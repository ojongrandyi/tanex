// Courier app (DISPATCH_SPEC §6; tracker G.4): what a courier.app account opens at the console
// path. Its own lazy chunk, mobile-first, in the courier's language (EN/FR). Screens: Today, Job,
// Cash, History, Profile. Every step is saved on the phone first and synced (./offlineQueue.ts);
// the position is shared only while a job is picked up or on the way (./useLocationSharing.ts).
import './courier.css';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CircleUserRound, CloudOff, History, ListChecks, RefreshCw, Check } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';
import { COMPANY, LOGO_WHITE } from '../config/brand';
import type { DispatchStatus } from '../shared/dispatchStatus';
import { CourierTextContext, useCourierText, useCourierTextValue, type CourierLang } from './context';
import { courierApi, type CashState, type CourierJob, type CourierProfile } from './courierApi';
import { CourierSync, cacheGet, cachePut, newKey, type QueueItem, type SyncState } from './offlineQueue';
import { isFinal, sharesLocation, viewStatus } from './jobLogic';
import { useLocationSharing } from './useLocationSharing';
import { setupCourierPwa } from './pwa';
import { JobDetail } from './JobDetail';
import { HistoryScreen, TodayScreen, type JobView } from './JobsScreens';
import { CashScreen } from './CashScreen';
import { ProfileScreen } from './ProfileScreen';
import { LocationCard } from './LocationCard';
import { errorText } from './ui';
import type { CourierStep } from './sheets';

type Tab = 'today' | 'cash' | 'history' | 'profile';
const POLL_MS = 20_000;
const ACTIVE: readonly DispatchStatus[] = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY'];

// ---- Seen assignments (per user, this phone) ----
const seenKey = (userId: string) => `tx_courier_seen_${userId}`;
function readSeen(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(seenKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function writeSeen(userId: string, ids: Set<string>) {
  try { window.localStorage.setItem(seenKey(userId), JSON.stringify([...ids].slice(-300))); } catch { /* not remembered */ }
}

// ---- New-job alert: vibration, and a short tone once the courier has allowed sound with a tap ----
let audioCtx: AudioContext | null = null;
function unlockSound(): boolean {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = audioCtx ?? new Ctx();
    audioCtx.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}
function alertNewJob() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  for (const at of [0, 0.25]) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.3, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.2);
  }
}

// ---- Entry: loads the dictionary of the courier's language ----

