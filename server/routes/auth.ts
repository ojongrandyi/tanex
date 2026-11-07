// Staff sign-in, sign-out, session check and password change (docs/IAM_RBAC_SPEC.md §5.6, §6).
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { normalizeIdentifier } from '../../src/shared/identifier.js';
import {
  checkNewPassword,
  hashPassword,
  PASSWORD_PROBLEM_MESSAGES,
  spendComparableTime,
  verifyPassword
} from '../auth/passwords.js';
import { getRequestAuth, isCourierOnly, loadAuth, resetRequestAuth, type RequestAuth } from '../auth/permissions.js';
import { COURIER_SESSION_MS, SESSION_COOKIE, STAFF_SESSION_MS } from '../auth/sessionStore.js';
import { consumeResetToken, createResetToken, findResetUser, findValidToken } from '../auth/passwordReset.js';
import { mailEnabled } from '../mail/mailer.js';
import { queueEmail } from '../mail/outbox.js';
import { passwordResetUrl } from '../mail/urls.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

// Same text for every failure (unknown account, wrong password, locked, disabled), so the
// answer never tells a guesser which part was wrong or that an account exists.
const SIGN_IN_FAILED = 'Incorrect sign-in details.';
// One answer for an unknown, used, replaced or expired reset link, or a disabled account.
const RESET_LINK_INVALID = 'This reset link is invalid or has expired.';

export const DISPLAY_NAME_MAX = 80;
const LOCALES: readonly string[] = ['en', 'fr'];

/**
 * Whether the sign-in screen may offer "Forgot password?": only when email is configured
 * (SMTP_HOST), so the link is never shown without a working reset behind it.
 */
export function passwordResetAvailable(): boolean {
  return mailEnabled();
}

interface LoginRow {
  id: string;
  display_name: string;
  password_hash: string;
  status: string;
  failed_logins: number;
  locked_until_ts: number | null;
}

function sessionUser(auth: RequestAuth) {
  return {
    id: auth.user.id,
    displayName: auth.user.displayName,
    email: auth.user.email,
    phone: auth.user.phone,
    locale: auth.user.locale,
    roles: auth.roles,
    permissions: auth.permissions,
    mustChangePassword: auth.user.mustChangePassword
  };
}

function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}

function save(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}

