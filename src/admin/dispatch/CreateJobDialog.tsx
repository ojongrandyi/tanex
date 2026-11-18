// New delivery job from the dispatch board (DISPATCH_SPEC §7: phone and walk-in orders). Same fields
// as the public booking form plus price override (with a reason), cash on delivery, who pays, the
// courier collecting the fee and an optional 4-digit delivery code. The rate-sheet price is checked
// as the form changes (POST /api/dispatch/quote, the same pricing the server applies on create);
// with no matching rate the price must be set by hand. The server validates everything again.
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { IamDialog } from '../components/IamDialog';
import { JOB_SCOPES, VEHICLE_LABELS, VEHICLE_TYPES, type JobScope, type VehicleType } from '../../shared/dispatchStatus';
import { SIZE_CLASSES, SIZE_CLASS_LABELS, type SizeClass } from '../../shared/localPricing';
import { PinPicker, type Pin } from './PinPicker';
import { boardApi, type BoardCity, type BoardZone, type DispatchJob, type PlaceInput, type QuoteResult } from './boardApi';
import { BOARD_TEXT, boardErrorText } from './boardStrings';
import { money } from './boardFormat';
import { consoleLang } from '../i18n/consoleText';

const T = BOARD_TEXT;
const C = BOARD_TEXT.create;

interface PlaceState { cityId: string; zoneId: string; landmark: string; directions: string; name: string; phone: string; pin: Pin; showPin: boolean }
const emptyPlace = (cityId = ''): PlaceState => ({ cityId, zoneId: '', landmark: '', directions: '', name: '', phone: '', pin: { lat: null, lng: null }, showPin: false });

const toInput = (p: PlaceState): PlaceInput => ({
  cityId: p.cityId, zoneId: p.zoneId || null, landmark: p.landmark.trim(), directions: p.directions.trim() || null,
  lat: p.pin.lat, lng: p.pin.lng, contactName: p.name.trim(), contactPhone: p.phone.trim(),
});

