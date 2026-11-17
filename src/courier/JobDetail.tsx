// Job screen (DISPATCH_SPEC §6 screen 2): pickup and drop-off cards with Call / WhatsApp / Open in
// Maps, a small map, the job details and the next step as a big button at the bottom.
import React, { Suspense, lazy, useState } from 'react';
import { ArrowLeft, MapPin, MessageCircle, Navigation, Phone, Zap } from 'lucide-react';
import type { DispatchStatus } from '../shared/dispatchStatus';
import { useCourierText } from './context';
import type { CourierJob, CourierPlace } from './courierApi';
import { courierActions, deliveryCollect, mapsLink, pickupCollect, placeTitle, telLink, whatsAppLink } from './jobLogic';
import { FailSheet, PickupSheet, PodSheet, type CourierStep } from './sheets';
import { StatusChip } from './ui';
import type { LocationSharing } from './useLocationSharing';
import { LocationCard } from './LocationCard';
import { buildJobMessages, type JobMessageTemplate } from '../shared/jobMessages';
import { pagePath } from '../router/routes';
import { logWhatsAppTap } from '../services/whatsappLog';

const JobMap = lazy(() => import('./JobMap').then((m) => ({ default: m.JobMap })));

const PlaceCard: React.FC<{ kind: 'pickup' | 'dropoff'; place: CourierPlace }> = ({ kind, place }) => {
  const { t } = useCourierText();
  const tel = telLink(place.contactPhone);
  const wa = whatsAppLink(place.contactPhone);
  return (
    <section className={`tx-cr-place tx-cr-place--${kind}`} aria-labelledby={`place-${kind}`}>
      <p className="tx-cr-place__kind" id={`place-${kind}`}>
        <MapPin size={16} aria-hidden="true" /> {t(kind === 'pickup' ? 'job.pickup' : 'job.dropoff')}
      </p>
      <h3 className="tx-cr-place__title">{placeTitle(place)}</h3>
      {place.landmark && <p className="tx-cr-place__landmark">{place.landmark}</p>}
      {place.directions && <p className="tx-cr-place__directions"><span>{t('job.directions')}:</span> {place.directions}</p>}
      <p className="tx-cr-place__contact">
        {place.contactName ?? '—'}{place.contactPhone ? ` · ${place.contactPhone}` : ` · ${t('job.noPhone')}`}
      </p>
      <div className="tx-cr-place__actions">
        {tel ? <a className="tx-cr-btn tx-cr-btn--secondary" href={tel}><Phone size={20} aria-hidden="true" />{t('job.call')}</a>
          : <span className="tx-cr-btn tx-cr-btn--secondary is-disabled" aria-disabled="true"><Phone size={20} aria-hidden="true" />{t('job.call')}</span>}
        {wa ? <a className="tx-cr-btn tx-cr-btn--secondary" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true" />{t('job.whatsApp')}</a>
          : <span className="tx-cr-btn tx-cr-btn--secondary is-disabled" aria-disabled="true"><MessageCircle size={20} aria-hidden="true" />{t('job.whatsApp')}</span>}
        <a className="tx-cr-btn tx-cr-btn--secondary" href={mapsLink(place)} target="_blank" rel="noopener noreferrer"><Navigation size={20} aria-hidden="true" />{t('job.openMaps')}</a>
      </div>
    </section>
  );
};

const MESSAGE_LABEL: Partial<Record<JobMessageTemplate, 'messages.onTheWay' | 'messages.delivered' | 'messages.failed'>> = {
  'local.on_the_way': 'messages.onTheWay',
  'local.delivered': 'messages.delivered',
  'local.failed': 'messages.failed',
};

/**
 * WhatsApp messages for the step the courier just recorded (DISPATCH_SPEC §10): on the way to the
 * recipient, delivered or failed to the sender. Written in the job's language, not the app's.
 * Each tap is logged (notification_log); the courier still taps Send in WhatsApp.
 */
const MessagesCard: React.FC<{ job: CourierJob; status: DispatchStatus }> = ({ job, status }) => {
  const { t } = useCourierText();
  const [opened, setOpened] = useState<string[]>([]);
  const locale = job.notifyLocale === 'fr' ? 'fr' : 'en';
  const messages = buildJobMessages({
    status, trackingNumber: job.trackingNumber, locale,
    trackLink: `${window.location.origin}${pagePath('track-result', job.trackingNumber, locale)}`,
    senderName: job.pickup.contactName, senderPhone: job.pickup.contactPhone,
    recipientName: job.dropoff.contactName, recipientPhone: job.dropoff.contactPhone,
    riderFirstName: job.courier?.publicFirstName ?? null, podRecipientName: job.pod.recipientName,
    deliveredAt: job.deliveredAt ?? (status === 'DELIVERED' ? Date.now() : null), failureReason: job.failureReason,
  }, 'courier');
  if (messages.length === 0) return null;
  return (
    <section className="tx-cr-facts" aria-labelledby="tx-cr-messages">
      <p id="tx-cr-messages"><strong>{t('messages.title')}</strong></p>
      <p className="tx-cr-muted">{t('messages.hint')}</p>
      {messages.map((m) => {
        const key = `${m.template}:${m.to}`;
        const label = t(MESSAGE_LABEL[m.template] ?? 'messages.title');
        return (
          <div key={key} className="tx-cr-message">
            {m.link ? (
              <a className="tx-cr-btn tx-cr-btn--secondary" href={m.link} target="_blank" rel="noopener noreferrer"
                onClick={() => { setOpened((o) => (o.includes(key) ? o : [...o, key])); logWhatsAppTap({ jobId: job.id, template: m.template, to: m.to }); }}>
                <MessageCircle size={20} aria-hidden="true" />{label}
              </a>
            ) : (
              <span className="tx-cr-btn tx-cr-btn--secondary is-disabled" aria-disabled="true"><MessageCircle size={20} aria-hidden="true" />{label}</span>
            )}
            {!m.link && <span className="tx-cr-muted">{t('messages.noPhone')}</span>}
            {opened.includes(key) && <span className="tx-cr-muted" role="status">{t('messages.opened')}</span>}
          </div>
        );
      })}
    </section>
  );
};

