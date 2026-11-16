// Console → Dispatch (DISPATCH_SPEC §7; tracker G.5). dispatch.view sees the board; dispatch.manage
// also creates, prices, assigns, cancels and returns jobs (the server checks and audits each one).
// Columns: Requested · To assign · Assigned · In progress · Problems (failed, late, stale location,
// locked code) · Done today, by the shared rules in src/shared/dispatchBoard.ts (the sidebar badge
// counts with the same rules on the server). Filters by city, vehicle and courier; a live map of
// couriers (stale markers greyed) and active job routes; the courier list; one GET /board call
// every 15 s while the tab is visible.
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  BOARD_COLUMNS, BOARD_REFRESH_MS, LOCATION_STALE_MS, boardColumn, jobProblems, placePoint, startOfDay, finishedAt,
  type BoardColumn,
} from '../../shared/dispatchBoard';
import { DISPATCH_STATUS_LABELS, VEHICLE_LABELS, VEHICLE_TYPES, type VehicleType } from '../../shared/dispatchStatus';
import { SIZE_CLASS_LABELS } from '../../shared/localPricing';
import { boardApi, type BoardData, type DispatchJob } from './boardApi';
import { BOARD_TEXT } from './boardStrings';
import { initials, minutesAgo, money, placeLine, when } from './boardFormat';
import { JobDrawer } from './JobDrawer';
import type { MapCourier, MapRoute } from './DispatchMap';
import '../pages/IamViews.css';
import './Dispatch.css';
import './DispatchBoard.css';

// Leaflet and the map code load only when the board is open (and the map is near the screen).
const DispatchMap = lazy(() => import('./DispatchMap').then((m) => ({ default: m.DispatchMap })));
const CreateJobDialog = lazy(() => import('./CreateJobDialog').then((m) => ({ default: m.CreateJobDialog })));

const T = BOARD_TEXT;
const F = BOARD_TEXT.filters;
type Notice = { kind: 'ok' | 'error'; text: string } | null;
const ACTIVE = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'FAILED_ATTEMPT'];

const JobCard: React.FC<{ job: DispatchJob; problems: string[]; now: number; selected: boolean; onOpen: () => void }> = ({ job, problems, now, selected, onOpen }) => (
  <li>
    <button type="button" className={`tx-board-card${selected ? ' is-selected' : ''}${job.isExpress ? ' is-express' : ''}`}
      onClick={onOpen} aria-label={T.card.open(job.trackingNumber)} aria-current={selected ? 'true' : undefined}>
      <span className="tx-board-card-top">
        <span className="font-mono tx-board-card-id">{job.trackingNumber}</span>
        <span className={`tx-board-status is-${job.status.toLowerCase()}`}>{DISPATCH_STATUS_LABELS[job.status].en}</span>
      </span>
      <span className="tx-board-card-route">
        <span>{placeLine(job.pickup)}</span>
        <span aria-hidden="true"> → </span>
        <span>{placeLine(job.dropoff)}</span>
      </span>
      <span className="tx-board-card-meta">
        {job.sizeClass ? SIZE_CLASS_LABELS[job.sizeClass].en : job.weightKg !== null ? `${job.weightKg} kg` : T.scope[job.scope]}
        {' · '}{VEHICLE_LABELS[job.vehicleRequired].en}
        {' · '}{job.price !== null ? money(job.price, job.currency) : T.card.noPrice}
      </span>
      <span className="tx-board-card-meta">
        {job.courier ? job.courier.displayName : T.card.notAssigned}
        {job.scheduledForTs !== null && ` · ${T.card.pickupAt(when(job.scheduledForTs, now))}`}
      </span>
      {(job.isExpress || job.codAmount !== null || problems.length > 0) && (
        <span className="tx-board-chips">
          {job.isExpress && <span className="tx-iam-chip warn">{T.card.express}</span>}
          {job.codAmount !== null && <span className="tx-iam-chip">{T.card.cod(money(job.codAmount, job.currency))}</span>}
          {problems.map((p) => <span key={p} className="tx-iam-chip off">{p}</span>)}
        </span>
      )}
    </button>
  </li>
);

