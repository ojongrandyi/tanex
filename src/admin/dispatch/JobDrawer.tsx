// Job drawer on the dispatch board (DISPATCH_SPEC §7; CONTENT §10.2): everything about one job
// (places, parcel, price and payment, courier, problems, proof of delivery), its timeline from the
// audit log, cash recorded on it and notifications sent, plus the dispatch actions the shared state
// machine allows (job.allowedActions). The server checks dispatch.manage and audits every action.
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, MessageCircle, Phone, X } from 'lucide-react';
import { IamDialog } from '../components/IamDialog';
import { DISPATCH_STATUS_LABELS, VEHICLE_LABELS, failureReasonLabel } from '../../shared/dispatchStatus';
import { SIZE_CLASS_LABELS } from '../../shared/localPricing';
import { placePoint, suggestCouriers, type JobProblem } from '../../shared/dispatchBoard';
import { boardApi, type BoardCity, type BoardCourier, type BoardZone, type DispatchJob, type JobHistory, type JobPlace } from './boardApi';
import { BOARD_TEXT, boardErrorText } from './boardStrings';
import { money, when } from './boardFormat';
import { buildJobMessages, type JobMessage } from '../../shared/jobMessages';
import { pagePath } from '../../router/routes';
import { logWhatsAppTap } from '../../services/whatsappLog';

const T = BOARD_TEXT;
const D = BOARD_TEXT.drawer;

type Sub = 'assign' | 'price' | 'confirm-price' | 'cancel' | 'return' | 'lift' | null;

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="tx-board-dl-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

const PlaceCard: React.FC<{ title: string; place: JobPlace }> = ({ title, place }) => (
  <section className="tx-board-place" aria-label={title}>
    <h3>{title}</h3>
    <p className="tx-board-place-main">
      <strong>{place.zoneName ?? D.noArea}</strong>{place.cityName ? `, ${place.cityName}` : ''}
    </p>
    {place.landmark && <p>{place.landmark}</p>}
    {place.directions && <p className="tx-iam-muted">{D.directions}: {place.directions}</p>}
    <p>
      {place.contactName}{' · '}
      <a href={`tel:${place.contactPhone}`} className="tx-board-tel"><Phone size={13} aria-hidden="true" /> {place.contactPhone}</a>
    </p>
  </section>
);

// ---- Action dialogs ----

const ReasonField: React.FC<{ label: string; value: string; onChange: (v: string) => void; hint?: string; required?: boolean }> = ({ label, value, onChange, hint, required = true }) => (
  <label className="tx-iam-field">
    <span>{label}</span>
    <textarea rows={2} maxLength={500} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    {hint && <small>{hint}</small>}
  </label>
);

const DialogError: React.FC<{ error: string | null }> = ({ error }) =>
  error ? <div className="tx-iam-notice error" role="alert"><AlertCircle size={14} aria-hidden="true" /><span>{error}</span></div> : null;

