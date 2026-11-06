// First Super Admin (docs/IAM_RBAC_SPEC.md §8) and the create/reset helpers shared with
// scripts/create-super-admin.ts. Takes the connection as a parameter so tests can use an
// in-memory database. Never logs passwords or hashes.
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { SUPER_ADMIN_ROLE_ID } from '../../src/shared/permissions.js';
import { inTransaction } from './schema.js';

export const BCRYPT_COST = 12;
export const DEFAULT_SUPER_ADMIN_NAME = 'Super Admin';

export function newUserId(): string {
  return 'usr_' + crypto.randomBytes(12).toString('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deliberately loose: one @, something on each side, a dot in the domain, no spaces.
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** A bcrypt hash as produced by bcryptjs ($2a$/$2b$/$2y$, two-digit cost, 53 characters). */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/** The locked Super Admin role's id, or null if it doesn't exist. */
export function findSuperAdminRoleId(conn: DatabaseSync): string | null {
  const row = conn.prepare(
    'SELECT id FROM roles WHERE is_locked = 1 ORDER BY (id = ?) DESC, created_at_ts ASC LIMIT 1'
  ).get(SUPER_ADMIN_ROLE_ID) as { id: string } | undefined;
  return row?.id ?? null;
}

interface AuditEntry {
  action: string;
  actorName: string;
  entityId: string;
  summary: string;
  after?: Record<string, unknown>;
}

// System-originated audit entry (no request, no signed-in actor). The request-based audit()
// helper arrives with B.2.
function writeSystemAudit(conn: DatabaseSync, entry: AuditEntry, now: number): void {
  conn.prepare(`
    INSERT INTO audit_log (id, at_ts, actor_user_id, actor_name, action, entity_type, entity_id, summary, before_json, after_json, ip)
    VALUES (?, ?, NULL, ?, ?, 'user', ?, ?, NULL, ?, NULL)
  `).run(
    'aud_' + crypto.randomBytes(12).toString('hex'),
    now,
    entry.actorName,
    entry.action,
    entry.entityId,
    entry.summary,
    entry.after ? JSON.stringify(entry.after) : null
  );
}

export interface CreateSuperAdminInput {
  email: string;
  displayName: string;
  passwordHash: string;
  mustChangePassword: boolean;
  /** Shown as the audit actor, e.g. 'system (first start)'. */
  actorName: string;
}

/** Creates an active user holding the Super Admin role. Returns the new user id. */
export function createSuperAdmin(conn: DatabaseSync, input: CreateSuperAdminInput, now: number = Date.now()): string {
  const roleId = findSuperAdminRoleId(conn);
  if (!roleId) throw new Error('The Super Admin role does not exist.');
  const email = normalizeEmail(input.email);
  const id = newUserId();

  inTransaction(conn, () => {
    conn.prepare(`
      INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password,
                         locale, failed_logins, created_at_ts, updated_at_ts, created_by)
      VALUES (?, ?, NULL, ?, ?, 'ACTIVE', ?, 'en', 0, ?, ?, NULL)
    `).run(id, email, input.displayName, input.passwordHash, input.mustChangePassword ? 1 : 0, now, now);
    conn.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, roleId);
    writeSystemAudit(conn, {
      action: 'user.create',
      actorName: input.actorName,
      entityId: id,
      summary: `Super Admin account created for ${email}`,
      after: { email, displayName: input.displayName, roles: [roleId], mustChangePassword: input.mustChangePassword }
    }, now);
  });
  return id;
}

export interface RecoverSuperAdminInput {
  userId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  actorName: string;
}

/**
 * Recovery for an existing account: sets a new password, re-enables it, clears any lockout,
 * makes sure it holds the Super Admin role, and signs it out everywhere.
 */
export function recoverSuperAdmin(conn: DatabaseSync, input: RecoverSuperAdminInput, now: number = Date.now()): void {
  const roleId = findSuperAdminRoleId(conn);
  if (!roleId) throw new Error('The Super Admin role does not exist.');

  inTransaction(conn, () => {
    conn.prepare(`
      UPDATE users SET password_hash = ?, must_change_password = ?, status = 'ACTIVE',
                       failed_logins = 0, locked_until_ts = NULL, updated_at_ts = ?
      WHERE id = ?
    `).run(input.passwordHash, input.mustChangePassword ? 1 : 0, now, input.userId);
    conn.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(input.userId, roleId);
    conn.prepare('DELETE FROM sessions WHERE user_id = ?').run(input.userId);
    writeSystemAudit(conn, {
      action: 'user.recover',
      actorName: input.actorName,
      entityId: input.userId,
      summary: 'Password reset, account re-enabled and Super Admin role ensured',
      after: { status: 'ACTIVE', roles: [roleId], mustChangePassword: input.mustChangePassword }
    }, now);
  });
}

export type BootstrapResult =
  | { outcome: 'users_exist' }
  | { outcome: 'created'; userId: string }
  | { outcome: 'not_configured' }
  | { outcome: 'invalid_config'; reason: string };

type Env = Record<string, string | undefined>;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

/**
 * On a database with no users: creates the first Super Admin from SUPER_ADMIN_EMAIL +
 * ADMIN_PASSWORD_HASH (+ optional SUPER_ADMIN_NAME) with must_change_password = 1, or logs how
 * to create one. Does nothing once any user exists.
 */
export function bootstrapSuperAdmin(conn: DatabaseSync, env: Env = process.env, logger: Logger = console): BootstrapResult {
  const { c } = conn.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (c > 0) return { outcome: 'users_exist' };

  const rawEmail = env.SUPER_ADMIN_EMAIL?.trim();
  const hash = env.ADMIN_PASSWORD_HASH?.trim();
  const howTo = 'run `npm run create-super-admin` on the server to create one.';

  if (!rawEmail || !hash) {
    logger.warn(`[iam] No staff accounts exist yet. Set SUPER_ADMIN_EMAIL and ADMIN_PASSWORD_HASH and restart, or ${howTo}`);
    return { outcome: 'not_configured' };
  }

  let reason: string | null = null;
  if (!looksLikeEmail(rawEmail)) reason = 'SUPER_ADMIN_EMAIL is not a valid email address';
  else if (!isBcryptHash(hash)) reason = 'ADMIN_PASSWORD_HASH is not a bcrypt hash';
  else if (!findSuperAdminRoleId(conn)) reason = 'the Super Admin role is missing';
  if (reason) {
    logger.error(`[iam] Super Admin not created: ${reason}. Fix it and restart, or ${howTo}`);
    return { outcome: 'invalid_config', reason };
  }

  const displayName = env.SUPER_ADMIN_NAME?.trim() || DEFAULT_SUPER_ADMIN_NAME;
  const userId = createSuperAdmin(conn, {
    email: rawEmail,
    displayName,
    passwordHash: hash!,
    mustChangePassword: true,
    actorName: 'system (first start)'
  });
  logger.log(`[iam] Created the first Super Admin (${normalizeEmail(rawEmail)}); a password change is required at first sign-in.`);
  return { outcome: 'created', userId };
}
