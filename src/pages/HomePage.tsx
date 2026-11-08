import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bike, Camera, Check, Clock, Mail, MapPin, MessageCircle, Navigation, Phone, Plane, Plus, Search,
  Ship, TrainFront, Truck, Users, Wallet, Warehouse,
} from 'lucide-react';
import { Barcode } from '../components/Barcode';
import { HomeNetworkMap } from '../components/HomeNetworkMap';
import { Button, Input, Textarea } from '../components/ui';
import { Link } from '../router/Link';
import { api } from '../services/api';
import {
  EMAIL, LOGO_MARK, LOGO_MARK_SIZE, OFFICES, PHONE, PHONE_2, TRACKING_ID_EXAMPLE, WHATSAPP, formatPhone,
} from '../config/brand';
import { HUB_CODE, NETWORK_POINTS, gatewayName, getGateway, formatGatewayTime, type Gateway } from '../data/gateways';
import { useApiErrorText, useAreaT, useLocale } from '../i18n/I18nProvider';
import { primeArea } from '../i18n/runtime';
import { formatMoney, formatOpeningHoursIn } from '../i18n/format';
import homeEn from '../i18n/en/home';
import { useNow } from '../utils/useNow';
import { ArrivalDoor, BikeHero, HeroGlobe, JourneySprite, Mountain, ParcelLabel, ParkedBike, ServicesRoad, TruckRoute, WorldGlobe } from './home/JourneyArt';
import { RouteRail, type RailChapter } from './home/RouteRail';
import './HomePage.css';

// Homepage (CONTENT §2.1–§2.10, the owner's order), laid out for the Journey (MOTION_3D_SPEC
// §5–§8) as approved in C.1 (design/home.html). Every section is a chapter with a stable id and
// data-chapter index; on desktop each chapter has a "lane" beside the text that alternates sides,
// where the 3D bike rides in phase H. Until then each lane holds a fixed-size SVG poster. Text
// blocks keep their own solid backgrounds, so contrast never depends on what's in the lane.

// English home text ships with the page: no dictionary round-trip before first paint.
primeArea('home', 'en', homeEn);

interface HomePageProps {
  onTrack: (trackingNumber: string) => void;
  onNavigate: (page: string, param?: string) => void;
}

// Owner flyer: Buea bike delivery "from 500 FCFA" (CLAUDE.md §2). Real prices live in the tariffs (G.2).
const BUEA_FROM_PRICE = 500;

// Where "Book a bike delivery" leads until the booking page exists (G.6): the local-delivery
// section of the Services page. One place to change when /local-delivery goes live.
const BIKE_BOOKING = { page: 'services', param: 'local-delivery' } as const;

// Blog section (CONTENT §2.9): the latest 3 posts in the page language. The public blog arrives
// with F.3; until then there are none and the section stays hidden. No sample posts.
interface HomePost { slug: string; title: string; excerpt: string }
const LATEST_POSTS: HomePost[] = [];

// Chapters of the Journey, in page order (MOTION_3D_SPEC §6). Ids are stable anchors.
const CHAPTER_IDS = ['door', 'services', 'in-town', 'city-to-city', 'world', 'label', 'contact', 'delivered'] as const;
const RAIL_KEYS = ['door', 'services', 'town', 'city', 'world', 'label', 'contact', 'delivered'] as const;

const SERVICE_CARDS = [
  { key: 'air', icon: Plane, param: 'air' },
  { key: 'maritime', icon: Ship, param: 'maritime' },
  { key: 'rail', icon: TrainFront, param: 'rail' },
  { key: 'road', icon: Truck, param: 'road' },
  { key: 'warehousing', icon: Warehouse, param: 'warehousing' },
  { key: 'local', icon: Bike, param: 'local-delivery' },
] as const;

const FAQ_KEYS = ['account', 'town', 'live', 'pay', 'international', 'language'] as const;

/** A headline with its one emphasised phrase (C.1). Either part may be empty in a language. */
const Headline: React.FC<{ start: string; em: string }> = ({ start, em }) => (
  <>
    {start}
    {start && em ? ' ' : ''}
    {em && <em className="tx-em">{em}</em>}
  </>
);

