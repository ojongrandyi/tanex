// express-session store on the `sessions` table (docs/IAM_RBAC_SPEC.md §5.7), so sign-ins
// survive a restart or redeploy. Takes the connection as a parameter so tests can use a file
// database in a temp folder. Also builds the session middleware itself, so the server and the
// tests use the same cookie settings.
import type { DatabaseSync } from 'node:sqlite';
import session, { type SessionData } from 'express-session';
import type { RequestHandler } from 'express';

declare module 'express-session' {
  interface SessionData {
    /** Signed-in user; permissions are read from the database on every request. */
    userId?: string;
    loginIp?: string;
    userAgent?: string;
  }
}

/** Cookie name (spec §5.7). */
export const SESSION_COOKIE = 'tx.sid';

/** Staff sessions: 12 hours, rolling. */
export const STAFF_SESSION_MS = 12 * 60 * 60 * 1000;
/** Users whose only permission is courier.app: 7 days, so riders aren't signed out mid-shift. */
export const COURIER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

type Callback = (err?: unknown) => void;

function expiryOf(sess: SessionData, now: number): number {
  const expires = sess.cookie?.expires;
  if (expires) {
    const t = new Date(expires).getTime();
    if (Number.isFinite(t)) return t;
  }
  return now + (sess.cookie?.originalMaxAge ?? STAFF_SESSION_MS);
}

export class SqliteSessionStore extends session.Store {
  private readonly conn: DatabaseSync;
  private purgeTimer: NodeJS.Timeout | null = null;

  constructor(conn: DatabaseSync, options: { purgeIntervalMs?: number | false } = {}) {
    super();
    this.conn = conn;
    const interval = options.purgeIntervalMs ?? PURGE_INTERVAL_MS;
    if (interval) {
      this.purgeTimer = setInterval(() => {
        try { this.purgeExpired(); } catch (err) { console.error('[sessions] purge failed:', err); }
      }, interval);
      // Never keeps the process (or a test run) alive on its own.
      this.purgeTimer.unref();
    }
  }

  /** Deletes expired rows. Returns how many were removed. */
  purgeExpired(now: number = Date.now()): number {
    const result = this.conn.prepare('DELETE FROM sessions WHERE expires_at_ts <= ?').run(now);
    return Number(result.changes);
  }

  stopPurge(): void {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.purgeTimer = null;
  }

  override get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = this.conn.prepare('SELECT data_json, expires_at_ts FROM sessions WHERE sid = ?')
        .get(sid) as { data_json: string; expires_at_ts: number } | undefined;
      if (!row) return cb(null, null);
      if (row.expires_at_ts <= Date.now()) {
        this.conn.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data_json) as SessionData);
    } catch (err) {
      cb(err);
    }
  }

  override set(sid: string, sess: SessionData, cb?: Callback): void {
    try {
      const now = Date.now();
      this.conn.prepare(`
        INSERT INTO sessions (sid, user_id, data_json, expires_at_ts, created_at_ts, last_seen_ts, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          user_id = excluded.user_id,
          data_json = excluded.data_json,
          expires_at_ts = excluded.expires_at_ts,
          last_seen_ts = excluded.last_seen_ts,
          ip = excluded.ip,
          user_agent = excluded.user_agent
      `).run(
        sid,
        sess.userId ?? null,
        JSON.stringify(sess),
        expiryOf(sess, now),
        now,
        now,
        sess.loginIp ?? null,
        sess.userAgent ?? null
      );
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override destroy(sid: string, cb?: Callback): void {
    try {
      this.conn.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override touch(sid: string, sess: SessionData, cb?: Callback): void {
    try {
      const now = Date.now();
      // The stored cookie carries the expiry too; keep it in step so a restored session
      // doesn't come back with a stale expiry date.
      const row = this.conn.prepare('SELECT data_json FROM sessions WHERE sid = ?').get(sid) as { data_json: string } | undefined;
      if (row) {
        const stored = JSON.parse(row.data_json) as SessionData;
        stored.cookie = sess.cookie;
        this.conn.prepare('UPDATE sessions SET expires_at_ts = ?, last_seen_ts = ?, data_json = ? WHERE sid = ?')
          .run(expiryOf(sess, now), now, JSON.stringify(stored), sid);
      }
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override clear(cb?: Callback): void {
    try {
      this.conn.exec('DELETE FROM sessions');
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override length(cb: (err: unknown, length?: number) => void): void {
    try {
      const { c } = this.conn.prepare('SELECT COUNT(*) AS c FROM sessions WHERE expires_at_ts > ?').get(Date.now()) as { c: number };
      cb(null, c);
    } catch (err) {
      cb(err);
    }
  }
}

/**
 * The session middleware: SQLite store, cookie `tx.sid`, httpOnly, sameSite=lax, secure in
 * production and on any HTTPS request, trusts the proxy's X-Forwarded-Proto (with app.set('trust proxy', 1)), 12 h
 * rolling by default. The login route sets a longer maxAge for courier-only users.
 */
export function createSessionMiddleware(store: SqliteSessionStore, secret: string): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    // Hostinger terminates HTTPS at a proxy; this lets express-session trust the forwarded
    // scheme so the secure cookie is still set.
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Always secure in production. Elsewhere 'auto': secure whenever the request arrived over
      // HTTPS (directly or via the proxy's X-Forwarded-Proto), so a deployment that forgot
      // NODE_ENV still gets a secure cookie, while plain-http local development keeps working.
      secure: process.env.NODE_ENV === 'production' ? true : 'auto',
      maxAge: STAFF_SESSION_MS
    }
  });
}
