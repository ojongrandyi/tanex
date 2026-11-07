// Self-service password reset by email (docs/IAM_RBAC_SPEC.md §6): a random 32-byte token is
// emailed as a link; only its SHA-256 hash is stored (`password_resets`), it lasts 30 minutes
// and works once. Asking again replaces any earlier unused link.
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { inTransaction } from './schema.js';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
/** Reset emails per account per hour; more requests are answered the same but send nothing. */
export const RESET_REQUESTS_PER_HOUR = 3;

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface ResetUser {
  id: string;
  email: string;
  phone: string | null;
  display_name: string;
  locale: string;
}

/** The active account with this (normalised) email, if any. */
export function findResetUser(conn: DatabaseSync, email: string): ResetUser | null {
  const row = conn.prepare(`
    SELECT id, email, phone, display_name, locale FROM users WHERE email = ? AND status = 'ACTIVE'
  `).get(email) as ResetUser | undefined;
  return row ?? null;
}

/**
 * Creates a token for the user, replacing their earlier unused ones. Returns the raw token (to
 * email, never stored) or null when the hourly limit for this account is reached.
 */
export function createResetToken(conn: DatabaseSync, userId: string, now: number = Date.now()): string | null {
  // Every token row is kept (used, replaced or expired) until it is an hour old, so the count
  // below sees all requests of the last hour; older rows are removed here.
  conn.prepare('DELETE FROM password_resets WHERE expires_at_ts < ?').run(now - 60 * 60 * 1000 + RESET_TOKEN_TTL_MS);
  const { c } = conn.prepare(`
    SELECT COUNT(*) AS c FROM password_resets WHERE user_id = ? AND expires_at_ts > ?
  `).get(userId, now - 60 * 60 * 1000 + RESET_TOKEN_TTL_MS) as { c: number };
  if (c >= RESET_REQUESTS_PER_HOUR) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  inTransaction(conn, () => {
    // Earlier links stop working: mark them used rather than delete, so they still count above.
    conn.prepare('UPDATE password_resets SET used_at_ts = ? WHERE user_id = ? AND used_at_ts IS NULL').run(now, userId);
    conn.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at_ts, used_at_ts) VALUES (?, ?, ?, NULL)')
      .run(hashResetToken(token), userId, now + RESET_TOKEN_TTL_MS);
  });
  return token;
}

/** The account a token belongs to while it is unused, unexpired and the account is active. */
export function findValidToken(conn: DatabaseSync, token: string, now: number = Date.now()): ResetUser | null {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const row = conn.prepare(`
    SELECT u.id, u.email, u.phone, u.display_name, u.locale FROM password_resets r
    JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ? AND r.used_at_ts IS NULL AND r.expires_at_ts > ? AND u.status = 'ACTIVE'
  `).get(hashResetToken(token), now) as ResetUser | undefined;
  return row ?? null;
}

/**
 * Uses the token and sets the new password hash in one transaction: clears must-change and the
 * sign-in lock, ends every session of the account. Returns false when the token was used (or
 * expired) in the meantime, so a link can never work twice.
 */
export function consumeResetToken(conn: DatabaseSync, token: string, userId: string, passwordHash: string, now: number = Date.now()): boolean {
  return inTransaction(conn, () => {
    const used = conn.prepare(`
      UPDATE password_resets SET used_at_ts = ? WHERE token_hash = ? AND user_id = ? AND used_at_ts IS NULL AND expires_at_ts > ?
    `).run(now, hashResetToken(token), userId, now);
    if (Number(used.changes) !== 1) return false;
    conn.prepare(`
      UPDATE users SET password_hash = ?, must_change_password = 0, failed_logins = 0, locked_until_ts = NULL, updated_at_ts = ?
      WHERE id = ?
    `).run(passwordHash, now, userId);
    conn.prepare('UPDATE password_resets SET used_at_ts = ? WHERE user_id = ? AND used_at_ts IS NULL').run(now, userId);
    conn.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    return true;
  });
}
