// "Where you are signed in" on My account (docs/IAM_RBAC_SPEC.md §9): the user's own active
// sessions, newest activity first, and "Sign out other devices".
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import { api, type UserSession } from '../../services/api';
import { AUTH_TEXT } from '../../auth/strings';
import { formatEventTimestamp } from '../../shared/timeZones';
import { OFFICE_TIME_ZONE } from '../../config/brand';

const T = AUTH_TEXT.account.sessions;

/** "Chrome on Windows" from a user-agent string; product names are not translated. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return T.unknownDevice;
  const ua = userAgent;
  const browser =
    /Edg\//.test(ua) ? 'Edge'
      : /OPR\/|Opera/.test(ua) ? 'Opera'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
          : /Firefox\//.test(ua) ? 'Firefox'
            : /Chrome\//.test(ua) ? 'Chrome'
              : /Safari\//.test(ua) ? 'Safari'
                : null;
  const os =
    /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Windows/.test(ua) ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
            : /Linux/.test(ua) ? 'Linux'
              : null;
  if (browser && os) return `${browser} ${T.on} ${os}`;
  return browser || os || T.unknownDevice;
}

/** IPv4 addresses arrive in IPv6-mapped form (::ffff:1.2.3.4); show the plain form. */
export function displayIp(ip: string): string {
  return ip.replace(/^::ffff:/i, '');
}

export const MySessions: React.FC = () => {
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await api.getMySessions());
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'Could not load.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const others = (sessions ?? []).filter((s) => !s.current).length;

  const signOutOthers = async () => {
    if (busy || !window.confirm(T.confirmSignOutOthers)) return;
    setBusy(true);
    setNotice(null);
    try {
      const n = await api.signOutOtherSessions();
      setNotice({ kind: 'ok', text: T.signedOut(n) });
      await load();
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'Could not sign out.' });
    } finally {
      setBusy(false);
    }
  };

  const when = (ts: number) => formatEventTimestamp(ts, OFFICE_TIME_ZONE);

  return (
    <section className="tx-account-card" aria-labelledby="tx-account-sessions">
      <header className="tx-account-card-head">
        <MonitorSmartphone size={18} aria-hidden="true" />
        <h2 id="tx-account-sessions">{T.title}</h2>
      </header>
      {sessions === null && !notice && <p className="tx-account-meta">{T.loading}</p>}
      {sessions && (
        <ul className="tx-account-sessions">
          {sessions.map((s, i) => (
            <li key={`${s.createdAt}-${i}`}>
              <strong>{deviceLabel(s.userAgent)}</strong>
              {s.current && <span className="tx-account-badge">{T.thisDevice}</span>}
              <span className="tx-account-meta">
                {s.lastSeenAt ? T.lastActive(when(s.lastSeenAt)) : T.signedIn(when(s.createdAt))}
                {s.ip ? ` · ${displayIp(s.ip)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {sessions && others === 0 && <p className="tx-account-meta">{T.none}</p>}
      {notice && (
        <div className={`tx-account-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}
      {others > 0 && (
        <div className="tx-account-actions">
          <button type="button" className="tx-account-btn" onClick={signOutOthers} disabled={busy}>
            {T.signOutOthers}
          </button>
        </div>
      )}
    </section>
  );
};