export const CourierApp: React.FC = () => {
  const { user } = useAuth();
  const lang: CourierLang = user?.locale === 'fr' ? 'fr' : 'en';
  useEffect(() => { setupCourierPwa(); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  if (!user) return null;
  return (
    <Suspense fallback={<div className="tx-cr-splash" aria-busy="true" />}>
      <CourierRoot lang={lang} />
    </Suspense>
  );
};

const CourierRoot: React.FC<{ lang: CourierLang }> = ({ lang }) => {
  const text = useCourierTextValue(lang);
  return (
    <CourierTextContext.Provider value={text}>
      <CourierShell />
    </CourierTextContext.Provider>
  );
};

const SyncPill: React.FC<{ state: SyncState; onSync: () => void }> = ({ state, onSync }) => {
  const { t } = useCourierText();
  const n = state.pending.length;
  const label = state.syncing ? t('sync.syncing')
    : !state.online ? (n ? t('sync.pendingCount', { n }) : t('sync.offline'))
      : n ? t('sync.pendingCount', { n }) : t('sync.synced');
  const kind = n || !state.online ? 'pending' : 'ok';
  return (
    <button type="button" className={`tx-cr-sync tx-cr-sync--${kind}`} onClick={onSync} aria-live="polite" title={t('sync.syncNow')}>
      {state.syncing ? <RefreshCw size={16} className="tx-cr-spin" aria-hidden="true" />
        : kind === 'ok' ? <Check size={16} aria-hidden="true" /> : <CloudOff size={16} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
};

const CourierShell: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const userId = user!.id;
  const { t, lang } = useCourierText();

  const sync = useMemo(() => new CourierSync(userId), [userId]);
  useEffect(() => () => sync.dispose(), [sync]);
  const [syncState, setSyncState] = useState<SyncState>(sync.getState());
  useEffect(() => sync.subscribe(setSyncState), [sync]);

  const [jobs, setJobs] = useState<CourierJob[] | null>(null);
  const [jobsFromCache, setJobsFromCache] = useState(false);
  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [cash, setCash] = useState<CashState | null>(null);
  const [cashError, setCashError] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(userId));
  const alerted = useRef<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(false);
  const [dutyBusy, setDutyBusy] = useState(false);
  const [dutyError, setDutyError] = useState<string | null>(null);

  const jobsCache = `jobs:${userId}`;
  const profileCache = `profile:${userId}`;

  const refreshJobs = useCallback(async () => {
    try {
      const list = await courierApi.jobs();
      setJobs(list);
      setJobsFromCache(false);
      cachePut(jobsCache, list);
    } catch (err) {
      if ((err as { status?: number }).status === 401) window.location.reload();
    }
  }, [jobsCache]);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await courierApi.me();
      setProfile(p);
      cachePut(profileCache, p);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === 'NO_COURIER_PROFILE') setFatal(t('app.noProfile'));
    }
  }, [profileCache, t]);

  const refreshCash = useCallback(async () => {
    try {
      setCash(await courierApi.cash());
      setCashError(false);
    } catch {
      setCashError(true);
    }
  }, []);

  // First paint from the copies on the phone, then from the server.
  useEffect(() => {
    let live = true;
    cacheGet<CourierJob[]>(jobsCache).then((c) => { if (live && c) { setJobs((j) => j ?? c); setJobsFromCache(true); } });
    cacheGet<CourierProfile>(profileCache).then((c) => { if (live && c) setProfile((p) => p ?? c); });
    refreshJobs();
    refreshProfile();
    return () => { live = false; };
  }, [jobsCache, profileCache, refreshJobs, refreshProfile]);

  // Poll while the app is visible; refresh at once when it comes back or the network returns.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refreshJobs(); };
    const timer = window.setInterval(tick, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') { refreshJobs(); sync.flush(); } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [refreshJobs, sync]);

  // Server answers to synced steps: take the updated job; a refused step reloads the list.
  useEffect(() => sync.onApplied((item, result) => {
    if (!result.ok) {
      refreshJobs();
      return;
    }
    if (item.kind === 'handover') {
      refreshCash();
      return;
    }
    const updated = result.data as CourierJob | undefined;
    if (updated && typeof updated === 'object' && 'id' in updated) {
      setJobs((list) => {
        if (!list) return list;
        // A declined job is no longer the courier's.
        if (updated.courierUserId !== userId) {
          return list.filter((j) => j.id !== updated.id);
        }
        const next = list.map((j) => (j.id === updated.id ? updated : j));
        cachePut(jobsCache, next);
        return next;
      });
    }
  }), [sync, refreshJobs, refreshCash, jobsCache, userId]);

  useEffect(() => { if (tab === 'cash') refreshCash(); }, [tab, refreshCash]);

  // Views with the status after the waiting steps.
  const views = useMemo<JobView[]>(() => (jobs ?? []).map((job) => ({
    job,
    status: viewStatus(job, syncState.pending),
    pending: syncState.pending.filter((i) => i.jobId === job.id).length,
    unseen: job.status === 'ASSIGNED' && !seen.has(job.id),
  })), [jobs, syncState.pending, seen]);
  const today = views.filter((v) => ACTIVE.includes(v.status));
  const history = views.filter((v) => !ACTIVE.includes(v.status))
    .sort((a, b) => (b.job.deliveredAt ?? b.job.updatedAt) - (a.job.deliveredAt ?? a.job.updatedAt));

  // Alert once per newly assigned job.
  useEffect(() => {
    const fresh = views.filter((v) => v.unseen && !alerted.current.has(v.job.id));
    if (fresh.length === 0) return;
    fresh.forEach((v) => alerted.current.add(v.job.id));
    alertNewJob();
  }, [views]);

  // Location: the job being carried right now.
  const activeJob = views.find((v) => sharesLocation(v.status));
  const location = useLocationSharing(activeJob?.job.id ?? null);

  // Android back button closes the job screen.
  const openJob = useCallback((id: string) => {
    setOpenId(id);
    setSeen((s) => {
      if (s.has(id)) return s;
      const next = new Set(s).add(id);
      writeSeen(userId, next);
      return next;
    });
    try { window.history.pushState({ txCourierJob: id }, '', window.location.href); } catch { /* ignore */ }
  }, [userId]);
  useEffect(() => {
    const onPop = () => setOpenId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const closeJob = () => {
    if ((window.history.state as { txCourierJob?: string } | null)?.txCourierJob) window.history.back();
    else setOpenId(null);
  };

  const record = useCallback(async (job: CourierJob, step: CourierStep) => {
    const deviceTs = Date.now();
    if (step.action === 'deliver' && (step.photo || step.signature)) {
      await sync.enqueue({ kind: 'pod', jobId: job.id, photo: step.photo, signature: step.signature, recipientName: step.recipientName, note: step.note ?? null });
    }
    const key = newKey();
    const body: Record<string, unknown> = { action: step.action, idempotencyKey: key, deviceTs };
    if (step.action === 'pick_up' && step.cash) body.cash = step.cash;
    if (step.action === 'deliver') {
      body.recipientName = step.recipientName;
      if (step.deliveryCode) body.deliveryCode = step.deliveryCode;
      if (step.cash) body.cash = step.cash;
      if (step.note) body.note = step.note;
    }
    if (step.action === 'fail') {
      body.failureReason = step.failureReason;
      if (step.note) body.note = step.note;
    }
    await sync.enqueue({ key, kind: 'action', jobId: job.id, body });
    if (step.action === 'decline' || step.action === 'deliver' || step.action === 'fail') closeJob();
    // closeJob is stable enough for this use (reads window.history at call time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  const handover = (amount: number, currency: string, note: string) => {
    const key = newKey();
    sync.enqueue({ key, kind: 'handover', jobId: null, body: { amount, currency, ...(note ? { note } : {}), idempotencyKey: key, deviceTs: Date.now() } });
  };

  const setDuty = async (on: boolean) => {
    setDutyBusy(true);
    setDutyError(null);
    try {
      const p = await courierApi.updateMe({ isOnDuty: on });
      setProfile(p);
      cachePut(profileCache, p);
    } catch (err) {
      const e = err as { code?: string; unreachable?: boolean; message?: string };
      setDutyError(e.unreachable ? t('sync.offline') : errorText(t, e.code, undefined, e.message, lang));
    } finally {
      setDutyBusy(false);
    }
  };

  const changeLanguage = async (l: CourierLang) => {
    const updated = await api.updateMyAccount({ locale: l });
    if (updated) setUser(updated);
  };
  const withdrawConsent = async () => {
    const p = await courierApi.updateMe({ showPhotoPublicly: false });
    setProfile(p);
    cachePut(profileCache, p);
  };

  const enableSound = () => {
    if (unlockSound()) {
      setSoundOn(true);
      alertNewJob();
    }
  };
  // Any tap also unlocks sound (browsers only allow audio after a user gesture).
  useEffect(() => {
    const unlock = () => { if (unlockSound()) setSoundOn(true); };
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  const openView = openId ? views.find((v) => v.job.id === openId) : undefined;
  const failures = syncState.failures;
  const queuedHandovers = syncState.pending.filter((i: QueueItem) => i.kind === 'handover');

  if (fatal) {
    return (
      <div className="tx-cr-app">
        <div className="tx-cr-screen"><p className="tx-cr-error">{fatal}</p>
          <button type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--block" onClick={() => logout()}>{t('app.signOut')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tx-cr-app">
      <header className="tx-cr-header">
        <img src={LOGO_WHITE} alt={COMPANY} width={81} height={28} className="tx-cr-header__logo" />
        <span className="tx-cr-header__name">{t('app.name')}</span>
        <SyncPill state={syncState} onSync={() => { sync.flush(); refreshJobs(); }} />
      </header>

      <div className="tx-cr-banners">
        {syncState.signedOut && (
          <div className="tx-cr-banner tx-cr-banner--error" role="alert">
            <p>{t('errors.SIGNED_OUT')}</p>
            <button type="button" className="tx-cr-btn tx-cr-btn--secondary tx-cr-btn--small" onClick={() => window.location.reload()}>{t('app.retry')}</button>
          </div>
        )}
        {failures.map((f) => {
          const job = jobs?.find((j) => j.id === f.jobId);
          return (
            <div key={f.key} className="tx-cr-banner tx-cr-banner--error" role="alert">
              <p>
                {job ? <strong className="tx-cr-mono">{job.trackingNumber} · </strong> : null}
                {t('sync.failed', { reason: errorText(t, f.code, f.details, f.message, lang) })}
              </p>
              <button type="button" className="tx-cr-btn tx-cr-btn--secondary tx-cr-btn--small" onClick={() => sync.dismissFailure(f.key)}>{t('sync.dismiss')}</button>
            </div>
          );
        })}
        {jobsFromCache && !syncState.online && <p className="tx-cr-banner tx-cr-banner--info">{t('sync.showingSaved')}</p>}
      </div>

      <main className="tx-cr-main">
        {openView ? (
          <JobDetail
            job={openView.job}
            status={openView.status}
            pendingCount={openView.pending}
            location={location}
            onBack={closeJob}
            onStep={record}
          />
        ) : openId ? (
          <div className="tx-cr-screen">
            <p className="tx-cr-note">{t('job.notFound')}</p>
            <button type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--block" onClick={closeJob}>{t('app.back')}</button>
          </div>
        ) : jobs === null ? (
          <div className="tx-cr-screen"><p className="tx-cr-muted">{t('app.loading')}</p></div>
        ) : (
          <>
            {tab === 'today' && activeJob && !isFinal(activeJob.status) && (
              <div className="tx-cr-screen tx-cr-screen--tight"><LocationCard location={location} /></div>
            )}
            {tab === 'today' && (
              <TodayScreen
                views={today} profile={profile} dutyBusy={dutyBusy} dutyError={dutyError} onDuty={setDuty}
                onOpen={openJob} soundOn={soundOn} onSound={enableSound}
              />
            )}
            {tab === 'cash' && <CashScreen cash={cash} error={cashError} queued={queuedHandovers} onHandover={handover} />}
            {tab === 'history' && <HistoryScreen views={history} onOpen={openJob} />}
            {tab === 'profile' && (
              <ProfileScreen
                profile={profile} displayName={user!.displayName}
                onLanguage={changeLanguage} onWithdrawConsent={withdrawConsent} onSignOut={() => logout()}
              />
            )}
          </>
        )}
      </main>

      {!openView && (
        <nav className="tx-cr-nav" aria-label={t('nav.label')}>
          {([
            ['today', ListChecks, t('nav.today'), today.filter((v) => v.unseen).length],
            ['cash', Banknote, t('nav.cash'), 0],
            ['history', History, t('nav.history'), 0],
            ['profile', CircleUserRound, t('nav.profile'), 0],
          ] as const).map(([id, Icon, label, badge]) => (
            <button
              key={id}
              type="button"
              className={`tx-cr-nav__item${tab === id ? ' is-active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => { setTab(id); window.scrollTo(0, 0); }}
            >
              <Icon size={24} aria-hidden="true" />
              <span>{label}</span>
              {badge > 0 && <span className="tx-cr-nav__badge">{badge}</span>}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};