function useRun(onDone: (job: DispatchJob, message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<DispatchJob>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await fn(), message);
    } catch (err) {
      setError(boardErrorText(err));
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const AssignDialog: React.FC<{
  job: DispatchJob; couriers: BoardCourier[]; zones: BoardZone[]; cities: BoardCity[]; now: number;
  onClose: () => void; onDone: (job: DispatchJob, message: string) => void;
}> = ({ job, couriers, zones, cities, now, onClose, onDone }) => {
  const { busy, error, run } = useRun(onDone);
  const reassign = job.allowedActions.includes('reassign');
  const list = suggestCouriers({
    pickupCityId: job.pickup.cityId, pickup: placePoint(job.pickup, zones, cities),
    vehicleRequired: job.vehicleRequired, courierUserId: job.courierUserId,
  }, couriers, now);
  const suggested = list.filter((s) => s.recommended);
  const others = list.filter((s) => !s.recommended);
  const row = (s: typeof list[number]) => {
    const c = s.courier;
    const name = c.displayName;
    return (
      <li key={c.userId} className="tx-board-suggest">
        <div className="tx-board-suggest-main">
          <strong>{name}</strong>
          <span className="tx-iam-muted">
            {VEHICLE_LABELS[c.vehicleType]?.en ?? c.vehicleType}
            {' · '}{T.assign.load(c.activeJobs)}
            {' · '}{s.distanceKm !== null && s.positionAgeMs !== null
              ? `${T.assign.distance(s.distanceKm)} (${T.assign.positionAge(Math.floor(s.positionAgeMs / 60_000))})`
              : T.assign.noPosition}
          </span>
          {s.misses.length > 0 && (
            <span className="tx-board-chips">
              {s.misses.map((m) => <span key={m} className="tx-iam-chip warn">{T.assign.misses[m]}</span>)}
            </span>
          )}
        </div>
        <button type="button" className={`tx-iam-btn small${s.recommended ? ' primary' : ''}`} disabled={busy}
          aria-label={T.assign.choose(name)}
          onClick={() => run(() => boardApi.assign(job.id, c.userId), T.assign.done(name))}>
          {reassign ? T.actions.reassign : T.actions.assign}
        </button>
      </li>
    );
  };
  return (
    <IamDialog title={reassign ? T.assign.reassignTitle(job.trackingNumber) : T.assign.title(job.trackingNumber)} onClose={onClose}>
      <p className="tx-iam-hint">{T.assign.intro}</p>
      <DialogError error={error} />
      {list.length === 0 ? <p className="tx-iam-muted">{T.assign.noCouriers}</p> : (
        <>
          <h3 className="tx-board-subhead">{T.assign.suggested}</h3>
          {suggested.length === 0 ? <p className="tx-iam-muted">{T.assign.noneSuggested}</p> : <ul className="tx-board-suggest-list">{suggested.map(row)}</ul>}
          {others.length > 0 && (
            <>
              <h3 className="tx-board-subhead">{T.assign.others}</h3>
              <ul className="tx-board-suggest-list">{others.map(row)}</ul>
            </>
          )}
        </>
      )}
      <div className="tx-iam-dialog-actions">
        <button type="button" className="tx-iam-btn" onClick={onClose}>{T.close}</button>
      </div>
    </IamDialog>
  );
};

const PriceDialog: React.FC<{ job: DispatchJob; thenConfirm: boolean; onClose: () => void; onDone: (job: DispatchJob, message: string) => void }> = ({ job, thenConfirm, onClose, onDone }) => {
  const { busy, error, setError, run } = useRun(onDone);
  const [price, setPrice] = useState(job.price !== null ? String(job.price) : '');
  const [reason, setReason] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(price.replace(/\s/g, '').replace(',', '.'));
    if (price.trim() === '' || !Number.isFinite(n) || n < 0) { setError(T.errors.INVALID_PRICE); return; }
    if (!reason.trim()) { setError(T.errors.REASON_REQUIRED); return; }
    run(async () => {
      const priced = await boardApi.setPrice(job.id, n, reason.trim());
      return thenConfirm ? boardApi.confirm(priced.id) : priced;
    }, thenConfirm ? T.confirmed : T.price.done);
  };
  return (
    <IamDialog title={thenConfirm ? T.actions.confirm : T.price.title} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        {job.price !== null && <p className="tx-iam-hint">{T.price.current(money(job.price, job.currency))}</p>}
        <label className="tx-iam-field">
          <span>{T.price.newPrice} ({job.currency})</span>
          <input type="text" inputMode="numeric" value={price} required onChange={(e) => setPrice(e.target.value)} />
        </label>
        <ReasonField label={T.price.reason} hint={T.price.reasonHint} value={reason} onChange={setReason} />
        <DialogError error={error} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? T.saving : thenConfirm ? T.actions.confirm : T.price.save}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const CancelDialog: React.FC<{ job: DispatchJob; onClose: () => void; onDone: (job: DispatchJob, message: string) => void }> = ({ job, onClose, onDone }) => {
  const { busy, error, setError, run } = useRun(onDone);
  const [reason, setReason] = useState('');
  // Owner decision #165: "move the shipment to the trash" is ticked by default.
  const [trash, setTrash] = useState(true);
  const wholeShipment = job.scope === 'LOCAL' || job.scope === 'INTERCITY';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError(T.errors.REASON_REQUIRED); return; }
    run(() => boardApi.cancel(job.id, reason.trim(), wholeShipment && trash), T.cancelJob.done);
  };
  return (
    <IamDialog title={T.cancelJob.title(job.trackingNumber)} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <ReasonField label={T.cancelJob.reason} value={reason} onChange={setReason} />
        {wholeShipment && (
          <label className="tx-iam-check">
            <input type="checkbox" checked={trash} onChange={(e) => setTrash(e.target.checked)} />
            <span>{T.cancelJob.trash}<small className="tx-iam-hint">{T.cancelJob.trashHint}</small></span>
          </label>
        )}
        <DialogError error={error} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancelJob.keep}</button>
          <button type="submit" className="tx-iam-btn danger" disabled={busy}>{busy ? T.saving : T.cancelJob.submit}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const ReturnDialog: React.FC<{ job: DispatchJob; onClose: () => void; onDone: (job: DispatchJob, message: string) => void }> = ({ job, onClose, onDone }) => {
  const { busy, error, run } = useRun(onDone);
  const [note, setNote] = useState('');
  return (
    <IamDialog title={T.returned.title(job.trackingNumber)} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={(e) => { e.preventDefault(); run(() => boardApi.markReturned(job.id, note.trim()), T.returned.done); }}>
        <p className="tx-iam-hint">{T.returned.intro}</p>
        <ReasonField label={T.returned.note} value={note} onChange={setNote} required={false} />
        <DialogError error={error} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? T.saving : T.returned.submit}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const LiftCodeDialog: React.FC<{ job: DispatchJob; onClose: () => void; onDone: (job: DispatchJob, message: string) => void }> = ({ job, onClose, onDone }) => {
  const { busy, error, setError, run } = useRun(onDone);
  const [reason, setReason] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError(T.errors.REASON_REQUIRED); return; }
    run(() => boardApi.liftCode(job.id, reason.trim()), T.liftCode.done);
  };
  return (
    <IamDialog title={T.liftCode.title} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <p className="tx-iam-hint">{T.liftCode.intro}</p>
        <ReasonField label={T.liftCode.reason} value={reason} onChange={setReason} />
        <DialogError error={error} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn danger" disabled={busy}>{busy ? T.saving : T.liftCode.submit}</button>
        </div>
      </form>
    </IamDialog>
  );
};