const parseAmount = (s: string): number | null => {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/** Same default as the server (server/dispatch/jobs.ts defaultVehicle). */
function autoVehicle(scope: JobScope, pickupCity: string, dropoffCity: string, size: string): VehicleType {
  if (scope === 'INTERCITY' || (pickupCity && dropoffCity && pickupCity !== dropoffCity)) return 'TRUCK';
  return size === 'LARGE' ? 'VAN' : 'BIKE';
}

const PlaceFields: React.FC<{
  legend: string; nameLabel: string; phoneLabel: string; value: PlaceState; onChange: (p: PlaceState) => void;
  cities: BoardCity[]; zones: BoardZone[]; cityLocked?: boolean;
}> = ({ legend, nameLabel, phoneLabel, value, onChange, cities, zones, cityLocked }) => {
  const set = (patch: Partial<PlaceState>) => onChange({ ...value, ...patch });
  const cityZones = zones.filter((z) => z.cityId === value.cityId && z.isActive);
  const city = cities.find((c) => c.id === value.cityId);
  const zone = cityZones.find((z) => z.id === value.zoneId);
  const near: Pin = zone && zone.lat !== null ? { lat: zone.lat, lng: zone.lng } : { lat: city?.lat ?? null, lng: city?.lng ?? null };
  return (
    <fieldset className="tx-board-fieldset">
      <legend>{legend}</legend>
      <div className="tx-iam-form-row">
        <label className="tx-iam-field">
          <span>{C.city}</span>
          <select value={value.cityId} required disabled={cityLocked} onChange={(e) => set({ cityId: e.target.value, zoneId: '' })}>
            <option value="">{C.chooseCity}</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="tx-iam-field">
          <span>{C.area}</span>
          <select value={value.zoneId} onChange={(e) => set({ zoneId: e.target.value })} disabled={!value.cityId}>
            <option value="">{C.noArea}</option>
            {cityZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
      </div>
      <label className="tx-iam-field">
        <span>{C.landmark}</span>
        <input type="text" maxLength={200} value={value.landmark} onChange={(e) => set({ landmark: e.target.value })} />
        <small>{C.landmarkHint}</small>
      </label>
      <label className="tx-iam-field">
        <span>{C.directions}</span>
        <textarea rows={2} maxLength={500} value={value.directions} onChange={(e) => set({ directions: e.target.value })} />
      </label>
      <div className="tx-iam-form-row">
        <label className="tx-iam-field">
          <span>{nameLabel}</span>
          <input type="text" maxLength={80} required autoComplete="off" value={value.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="tx-iam-field">
          <span>{phoneLabel}</span>
          <input type="tel" required autoComplete="off" value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
          <small>{C.phoneHint}</small>
        </label>
      </div>
      <button type="button" className="tx-iam-btn small" aria-expanded={value.showPin} onClick={() => set({ showPin: !value.showPin })}>
        {value.showPin ? C.hidePin : C.showPin}
      </button>
      {value.showPin && <PinPicker value={value.pin} onChange={(pin) => set({ pin })} near={near} />}
    </fieldset>
  );
};

export const CreateJobDialog: React.FC<{
  cities: BoardCity[];
  zones: BoardZone[];
  onClose: () => void;
  onCreated: (job: DispatchJob) => void;
}> = ({ cities: allCities, zones, onClose, onCreated }) => {
  const cities = useMemo(() => allCities.filter((c) => c.isActive), [allCities]);
  const firstCity = cities.length === 1 ? cities[0].id : '';
  const [scope, setScope] = useState<JobScope>('LOCAL');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [pickup, setPickup] = useState<PlaceState>(() => emptyPlace(firstCity));
  const [dropoff, setDropoff] = useState<PlaceState>(() => emptyPlace(firstCity));
  const [size, setSize] = useState<SizeClass | ''>('');
  const [weight, setWeight] = useState('');
  const [item, setItem] = useState('');
  const [express, setExpress] = useState(false);
  const [scheduled, setScheduled] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType | ''>('');
  const [payer, setPayer] = useState<'SENDER' | 'RECIPIENT'>('SENDER');
  const [cod, setCod] = useState('');
  const [collectFee, setCollectFee] = useState(false);
  const [code, setCode] = useState('');
  const [locale, setLocale] = useState<'en' | 'fr'>('en');
  const [byHand, setByHand] = useState(false);
  const [price, setPrice] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [quote, setQuote] = useState<QuoteResult | 'checking' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const local = scope === 'LOCAL';
  const sameCity = !!pickup.cityId && pickup.cityId === dropoff.cityId;
  const weightNum = parseAmount(weight);
  // A local job keeps the drop-off in the pickup city.
  useEffect(() => {
    if (local && dropoff.cityId !== pickup.cityId) setDropoff((d) => ({ ...d, cityId: pickup.cityId, zoneId: '' }));
  }, [local, pickup.cityId, dropoff.cityId]);

  // Rate-sheet price, checked shortly after the inputs that decide it change.
  const quoteReady = !!pickup.cityId && !!dropoff.cityId && (sameCity ? !!size : weightNum !== null && weightNum > 0);
  useEffect(() => {
    if (!quoteReady) { setQuote(null); return; }
    setQuote('checking');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      boardApi.quote({
        pickup: { cityId: pickup.cityId, zoneId: pickup.zoneId || null },
        dropoff: { cityId: dropoff.cityId, zoneId: dropoff.zoneId || null },
        sizeClass: size || null, weightKg: weightNum && weightNum > 0 ? weightNum : null, isExpress: express,
      }).then((q) => { if (!cancelled) setQuote(q); })
        .catch(() => { if (!cancelled) setQuote(null); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [quoteReady, pickup.cityId, pickup.zoneId, dropoff.cityId, dropoff.zoneId, size, weightNum, express]);

  const noRate = quote !== null && quote !== 'checking' && !quote.ok;
  const handPriced = byHand || noRate;
  const auto = autoVehicle(scope, pickup.cityId, dropoff.cityId, size);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fail = (msg: string) => { setError(msg); return; };
    if (!pickup.cityId || !dropoff.cityId) return fail(C.chooseCity);
    const priceNum = parseAmount(price);
    const codNum = parseAmount(cod);
    if (handPriced) {
      if (priceNum === null || Number.isNaN(priceNum) || priceNum < 0) return fail(T.errors.INVALID_PRICE);
      if (!priceReason.trim()) return fail(T.errors.REASON_REQUIRED);
    }
    if (codNum !== null && (Number.isNaN(codNum) || codNum < 0)) return fail(T.errors.INVALID_COD);
    if (weight.trim() && (weightNum === null || Number.isNaN(weightNum) || weightNum <= 0)) return fail(T.errors.INVALID_WEIGHT);
    if (code.trim() && !/^\d{4}$/.test(code.trim())) return fail(T.errors.INVALID_DELIVERY_CODE);
    const scheduledTs = scheduled ? new Date(scheduled).getTime() : null;
    setBusy(true);
    setError(null);
    try {
      const job = await boardApi.create({
        scope,
        ...(scope === 'FIRST_MILE' || scope === 'LAST_MILE' ? { trackingNumber: trackingNumber.trim().toUpperCase() } : {}),
        pickup: toInput(pickup),
        dropoff: toInput(dropoff),
        sizeClass: size || null,
        weightKg: weightNum && weightNum > 0 ? weightNum : null,
        itemDescription: item.trim() || null,
        isExpress: express,
        scheduledForTs: scheduledTs && Number.isFinite(scheduledTs) ? scheduledTs : null,
        ...(vehicle ? { vehicleRequired: vehicle } : {}),
        ...(handPriced ? { price: priceNum!, priceReason: priceReason.trim() } : {}),
        payer,
        codAmount: codNum,
        collectDeliveryFee: collectFee,
        deliveryCode: code.trim() || null,
        notifyLocale: locale,
      });
      onCreated(job);
    } catch (err) {
      setError(boardErrorText(err));
      setBusy(false);
    }
  };

  if (cities.length === 0) {
    return (
      <IamDialog title={C.title} onClose={onClose}>
        <p className="tx-iam-muted">{C.noCities}</p>
        <div className="tx-iam-dialog-actions"><button type="button" className="tx-iam-btn" onClick={onClose}>{T.close}</button></div>
      </IamDialog>
    );
  }

  return (
    <IamDialog title={C.title} onClose={onClose}>
      <form className="tx-iam-form tx-board-create" onSubmit={submit} noValidate>
        <p className="tx-iam-hint">{C.intro}</p>
        <label className="tx-iam-field">
          <span>{C.scope}</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as JobScope)}>
            {JOB_SCOPES.map((s) => <option key={s} value={s}>{C.scopes[s]}</option>)}
          </select>
        </label>
        {(scope === 'FIRST_MILE' || scope === 'LAST_MILE') && (
          <label className="tx-iam-field">
            <span>{C.trackingNumber}</span>
            <input type="text" className="font-mono" maxLength={20} required value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())} />
          </label>
        )}

        <PlaceFields legend={C.pickup} nameLabel={C.senderName} phoneLabel={C.senderPhone} value={pickup} onChange={setPickup}
          cities={cities} zones={zones} />
        <PlaceFields legend={C.dropoff} nameLabel={C.recipientName} phoneLabel={C.recipientPhone} value={dropoff} onChange={setDropoff}
          cities={cities} zones={zones} cityLocked={local} />

        <fieldset className="tx-board-fieldset">
          <legend>{C.parcel}</legend>
          <div className="tx-iam-form-row">
            <label className="tx-iam-field">
              <span>{C.size}</span>
              <select value={size} required={local} onChange={(e) => setSize(e.target.value as SizeClass | '')}>
                <option value="">{C.chooseSize}</option>
                {SIZE_CLASSES.map((s) => <option key={s} value={s}>{SIZE_CLASS_LABELS[s][consoleLang()]}</option>)}
              </select>
            </label>
            <label className="tx-iam-field">
              <span>{C.weight}</span>
              <input type="text" inputMode="decimal" required={scope === 'INTERCITY'} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
          </div>
          <label className="tx-iam-field">
            <span>{C.item}</span>
            <input type="text" maxLength={200} value={item} onChange={(e) => setItem(e.target.value)} />
          </label>
          <div className="tx-iam-form-row">
            <label className="tx-iam-field">
              <span>{C.scheduled}</span>
              <input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </label>
            <label className="tx-iam-field">
              <span>{C.vehicle}</span>
              <select value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleType | '')}>
                <option value="">{C.vehicleAuto(VEHICLE_LABELS[auto][consoleLang()])}</option>
                {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{VEHICLE_LABELS[v][consoleLang()]}</option>)}
              </select>
            </label>
          </div>
          <label className="tx-iam-check">
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
            <span>{C.express}</span>
          </label>
        </fieldset>

        <fieldset className="tx-board-fieldset">
          <legend>{C.payment}</legend>
          <div className="tx-board-quote" role="status" aria-live="polite">
            {quote === null && <span className="tx-iam-muted">{C.quoteNeeds}</span>}
            {quote === 'checking' && <span className="tx-iam-muted">{C.quoteChecking}</span>}
            {quote !== null && quote !== 'checking' && (quote.ok
              ? <strong>{C.quote(money(quote.price, quote.currency))}</strong>
              : <span>{quote.reason === 'NO_EXPRESS_RATE' ? C.noExpressQuote : C.noQuote}</span>)}
          </div>
          {!noRate && (
            <label className="tx-iam-check">
              <input type="checkbox" checked={byHand} onChange={(e) => setByHand(e.target.checked)} />
              <span>{C.byHand}</span>
            </label>
          )}
          {handPriced && (
            <div className="tx-iam-form-row">
              <label className="tx-iam-field">
                <span>{C.price}</span>
                <input type="text" inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label className="tx-iam-field">
                <span>{C.priceReason}</span>
                <input type="text" maxLength={500} required value={priceReason} onChange={(e) => setPriceReason(e.target.value)} />
              </label>
            </div>
          )}
          <div className="tx-iam-form-row">
            <label className="tx-iam-field">
              <span>{C.payer}</span>
              <select value={payer} onChange={(e) => setPayer(e.target.value as 'SENDER' | 'RECIPIENT')}>
                <option value="SENDER">{T.drawer.payers.SENDER}</option>
                <option value="RECIPIENT">{T.drawer.payers.RECIPIENT}</option>
              </select>
            </label>
            <label className="tx-iam-field">
              <span>{C.cod}</span>
              <input type="text" inputMode="numeric" value={cod} onChange={(e) => setCod(e.target.value)} />
              <small>{C.codHint}</small>
            </label>
          </div>
          <label className="tx-iam-check">
            <input type="checkbox" checked={collectFee} onChange={(e) => setCollectFee(e.target.checked)} />
            <span>{C.collectFee}</span>
          </label>
          <div className="tx-iam-form-row">
            <label className="tx-iam-field">
              <span>{C.deliveryCode}</span>
              <input type="text" inputMode="numeric" maxLength={4} autoComplete="off" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              <small>{C.deliveryCodeHint}</small>
            </label>
            <label className="tx-iam-field">
              <span>{C.notifyLocale}</span>
              <select value={locale} onChange={(e) => setLocale(e.target.value as 'en' | 'fr')}>
                <option value="en">{T.drawer.languages.en}</option>
                <option value="fr">{T.drawer.languages.fr}</option>
              </select>
            </label>
          </div>
        </fieldset>

        {error && <div className="tx-iam-notice error" role="alert"><AlertCircle size={14} aria-hidden="true" /><span>{error}</span></div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? T.saving : C.submit}</button>
        </div>
      </form>
    </IamDialog>
  );
};