/** A new router (with its own per-IP limiter) — one per app. */
export function createAuthRouter(): Router {
  const router = Router();

  // Per IP: 20 attempts (failed or successful) per 15 minutes. Account lockout below covers
  // guessing one account's password from many addresses.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', error: 'Too many login attempts. Try again in a few minutes.' }
  });

  // Reset links: per IP, 10 requests and 10 new-password attempts per hour. The per-account
  // limit (passwordReset.ts) covers one inbox being flooded from many addresses.
  const forgotLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', error: 'Too many attempts. Please wait a while and try again.' }
  });
  const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', error: 'Too many attempts. Please wait a while and try again.' }
  });

  // POST /api/auth/login  { identifier, password }
  router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body || {};
      if (typeof identifier !== 'string' || !identifier.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({ success: false, error: 'Email or phone and password are required.' });
      }

      const id = normalizeIdentifier(identifier);
      const row = id
        ? db.prepare(`
            SELECT id, display_name, password_hash, status, failed_logins, locked_until_ts
            FROM users WHERE ${id.kind === 'email' ? 'email' : 'phone'} = ?
          `).get(id.value) as LoginRow | undefined
        : undefined;
      const anonymous = { userId: null, name: 'anonymous' };
      const now = Date.now();

      if (!row) {
        await spendComparableTime(password);
        audit(req, 'auth.login_failed', 'user', null, 'Sign-in failed: no matching account', undefined, undefined, { actor: anonymous });
        return res.status(401).json({ success: false, error: SIGN_IN_FAILED });
      }

      const actor = { userId: row.id, name: row.display_name };

      if (row.locked_until_ts && row.locked_until_ts > now) {
        await spendComparableTime(password);
        audit(req, 'auth.login_failed', 'user', row.id, 'Sign-in refused: account temporarily locked', undefined, undefined, { actor });
        return res.status(401).json({ success: false, error: SIGN_IN_FAILED });
      }

      if (row.status !== 'ACTIVE') {
        await spendComparableTime(password);
        audit(req, 'auth.login_failed', 'user', row.id, 'Sign-in refused: account disabled', undefined, undefined, { actor });
        return res.status(401).json({ success: false, error: SIGN_IN_FAILED });
      }

      if (!(await verifyPassword(password, row.password_hash))) {
        const failed = row.failed_logins + 1;
        if (failed >= MAX_FAILED_LOGINS) {
          db.prepare('UPDATE users SET failed_logins = 0, locked_until_ts = ? WHERE id = ?').run(now + LOCKOUT_MS, row.id);
          audit(req, 'auth.login_failed', 'user', row.id, `Wrong password; account locked for 15 minutes after ${MAX_FAILED_LOGINS} failures`, undefined, undefined, { actor });
        } else {
          db.prepare('UPDATE users SET failed_logins = ?, locked_until_ts = NULL WHERE id = ?').run(failed, row.id);
          audit(req, 'auth.login_failed', 'user', row.id, `Wrong password (${failed} of ${MAX_FAILED_LOGINS})`, undefined, undefined, { actor });
        }
        return res.status(401).json({ success: false, error: SIGN_IN_FAILED });
      }

      db.prepare('UPDATE users SET failed_logins = 0, locked_until_ts = NULL, last_login_ts = ? WHERE id = ?').run(now, row.id);
      const auth = loadAuth(db, row.id);
      if (!auth) return res.status(401).json({ success: false, error: SIGN_IN_FAILED });

      // New session id on every sign-in (no session fixation).
      await regenerate(req);
      resetRequestAuth(req);
      req.session.userId = row.id;
      req.session.loginIp = req.ip;
      req.session.userAgent = (req.get('user-agent') || '').slice(0, 300);
      // originalMaxAge too: the rolling refresh on later requests resets maxAge to it.
      const lifetime = isCourierOnly(auth.permissions) ? COURIER_SESSION_MS : STAFF_SESSION_MS;
      req.session.cookie.originalMaxAge = lifetime;
      req.session.cookie.maxAge = lifetime;
      await save(req);

      audit(req, 'auth.login', 'user', row.id, 'Signed in', undefined, undefined, { actor });
      res.json({ success: true, user: sessionUser(auth) });
    } catch (err) {
      console.error('[auth] login failed:', err);
      res.status(500).json({ success: false, error: 'Sign-in is temporarily unavailable.' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', (req: Request, res: Response) => {
    const auth = getRequestAuth(req);
    if (auth) audit(req, 'auth.logout', 'user', auth.user.id, 'Signed out');
    const finish = () => {
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.json({ success: true });
    };
    if (!req.session) return finish();
    req.session.destroy(finish);
  });

  // GET /api/auth/session: public; the signed-in user or null.
  router.get('/session', (req: Request, res: Response) => {
    const auth = getRequestAuth(req);
    res.json({ success: true, user: auth ? sessionUser(auth) : null, passwordReset: passwordResetAvailable() });
  });

  // PATCH /api/auth/me  { displayName?, locale? }: the signed-in user's own name and language.
  router.patch('/me', (req: Request, res: Response) => {
    const auth = getRequestAuth(req);
    if (!auth) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { displayName, locale } = req.body || {};
    const changes: { display_name?: string; locale?: string } = {};
    if (displayName !== undefined) {
      const name = typeof displayName === 'string' ? displayName.trim().replace(/\s+/g, ' ') : '';
      if (!name || name.length > DISPLAY_NAME_MAX) {
        return res.status(400).json({ success: false, code: 'INVALID_NAME', error: `Enter a name of 1 to ${DISPLAY_NAME_MAX} characters.` });
      }
      if (name !== auth.user.displayName) changes.display_name = name;
    }
    if (locale !== undefined) {
      if (typeof locale !== 'string' || !LOCALES.includes(locale)) {
        return res.status(400).json({ success: false, code: 'INVALID_LOCALE', error: 'Language must be en or fr.' });
      }
      if (locale !== auth.user.locale) changes.locale = locale;
    }

    const fields = Object.keys(changes) as (keyof typeof changes)[];
    if (fields.length > 0) {
      const sets = fields.map((f) => `${f} = ?`).join(', ');
      db.prepare(`UPDATE users SET ${sets}, updated_at_ts = ? WHERE id = ?`)
        .run(...fields.map((f) => changes[f] as string), Date.now(), auth.user.id);
      audit(req, 'user.update_self', 'user', auth.user.id, `Own account updated: ${fields.join(', ')}`);
      resetRequestAuth(req);
    }
    const fresh = loadAuth(db, auth.user.id);
    res.json({ success: true, user: fresh ? sessionUser(fresh) : null });
  });

  // GET /api/auth/sessions: the signed-in user's own active sessions (My account). The session
  // id itself is never returned; `current` marks the one making this request.
  router.get('/sessions', (req: Request, res: Response) => {
    const auth = getRequestAuth(req);
    if (!auth) return res.status(401).json({ success: false, error: 'Authentication required' });
    const rows = db.prepare(`
      SELECT sid, created_at_ts, last_seen_ts, expires_at_ts, ip, user_agent FROM sessions
      WHERE user_id = ? AND expires_at_ts > ? ORDER BY COALESCE(last_seen_ts, created_at_ts) DESC
    `).all(auth.user.id, Date.now()) as unknown as {
      sid: string; created_at_ts: number; last_seen_ts: number | null; expires_at_ts: number; ip: string | null; user_agent: string | null;
    }[];
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: rows.map((r) => ({
        createdAt: r.created_at_ts,
        lastSeenAt: r.last_seen_ts,
        expiresAt: r.expires_at_ts,
        ip: r.ip,
        userAgent: r.user_agent,
        current: r.sid === req.sessionID
      }))
    });
  });

  // DELETE /api/auth/sessions: signs the user out on every other device; keeps this session.
  router.delete('/sessions', (req: Request, res: Response) => {
    const auth = getRequestAuth(req);
    if (!auth) return res.status(401).json({ success: false, error: 'Authentication required' });
    const result = db.prepare('DELETE FROM sessions WHERE user_id = ? AND sid <> ?').run(auth.user.id, req.sessionID ?? '');
    const count = Number(result.changes);
    audit(req, 'auth.sessions_revoke_others', 'user', auth.user.id,
      `Signed out on other devices (${count} session${count === 1 ? '' : 's'})`);
    res.json({ success: true, data: { signedOut: count } });
  });

  // POST /api/auth/forgot  { email }: emails a reset link to an active account with that email.
  // Always the same answer (and the work happens after it is sent), so the reply and its timing
  // never tell whether an account exists. Does nothing while email is off.
  router.post('/forgot', forgotLimiter, (req: Request, res: Response) => {
    const { email } = req.body || {};
    res.json({ success: true });

    try {
      if (!mailEnabled() || typeof email !== 'string' || email.length > 254) return;
      const id = normalizeIdentifier(email);
      if (!id || id.kind !== 'email') return;
      const user = findResetUser(db, id.value);
      if (!user) {
        audit(req, 'auth.password_reset_request', 'user', null,
          'Password reset requested for an address with no active account', undefined, undefined,
          { actor: { userId: null, name: 'anonymous' } });
        return;
      }
      const actor = { userId: user.id, name: user.display_name };
      const token = createResetToken(db, user.id);
      if (!token) {
        audit(req, 'auth.password_reset_request', 'user', user.id,
          'Password reset requested; no email sent (hourly limit reached)', undefined, undefined, { actor });
        return;
      }
      const queued = queueEmail({
        to: user.email,
        template: 'auth.reset',
        locale: user.locale === 'fr' ? 'fr' : 'en',
        vars: { url: passwordResetUrl(token) },
        related: { type: 'user', id: user.id }
      });
      audit(req, 'auth.password_reset_request', 'user', user.id,
        queued ? 'Password reset link emailed' : 'Password reset requested; the email could not be queued',
        undefined, undefined, { actor });
    } catch (err) {
      console.error('[auth] forgot-password failed:', err);
    }
  });

  // POST /api/auth/reset  { token, newPassword }: sets a new password with an emailed link.
  // Single use; signs the account out everywhere; the user then signs in with the new password.
  router.post('/reset', resetLimiter, async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body || {};
      if (typeof token !== 'string' || typeof newPassword !== 'string' || !newPassword) {
        return res.status(400).json({ success: false, code: 'INVALID_TOKEN', error: RESET_LINK_INVALID });
      }
      const user = findValidToken(db, token);
      if (!user) return res.status(400).json({ success: false, code: 'INVALID_TOKEN', error: RESET_LINK_INVALID });

      const problem = checkNewPassword(newPassword, { email: user.email, phone: user.phone });
      if (problem) {
        return res.status(400).json({ success: false, code: problem.toUpperCase(), error: PASSWORD_PROBLEM_MESSAGES[problem] });
      }

      const hash = await hashPassword(newPassword);
      if (!consumeResetToken(db, token, user.id, hash)) {
        return res.status(400).json({ success: false, code: 'INVALID_TOKEN', error: RESET_LINK_INVALID });
      }
      audit(req, 'auth.password_reset', 'user', user.id, 'Password reset with an emailed link; signed out everywhere',
        undefined, undefined, { actor: { userId: user.id, name: user.display_name } });
      res.json({ success: true });
    } catch (err) {
      console.error('[auth] reset-password failed:', err);
      res.status(500).json({ success: false, error: 'Could not reset the password.' });
    }
  });

  // POST /api/auth/change-password  { currentPassword, newPassword }
  router.post('/change-password', async (req: Request, res: Response) => {
    try {
      const auth = getRequestAuth(req);
      if (!auth) return res.status(401).json({ success: false, error: 'Authentication required' });

      const { currentPassword, newPassword } = req.body || {};
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Current and new password are required.' });
      }

      const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(auth.user.id) as { password_hash: string } | undefined;
      if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
        audit(req, 'auth.password_change_failed', 'user', auth.user.id, 'Password change refused: current password incorrect');
        return res.status(400).json({ success: false, code: 'WRONG_PASSWORD', error: 'The current password is incorrect.' });
      }

      const problem = checkNewPassword(newPassword, { email: auth.user.email, phone: auth.user.phone });
      if (problem) {
        return res.status(400).json({ success: false, code: problem.toUpperCase(), error: PASSWORD_PROBLEM_MESSAGES[problem] });
      }

      const hash = await hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at_ts = ? WHERE id = ?')
        .run(hash, Date.now(), auth.user.id);
      // Sign out every other session of this user (spec §5.7).
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND sid <> ?').run(auth.user.id, req.sessionID);

      audit(req, 'auth.password_change', 'user', auth.user.id,
        auth.user.mustChangePassword
          ? 'Temporary password replaced; other sessions signed out'
          : 'Password changed; other sessions signed out');
      res.json({ success: true });
    } catch (err) {
      console.error('[auth] change-password failed:', err);
      res.status(500).json({ success: false, error: 'Could not change the password.' });
    }
  });

  return router;
}

export const authRouter = createAuthRouter();
