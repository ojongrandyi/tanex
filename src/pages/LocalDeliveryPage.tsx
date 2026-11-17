// Local delivery booking (/local-delivery, /fr/livraison-locale; DISPATCH_SPEC §8, CONTENT §7.5; G.6).
// One form in five numbered parts and a summary with the live price. The price is the admin's rate
// for the city, areas, size and express (POST /api/local-delivery/quote); with no rate the form says
// "We'll confirm your price". Booking creates a TX shipment and a REQUESTED job; the success screen
// gives the tracking ID and a WhatsApp link that shares tracking with the recipient.
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Button, Checkbox, Input, Radio, Select } from '../components/ui';
import { Link } from '../router/Link';
import { pagePath } from '../router/routes';
import { useApiErrorText, useAreaT, useLocale } from '../i18n/I18nProvider';
import { formatMoney } from '../i18n/format';
import { useCompanyContact } from '../utils/useCompanyContact';
import { normalizePhone } from '../shared/identifier';
import { SIZE_CLASSES, type SizeClass } from '../shared/localPricing';
import { buildWhatsAppLink } from '../shared/whatsapp';
import { logBookingShareTap } from '../services/whatsappLog';
import { localDeliveryApi, type BookingResult, type LocalQuote, type PublicCity } from '../services/localDeliveryApi';
import type { MapPin as Pin } from './localDelivery/PinMap';
import './LocalDeliveryPage.css';

// The map (and Leaflet) loads only when a customer opens "Pin on map".
const PinMap = lazy(() => import('./localDelivery/PinMap').then((m) => ({ default: m.PinMap })));

interface LocalDeliveryPageProps {
  onNavigate: (page: string, param?: string) => void;
}

/** Area select value for "My area isn't listed": no area, the landmark says where. */
const OTHER_AREA = '__other';
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const DAY_MS = 86_400_000;
/** Stand-in for the tracking ID, to split "Your tracking ID is {id}." around the styled ID. */
const ID_MARK = '\u0001';

interface PlaceState {
  zone: string;
  landmark: string;
  name: string;
  phone: string;
  pin: Pin | null;
  pinOpen: boolean;
}

const emptyPlace = (): PlaceState => ({ zone: '', landmark: '', name: '', phone: '', pin: null, pinOpen: false });

type ErrorKey = 'city' | 'pickupPlace' | 'pickupName' | 'pickupPhone' | 'dropoffPlace' | 'dropoffName' | 'dropoffPhone'
  | 'size' | 'cod' | 'time' | 'email';

type QuoteState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; quote: LocalQuote } | { kind: 'error' };

/** "2026-11-16T14:30" for a datetime-local input, in the browser's time. */
function localInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const zoneIdOf = (zone: string) => (zone && zone !== OTHER_AREA ? zone : null);

