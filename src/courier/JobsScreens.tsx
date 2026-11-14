// Today and History (DISPATCH_SPEC §6 screens 1 and 5): job cards with pickup / drop-off area and
// landmark, size, cash to collect and the express badge; unseen assignments are highlighted.
import React from 'react';
import { ArrowRight, Bell, Zap } from 'lucide-react';
import type { DispatchStatus } from '../shared/dispatchStatus';
import { useCourierText } from './context';
import type { CourierJob, CourierProfile } from './courierApi';
import { deliveryCollect, pickupCollect, placeTitle } from './jobLogic';
import { StatusChip } from './ui';

export interface JobView { job: CourierJob; status: DispatchStatus; pending: number; unseen: boolean }

const JobCard: React.FC<{ view: JobView; onOpen: (id: string) => void }> = ({ view, onOpen }) => {
  const { t, money, time } = useCourierText();
  const { job, status } = view;
  // What is still to collect: the pickup fee until pickup, the delivery amount until the job ends.
  const before = (s: DispatchStatus[]) => s.includes(status);
  const collect = (before(['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY']) ? deliveryCollect(job).total : 0)
    + (before(['ASSIGNED', 'ACCEPTED']) ? pickupCollect(job) : 0);
  const when = job.deliveredAt ?? job.cancelledAt ?? job.scheduledForTs;
  return (
    <li>
      <button
        type="button"
        className={`tx-cr-card${view.unseen ? ' is-unseen' : ''}`}
        onClick={() => onOpen(job.id)}
        aria-label={t('job.open', { id: job.trackingNumber })}
      >
        <div className="tx-cr-card__top">
          <StatusChip status={status} />
          {job.isExpress && <span className="tx-cr-badge tx-cr-badge--express"><Zap size={14} aria-hidden="true" />{t('job.express')}</span>}
          {view.unseen && <span className="tx-cr-badge tx-cr-badge--new">{t('today.newJob')}</span>}
          <span className="tx-cr-mono tx-cr-card__id">{job.trackingNumber}</span>
        </div>
        <div className="tx-cr-card__route">
          <div>
            <span className="tx-cr-card__label">{t('job.pickup')}</span>
            <strong>{placeTitle(job.pickup)}</strong>
            {job.pickup.landmark && <span className="tx-cr-card__landmark">{job.pickup.landmark}</span>}
          </div>
          <ArrowRight size={18} aria-hidden="true" className="tx-cr-card__arrow" />
          <div>
            <span className="tx-cr-card__label">{t('job.dropoff')}</span>
            <strong>{placeTitle(job.dropoff)}</strong>
            {job.dropoff.landmark && <span className="tx-cr-card__landmark">{job.dropoff.landmark}</span>}
          </div>
        </div>
        <div className="tx-cr-card__meta">
          {job.sizeClass && <span>{t(`sizes.${job.sizeClass}`)}</span>}
          {job.weightKg ? <span>{t('job.weight', { n: job.weightKg })}</span> : null}
          {collect > 0 && <span className="tx-cr-money">{t('job.cashToCollect', { amount: money(collect, job.currency) })}</span>}
          {when ? <span>{time(when)}</span> : null}
          {view.pending > 0 && <span className="tx-cr-pending-dot">{t('sync.pending')}</span>}
        </div>
      </button>
    </li>
  );
};

export const TodayScreen: React.FC<{
  views: JobView[];
  profile: CourierProfile | null;
  dutyBusy: boolean;
  dutyError: string | null;
  onDuty: (on: boolean) => void;
  onOpen: (id: string) => void;
  soundOn: boolean;
  onSound: () => void;
}> = ({ views, profile, dutyBusy, dutyError, onDuty, onOpen, soundOn, onSound }) => {
  const { t } = useCourierText();
  const unseen = views.filter((v) => v.unseen).length;
  return (
    <section className="tx-cr-screen" aria-labelledby="cr-today">
      <h1 id="cr-today" className="tx-cr-h1">{t('today.title')}</h1>
      {profile && (
        <div className={`tx-cr-duty${profile.isOnDuty ? ' is-on' : ''}`}>
          <label className="tx-cr-switch">
            <input type="checkbox" role="switch" checked={profile.isOnDuty} disabled={dutyBusy} onChange={(e) => onDuty(e.target.checked)} />
            <span className="tx-cr-switch__track" aria-hidden="true"><span /></span>
            <span className="tx-cr-switch__text">{profile.isOnDuty ? t('today.onDuty') : t('today.offDuty')}</span>
          </label>
          {!profile.isOnDuty && <p className="tx-cr-muted">{t('today.dutyHint')}</p>}
          {dutyError && <p className="tx-cr-error" role="alert">{dutyError}</p>}
        </div>
      )}
      {unseen > 0 && (
        <p className="tx-cr-newbanner" role="status">
          <Bell size={20} aria-hidden="true" /> {unseen === 1 ? t('today.newJob') : t('today.newJobs', { n: unseen })}
        </p>
      )}
      {!soundOn && (
        <button type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--block" onClick={onSound}>
          <Bell size={18} aria-hidden="true" /> {t('today.enableAlerts')}
        </button>
      )}
      {views.length === 0
        ? <p className="tx-cr-empty">{t('today.empty')}</p>
        : <ul className="tx-cr-list">{views.map((v) => <JobCard key={v.job.id} view={v} onOpen={onOpen} />)}</ul>}
    </section>
  );
};

export const HistoryScreen: React.FC<{ views: JobView[]; onOpen: (id: string) => void }> = ({ views, onOpen }) => {
  const { t, date } = useCourierText();
  // Grouped by day, newest first.
  const groups = new Map<string, JobView[]>();
  for (const v of views) {
    const d = date(v.job.deliveredAt ?? v.job.cancelledAt ?? v.job.updatedAt);
    groups.set(d, [...(groups.get(d) ?? []), v]);
  }
  return (
    <section className="tx-cr-screen" aria-labelledby="cr-history">
      <h1 id="cr-history" className="tx-cr-h1">{t('history.title')}</h1>
      <p className="tx-cr-muted">{t('history.intro')}</p>
      {views.length === 0 && <p className="tx-cr-empty">{t('history.empty')}</p>}
      {[...groups].map(([day, list]) => (
        <div key={day}>
          <h2 className="tx-cr-h2">{day}</h2>
          <ul className="tx-cr-list">{list.map((v) => <JobCard key={v.job.id} view={v} onOpen={onOpen} />)}</ul>
        </div>
      ))}
    </section>
  );
};