// ---- WhatsApp click-to-chat (DISPATCH_SPEC §10, NOTIFICATIONS_SPEC §2) ----

/** The messages that fit the job's step, in its notify_locale, with the public tracking link. */
export function boardJobMessages(job: DispatchJob): JobMessage[] {
  const locale = job.notifyLocale === 'fr' ? 'fr' : 'en';
  return buildJobMessages({
    status: job.status, trackingNumber: job.trackingNumber, locale,
    trackLink: `${window.location.origin}${pagePath('track-result', job.trackingNumber, locale)}`,
    senderName: job.pickup.contactName, senderPhone: job.pickup.contactPhone,
    recipientName: job.dropoff.contactName, recipientPhone: job.dropoff.contactPhone,
    riderFirstName: job.courier?.publicFirstName ?? null, podRecipientName: job.pod.recipientName,
    deliveredAt: job.deliveredAt, failureReason: job.failureReason,
  }, 'dispatch');
}

const WhatsAppSection: React.FC<{ job: DispatchJob; onOpened: () => void }> = ({ job, onOpened }) => {
  const [opened, setOpened] = useState<string[]>([]);
  useEffect(() => { setOpened([]); }, [job.id, job.status]);
  const messages = boardJobMessages(job);
  if (messages.length === 0) return null;
  const W = D.whatsApp;
  return (
    <section aria-label={W.title}>
      <h3>{W.title}</h3>
      <p className="tx-iam-hint">{W.hint}</p>
      <ul className="tx-board-wa">
        {messages.map((m) => {
          const key = `${m.template}:${m.to}`;
          const label = W.send(D.templateNames[m.template] ?? m.template, m.to);
          return (
            <li key={key}>
              {m.link ? (
                <a className="tx-iam-btn small" href={m.link} target="_blank" rel="noopener noreferrer"
                  onClick={() => {
                    setOpened((o) => (o.includes(key) ? o : [...o, key]));
                    logWhatsAppTap({ jobId: job.id, template: m.template, to: m.to });
                    // Let the log row land before the timeline reloads.
                    window.setTimeout(onOpened, 800);
                  }}>
                  <MessageCircle size={14} aria-hidden="true" /> {label}
                </a>
              ) : (
                <button type="button" className="tx-iam-btn small" disabled title={W.noPhone}>
                  <MessageCircle size={14} aria-hidden="true" /> {label}
                </button>
              )}
              {!m.link && <span className="tx-iam-muted"> {W.noPhone}</span>}
              {opened.includes(key) && <span className="tx-iam-chip" role="status">{W.opened}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// ---- Drawer ----

export const JobDrawer: React.FC<{
  job: DispatchJob;
  problems: JobProblem[];
  couriers: BoardCourier[];
  zones: BoardZone[];
  cities: BoardCity[];
  now: number;
  canManage: boolean;
  onClose: () => void;
  onChanged: (job: DispatchJob, message: string) => void;
  onOpenTracking?: (trackingNumber: string) => void;
}> = ({ job, problems, couriers, zones, cities, now, canManage, onClose, onChanged, onOpenTracking }) => {
  const [sub, setSub] = useState<Sub>(null);
  const [history, setHistory] = useState<JobHistory | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [rateBusy, setRateBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const subRef = useRef(sub);
  subRef.current = sub;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = `tx-board-drawer-${job.id}`;

  // Focus moves into the drawer when another job opens; Escape closes it unless a dialog is open
  // (the dialog handles its own Escape).
  useEffect(() => {
    ref.current?.focus();
  }, [job.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !subRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The timeline follows the job: reloaded whenever it changes (board refresh or an action).
  useEffect(() => {
    let cancelled = false;
    setHistoryError(false);
    boardApi.history(job.id)
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch(() => { if (!cancelled) setHistoryError(true); });
    return () => { cancelled = true; };
  }, [job.id, job.updatedAt, historyTick]);
  useEffect(() => { setHistory(null); setActionError(null); }, [job.id]);

  const done = (updated: DispatchJob, message: string) => {
    setSub(null);
    onChanged(updated, message);
  };
  const can = (a: DispatchJob['allowedActions'][number]) => canManage && job.allowedActions.includes(a);
  const final = job.status === 'DELIVERED' || job.status === 'RETURNED' || job.status === 'CANCELLED';

  const confirmJob = async () => {
    if (job.price === null) { setSub('confirm-price'); return; }
    setRateBusy(true);
    setActionError(null);
    try {
      done(await boardApi.confirm(job.id), T.confirmed);
    } catch (err) {
      setActionError(boardErrorText(err));
    } finally {
      setRateBusy(false);
    }
  };
  const backToRates = async () => {
    if (!window.confirm(T.price.rateSheetConfirm)) return;
    setRateBusy(true);
    setActionError(null);
    try {
      done(await boardApi.priceFromRates(job.id), T.price.done);
    } catch (err) {
      setActionError(boardErrorText(err));
    } finally {
      setRateBusy(false);
    }
  };

  const vehicle = (v: string) => VEHICLE_LABELS[v as keyof typeof VEHICLE_LABELS]?.en ?? v;

  return (
    <aside className="tx-board-drawer" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
      <header className="tx-board-drawer-head">
        <div>
          <h2 id={titleId} className="font-mono">{job.trackingNumber}</h2>
          <p className="tx-board-chips">
            <span className={`tx-board-status is-${job.status.toLowerCase()}`}>{DISPATCH_STATUS_LABELS[job.status].en}</span>
            <span className="tx-iam-chip">{T.scope[job.scope]}</span>
            <span className="tx-iam-chip">{vehicle(job.vehicleRequired)}</span>
            {job.isExpress && <span className="tx-iam-chip warn">{T.card.express}</span>}
          </p>
        </div>
        <button type="button" className="tx-board-icon-btn" onClick={onClose} aria-label={T.close}><X size={18} aria-hidden="true" /></button>
      </header>

      <div className="tx-board-drawer-body">
        {problems.length > 0 && (
          <div className="tx-iam-notice error" role="status">
            <AlertCircle size={14} aria-hidden="true" />
            <span><strong>{D.problems}:</strong> {problems.map((p) => T.problems[p]).join(' · ')}</span>
          </div>
        )}

        {canManage && !final && (
          <div className="tx-board-actions">
            {can('confirm') && <button type="button" className="tx-iam-btn primary small" disabled={rateBusy} onClick={confirmJob}>{T.actions.confirm}</button>}
            {can('assign') && <button type="button" className="tx-iam-btn primary small" onClick={() => setSub('assign')}>{T.actions.assign}</button>}
            {can('reassign') && <button type="button" className="tx-iam-btn small" onClick={() => setSub('assign')}>{T.actions.reassign}</button>}
            <button type="button" className="tx-iam-btn small" onClick={() => setSub('price')}>{T.actions.overridePrice}</button>
            {job.priceOverridden && <button type="button" className="tx-iam-btn small" disabled={rateBusy} onClick={backToRates}>{T.actions.rateSheet}</button>}
            {job.hasDeliveryCode && <button type="button" className="tx-iam-btn small" onClick={() => setSub('lift')}>{T.actions.liftCode}</button>}
            {can('return') && <button type="button" className="tx-iam-btn small" onClick={() => setSub('return')}>{T.actions.returned}</button>}
            {can('cancel') && <button type="button" className="tx-iam-btn danger small" onClick={() => setSub('cancel')}>{T.actions.cancel}</button>}
          </div>
        )}
        {!canManage && <p className="tx-iam-hint">{D.viewOnly}</p>}
        {actionError && <DialogError error={actionError} />}

        <WhatsAppSection job={job} onOpened={() => setHistoryTick((n) => n + 1)} />

        <PlaceCard title={D.pickup} place={job.pickup} />
        <PlaceCard title={D.dropoff} place={job.dropoff} />

        <section aria-label={D.courier}>
          <h3>{D.courier}</h3>
          {job.courier ? (
            <p>
              <strong>{job.courier.displayName}</strong> ({vehicle(job.courier.vehicleType)}{job.courier.plateNumber ? `, ${job.courier.plateNumber}` : ''})
              {job.courier.phone && <>{' · '}<a href={`tel:${job.courier.phone}`} className="tx-board-tel"><Phone size={13} aria-hidden="true" /> {job.courier.phone}</a></>}
            </p>
          ) : <p className="tx-iam-muted">{D.noCourier}</p>}
        </section>

        <section aria-label={D.parcel}>
          <h3>{D.parcel}</h3>
          <dl className="tx-board-dl">
            {job.sizeClass && <Field label={D.size}>{SIZE_CLASS_LABELS[job.sizeClass].en}</Field>}
            {job.weightKg !== null && <Field label={D.weight}>{D.weightKg(job.weightKg)}</Field>}
            {job.itemDescription && <Field label={D.item}>{job.itemDescription}</Field>}
            <Field label={D.vehicle}>{vehicle(job.vehicleRequired)}</Field>
            {job.scheduledForTs !== null && <Field label={D.scheduled}>{when(job.scheduledForTs, now)}</Field>}
          </dl>
        </section>

        <section aria-label={D.money}>
          <h3>{D.money}</h3>
          <dl className="tx-board-dl">
            <Field label={D.price}>
              {job.price !== null
                ? <>{money(job.price, job.currency)} <span className="tx-iam-muted">({job.priceOverridden ? D.priceByHand : D.priceFromRates})</span></>
                : <span className="tx-iam-muted">{D.noPrice}</span>}
            </Field>
            <Field label={D.payer}>{D.payers[job.payer] ?? job.payer}</Field>
            {job.codAmount !== null && <Field label={D.cod}>{money(job.codAmount, job.currency)}</Field>}
            <Field label={D.collectFee}>{job.collectDeliveryFee ? T.yes : T.no}</Field>
            <Field label={D.deliveryCode}>
              {!job.hasDeliveryCode ? D.codeNone : job.deliveryCodeTriesLeft === 0 ? D.codeLocked : D.codeSet(job.deliveryCodeTriesLeft ?? 0)}
            </Field>
            <Field label={D.language}>{D.languages[job.notifyLocale] ?? job.notifyLocale}</Field>
          </dl>
        </section>

        {job.failureReason && (
          <section aria-label={D.failure}>
            <h3>{D.failure}</h3>
            <p>{failureReasonLabel(job.failureReason)}{job.failureNote ? `: ${job.failureNote}` : ''}</p>
            <p className="tx-iam-muted">{D.attempts(job.attempts)}</p>
          </section>
        )}

        {(job.pod.recipientName || job.pod.photoUrl) && (
          <section aria-label={D.pod}>
            <h3>{D.pod}</h3>
            <dl className="tx-board-dl">
              {job.pod.recipientName && <Field label={D.podRecipient}>{job.pod.recipientName}{job.deliveredAt ? ` · ${when(job.deliveredAt, now)}` : ''}</Field>}
              {job.pod.note && <Field label={D.podNote}>{job.pod.note}</Field>}
            </dl>
            <div className="tx-board-pod">
              {job.pod.photoUrl && (
                <a href={job.pod.photoUrl} target="_blank" rel="noopener noreferrer">
                  <img src={job.pod.photoUrl} alt={D.podPhoto} width={320} height={240} loading="lazy" />
                </a>
              )}
              {job.pod.signatureUrl && (
                <img src={job.pod.signatureUrl} alt={D.podSignature} width={320} height={120} loading="lazy" className="is-signature" />
              )}
            </div>
          </section>
        )}

        <section aria-label={D.timeline}>
          <h3>{D.timeline}</h3>
          {historyError && <p className="tx-iam-muted">{D.historyError}</p>}
          {!history && !historyError && <p className="tx-iam-muted" role="status">{T.loading}</p>}
          {history && (history.timeline.length === 0 ? <p className="tx-iam-muted">{D.noTimeline}</p> : (
            <ol className="tx-board-timeline">
              {history.timeline.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <time className="font-mono">{when(e.at, now)}</time>
                  <span>
                    {e.summary ?? e.action}
                    {e.actorName && <span className="tx-iam-muted"> {D.by(e.actorName)}</span>}
                    {e.reason && <span className="tx-board-reason">{D.reason(e.reason)}</span>}
                  </span>
                </li>
              ))}
            </ol>
          ))}
        </section>

        <section aria-label={D.cash}>
          <h3>{D.cash}</h3>
          {history && (history.cash.length === 0 ? <p className="tx-iam-muted">{D.noCash}</p> : (
            <ul className="tx-board-list">
              {history.cash.map((c) => (
                <li key={c.ref}>
                  <span className="font-mono">{c.ref}</span>
                  {' · '}{D.cashTypes[c.entryType] ?? c.entryType}{' · '}{money(c.amount, c.currency)}
                  {' · '}{D.cashMethods[c.method] ?? c.method}{c.momoReference ? ` (${c.momoReference})` : ''}
                  {' · '}<span className="tx-iam-muted">{D.cashStatus[c.status] ?? c.status}</span>
                </li>
              ))}
            </ul>
          ))}
        </section>

        <section aria-label={D.notifications}>
          <h3>{D.notifications}</h3>
          {history && (history.notifications.length === 0 ? <p className="tx-iam-muted">{D.noNotifications}</p> : (
            <ul className="tx-board-list">
              {history.notifications.map((n, i) => (
                <li key={`${n.at}-${i}`}>
                  {when(n.at, now)}{' · '}{D.templateNames[n.template] ?? n.template}{' · '}
                  {n.channel === 'WHATSAPP_LINK' ? (
                    <>
                      {D.whatsAppTo(n.to)}{' · '}<span className="tx-iam-muted">{D.whatsAppOpenedStatus}{n.byName ? ` (${D.whatsAppBy(n.byName)})` : ''}</span>
                    </>
                  ) : (
                    <>{D.emailTo(n.to)}{' · '}<span className="tx-iam-muted">{D.emailStatus[n.status] ?? n.status}</span></>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </section>

        {onOpenTracking && (
          <button type="button" className="tx-iam-btn small" onClick={() => onOpenTracking(job.trackingNumber)}>
            <ExternalLink size={14} aria-hidden="true" /> {D.trackingLink}
          </button>
        )}
      </div>

      {sub === 'assign' && <AssignDialog job={job} couriers={couriers} zones={zones} cities={cities} now={now} onClose={() => setSub(null)} onDone={done} />}
      {(sub === 'price' || sub === 'confirm-price') && <PriceDialog job={job} thenConfirm={sub === 'confirm-price'} onClose={() => setSub(null)} onDone={done} />}
      {sub === 'cancel' && <CancelDialog job={job} onClose={() => setSub(null)} onDone={done} />}
      {sub === 'return' && <ReturnDialog job={job} onClose={() => setSub(null)} onDone={done} />}
      {sub === 'lift' && <LiftCodeDialog job={job} onClose={() => setSub(null)} onDone={done} />}
    </aside>
  );
};
