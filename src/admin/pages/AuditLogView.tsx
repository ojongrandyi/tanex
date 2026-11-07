// Audit log (docs/IAM_RBAC_SPEC.md §9): filter by person, action, record and date; newest
// first, 50 per page; each entry opens to show what changed (before / after). Dates are read
// and shown in the office time zone.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { api, type AuditEntry, type AuditFilters, type AuditPage } from '../../services/api';
import { IAM_TEXT, iamErrorText } from '../../auth/strings';
import { formatEventTimestamp, zonedTimeToUtc } from '../../shared/timeZones';
import { OFFICE_TIME_ZONE } from '../../config/brand';
import './IamViews.css';

const T = IAM_TEXT.audit;
const PAGE_SIZE = 50;
const DAY_MS = 86_400_000;

interface Filters { actor: string; action: string; entityType: string; entityId: string; from: string; to: string }
const EMPTY: Filters = { actor: '', action: '', entityType: '', entityId: '', from: '', to: '' };

/** Start of a YYYY-MM-DD day in the office time zone, as epoch ms. */
const dayStart = (date: string): number | undefined => (date ? zonedTimeToUtc(date, '00:00', OFFICE_TIME_ZONE) ?? undefined : undefined);

const show = (value: unknown): string => (value === null || value === undefined ? '' : JSON.stringify(value, null, 2));

const Detail: React.FC<{ entry: AuditEntry }> = ({ entry }) => {
  const before = show(entry.before);
  const after = show(entry.after);
  return (
    <>
      {before || after ? (
        <div className="tx-audit-detail">
          <div>
            <h4>{T.before}</h4>
            <pre>{before || '–'}</pre>
          </div>
          <div>
            <h4>{T.after}</h4>
            <pre>{after || '–'}</pre>
          </div>
        </div>
      ) : (
        <p className="tx-iam-muted" style={{ margin: '0.5rem 0 0' }}>{T.noDetail}</p>
      )}
      {entry.ip && <p className="tx-iam-sub" style={{ marginTop: '0.4rem' }}>{T.ip}: {entry.ip}</p>}
    </>
  );
};

export const AuditLogView: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  // The record ID box is applied when the person stops typing, not on every key.
  const [entityIdInput, setEntityIdInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [options, setOptions] = useState<AuditFilters>({ actions: [], entityTypes: [], actors: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.getAuditFilters().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((f) => (f.entityId === entityIdInput.trim() ? f : { ...f, entityId: entityIdInput.trim() }));
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [entityIdInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const toStart = dayStart(filters.to);
      const result = await api.getAuditLog({
        actor: filters.actor || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        from: dayStart(filters.from),
        // The "to" day is included: up to the start of the next day.
        to: toStart === undefined ? undefined : toStart + DAY_MS,
        page,
        pageSize: PAGE_SIZE
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError(iamErrorText(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const clear = () => {
    setFilters(EMPTY);
    setEntityIdInput('');
    setPage(1);
  };
  const filtered = Object.values(filters).some(Boolean) || entityIdInput !== '';
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="tx-iam animate-fade-in">
      <div className="tx-iam-card">
        <div className="tx-audit-filters">
          <label className="tx-iam-field">
            <span>{T.filters.person}</span>
            <select value={filters.actor} onChange={(e) => set({ actor: e.target.value })}>
              <option value="">{T.all.person}</option>
              {options.actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="tx-iam-field">
            <span>{T.filters.action}</span>
            <select value={filters.action} onChange={(e) => set({ action: e.target.value })}>
              <option value="">{T.all.action}</option>
              {options.actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="tx-iam-field">
            <span>{T.filters.record}</span>
            <select value={filters.entityType} onChange={(e) => set({ entityType: e.target.value })}>
              <option value="">{T.all.record}</option>
              {options.entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="tx-iam-field">
            <span>{T.filters.recordId}</span>
            <input type="search" value={entityIdInput} maxLength={100} onChange={(e) => setEntityIdInput(e.target.value)} />
          </label>
          <label className="tx-iam-field">
            <span>{T.filters.date}: {T.filters.from}</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label className="tx-iam-field">
            <span>{T.filters.date}: {T.filters.to}</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
          </label>
          <div>
            <button type="button" className="tx-iam-btn" onClick={clear} disabled={!filtered}>{T.clear}</button>
          </div>
        </div>
      </div>

      {error && (
        <div className="tx-iam-notice error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="tx-iam-card" aria-busy={loading}>
        {!data && !error && <p className="tx-iam-muted">{T.loading}</p>}
        {data && data.items.length === 0 && <p className="tx-iam-muted">{T.empty}</p>}
        {data && data.items.length > 0 && (
          <table className="tx-iam-table">
            <thead>
              <tr>
                <th scope="col">{T.columns.when}</th>
                <th scope="col">{T.columns.person}</th>
                <th scope="col">{T.columns.action}</th>
                <th scope="col">{T.columns.record}</th>
                <th scope="col">{T.columns.summary}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => {
                const isOpen = open === entry.id;
                return (
                  <tr key={entry.id}>
                    <td data-label={T.columns.when}>{formatEventTimestamp(entry.at, OFFICE_TIME_ZONE)}</td>
                    <td data-label={T.columns.person}>{entry.actorUserId ? entry.actorName : (entry.actorName || T.notSignedIn)}</td>
                    <td data-label={T.columns.action}><span className="tx-audit-action">{entry.action}</span></td>
                    <td data-label={T.columns.record}>
                      {entry.entityType && <span className="tx-iam-sub">{entry.entityType}</span>}
                      {entry.entityId && <span className="tx-audit-action">{entry.entityId}</span>}
                    </td>
                    <td data-label={T.columns.summary}>
                      <button type="button" className="tx-iam-btn small" aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : entry.id)}
                        style={{ float: 'right', marginLeft: '0.5rem' }}
                        aria-label={isOpen ? T.hideDetail : T.showDetail}>
                        {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                      </button>
                      {entry.summary}
                      {isOpen && <Detail entry={entry} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {data && data.total > 0 && (
          <div className="tx-audit-pager">
            <span className="tx-iam-muted">{T.entries(data.total)}</span>
            <div>
              <button type="button" className="tx-iam-btn small" disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>{T.previous}</button>
              <span className="tx-iam-muted">{T.page(page, pages)}</span>
              <button type="button" className="tx-iam-btn small" disabled={page >= pages || loading}
                onClick={() => setPage((p) => p + 1)}>{T.next}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