export const JobDetail: React.FC<{
  job: CourierJob;
  status: DispatchStatus;
  pendingCount: number;
  location: LocationSharing;
  onBack: () => void;
  onStep: (job: CourierJob, step: CourierStep) => void;
}> = ({ job, status, pendingCount, location, onBack, onStep }) => {
  const { t, money, dateTime } = useCourierText();
  const [sheet, setSheet] = useState<'pickup' | 'pod' | 'fail' | null>(null);
  const actions = courierActions(status);
  const due = deliveryCollect(job);
  const pickupDue = pickupCollect(job);
  // Amounts to collect are shown only until the step that collects them.
  const afterDelivery = ['DELIVERED', 'FAILED_ATTEMPT', 'RETURNED', 'CANCELLED'].includes(status);

  const step = (s: CourierStep) => {
    setSheet(null);
    onStep(job, s);
  };
  const primary = (): { label: string; run: () => void } | null => {
    if (actions.includes('accept')) return { label: t('actions.accept'), run: () => step({ action: 'accept' }) };
    if (actions.includes('pick_up')) return { label: t('actions.pick_up'), run: () => (pickupDue > 0 ? setSheet('pickup') : step({ action: 'pick_up' })) };
    if (actions.includes('start_delivery')) return { label: t('actions.start_delivery'), run: () => step({ action: 'start_delivery' }) };
    if (actions.includes('deliver')) return { label: t('actions.deliver'), run: () => setSheet('pod') };
    return null;
  };
  const p = primary();
  const decline = () => {
    if (window.confirm(t('actions.declineConfirm'))) step({ action: 'decline' });
  };

  return (
    <div className="tx-cr-detail">
      <div className="tx-cr-detail__bar">
        <button type="button" className="tx-cr-icon-btn" onClick={onBack} aria-label={t('app.back')}><ArrowLeft size={24} /></button>
        <div className="tx-cr-detail__id">
          <span className="tx-cr-mono">{job.trackingNumber}</span>
          <StatusChip status={status} />
        </div>
        {job.isExpress && <span className="tx-cr-badge tx-cr-badge--express"><Zap size={14} aria-hidden="true" />{t('job.express')}</span>}
      </div>

      {pendingCount > 0 && <p className="tx-cr-pending" role="status">{t('sync.pending')}</p>}
      {(status === 'PICKED_UP' || status === 'ON_THE_WAY') && <LocationCard location={location} />}

      <Suspense fallback={<div className="tx-cr-map" />}>
        <JobMap pickup={job.pickup} dropoff={job.dropoff} />
      </Suspense>

      <PlaceCard kind="pickup" place={job.pickup} />
      <PlaceCard kind="dropoff" place={job.dropoff} />

      <section className="tx-cr-facts">
        {(job.itemDescription || job.sizeClass || job.weightKg) && (
          <p>
            <span>{t('job.item')}:</span> {[job.itemDescription, job.sizeClass ? t(`sizes.${job.sizeClass}`) : null, job.weightKg ? t('job.weight', { n: job.weightKg }) : null].filter(Boolean).join(' · ')}
          </p>
        )}
        {job.scheduledForTs && <p>{t('job.scheduled', { time: dateTime(job.scheduledForTs) })}</p>}
        {pickupDue > 0 && (status === 'ASSIGNED' || status === 'ACCEPTED') && <p className="tx-cr-money">{t('job.feeToCollect', { amount: money(pickupDue, job.currency) })} · {t('job.pickup')}</p>}
        {due.total > 0 && !afterDelivery && <p className="tx-cr-money">{t('job.cashToCollect', { amount: money(due.total, job.currency) })}</p>}
        {job.hasDeliveryCode && <p>{t('job.codeNeeded')}</p>}
        {job.attempts > 0 && <p>{t('job.attempts', { n: job.attempts })}</p>}
      </section>

      <MessagesCard job={job} status={status} />

      {(p || actions.includes('decline') || actions.includes('fail')) && (
        <div className="tx-cr-actionbar">
          {actions.includes('decline') && (
            <button type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--large" onClick={decline}>{t('actions.decline')}</button>
          )}
          {actions.includes('fail') && (
            <button type="button" className="tx-cr-btn tx-cr-btn--danger-ghost tx-cr-btn--large" onClick={() => setSheet('fail')}>{t('actions.fail')}</button>
          )}
          {p && <button type="button" className="tx-cr-btn tx-cr-btn--primary tx-cr-btn--large tx-cr-grow" onClick={p.run}>{p.label}</button>}
        </div>
      )}

      {sheet === 'pickup' && <PickupSheet job={job} onClose={() => setSheet(null)} onSubmit={step} />}
      {sheet === 'pod' && <PodSheet job={job} onClose={() => setSheet(null)} onSubmit={step} />}
      {sheet === 'fail' && <FailSheet onClose={() => setSheet(null)} onSubmit={step} />}
    </div>
  );
};