/** Light reveals (no motion library): sections below the fold fade up once as they enter. */
function useReveal(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    // Only hide what is still below the fold, so nothing already on screen blinks.
    const fold = window.innerHeight;
    const pending = targets.filter((t) => t.getBoundingClientRect().top > fold);
    pending.forEach((t) => t.classList.add('tx-reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    pending.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}

export const HomePage: React.FC<HomePageProps> = ({ onTrack, onNavigate }) => {
  const t = useAreaT('home');
  const locale = useLocale();
  const apiErrorText = useApiErrorText();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  // ---- Hero track field ----
  const [trackId, setTrackId] = useState('');
  const submitTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackId.trim();
    if (id) onTrack(id);
    else onNavigate('track');
  };

  // ---- Network map selection ----
  const [activeCode, setActiveCode] = useState(HUB_CODE);
  const active = getGateway(activeCode) ?? getGateway(HUB_CODE)!;
  const now = useNow();
  const activeTime = formatGatewayTime(active.timeZone, now);
  const countryName = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([locale === 'fr' ? 'fr' : 'en'], { type: 'region' });
      return (iso: string, fallback: string) => names.of(iso) ?? fallback;
    } catch {
      return (_iso: string, fallback: string) => fallback;
    }
  }, [locale]);
  const pointTitle = useCallback((g: Gateway) => `${gatewayName(g, locale)}, ${countryName(g.iso, g.country)}`, [locale, countryName]);
  const modeLabel = (m: Gateway['modes'][number]) => t(m === 'Air' ? 'network.modes.air' : m === 'Ocean' ? 'network.modes.ocean' : 'network.modes.road');

  // ---- Get in touch (reuses the contact API; the server issues the TX-TKT reference) ----
  const [form, setForm] = useState({ name: '', contact: '', message: '' });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const name = form.name.trim();
    const contact = form.contact.trim();
    const message = form.message.trim();
    if (!name || !contact || !message) {
      setFormError(t('contact.form.errorRequired'));
      return;
    }
    const isEmail = contact.includes('@');
    if (!isEmail && contact.replace(/\D/g, '').length < 6) {
      setFormError(t('contact.form.errorContact'));
      return;
    }
    setSending(true);
    setFormError('');
    try {
      const saved = await api.submitContactMessage({
        name,
        email: isEmail ? contact : '',
        phone: isEmail ? '' : contact,
        // Staff-facing (the console is English until phase I).
        subject: 'Home page message',
        priority: 'routine',
        message,
      });
      setReference(saved.id);
      setForm({ name: '', contact: '', message: '' });
    } catch (err) {
      setFormError(apiErrorText(err, t('contact.form.errorSend')));
    } finally {
      setSending(false);
    }
  };

  const hours = formatOpeningHoursIn(locale);
  const addressOf = (city: string) => {
    const office = OFFICES.find((o) => o.city === city);
    return office ? (locale === 'fr' ? office.addressFr : office.address) : '';
  };

  const railChapters: RailChapter[] = CHAPTER_IDS.map((id, i) => ({ id, label: t(`rail.chapters.${RAIL_KEYS[i]}`) }));

  return (
    <div className="tx-home" ref={rootRef}>
      <JourneySprite />
      <RouteRail chapters={railChapters} label={t('rail.label')} />

      {/* 0 · Hero: your door (CONTENT §2.1) */}
      <section className="tx-ch tx-ch--hero tx-dark" id="door" data-chapter="0" aria-labelledby="home-title" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro">
            <p className="tx-eyebrow">{t('hero.eyebrow')}</p>
            <h1 className="tx-display tx-home__h1" id="home-title">
              {t('hero.titleLine1')}{' '}
              <span className="tx-home__h1-l2"><em className="tx-em">{t('hero.titleLine2')}</em></span>
            </h1>
            <p className="tx-lead">{t('hero.sub')}</p>
            <form className="tx-home__track" onSubmit={submitTrack} role="search">
              <label className="tx-home__track-label" htmlFor="home-track">{t('hero.trackLabel')}</label>
              <div className="tx-track">
                <Search className="tx-track__icon" aria-hidden="true" />
                <input
                  id="home-track"
                  className="tx-track__input"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value.toUpperCase())}
                  placeholder={t('hero.trackPlaceholder', { example: TRACKING_ID_EXAMPLE })}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={14}
                />
                <Button type="submit" variant="primary">{t('hero.trackButton')}</Button>
              </div>
            </form>
          </div>
          <div className="tx-ch__lane tx-lane--hero" aria-hidden="true">
            <HeroGlobe />
          </div>
          <div className="tx-ch__rest">
            <div className="tx-home__hero-btns">
              <Link page="quote" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('hero.quote')}</Link>
              <Link page={BIKE_BOOKING.page} param={BIKE_BOOKING.param} onNavigate={onNavigate} className="tx-btn tx-btn--on-dark tx-btn--lg">{t('hero.bike')}</Link>
            </div>
            <ul className="tx-home__facts">
              <li><Check aria-hidden="true" />{t('hero.facts.live')}</li>
              <li><Check aria-hidden="true" />{t('hero.facts.photo')}</li>
              <li><Check aria-hidden="true" />{t('hero.facts.languages')}</li>
            </ul>
          </div>
        </div>
        <Mountain className="tx-home__mount" />
        <p className="tx-home__caption tx-home__hero-cap" aria-hidden="true">{t('hero.caption')}</p>
      </section>

      {/* 1 · Services (CONTENT §2.2): lane on the left, the road */}
      <section className="tx-ch tx-ch--lane-left tx-ch--wide-lane tx-ch--services" id="services" data-chapter="1" aria-labelledby="home-services" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro" data-reveal>
            <p className="tx-eyebrow">{t('services.eyebrow')}</p>
            <h2 className="tx-h1 tx-home__chap-h" id="home-services"><Headline start={t('services.titleStart')} em={t('services.titleEm')} /></h2>
            <p className="tx-lead">{t('services.intro')}</p>
          </div>
          <div className="tx-ch__lane tx-lane--road" aria-hidden="true">
            <ServicesRoad />
          </div>
          <div className="tx-ch__rest">
            <ul className="tx-home__cards">
              {SERVICE_CARDS.map(({ key, icon: Icon, param }) => {
                const isLocal = key === 'local';
                return (
                  <li key={key} className="tx-card tx-home__card" data-reveal>
                    <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                    <h3 className="tx-card__title">{t(`services.${key}.title`)}</h3>
                    <p className="tx-card__body">{t(`services.${key}.body`)}</p>
                    <Link
                      page={isLocal ? BIKE_BOOKING.page : 'services'}
                      param={isLocal ? BIKE_BOOKING.param : param}
                      onNavigate={onNavigate}
                      className="tx-link"
                    >
                      {isLocal ? t('services.local.cta') : t(`services.${key}.title`)}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* 2 · Bike delivery (CONTENT §2.3): dark, lane on the right */}
      <section className="tx-ch tx-ch--bike tx-dark" id="in-town" data-chapter="2" aria-labelledby="home-bike" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro" data-reveal>
            <p className="tx-eyebrow">{t('bike.eyebrow')}</p>
            <h2 className="tx-display tx-home__bike-h" id="home-bike"><Headline start={t('bike.titleStart')} em={t('bike.titleEm')} /></h2>
            <p className="tx-lead">{t('bike.body')}</p>
          </div>
          <div className="tx-ch__lane tx-lane--bike" aria-hidden="true">
            <span className="tx-home__orbit" />
            <BikeHero />
          </div>
          <div className="tx-ch__rest" data-reveal>
            <ol className="tx-home__steps" aria-label={t('bike.stepsLabel')}>
              <li className="tx-chip tx-chip--active">{t('bike.steps.picked')}</li>
              <li className="tx-chip tx-chip--outline">{t('bike.steps.way')}</li>
              <li className="tx-chip tx-chip--outline">{t('bike.steps.delivered')}</li>
            </ol>
            <p className="tx-home__price">
              {t('bike.priceStart')}{' '}
              <span className="tx-home__mono">{t('bike.priceAmount', { amount: formatMoney(BUEA_FROM_PRICE, 'XAF', locale) })}</span>
            </p>
            <ul className="tx-home__points">
              <li><span className="tx-home__ic" aria-hidden="true"><Users /></span>{t('bike.points.riders')}</li>
              <li><span className="tx-home__ic" aria-hidden="true"><Navigation /></span>{t('bike.points.live')}</li>
              <li><span className="tx-home__ic" aria-hidden="true"><Wallet /></span>{t('bike.points.pay')}</li>
              <li><span className="tx-home__ic" aria-hidden="true"><Camera /></span>{t('bike.points.photo')}</li>
            </ul>
            <div className="tx-home__cta-row">
              <Link page={BIKE_BOOKING.page} param={BIKE_BOOKING.param} onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('bike.cta')}</Link>
              <Link page="help" onNavigate={onNavigate} className="tx-link">{t('bike.pricing')}<ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · Truck delivery (CONTENT §2.4): cream, lane on the left */}
      <section className="tx-ch tx-ch--lane-left tx-ch--truck" id="city-to-city" data-chapter="3" aria-labelledby="home-truck" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro" data-reveal>
            <p className="tx-eyebrow">{t('truck.eyebrow')}</p>
            <h2 className="tx-h1 tx-home__chap-h" id="home-truck"><Headline start={t('truck.titleStart')} em={t('truck.titleEm')} /></h2>
            <p className="tx-lead">{t('truck.body')}</p>
          </div>
          <div className="tx-ch__lane tx-lane--truck" aria-hidden="true">
            <TruckRoute beyond={t('truck.beyond')} />
            <p className="tx-home__caption tx-home__lane-cap">{t('truck.caption')}</p>
          </div>
          <div className="tx-ch__rest" data-reveal>
            <ul className="tx-home__checks">
              <li><Check aria-hidden="true" />{t('truck.points.loads')}</li>
              <li><Check aria-hidden="true" />{t('truck.points.ends')}</li>
              <li><Check aria-hidden="true" />{t('truck.points.tracked')}</li>
            </ul>
            <Link page="quote" param="road" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('truck.cta')}</Link>
          </div>
        </div>
      </section>

      {/* 4 · Global network (CONTENT §2.5): dark, lane on the right, then the real map */}
      <section className="tx-ch tx-ch--world tx-dark" id="world" data-chapter="4" aria-labelledby="home-world" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro" data-reveal>
            <p className="tx-eyebrow">{t('network.eyebrow')}</p>
            <h2 className="tx-h1 tx-home__chap-h" id="home-world"><Headline start={t('network.titleStart')} em={t('network.titleEm')} /></h2>
            <p className="tx-lead">{t('network.intro')}</p>
          </div>
          <div className="tx-ch__lane tx-lane--world" aria-hidden="true">
            <WorldGlobe />
          </div>
          <div className="tx-ch__rest" data-reveal>
            <ul className="tx-home__legend">
              <li><span className="tx-home__lg-base" aria-hidden="true" />{t('network.legend.base')}</li>
              <li><span className="tx-home__lg-gw" aria-hidden="true" />{t('network.legend.gateway')}</li>
              <li><span className="tx-home__lg-lane" aria-hidden="true" />{t('network.legend.lane')}</li>
            </ul>
            <Link page="locations" onNavigate={onNavigate} className="tx-btn tx-btn--on-dark">{t('network.cta')}<ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="tx-ch__wrap tx-home__map">
          <HomeNetworkMap activeCode={activeCode} onSelectGateway={setActiveCode} label={t('network.mapLabel')} pointTitle={pointTitle} />
          <div className="tx-home__map-card">
            <label className="tx-home__map-pick">
              <span>{t('network.choose')}</span>
              <select value={activeCode} onChange={(e) => setActiveCode(e.target.value)}>
                {NETWORK_POINTS.map((g) => <option key={g.code} value={g.code}>{g.code} · {gatewayName(g, locale)}</option>)}
              </select>
            </label>
            <div aria-live="polite">
            <p className="tx-home__map-name">
              <span className="tx-home__mono">{active.code}</span> {gatewayName(active, locale)}
            </p>
            <p className="tx-home__map-meta">{countryName(active.iso, active.country)} · {active.modes.map(modeLabel).join(' · ')}</p>
            <p className="tx-home__map-meta">
              {t('network.localTime')}: <span className="tx-home__mono">{activeTime.time}</span> {activeTime.offset}
            </p>
            {active.kind === 'gateway' && (
              <Link page="contact" param={active.code} onNavigate={onNavigate} className="tx-link">{t('network.contactLane')}<ArrowRight aria-hidden="true" /></Link>
            )}
            </div>
          </div>
        </div>
      </section>

      {/* 5 · Smart labels (CONTENT §2.6): cream, lane on the left */}
      <section className="tx-ch tx-ch--lane-left tx-ch--labels" id="label" data-chapter="5" aria-labelledby="home-labels" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro" data-reveal>
            <p className="tx-eyebrow">{t('labels.eyebrow')}</p>
            <h2 className="tx-h1 tx-home__chap-h" id="home-labels"><Headline start={t('labels.titleStart')} em={t('labels.titleEm')} /></h2>
            <p className="tx-lead">{t('labels.body')}</p>
          </div>
          <div className="tx-ch__lane tx-lane--parcel" aria-hidden="true">
            <ParcelLabel />
            <span className="tx-home__scan" />
            <p className="tx-home__caption tx-home__lane-cap">{t('labels.caption', { id: TRACKING_ID_EXAMPLE })}</p>
          </div>
          <div className="tx-ch__rest" data-reveal>
            <ul className="tx-home__tiles">
              {(['id', 'pieces', 'live'] as const).map((k) => (
                <li key={k} className="tx-home__tile">
                  <b>{t(`labels.tiles.${k}.value`)}</b>
                  <span>{t(`labels.tiles.${k}.label`)}</span>
                </li>
              ))}
            </ul>
            <figure className="tx-home__label" aria-label={t('labels.demo.label')}>
              <div className="tx-home__label-head">
                <span>TANEX</span>
                <img src={LOGO_MARK} alt="" width={LOGO_MARK_SIZE} height={LOGO_MARK_SIZE} loading="lazy" decoding="async" />
              </div>
              <dl>
                <div><dt>{t('labels.demo.origin')}</dt><dd>{t('labels.demo.originValue')}</dd></div>
                <div><dt>{t('labels.demo.destination')}</dt><dd>{t('labels.demo.destinationValue')}</dd></div>
                <div><dt>{t('labels.demo.weight')}</dt><dd>{t('labels.demo.weightValue')}</dd></div>
                <div><dt>{t('labels.demo.service')}</dt><dd>{t('labels.demo.serviceValue')}</dd></div>
              </dl>
              <div className="tx-home__label-code">
                <Barcode value={TRACKING_ID_EXAMPLE} height={56} width={2} displayValue={false} lineColor="#1C120E" className="tx-home__barcode" />
                <figcaption>{t('labels.demo.trackingId', { id: TRACKING_ID_EXAMPLE })}</figcaption>
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* 6 · Get in touch (CONTENT §2.7): lane on the right, the bike parks */}
      <section className="tx-ch tx-ch--contact" id="contact" data-chapter="6" aria-labelledby="home-contact" tabIndex={-1}>
        <div className="tx-ch__wrap tx-ch__grid">
          <div className="tx-ch__intro" data-reveal>
            <h2 className="tx-h1 tx-home__chap-h" id="home-contact"><Headline start={t('contact.titleStart')} em={t('contact.titleEm')} /></h2>
            <p className="tx-lead">{t('contact.body')}</p>
          </div>
          <div className="tx-ch__lane tx-lane--park" aria-hidden="true">
            <ParkedBike />
          </div>
          <div className="tx-ch__rest">
            <div className="tx-home__contact-cols">
              <ul className="tx-home__channels" aria-label={t('contact.channelsLabel')} data-reveal>
                {[PHONE, PHONE_2].filter(Boolean).map((p) => (
                  <li key={p}>
                    <span className="tx-home__ch-ic" aria-hidden="true"><Phone /></span>
                    <div><small>{t('contact.call')}</small><a href={`tel:${p}`}>{formatPhone(p)}</a></div>
                  </li>
                ))}
                {WHATSAPP && (
                  <li>
                    <span className="tx-home__ch-ic" aria-hidden="true"><MessageCircle /></span>
                    <div><small>{t('contact.whatsapp')}</small><a href={`https://wa.me/${WHATSAPP.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{formatPhone(WHATSAPP)}</a></div>
                  </li>
                )}
                {EMAIL && (
                  <li>
                    <span className="tx-home__ch-ic" aria-hidden="true"><Mail /></span>
                    <div><small>{t('contact.email')}</small><a href={`mailto:${EMAIL}`}>{EMAIL}</a></div>
                  </li>
                )}
                <li>
                  <span className="tx-home__ch-ic" aria-hidden="true"><MapPin /></span>
                  <div><small>{t('contact.visitBuea')}</small><strong>{addressOf('Buea')}</strong></div>
                </li>
                <li>
                  <span className="tx-home__ch-ic" aria-hidden="true"><MapPin /></span>
                  <div><small>{t('contact.visitDouala')}</small><strong>{addressOf('Douala')}</strong></div>
                </li>
                <li>
                  <span className="tx-home__ch-ic" aria-hidden="true"><Clock /></span>
                  <div><small>{t('contact.open')}</small><strong>{hours}</strong></div>
                </li>
              </ul>
              {reference ? (
                <div className="tx-home__form tx-home__form--done" role="status">
                  <p className="tx-home__done-title"><Check aria-hidden="true" />{t('contact.success.title')}</p>
                  <p>{t('contact.success.body', { ref: reference })}</p>
                  <Button variant="ghost" onClick={() => setReference(null)}>{t('contact.success.again')}</Button>
                </div>
              ) : (
                <form className="tx-home__form" onSubmit={submitMessage} noValidate aria-labelledby="home-form-title" data-reveal>
                  <h3 className="tx-h3" id="home-form-title">{t('contact.form.title')}</h3>
                  <Input label={t('contact.form.name')} value={form.name} autoComplete="name" required
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={120} />
                  <Input label={t('contact.form.contact')} value={form.contact} autoComplete="email" required
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} maxLength={160} />
                  <Textarea label={t('contact.form.message')} value={form.message} rows={4} required
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} maxLength={4000} />
                  {formError && <p className="tx-error" role="alert">{formError}</p>}
                  <Button type="submit" variant="secondary" size="lg" disabled={sending}>
                    {sending ? t('contact.form.sending') : t('contact.form.submit')}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 7 · FAQ (CONTENT §2.8) and blog (§2.9): no lane, reading first */}
      <section className="tx-ch tx-ch--faq" id="faq" data-chapter="7" aria-labelledby="home-faq">
        <div className="tx-ch__wrap tx-home__faq-grid">
          <div className="tx-home__faq-intro">
            <p className="tx-eyebrow">{t('faq.eyebrow')}</p>
            <h2 className="tx-h1 tx-home__chap-h" id="home-faq">{t('faq.title')}</h2>
          </div>
          <div className="tx-home__faq-list" data-reveal>
            {FAQ_KEYS.map((k, i) => (
              <details key={k} className="tx-home__faq" open={i === 0}>
                <summary>{t(`faq.items.${k}.q`)}<Plus aria-hidden="true" /></summary>
                <p>{t(`faq.items.${k}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {LATEST_POSTS.length > 0 && (
        <section className="tx-ch tx-ch--blog" id="blog" aria-labelledby="home-blog">
          <div className="tx-ch__wrap">
            <div className="tx-home__blog-head">
              <div>
                <p className="tx-eyebrow">{t('blog.eyebrow')}</p>
                <h2 className="tx-h1 tx-home__chap-h" id="home-blog">{t('blog.title')}</h2>
              </div>
              <Link page="blog" onNavigate={onNavigate} className="tx-link">{t('blog.all')}<ArrowRight aria-hidden="true" /></Link>
            </div>
            <ul className="tx-home__posts">
              {LATEST_POSTS.slice(0, 3).map((p) => (
                <li key={p.slug} className="tx-card">
                  <h3 className="tx-card__title"><Link page="blog" param={p.slug} onNavigate={onNavigate}>{p.title}</Link></h3>
                  <p className="tx-card__body">{p.excerpt}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 8 · Delivered: the bike stops at a door, just above the footer (MOTION_3D_SPEC §6) */}
      <section className="tx-ch tx-ch--arrival tx-dark" id="delivered" data-chapter="8" aria-labelledby="home-arrival" tabIndex={-1}>
        <div className="tx-ch__wrap tx-home__arrive">
          <div className="tx-ch__lane tx-lane--door" aria-hidden="true">
            <ArrivalDoor />
          </div>
          <div data-reveal>
            <h2 className="tx-display tx-home__arrive-h" id="home-arrival"><em className="tx-em">{t('arrival.title')}</em></h2>
            <p className="tx-home__arrive-p">{t('arrival.body')}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