export const DispatchBoardView: React.FC<{
  searchQuery?: string;
  /** Called after each refresh and action so the sidebar badge can follow. */
  onBoardChanged?: () => void;
  onOpenTracking?: (trackingNumber: string) => void;
}> = ({ searchQuery = '', onBoardChanged, onOpenTracking }) => {
  const { can } = useAuth();
  const canManage = can('dispatch.manage');
  const [data, setData] = useState<BoardData | null>(null);
  const [skew, setSkew] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Last copy of the open job, kept if it drops off the board (finished more than a day ago).
  const [selectedCopy, setSelectedCopy] = useState<DispatchJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [city, setCity] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType | ''>('');
  const [courier, setCourier] = useState('');
  const [search, setSearch] = useState('');
  const changedRef = useRef(onBoardChanged);
  changedRef.current = onBoardChanged;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const board = await boardApi.board();
      setData(board);
      setSkew(board.serverTime - Date.now());
      setTick(Date.now());
      setLastLoaded(board.serverTime);
      setLoadError(false);
      changedRef.current?.();
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refresh every 15 s while the tab is visible, and at once when it becomes visible again.
  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, BOARD_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const now = tick + skew;
  const lastPing = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data?.couriers ?? []) if (c.lastPosition) m.set(c.userId, c.lastPosition.recordedAt);
    return m;
  }, [data]);
  const pingOf = useCallback((j: DispatchJob) => (j.courierUserId ? lastPing.get(j.courierUserId) ?? null : null), [lastPing]);

  const q = (search || searchQuery).trim().toUpperCase();
  const filtered = useMemo(() => (data?.jobs ?? []).filter((j) =>
    (!city || j.pickup.cityId === city || j.dropoff.cityId === city)
    && (!vehicle || j.vehicleRequired === vehicle)
    && (!courier || (courier === '-' ? !j.courierUserId : j.courierUserId === courier))
    && (!q || j.trackingNumber.includes(q))), [data, city, vehicle, courier, q]);

  const dayStart = startOfDay(now);
  const columns = useMemo(() => {
    const out = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as DispatchJob[]])) as Record<BoardColumn, DispatchJob[]>;
    for (const j of filtered) {
      const col = boardColumn(j, pingOf(j), now, dayStart);
      if (col) out[col].push(j);
    }
    // Oldest waiting first; done today newest first.
    for (const c of BOARD_COLUMNS) {
      out[c].sort(c === 'DONE_TODAY' ? (a, b) => finishedAt(b) - finishedAt(a) : (a, b) => (a.isExpress === b.isExpress ? a.createdAt - b.createdAt : a.isExpress ? -1 : 1));
    }
    return out;
  }, [filtered, pingOf, now, dayStart]);

  const selected = (selectedId && data?.jobs.find((j) => j.id === selectedId)) || (selectedCopy?.id === selectedId ? selectedCopy : null);
  useEffect(() => {
    if (selected && selected !== selectedCopy) setSelectedCopy(selected);
  }, [selected, selectedCopy]);

  const onJobChanged = (job: DispatchJob, message: string) => {
    setData((d) => (d ? { ...d, jobs: d.jobs.some((j) => j.id === job.id) ? d.jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...d.jobs] } : d));
    setSelectedCopy(job);
    setNotice({ kind: 'ok', text: message });
    load();
  };

  // Map: couriers on duty with a position (filtered by city/vehicle), and routes of active jobs.
  const visibleCouriers = useMemo(() => (data?.couriers ?? []).filter((c) =>
    (!city || c.homeCityId === city) && (!vehicle || c.vehicleType === vehicle)), [data, city, vehicle]);
  const mapCouriers: MapCourier[] = useMemo(() => visibleCouriers
    .filter((c) => c.isOnDuty && c.lastPosition)
    .map((c) => {
      const age = now - c.lastPosition!.recordedAt;
      return {
        userId: c.userId, initials: initials(c.displayName),
        label: `${c.displayName} · ${T.couriers.lastSeen(minutesAgo(c.lastPosition!.recordedAt, now))}`,
        at: { lat: c.lastPosition!.lat, lng: c.lastPosition!.lng }, stale: age > LOCATION_STALE_MS,
      };
    }), [visibleCouriers, now]);
  const mapRoutes: MapRoute[] = useMemo(() => filtered
    .filter((j) => !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(j.status))
    .map((j) => ({
      jobId: j.id, label: `${j.trackingNumber}: ${placeLine(j.pickup)} → ${placeLine(j.dropoff)}`,
      from: placePoint(j.pickup, data?.zones ?? [], data?.cities ?? []),
      to: placePoint(j.dropoff, data?.zones ?? [], data?.cities ?? []),
    }))
    .filter((r) => r.from || r.to), [filtered, data]);

  const doneToday = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of data?.jobs ?? []) {
      if (j.courierUserId && (j.status === 'DELIVERED' || j.status === 'RETURNED') && finishedAt(j) >= dayStart) {
        m.set(j.courierUserId, (m.get(j.courierUserId) ?? 0) + 1);
      }
    }
    return m;
  }, [data, dayStart]);

  const activeCount = (data?.jobs ?? []).filter((j) => ACTIVE.includes(j.status)).length;
  const filtersOn = !!(city || vehicle || courier || search);

  if (!data) {
    return (
      <div className="tx-iam">
        {loadError
          ? <div className="tx-iam-notice error" role="alert"><AlertCircle size={14} aria-hidden="true" /><span>{T.refreshFailed}</span></div>
          : <p className="tx-iam-muted" role="status">{T.loading}</p>}
      </div>
    );
  }

  return (
    <div className="tx-iam tx-board">
      <div className="tx-iam-toolbar tx-board-toolbar" role="search" aria-label={F.label}>
        <label className="tx-iam-field">
          <span>{F.city}</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{F.allCities}</option>
            {data.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="tx-iam-field">
          <span>{F.vehicle}</span>
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleType | '')}>
            <option value="">{F.allVehicles}</option>
            {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{VEHICLE_LABELS[v].en}</option>)}
          </select>
        </label>
        <label className="tx-iam-field">
          <span>{F.courier}</span>
          <select value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">{F.allCouriers}</option>
            <option value="-">{F.unassigned}</option>
            {data.couriers.map((c) => <option key={c.userId} value={c.userId}>{c.displayName}</option>)}
          </select>
        </label>
        <label className="tx-iam-field">
          <span>{F.search}</span>
          <input type="search" className="font-mono" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {filtersOn && (
          <button type="button" className="tx-iam-btn small" onClick={() => { setCity(''); setVehicle(''); setCourier(''); setSearch(''); }}>{F.clear}</button>
        )}
        <span className="tx-board-toolbar-end">
          <span className="tx-iam-muted tx-board-updated" aria-live="polite">
            {loadError ? T.refreshFailed : lastLoaded ? T.updatedAt(when(lastLoaded, now)) : ''}
          </span>
          <button type="button" className="tx-iam-btn small" onClick={load} disabled={refreshing} aria-label={T.refresh}>
            <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'tx-board-spin' : undefined} /> {T.refresh}
          </button>
          {canManage && (
            <button type="button" className="tx-iam-btn primary small" onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" /> {T.newJob}
            </button>
          )}
        </span>
      </div>

      {notice && (
        <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="tx-board-columns">
        {BOARD_COLUMNS.map((col) => (
          <section key={col} className={`tx-board-column is-${col.toLowerCase()}`} aria-labelledby={`tx-board-col-${col}`}>
            <h2 id={`tx-board-col-${col}`}>
              {T.columns[col]} <span className="tx-board-count" aria-label={T.jobsCount(columns[col].length)}>{columns[col].length}</span>
            </h2>
            {columns[col].length === 0 ? <p className="tx-iam-muted tx-board-empty">{T.emptyColumn}</p> : (
              <ul className="tx-board-cards">
                {columns[col].map((j) => (
                  <JobCard key={j.id} job={j} now={now} selected={j.id === selectedId}
                    problems={jobProblems(j, pingOf(j), now).map((p) => T.problems[p])}
                    onOpen={() => setSelectedId(j.id)} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="tx-board-lower">
        <section className="tx-iam-card tx-board-map-card" aria-labelledby="tx-board-map-title">
          <h2 id="tx-board-map-title">{T.map.title}</h2>
          <Suspense fallback={<div className="tx-board-map" aria-hidden="true" />}>
            <DispatchMap couriers={mapCouriers} routes={mapRoutes} onOpenJob={setSelectedId} />
          </Suspense>
          <ul className="tx-board-legend">
            <li><span className="tx-board-dot" aria-hidden="true" /> {T.map.fresh}</li>
            <li><span className="tx-board-dot is-stale" aria-hidden="true" /> {T.map.stale}</li>
            <li><span className="tx-board-line" aria-hidden="true" /> {T.map.route}</li>
          </ul>
          {mapCouriers.length === 0 && <p className="tx-iam-hint">{T.map.noPositions}</p>}
          {activeCount > 0 && mapRoutes.length === 0 && <p className="tx-iam-hint">{T.map.noPins}</p>}
        </section>

        <section className="tx-iam-card tx-board-couriers" aria-labelledby="tx-board-couriers-title">
          <h2 id="tx-board-couriers-title">{T.couriers.title}</h2>
          {visibleCouriers.length === 0 ? <p className="tx-iam-muted">{T.couriers.empty}</p> : (
            <div className="tx-board-table-wrap">
              <table className="tx-iam-table">
                <thead>
                  <tr>
                    <th scope="col">{T.couriers.columns.courier}</th>
                    <th scope="col">{T.couriers.columns.status}</th>
                    <th scope="col">{T.couriers.columns.active}</th>
                    <th scope="col">{T.couriers.columns.done}</th>
                    <th scope="col">{T.couriers.columns.lastSeen}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCouriers.map((c) => {
                    const stale = !c.lastPosition || now - c.lastPosition.recordedAt > LOCATION_STALE_MS;
                    return (
                      <tr key={c.userId} className={c.accountStatus !== 'ACTIVE' ? 'is-disabled' : undefined}>
                        <td data-label={T.couriers.columns.courier}>
                          <strong>{c.displayName}</strong>
                          <span className="tx-iam-sub">{VEHICLE_LABELS[c.vehicleType]?.en ?? c.vehicleType}{c.phone ? ` · ${c.phone}` : ''}</span>
                        </td>
                        <td data-label={T.couriers.columns.status}>
                          {c.accountStatus !== 'ACTIVE'
                            ? <span className="tx-iam-chip off">{T.couriers.disabled}</span>
                            : c.isOnDuty ? <span className="tx-iam-chip ok">{T.couriers.onDuty}</span> : <span className="tx-iam-chip">{T.couriers.offDuty}</span>}
                        </td>
                        <td className="font-mono" data-label={T.couriers.columns.active}>{c.activeJobs}</td>
                        <td className="font-mono" data-label={T.couriers.columns.done}>{doneToday.get(c.userId) ?? 0}</td>
                        <td className={stale ? 'tx-iam-muted' : undefined} data-label={T.couriers.columns.lastSeen}>
                          {c.lastPosition ? T.couriers.lastSeen(minutesAgo(c.lastPosition.recordedAt, now)) : T.couriers.never}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selected && (
        <JobDrawer job={selected} problems={jobProblems(selected, pingOf(selected), now)}
          couriers={data.couriers} zones={data.zones} cities={data.cities} now={now} canManage={canManage}
          onClose={() => { setSelectedId(null); setSelectedCopy(null); }} onChanged={onJobChanged} onOpenTracking={onOpenTracking} />
      )}

      {creating && (
        <Suspense fallback={null}>
          <CreateJobDialog cities={data.cities} zones={data.zones} onClose={() => setCreating(false)}
            onCreated={(job) => { setCreating(false); setSelectedId(job.id); onJobChanged(job, T.create.created(job.trackingNumber)); }} />
        </Suspense>
      )}
    </div>
  );
};
