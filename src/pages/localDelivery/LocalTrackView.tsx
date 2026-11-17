// Track page for a local or intercity delivery (DISPATCH_SPEC §8, CONTENT §6.9; G.7). Stepper, courier
// card (first name, vehicle, photo only with consent), map with the live courier position while the
// parcel is on its way, approximate ETA, proof-of-delivery line, share on WhatsApp. Refreshes every
// 20 s (the server's pollMs) while the delivery isn't finished and the tab is visible; stops once it
// is delivered, returned or cancelled. Everything shown comes from the public `localDelivery` block,
// which never holds phone numbers or stale positions (server/dispatch/publicTracking.ts).
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Clock, Headphones, MessageCircle, Package } from 'lucide-react';
import type { Shipment } from '../../types/shipment';
import type { PublicLocalDelivery } from '../../shared/localTracking';
import { LOCAL_STEPS } from '../../shared/localTracking';
import { VEHICLE_LABELS, failureReasonLabel } from '../../shared/dispatchStatus';
import { buildWhatsAppShareLink } from '../../shared/whatsapp';
import { useAreaT, useLocale } from '../../i18n/I18nProvider';
import { formatDateTime, formatTime } from '../../i18n/format';
import { pagePath } from '../../router/routes';
import { Link } from '../../router/Link';
import { api } from '../../services/api';
import { LiveDeliveryMap } from './LiveDeliveryMap';

interface Props {
  shipment: Shipment;
  onNavigate: (page: string, param?: string) => void;
}

