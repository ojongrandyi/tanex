// Settings → Email (docs/NOTIFICATIONS_SPEC.md §3): whether email is on, the sender settings
// (never the password), queue figures, a test email, failed emails with "Try again", and the
// latest messages. Reading needs settings.view; sending and retrying need settings.manage.
import React, { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, Send } from 'lucide-react';
import { api, type MailStatus, type OutboxItem } from '../../services/api';
import { useAuth, usePermission } from '../../auth/AuthContext';
import { MAIL_TEXT as T } from '../../auth/strings';
import { OFFICE_TIME_ZONE } from '../../config/brand';
import { formatEventTimestamp } from '../../shared/timeZones';
import '../pages/IamViews.css';
import './EmailSettingsPanel.css';

const when = (ts: number | null) => (ts ? formatEventTimestamp(ts, OFFICE_TIME_ZONE) : T.never);

const STATUS_CHIP: Record<string, string> = { SENT: 'ok', FAILED: 'warn', QUEUED: 'off', SENDING: 'off' };

const OutboxTable: React.FC<{ rows: OutboxItem[]; onRetry?: (id: string) => void; busyId?: string | null; withError?: boolean }> = ({
  rows,
  onRetry,
  busyId,
  withError
}) => (
  <table className="tx-iam-table">
    <thead>
      <tr>
        <th>{T.columns.created}</th>
        <th>{T.columns.to}</th>
        <th>{T.columns.subject}</th>
        <th>{T.columns.status}</th>
        <th>{T.columns.attempts}</th>
        {withError && <th>{T.columns.error}</th>}
        {onRetry && <th aria-hidden="true" />}
      </tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.id}>
          <td data-label={T.columns.created}>{when(r.createdAt)}</td>
          <td data-label={T.columns.to}>{r.to}</td>
          <td data-label={T.columns.subject}>{r.subject}</td>
          <td data-label={T.columns.status}>
            <span className={`tx-iam-chip ${STATUS_CHIP[r.status] || 'off'}`}>{T.status[r.status] || r.status}</span>
          </td>
          <td data-label={T.columns.attempts}>{r.attempts}</td>
          {withError && <td data-label={T.columns.error}>{r.lastError || '—'}</td>}
          {onRetry && (
            <td>
              <button type="button" className="tx-iam-btn small" disabled={busyId === r.id} onClick={() => onRetry(r.id)}>
                {T.failedList.retry}
              </button>
            </td>
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

export const EmailSettingsPanel: React.FC = () => {
  const { user } = useAuth();
  const canManage = usePermission('settings.manage');
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [to, setTo] = useState(user?.email || '');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api.getMailStatus());
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || T.loading);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setNotice(null);
    try {
      const result = await api.sendTestEmail(to.trim() || undefined);
      setNotice(result.sent
        ? { kind: 'ok', text: T.test.sent(to.trim() || user?.email || '') }
        : { kind: 'error', text: T.test.failed(result.error || '') });
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || '' });
    } finally {
      setSending(false);
      void load();
    }
  };

  const retry = async (id: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await api.retryEmail(id);
      setNotice({ kind: 'ok', text: T.failedList.retried });
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.code === 'NOT_RETRYABLE' ? T.failedList.notRetryable : err?.message || '' });
    } finally {
      setBusyId(null);
      void load();
    }
  };

  return (
    <div className="settings-card-section animate-fade-in tx-mail">
      <div className="settings-card-header">
        <div className="header-icon-wrap icon-blue">
          <Mail size={20} />
        </div>
        <div>
          <h3>{T.title}</h3>
          <p>{T.intro}</p>
        </div>
      </div>

      <div className="settings-card-body tx-iam">
        {loadError && <div className="tx-iam-notice error" role="alert">{loadError}</div>}
        {!status && !loadError && <p className="tx-iam-muted">{T.loading}</p>}

        {status && (
          <>
            <div className="tx-mail-head">
              <span className={`tx-iam-chip ${status.enabled ? 'ok' : 'warn'}`}>{status.enabled ? T.on : T.off}</span>
              <button type="button" className="tx-iam-btn small" onClick={() => { void load(); }}>
                <RefreshCw size={13} aria-hidden="true" />
                <span>{T.refresh}</span>
              </button>
            </div>

            {!status.enabled && <p className="tx-iam-muted">{T.offHint}</p>}

            {status.enabled && (
              <dl className="tx-mail-facts">
                <div><dt>{T.fields.server}</dt><dd>{status.host}:{status.port}{status.secure ? ' (SSL)' : ''}</dd></div>
                <div><dt>{T.fields.sender}</dt><dd>{status.from}</dd></div>
                {status.replyTo && <div><dt>{T.fields.replyTo}</dt><dd>{status.replyTo}</dd></div>}
                {status.user && <div><dt>{T.fields.account}</dt><dd>{status.user}</dd></div>}
              </dl>
            )}

            <dl className="tx-mail-figures">
              <div><dt>{T.summary.queued}</dt><dd>{status.summary.queued}</dd></div>
              <div><dt>{T.summary.failed}</dt><dd>{status.summary.failed}</dd></div>
              <div><dt>{T.summary.sent24h}</dt><dd>{status.summary.sentLast24h}</dd></div>
              <div><dt>{T.summary.lastSent}</dt><dd className="tx-mail-date">{when(status.summary.lastSentAt)}</dd></div>
            </dl>

            {notice && (
              <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>
            )}

            {status.enabled && (
              <section className="tx-iam-card">
                <h4 className="tx-mail-title">{T.test.title}</h4>
                {canManage ? (
                  <form className="tx-mail-test" onSubmit={sendTest}>
                    <label className="tx-iam-field">
                      <span>{T.test.to}</span>
                      <input type="email" value={to} onChange={(e) => setTo(e.target.value)} autoComplete="email" />
                    </label>
                    <button type="submit" className="tx-iam-btn primary" disabled={sending}>
                      <Send size={14} aria-hidden="true" />
                      <span>{sending ? T.test.busy : T.test.submit}</span>
                    </button>
                  </form>
                ) : (
                  <p className="tx-iam-muted">{T.manageOnly}</p>
                )}
              </section>
            )}

            <section className="tx-iam-card">
              <h4 className="tx-mail-title">{T.failedList.title}</h4>
              {status.failed.length === 0 ? (
                <p className="tx-iam-muted">{T.failedList.empty}</p>
              ) : (
                <OutboxTable rows={status.failed} withError onRetry={canManage ? retry : undefined} busyId={busyId} />
              )}
            </section>

            <section className="tx-iam-card">
              <h4 className="tx-mail-title">{T.recent.title}</h4>
              {status.recent.length === 0 ? (
                <p className="tx-iam-muted">{T.recent.empty}</p>
              ) : (
                <OutboxTable rows={status.recent} withError />
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailSettingsPanel;
