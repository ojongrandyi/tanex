// Console → Cash & Mobile Money (DISPATCH_SPEC §9; tracker G.8). cash.view sees what each courier
// holds, every entry waiting for Finance and the daily report (+ CSV); cash.confirm also confirms or
// rejects handovers and mobile money references and records adjustments with a reason. The server
// checks the permission and audits every change.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { IamDialog } from '../components/IamDialog';
import { money, when } from '../dispatch/boardFormat';
import { cashApi, reportCsvUrl, type CashCourier, type CashEntry, type CashOverview, type CashReport } from './cashApi';
import { CASH_TEXT, cashErrorText } from './strings';
import '../pages/IamViews.css';
import './Cash.css';

const T = CASH_TEXT;
type Tab = 'pending' | 'couriers' | 'report';
type Notice = { kind: 'ok' | 'error'; text: string } | null;

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Douala', day: 'numeric', month: 'short' });

const NoticeLine: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

const methodLine = (e: CashEntry) =>
  e.type === 'COLLECTED' && e.method !== 'CASH' ? `${T.methods[e.method] ?? e.method} · ${T.collectedMoMo}` : (T.methods[e.method] ?? e.method);

/** Ledger rows (pending list and one courier's statement). */
const EntryTable: React.FC<{
  entries: CashEntry[]; now: number; showCourier: boolean; canConfirm: boolean; busyId: string | null;
  onConfirm?: (e: CashEntry) => void; onReject?: (e: CashEntry) => void;
}> = ({ entries, now, showCourier, canConfirm, busyId, onConfirm, onReject }) => (
  <div className="tx-cash-scroll">
    <table className="tx-iam-table tx-cash-table">
      <thead>
        <tr>
          <th scope="col">{T.columns.when}</th>
          <th scope="col">{T.columns.ref}</th>
          {showCourier && <th scope="col">{T.columns.courier}</th>}
          <th scope="col">{T.columns.type}</th>
          <th scope="col">{T.columns.method}</th>
          <th scope="col" className="is-num">{T.columns.amount}</th>
          <th scope="col">{T.columns.status}</th>
          {canConfirm && onConfirm && <th scope="col">{T.columns.actions}</th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td data-label={T.columns.when}>{when(e.createdAt, now)}{e.recordedByName && <span className="tx-iam-sub">{T.by(e.recordedByName)}</span>}</td>
            <td data-label={T.columns.ref}><span className="font-mono">{e.ref}</span>{e.trackingNumber && <span className="tx-iam-sub font-mono">{e.trackingNumber}</span>}</td>
            {showCourier && <td data-label={T.columns.courier}>{e.courierName ?? '—'}</td>}
            <td data-label={T.columns.type}>{T.types[e.type] ?? e.type}{e.note && <span className="tx-iam-sub">{e.note}</span>}</td>
            <td data-label={T.columns.method} className="is-wrap">{methodLine(e)}{e.momoReference && <span className="tx-iam-sub font-mono">{T.columns.momoRef}: {e.momoReference}</span>}</td>
            <td data-label={T.columns.amount} className="is-num">{money(e.amount, e.currency)}</td>
            <td data-label={T.columns.status}>
              <span className={`tx-iam-chip${e.status === 'REJECTED' ? ' warn' : ''}`}>{T.statuses[e.status] ?? e.status}</span>
              {e.confirmedByName && e.status !== 'PENDING' && <span className="tx-iam-sub">{T.by(e.confirmedByName)}</span>}
            </td>
            {canConfirm && onConfirm && (
              <td data-label={T.columns.actions}>
                {e.status === 'PENDING' && (
                  <span className="tx-iam-row-actions">
                    <button type="button" className="tx-iam-btn small primary" disabled={busyId === e.id} onClick={() => onConfirm(e)}>{T.confirm}</button>
                    <button type="button" className="tx-iam-btn small danger" disabled={busyId === e.id} onClick={() => onReject?.(e)}>{T.reject}</button>
                  </span>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RejectDialog: React.FC<{ entry: CashEntry; onClose: () => void; onDone: (e: CashEntry, charged: boolean) => void }> = ({ entry, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  // #175: never charged by default; offered only for a mobile money payment the courier recorded.
  const chargeable = entry.type === 'COLLECTED' && entry.method !== 'CASH';
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!reason.trim()) return setError(T.reasonRequired);
    setBusy(true);
    setError(null);
    try {
      onDone(await cashApi.reject(entry.id, reason.trim(), chargeable && charge), chargeable && charge);
    } catch (err) {
      setError(cashErrorText(err));
      setBusy(false);
    }
  };
  return (
    <IamDialog title={T.rejectTitle(entry.ref)} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <p className="tx-iam-hint">{T.types[entry.type]} · {money(entry.amount, entry.currency)} · {entry.courierName}</p>
        <label className="tx-iam-field">
          <span>{T.rejectReason}</span>
          <textarea rows={2} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} />
          <small>{T.rejectHint}</small>
        </label>
        {chargeable && (
          <label className="tx-iam-check">
            <input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />
            <span>{T.chargeCourier(money(entry.amount, entry.currency))}<small className="tx-iam-hint">{T.chargeHint}</small></span>
          </label>
        )}
        <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.adjust.cancel}</button>
          <button type="submit" className="tx-iam-btn danger" disabled={busy}>{busy ? T.adjust.saving : T.reject}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const AdjustDialog: React.FC<{ courier: CashCourier; onClose: () => void; onDone: () => void }> = ({ courier, onClose, onDone }) => {
  const currencies = courier.balances.length ? courier.balances.map((b) => b.currency) : ['XAF'];
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(currencies[0]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = Number(amount.replace(/\s/g, '').replace('−', '-').replace(',', '.'));
    if (!amount.trim() || !Number.isFinite(n) || n === 0) return setError(T.adjust.invalidAmount);
    if (!reason.trim()) return setError(T.reasonRequired);
    setBusy(true);
    setError(null);
    try {
      await cashApi.adjust(courier.userId, n, currency, reason.trim());
      onDone();
    } catch (err) {
      setError(cashErrorText(err));
      setBusy(false);
    }
  };
  return (
    <IamDialog title={T.adjust.title(courier.displayName)} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <p className="tx-iam-hint">{T.adjust.intro}</p>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field">
            <span>{T.adjust.amount}</span>
            <input type="text" inputMode="decimal" className="tx-iam-input" value={amount} required onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="tx-iam-field">
            <span>{T.adjust.currency}</span>
            <select className="tx-iam-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {[...new Set([...currencies, 'XAF'])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="tx-iam-field">
          <span>{T.adjust.reason}</span>
          <textarea rows={2} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} />
          <small>{T.adjust.reasonHint}</small>
        </label>
        <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.adjust.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? T.adjust.saving : T.adjust.save}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const CourierStatement: React.FC<{ courier: CashCourier; now: number; tick: number }> = ({ courier, now, tick }) => {
  const [entries, setEntries] = useState<CashEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    cashApi.entries(courier.userId)
      .then((e) => { if (!cancelled) setEntries(e); })
      .catch((err) => { if (!cancelled) setError(cashErrorText(err)); });
    return () => { cancelled = true; };
  }, [courier.userId, tick]);
  return (
    <div className="tx-cash-statement">
      <h3>{T.couriers.entriesTitle(courier.displayName)}</h3>
      {error && <NoticeLine notice={{ kind: 'error', text: error }} />}
      {!entries && !error && <p className="tx-iam-muted" role="status">{T.loading}</p>}
      {entries && (entries.length === 0
        ? <p className="tx-iam-muted">{T.couriers.noEntries}</p>
        : <EntryTable entries={entries} now={now} showCourier={false} canConfirm={false} busyId={null} />)}
    </div>
  );
};

const ReportPanel: React.FC<{ today: string }> = ({ today }) => {
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<CashReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setReport(null);
    setError(null);
    cashApi.report(date)
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((err) => { if (!cancelled) setError(cashErrorText(err)); });
    return () => { cancelled = true; };
  }, [date]);
  const C = T.report.columns;
  return (
    <div className="tx-iam-card">
      <p className="tx-iam-hint">{T.report.intro}</p>
      <div className="tx-iam-toolbar">
        <label className="tx-iam-field tx-cash-date">
          <span>{T.report.date}</span>
          <input type="date" className="tx-iam-input" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date && (
          <a className="tx-iam-btn" href={reportCsvUrl(date)} download={`cash-report-${date}.csv`}>
            <Download size={15} aria-hidden="true" /><span>{T.report.csv}</span>
          </a>
        )}
      </div>
      {error && <NoticeLine notice={{ kind: 'error', text: error }} />}
      {!report && !error && <p className="tx-iam-muted" role="status">{T.loading}</p>}
      {report && (report.rows.length === 0 ? <p className="tx-iam-muted">{T.report.empty}</p> : (
        <div className="tx-cash-scroll">
          <table className="tx-iam-table tx-cash-table">
            <thead>
              <tr>
                <th scope="col">{T.columns.courier}</th>
                <th scope="col" className="is-num">{C.collected}</th>
                <th scope="col" className="is-num">{C.mobileMoney}</th>
                <th scope="col" className="is-num">{C.declared}</th>
                <th scope="col" className="is-num">{C.confirmed}</th>
                <th scope="col" className="is-num">{C.adjustments}</th>
                <th scope="col" className="is-num">{C.waiting}</th>
                <th scope="col" className="is-num">{C.balance}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={`${r.courierUserId}-${r.currency}`}>
                  <td data-label={T.columns.courier}>{r.courierName}</td>
                  <td data-label={C.collected} className="is-num">{money(r.collected, r.currency)}</td>
                  <td data-label={C.mobileMoney} className="is-num">{money(r.mobileMoney, r.currency)}</td>
                  <td data-label={C.declared} className="is-num">{money(r.handoversDeclared, r.currency)}</td>
                  <td data-label={C.confirmed} className="is-num">{money(r.handoversConfirmed, r.currency)}</td>
                  <td data-label={C.adjustments} className="is-num">{money(r.adjustments, r.currency)}</td>
                  <td data-label={C.waiting} className="is-num">{r.pendingCount}</td>
                  <td data-label={C.balance} className="is-num"><strong>{money(r.balanceEnd, r.currency)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export const CashView: React.FC<{ searchQuery?: string; onCashChanged?: () => void }> = ({ searchQuery = '', onCashChanged }) => {
  const { can } = useAuth();
  const canConfirm = can('cash.confirm');
  const [tab, setTab] = useState<Tab>('pending');
  const [data, setData] = useState<CashOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<CashEntry | null>(null);
  const [adjusting, setAdjusting] = useState<CashCourier | null>(null);
  const [openCourier, setOpenCourier] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoadError(null);
    cashApi.overview().then(setData).catch((err) => setLoadError(cashErrorText(err)));
  }, []);
  useEffect(() => { load(); }, [load, tick]);
  const changed = (text: string) => {
    setNotice({ kind: 'ok', text });
    setTick((n) => n + 1);
    onCashChanged?.();
  };

  const confirmEntry = async (e: CashEntry) => {
    if (!window.confirm(T.confirmAsk(e.ref, money(e.amount, e.currency)))) return;
    setBusyId(e.id);
    setNotice(null);
    try {
      await cashApi.confirm(e.id);
      changed(T.confirmed(e.ref));
    } catch (err) {
      setNotice({ kind: 'error', text: cashErrorText(err) });
      setTick((n) => n + 1);
    } finally {
      setBusyId(null);
    }
  };

  const now = data?.serverTime ?? Date.now();
  const query = (filter || searchQuery).trim().toLowerCase();
  const matches = (values: (string | null)[]) => !query || values.some((v) => (v ?? '').toLowerCase().includes(query));
  const pending = (data?.pending ?? []).filter((e) => matches([e.courierName, e.ref, e.trackingNumber, e.momoReference]));
  const couriers = (data?.couriers ?? []).filter((c) => matches([c.displayName, c.phone]));

  return (
    <div className="tx-iam animate-fade-in">
      <div className="tx-iam-toolbar">
        <div className="tx-cash-tabs" role="tablist" aria-label={T.tabs.pending}>
          {(['pending', 'couriers', 'report'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k}
              className={`tx-iam-btn small${tab === k ? ' primary' : ''}`} onClick={() => setTab(k)}>
              {T.tabs[k]}{k === 'pending' && data && data.pending.length > 0 ? ` (${data.pending.length})` : ''}
            </button>
          ))}
        </div>
        {tab !== 'report' && (
          <input type="search" className="tx-iam-input" placeholder={T.search} aria-label={T.search}
            value={filter} onChange={(e) => setFilter(e.target.value)} />
        )}
      </div>

      {!canConfirm && <p className="tx-iam-hint" style={{ margin: 0 }}>{T.viewOnly}</p>}
      <NoticeLine notice={notice} />
      {loadError && (
        <div className="tx-iam-notice error" role="alert">
          <AlertCircle size={14} aria-hidden="true" /><span>{loadError}</span>
          <button type="button" className="tx-iam-btn small" onClick={() => setTick((n) => n + 1)}>{T.retry}</button>
        </div>
      )}
      {!data && !loadError && <p className="tx-iam-muted" role="status">{T.loading}</p>}

      {data && tab === 'pending' && (
        <div className="tx-iam-card">
          <p className="tx-iam-hint">{T.pending.intro}</p>
          {data.pending.length === 0 ? <p className="tx-iam-muted">{T.pending.empty}</p>
            : pending.length === 0 ? <p className="tx-iam-muted">{T.pending.noMatch}</p>
              : <EntryTable entries={pending} now={now} showCourier canConfirm={canConfirm} busyId={busyId} onConfirm={confirmEntry} onReject={setRejecting} />}
        </div>
      )}

      {data && tab === 'couriers' && (
        <div className="tx-iam-card">
          <p className="tx-iam-hint">{T.couriers.intro}</p>
          {data.couriers.length === 0 ? <p className="tx-iam-muted">{T.couriers.empty}</p> : (
            <div className="tx-cash-scroll">
              <table className="tx-iam-table tx-cash-table">
                <thead>
                  <tr>
                    <th scope="col">{T.columns.courier}</th>
                    <th scope="col" className="is-num">{T.columns.balance}</th>
                    <th scope="col" className="is-num">{T.columns.toHandOver}</th>
                    <th scope="col" className="is-num">{T.columns.mobileMoney}</th>
                    <th scope="col" className="is-num">{T.columns.waiting}</th>
                    <th scope="col">{T.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c) => (
                    <React.Fragment key={c.userId}>
                      <tr>
                        <td data-label={T.columns.courier}>{c.displayName}{c.phone && <span className="tx-iam-sub">{c.phone}</span>}</td>
                        <td data-label={T.columns.balance} className="is-num">
                          {c.balances.length === 0 ? <span className="tx-iam-muted">{T.couriers.none}</span>
                            : c.balances.map((b) => <strong key={b.currency} className="tx-cash-line">{money(b.balance, b.currency)}</strong>)}
                        </td>
                        <td data-label={T.columns.toHandOver} className="is-num">
                          {c.balances.map((b) => (
                            <span key={b.currency} className="tx-cash-line">
                              {money(b.outstanding, b.currency)}
                              {b.dueBy !== null && (
                                <span className={`tx-iam-chip${b.overdue ? ' warn' : ''}`}>
                                  {b.overdue ? T.couriers.overdue(dateFmt.format(b.dueBy)) : T.couriers.dueBy(dateFmt.format(b.dueBy))}
                                </span>
                              )}
                            </span>
                          ))}
                        </td>
                        <td data-label={T.columns.mobileMoney} className="is-num">{c.balances.map((b) => <span key={b.currency} className="tx-cash-line">{money(b.mobileMoney, b.currency)}</span>)}</td>
                        <td data-label={T.columns.waiting} className="is-num">{c.pendingCount}</td>
                        <td data-label={T.columns.actions}>
                          <span className="tx-iam-row-actions">
                            <button type="button" className="tx-iam-btn small" aria-expanded={openCourier === c.userId}
                              onClick={() => setOpenCourier((o) => (o === c.userId ? null : c.userId))}>
                              {openCourier === c.userId ? T.couriers.hideEntries : T.couriers.entries}
                            </button>
                            {canConfirm && <button type="button" className="tx-iam-btn small" onClick={() => setAdjusting(c)}>{T.couriers.adjust}</button>}
                          </span>
                        </td>
                      </tr>
                      {openCourier === c.userId && (
                        <tr className="tx-cash-statement-row">
                          <td colSpan={6}><CourierStatement courier={c} now={now} tick={tick} /></td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {data && tab === 'report' && <ReportPanel today={data.today} />}

      {rejecting && (
        <RejectDialog entry={rejecting} onClose={() => setRejecting(null)}
          onDone={(e, charged) => { setRejecting(null); changed(charged ? T.rejectedCharged(e.ref, money(e.amount, e.currency)) : T.rejected(e.ref)); }} />
      )}
      {adjusting && (
        <AdjustDialog courier={adjusting} onClose={() => setAdjusting(null)}
          onDone={() => { const name = adjusting.displayName; setAdjusting(null); changed(T.adjust.done(name)); }} />
      )}
    </div>
  );
};