// onNavigate is part of the page contract (App.tsx); links here route by themselves.
export const LocalDeliveryPage: React.FC<LocalDeliveryPageProps> = () => {
  const t = useAreaT('localDelivery');
  const locale = useLocale();
  const apiErrorText = useApiErrorText();
  const { phone: officePhone, phoneHref, whatsapp } = useCompanyContact();

  const [cities, setCities] = useState<PublicCity[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  const [shareOpened, setShareOpened] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    localDeliveryApi.areas()
      .then((list) => {
        if (!alive) return;
        setCities(list);
        // One city: chosen for the customer.
        if (list.length === 1) setCityId((c) => c || list[0].id);
      })
      .catch(() => alive && setLoadFailed(true));
    return () => { alive = false; };
  }, [loadTick]);

  const [cityId, setCityId] = useState('');
  const [pickup, setPickup] = useState<PlaceState>(emptyPlace);
  const [dropoff, setDropoff] = useState<PlaceState>(emptyPlace);
  const [size, setSize] = useState<SizeClass | ''>('');
  const [item, setItem] = useState('');
  const [express, setExpress] = useState(false);
  const [payer, setPayer] = useState<'SENDER' | 'RECIPIENT'>('SENDER');
  const [codOn, setCodOn] = useState(false);
  const [codAmount, setCodAmount] = useState('');
  const [time, setTime] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<(BookingResult & { recipientName: string; recipientPhone: string; senderName: string }) | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const city = cities?.find((c) => c.id === cityId) ?? null;
  const zones = city?.zones ?? [];

  // A new city clears the areas and pins chosen for the old one.
  const chooseCity = (id: string) => {
    setCityId(id);
    setPickup((p) => ({ ...p, zone: '', pin: null }));
    setDropoff((p) => ({ ...p, zone: '', pin: null }));
  };

  // ---- Live price ----
  const [quote, setQuote] = useState<QuoteState>({ kind: 'idle' });
  const pickupZone = zoneIdOf(pickup.zone);
  const dropoffZone = zoneIdOf(dropoff.zone);
  useEffect(() => {
    if (!cityId || !size) {
      setQuote({ kind: 'idle' });
      return;
    }
    let alive = true;
    setQuote({ kind: 'loading' });
    // Small pause so choosing several fields in a row asks once.
    const timer = window.setTimeout(() => {
      localDeliveryApi.quote({ cityId, pickupZoneId: pickupZone, dropoffZoneId: dropoffZone, sizeClass: size, isExpress: express })
        .then((q) => alive && setQuote({ kind: 'done', quote: q }))
        .catch(() => alive && setQuote({ kind: 'error' }));
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [cityId, pickupZone, dropoffZone, size, express]);

  const priceText = useMemo(() => {
    if (quote.kind === 'idle') return t('book.price.choose');
    if (quote.kind === 'loading') return t('book.price.checking');
    if (quote.kind === 'done' && quote.quote.priced) {
      return t('book.price.priced', { amount: formatMoney(quote.quote.price, quote.quote.currency, locale) });
    }
    return size === 'LARGE' ? t('book.price.large') : t('book.price.noRate');
  }, [quote, size, t, locale]);

  // ---- Checks and submit ----
  const validate = (): Partial<Record<ErrorKey, string>> => {
    const e: Partial<Record<ErrorKey, string>> = {};
    if (!cityId) e.city = t('book.errors.city');
    const place = (p: PlaceState, which: 'pickup' | 'dropoff') => {
      if (!zoneIdOf(p.zone) && !p.landmark.trim()) e[`${which}Place`] = t('book.errors.place');
      if (!p.name.trim()) e[`${which}Name`] = which === 'pickup' ? t('book.errors.name') : t('book.errors.recipientName');
      if (!normalizePhone(p.phone)) e[`${which}Phone`] = which === 'pickup' ? t('book.errors.phone') : t('book.errors.recipientPhone');
    };
    place(pickup, 'pickup');
    place(dropoff, 'dropoff');
    if (!size) e.size = t('book.errors.size');
    if (codOn) {
      const n = Number(codAmount.replace(/[\s,]/g, ''));
      if (!Number.isFinite(n) || n <= 0) e.cod = t('book.errors.cod');
    }
    if (time) {
      const ts = new Date(time).getTime();
      const now = Date.now();
      if (!Number.isFinite(ts) || ts < now - 10 * 60_000 || ts > now + 30 * DAY_MS) e.time = t('book.errors.time');
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = t('book.errors.email');
    return e;
  };

  const SERVER_CODES: Record<string, Parameters<typeof t>[0]> = {
    INVALID_CITY: 'book.errors.city',
    INVALID_AREA: 'book.errors.place',
    INVALID_SIZE: 'book.errors.size',
    INVALID_TIME: 'book.errors.time',
    INVALID_EMAIL: 'book.errors.email',
    INVALID_COD: 'book.errors.cod',
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (sending) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(t('book.errors.fix'));
      window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setFormError('');
    setSending(true);
    const place = (p: PlaceState) => ({
      zoneId: zoneIdOf(p.zone),
      landmark: p.landmark.trim(),
      contactName: p.name.trim(),
      contactPhone: p.phone.trim(),
      ...(p.pin ? { lat: p.pin.lat, lng: p.pin.lng } : {}),
    });
    try {
      const result = await localDeliveryApi.book({
        cityId,
        pickup: place(pickup),
        dropoff: place(dropoff),
        sizeClass: size as SizeClass,
        itemDescription: item.trim() || null,
        isExpress: express,
        payer,
        codAmount: codOn ? Number(codAmount.replace(/[\s,]/g, '')) : null,
        scheduledForTs: time ? new Date(time).getTime() : null,
        email: email.trim() || null,
        locale,
      });
      setDone({ ...result, recipientName: dropoff.name.trim(), recipientPhone: dropoff.phone.trim(), senderName: pickup.name.trim() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      setFormError(SERVER_CODES[code] ? t(SERVER_CODES[code]) : apiErrorText(err, t('book.errors.submit')));
    } finally {
      setSending(false);
    }
  };

  const bookAnother = () => {
    setDone(null);
    setShareOpened(false);
    setPickup(emptyPlace());
    setDropoff(emptyPlace());
    setSize('');
    setItem('');
    setExpress(false);
    setPayer('SENDER');
    setCodOn(false);
    setCodAmount('');
    setTime('');
    setErrors({});
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Parts ----
  const hero = (
    <section className="tx-ld__hero tx-dark" aria-labelledby="ld-title">
      <div className="tx-ld__wrap">
        <p className="tx-eyebrow">{t('book.eyebrow')}</p>
        <h1 className="tx-h1" id="ld-title">{t('book.title')}</h1>
        <p className="tx-lead">{t('book.sub')}</p>
      </div>
    </section>
  );

  if (done) {
    const link = `${window.location.origin}${pagePath('track-result', done.trackingNumber, locale)}`;
    const wa = buildWhatsAppLink(done.recipientPhone, 'local.share_recipient',
      { name: done.recipientName, sender: done.senderName, link }, locale);
    // The ID sits inside the sentence in both languages: split the text around it.
    const [idBefore, idAfter = ''] = t('book.success.id', { id: ID_MARK }).split(ID_MARK);
    return (
      <div className="tx-ld">
        {hero}
        <section className="tx-ld__main">
          <div className="tx-ld__wrap">
            <div className="tx-ld__card tx-ld__done" role="status">
              <p className="tx-ld__done-title"><Check aria-hidden="true" />{t('book.success.title')}</p>
              <p>{idBefore}<strong className="tx-ld__id">{done.trackingNumber}</strong>{idAfter}</p>
              <p className="tx-ld__done-price">
                {done.priced && done.price !== null
                  ? t('book.price.priced', { amount: formatMoney(done.price, done.currency, locale) })
                  : t('book.price.noRate')}
              </p>
              <div className="tx-ld__done-actions">
                <Link page="track-result" param={done.trackingNumber} className="tx-btn tx-btn--primary">{t('book.success.track')}</Link>
                {wa && (
                  <a className="tx-btn tx-btn--secondary" href={wa} target="_blank" rel="noopener noreferrer"
                    onClick={() => { setShareOpened(true); logBookingShareTap(done.trackingNumber); }}>
                    <MessageCircle aria-hidden="true" />{t('book.success.whatsapp')}
                  </a>
                )}
                <Button variant="ghost" onClick={bookAnother}>{t('book.success.again')}</Button>
              </div>
              {shareOpened && <p className="tx-ld__hint" aria-live="polite">{t('book.success.whatsappOpened')}</p>}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const placeFields = (which: 'pickup' | 'dropoff') => {
    const p = which === 'pickup' ? pickup : dropoff;
    const set = which === 'pickup' ? setPickup : setDropoff;
    const patch = (v: Partial<PlaceState>) => set((s) => ({ ...s, ...v }));
    const zone = zones.find((z) => z.id === p.zone);
    const near = zone && zone.lat !== null ? zone : city;
    return (
      <>
        <div className="tx-ld__row">
          <Select label={t('book.fields.area')} value={p.zone} disabled={!city}
            error={errors[`${which}Place`]} onChange={(e) => patch({ zone: e.target.value })}>
            <option value="">{t('book.fields.areaPlaceholder')}</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            <option value={OTHER_AREA}>{t('book.fields.areaOther')}</option>
          </Select>
          <Input label={t('book.fields.landmark')} hint={t('book.fields.landmarkHint')} value={p.landmark} maxLength={200}
            onChange={(e) => patch({ landmark: e.target.value })} autoComplete="off" />
        </div>
        <div className="tx-ld__row">
          <Input label={which === 'pickup' ? t('book.fields.contactName') : t('book.fields.recipientName')} value={p.name} maxLength={80}
            required error={errors[`${which}Name`]} onChange={(e) => patch({ name: e.target.value })}
            autoComplete={which === 'pickup' ? 'name' : 'off'} />
          <Input label={which === 'pickup' ? t('book.fields.contactPhone') : t('book.fields.recipientPhone')} type="tel" value={p.phone}
            maxLength={30} required error={errors[`${which}Phone`]} onChange={(e) => patch({ phone: e.target.value })}
            autoComplete={which === 'pickup' ? 'tel' : 'off'} inputMode="tel" />
        </div>
        <div className="tx-ld__pin">
          <span className="tx-ld__pin-title"><MapPin aria-hidden="true" />{t('book.pin.title')}</span>
          {!p.pinOpen ? (
            <Button type="button" variant="ghost" size="sm" disabled={!city} onClick={() => patch({ pinOpen: true })}>{t('book.pin.add')}</Button>
          ) : (
            <>
              <p className="tx-ld__hint">{p.pin ? t('book.pin.set') : t('book.pin.hint')}</p>
              <Suspense fallback={<div className="tx-ld-pinmap" />}>
                <PinMap value={p.pin} onChange={(pin) => patch({ pin })} near={near ?? null}
                  label={which === 'pickup' ? t('book.pin.mapLabelPickup') : t('book.pin.mapLabelDropoff')} />
              </Suspense>
              <Button type="button" variant="ghost" size="sm" onClick={() => patch({ pin: null, pinOpen: false })}>{t('book.pin.remove')}</Button>
            </>
          )}
        </div>
      </>
    );
  };

  let body: React.ReactNode;
  if (loadFailed) {
    body = (
      <div className="tx-ld__card" role="alert">
        <p>{t('book.loadError')}</p>
        <Button variant="secondary" onClick={() => setLoadTick((n) => n + 1)}>{t('book.retry')}</Button>
      </div>
    );
  } else if (!cities) {
    body = <div className="tx-ld__card tx-ld__loading" aria-busy="true" />;
  } else if (cities.length === 0) {
    // No delivery city is open in the console yet: phone and WhatsApp instead of a form.
    body = (
      <div className="tx-ld__card tx-ld__unavailable">
        <p>{t('book.unavailable')}</p>
        <div className="tx-ld__done-actions">
          {phoneHref && <a className="tx-btn tx-btn--secondary" href={phoneHref}><Phone aria-hidden="true" />{officePhone}</a>}
          {whatsapp && (
            <a className="tx-btn tx-btn--ghost" href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <form ref={formRef} className="tx-ld__grid" onSubmit={submit} noValidate aria-labelledby="ld-title">
        <div className="tx-ld__parts">
          <fieldset className="tx-ld__card tx-ld__part">
            <legend className="tx-ld__legend">{t('book.steps.city')}</legend>
            <Select label={t('book.fields.city')} value={cityId} required error={errors.city} onChange={(e) => chooseCity(e.target.value)}>
              <option value="" disabled>{t('book.fields.cityPlaceholder')}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </fieldset>

          <fieldset className="tx-ld__card tx-ld__part">
            <legend className="tx-ld__legend">{t('book.steps.pickup')}</legend>
            {placeFields('pickup')}
          </fieldset>

          <fieldset className="tx-ld__card tx-ld__part">
            <legend className="tx-ld__legend">{t('book.steps.dropoff')}</legend>
            {placeFields('dropoff')}
          </fieldset>

          <fieldset className="tx-ld__card tx-ld__part">
            <legend className="tx-ld__legend">{t('book.steps.parcel')}</legend>
            <fieldset className="tx-ld__choices" aria-describedby={errors.size ? 'ld-size-error' : undefined}>
              <legend className="tx-ld__choices-label">{t('book.fields.size')}</legend>
              {SIZE_CLASSES.map((s) => (
                <Radio key={s} name="ld-size" value={s} checked={size === s} error={!!errors.size}
                  onChange={() => setSize(s)} label={t(`book.fields.sizes.${s}`)} />
              ))}
              {errors.size && <p className="tx-error" id="ld-size-error">{errors.size}</p>}
            </fieldset>
            <Input label={t('book.fields.item')} optionalText={t('book.fields.optional')} value={item} maxLength={200}
              onChange={(e) => setItem(e.target.value)} />
            <Checkbox label={t('book.fields.express')} checked={express} onChange={(e) => setExpress(e.target.checked)} />
          </fieldset>

          <fieldset className="tx-ld__card tx-ld__part">
            <legend className="tx-ld__legend">{t('book.steps.payment')}</legend>
            <fieldset className="tx-ld__choices">
              <legend className="tx-ld__choices-label">{t('book.fields.payer')}</legend>
              <Radio name="ld-payer" value="SENDER" checked={payer === 'SENDER'} onChange={() => setPayer('SENDER')} label={t('book.fields.payerSender')} />
              <Radio name="ld-payer" value="RECIPIENT" checked={payer === 'RECIPIENT'} onChange={() => setPayer('RECIPIENT')} label={t('book.fields.payerRecipient')} />
            </fieldset>
            <Checkbox label={t('book.fields.cod')} checked={codOn} onChange={(e) => setCodOn(e.target.checked)} />
            {codOn && (
              <Input label={`${t('book.fields.codAmount')} (FCFA)`} value={codAmount} inputMode="numeric" maxLength={12}
                error={errors.cod} onChange={(e) => setCodAmount(e.target.value)} />
            )}
            <div className="tx-ld__row">
              <Input label={t('book.fields.time')} optionalText={t('book.fields.optional')} hint={t('book.fields.timeHint')} type="datetime-local"
                value={time} min={localInputValue(Date.now())} max={localInputValue(Date.now() + 30 * DAY_MS)}
                error={errors.time} onChange={(e) => setTime(e.target.value)} />
              <Input label={t('book.fields.email')} type="email" value={email} maxLength={254} autoComplete="email"
                error={errors.email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </fieldset>
        </div>

        <aside className="tx-ld__summary" aria-labelledby="ld-summary-title">
          <div className="tx-ld__card">
            <h2 className="tx-ld__legend" id="ld-summary-title">{t('book.steps.summary')}</h2>
            <p className="tx-ld__price" aria-live="polite">{priceText}</p>
            {formError && <p className="tx-error tx-ld__form-error" role="alert">{formError}</p>}
            <Button type="submit" size="lg" block disabled={sending}>{sending ? t('book.sending') : t('book.submit')}</Button>
          </div>
        </aside>
      </form>
    );
  }

  return (
    <div className="tx-ld">
      {hero}
      <section className="tx-ld__main" aria-label={t('book.title')}>
        <div className="tx-ld__wrap">{body}</div>
      </section>
    </div>
  );
};