export const LocalTrackView: React.FC<Props> = ({ shipment, onNavigate }) => {
  const t = useAreaT('localDelivery');
  const locale = useLocale();
  const tracking = shipment.trackingNumber;
  const [data, setData] = useState<PublicLocalDelivery | null>(shipment.localDelivery ?? null);
  // When the answer arrived, so the position's age keeps counting between refreshes.
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  // A shipment opened from the console's cache has no public block yet: fetch it once.
  useEffect(() => {
    if (shipment.localDelivery) {
      setData(shipment.localDelivery);
      setReceivedAt(Date.now());
      return;
    }
    let alive = true;
    api.trackShipment(tracking).then((s) => {
      if (alive && s?.localDelivery) {
        setData(s.localDelivery);
        setReceivedAt(Date.now());
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [tracking, shipment.localDelivery]);

  // Refresh every pollMs while open and visible; none once the delivery is finished (pollMs null).
  const pollMs = data?.pollMs ?? null;
  const refreshing = useRef(false);
  useEffect(() => {
    if (!pollMs) return;
    let stopped = false;
    const refresh = async () => {
      if (stopped || refreshing.current || document.visibilityState === 'hidden') return;
      refreshing.current = true;
      try {
        const s = await api.trackShipment(tracking);
        if (!stopped && s?.localDelivery) {
          setData(s.localDelivery);
          setReceivedAt(Date.now());
        }
      } catch (err) {
        // Gone (cancelled and moved to the trash): stop asking.
        if ((err as { status?: number })?.status === 404) stopped = true;
      } finally {
        refreshing.current = false;
      }
    };
    const timer = window.setInterval(refresh, pollMs);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pollMs, tracking]);

  // Seconds counter for "Updated n seconds ago", only while a position is shown.
  const hasPosition = !!data?.position;
  useEffect(() => {
    if (!hasPosition) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasPosition]);

  const isDriver = data ? data.vehicle !== 'BIKE' : false;
  const shareLink = buildWhatsAppShareLink('local.share_tracking',
    { link: `${typeof window !== 'undefined' ? window.location.origin : ''}${pagePath('track-result', tracking, locale)}` }, locale);

  const header = (
    <section className="tx-ldt__hero tx-dark" aria-labelledby="ldt-title">
      <div className="tx-ld__wrap">
        <Link page="track" onNavigate={onNavigate} className="tx-ldt__back"><ArrowLeft aria-hidden="true" />{t('track.back')}</Link>
        <p className="tx-eyebrow">{data ? t(`track.scope.${data.scope}`) : t('track.trackingId')}</p>
        <h1 className="tx-h1 tx-ldt__id" id="ldt-title"><span className="tx-visually-hidden">{t('track.trackingId')} </span>{tracking}</h1>
        {data && (
          <p className="tx-lead tx-ldt__route">
            {[data.route.pickupArea, data.route.pickupCity].filter(Boolean).join(', ')}
            {' → '}
            {[data.route.dropoffArea, data.route.dropoffCity].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </section>
  );

  if (!data) {
    return <div className="tx-ld tx-ldt">{header}<section className="tx-ld__main"><div className="tx-ld__wrap"><div className="tx-ld__card tx-ld__loading" aria-busy="true" /></div></section></div>;
  }

  const outcomeBanner = data.outcome === 'RETURNED' ? t('track.returned') : data.outcome === 'CANCELLED' ? t('track.cancelled') : null;
  const ageSeconds = data.position ? Math.max(0, Math.round((data.position.ageMs + (now - receivedAt)) / 1000)) : 0;
  const eta = data.etaMinutes;

  return (
    <div className="tx-ld tx-ldt">
      {header}
      <section className="tx-ld__main">
        <div className="tx-ld__wrap tx-ldt__grid">
          <div className="tx-ldt__col">
            {/* Stepper */}
            <div className="tx-ld__card">
              <h2 className="tx-ld__legend">{t('track.progress')}</h2>
              {outcomeBanner && <p className="tx-ldt__banner">{outcomeBanner}</p>}
              <ol className="tx-ldt__steps">
                {LOCAL_STEPS.map((key, i) => {
                  const failedHere = data.outcome === 'FAILED' && i === data.step;
                  const done = !outcomeBanner && (i < data.step || (i === data.step && data.outcome === 'DELIVERED'));
                  const current = !outcomeBanner && i === data.step && data.outcome === 'ACTIVE';
                  const at = data.times[key];
                  return (
                    <li key={key} className={`tx-ldt__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}${failedHere ? ' is-failed' : ''}`}
                      aria-current={current || failedHere ? 'step' : undefined}>
                      <span className="tx-ldt__dot" aria-hidden="true">
                        {failedHere ? <AlertTriangle /> : done ? <Check /> : null}
                      </span>
                      <span className="tx-ldt__step-text">
                        <strong>{failedHere ? t('track.failed') : t(`track.steps.${key}`)}</strong>
                        {failedHere && data.failureReason && <span>{failureReasonLabel(data.failureReason, locale)}</span>}
                        {failedHere && <span>{t('track.failedNext')}</span>}
                        {at && (done || current) && <time dateTime={new Date(at).toISOString()}>{formatDateTime(at, locale)}</time>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Proof of delivery: masked name and time only. */}
            {data.outcome === 'DELIVERED' && data.pod && (
              <div className="tx-ld__card tx-ldt__pod" role="status">
                <p><Package aria-hidden="true" />
                  {t('track.delivered', { time: data.pod.deliveredAt ? formatTime(data.pod.deliveredAt, locale) : '', name: data.pod.recipient })}</p>
                {data.pod.photo && <p className="tx-ldt__muted"><Check aria-hidden="true" />{t('track.photo')}</p>}
              </div>
            )}

            {/* Courier card, from assignment until delivery. */}
            {data.courier && (
              <div className="tx-ld__card tx-ldt__courier">
                {data.courier.photoUrl && (
                  <img src={data.courier.photoUrl} width={64} height={64} alt={t('track.courier.photoAlt', { name: data.courier.firstName })} />
                )}
                <div>
                  <p className="tx-ldt__muted">{isDriver ? t('track.courier.driver') : t('track.courier.rider')}</p>
                  <p className="tx-ldt__name">{data.courier.firstName}</p>
                  <p className="tx-ldt__muted">{VEHICLE_LABELS[data.courier.vehicle]?.[locale] ?? ''}</p>
                </div>
              </div>
            )}

            <div className="tx-ldt__actions">
              <a className="tx-btn tx-btn--secondary" href={shareLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />{t('track.share')}
              </a>
            </div>
          </div>

          <div className="tx-ldt__col">
            {/* Map: live while the courier carries the parcel; the route otherwise. */}
            <div className="tx-ld__card tx-ldt__mapcard">
              <h2 className="tx-ld__legend">{data.live ? t('track.live.title') : t('track.route.title')}</h2>
              {data.live && (
                <p className="tx-ldt__fresh" aria-live="polite">
                  <Clock aria-hidden="true" />
                  {data.position
                    ? t('track.live.updated', { n: ageSeconds })
                    : isDriver ? t('track.live.staleDriver') : t('track.live.staleRider')}
                </p>
              )}
              {data.live && eta !== null && data.position && (
                <div className="tx-ldt__eta">
                  <strong>{eta >= 60 ? t('track.eta.hours', { h: Math.floor(eta / 60), m: eta % 60 }) : t('track.eta.minutes', { n: eta })}</strong>
                  <span>{isDriver ? t('track.eta.noteDriver') : t('track.eta.noteRider')}</span>
                </div>
              )}
              {(data.route.pickup || data.route.dropoff) && (
                <LiveDeliveryMap
                  pickup={data.route.pickup}
                  dropoff={data.route.dropoff}
                  courier={data.live && data.position ? { lat: data.position.lat, lng: data.position.lng } : null}
                  label={t('track.route.mapLabel')}
                  markerLabels={{ pickup: t('track.route.pickup'), dropoff: t('track.route.dropoff'), courier: t('track.route.courier') }}
                />
              )}
              <dl className="tx-ldt__ends">
                <div><dt>{t('track.route.from')}</dt><dd>{[data.route.pickupArea, data.route.pickupCity].filter(Boolean).join(', ') || '—'}</dd></div>
                <div><dt>{t('track.route.to')}</dt><dd>{[data.route.dropoffArea, data.route.dropoffCity].filter(Boolean).join(', ') || '—'}</dd></div>
              </dl>
            </div>

            <div className="tx-ld__card tx-ldt__help">
              <Headphones aria-hidden="true" />
              <div>
                <p className="tx-ldt__name">{t('track.help.title')}</p>
                <p className="tx-ldt__muted">{t('track.help.body')}</p>
                <Link page="contact" onNavigate={onNavigate} className="tx-link">{t('track.help.contact')}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LocalTrackView;
