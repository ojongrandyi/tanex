// Staff accounts, roles, permissions, sessions and audit log (docs/IAM_RBAC_SPEC.md §3).
// Every function takes the connection as a parameter so tests can run against an in-memory
// database; server/db.ts calls initIamSchema(db) from initDatabase().
import type { DatabaseSync } from 'node:sqlite';
import { ALL_PERMISSIONS, PERMISSIONS, SEEDED_ROLES } from '../../src/shared/permissions.js';

export function createIamTables(conn: DatabaseSync): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      must_change_password INTEGER NOT NULL DEFAULT 1,
      locale TEXT NOT NULL DEFAULT 'en',
      avatar_file TEXT,
      job_title TEXT,
      bio TEXT,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until_ts INTEGER,
      last_login_ts INTEGER,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL,
      created_by TEXT,
      CHECK (email IS NOT NULL OR phone IS NOT NULL)
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at_ts INTEGER NOT NULL,
      updated_at_ts INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      key TEXT PRIMARY KEY,
      group_key TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT,
      permission_key TEXT,
      PRIMARY KEY (role_id, permission_key)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT,
      role_id TEXT,
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      user_id TEXT,
      data_json TEXT NOT NULL,
      expires_at_ts INTEGER NOT NULL,
      created_at_ts INTEGER NOT NULL,
      last_seen_ts INTEGER,
      ip TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at_ts INTEGER NOT NULL,
      used_at_ts INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      at_ts INTEGER NOT NULL,
      actor_user_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT,
      before_json TEXT,
      after_json TEXT,
      ip TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at_ts);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at_ts);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_user_id);
  `);
}

/** Runs fn inside a transaction; rolls back and rethrows on error. */
export function inTransaction<T>(conn: DatabaseSync, fn: () => T): T {
  conn.exec('BEGIN');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Makes the `permissions` table match the catalogue in src/shared/permissions.ts: inserts new
 * keys, refreshes group/description, and removes keys that are no longer in the catalogue
 * (also from role_permissions, so a removed key can't linger on a role). `*` is not a catalogue
 * key and is never removed from role_permissions. The table stores the English description;
 * the French text is read from the catalogue by the console.
 */
export function syncPermissions(conn: DatabaseSync): void {
  inTransaction(conn, () => {
    const upsert = conn.prepare(`
      INSERT INTO permissions (key, group_key, description) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET group_key = excluded.group_key, description = excluded.description
    `);
    for (const p of PERMISSIONS) upsert.run(p.key, p.group, p.description.en);

    const keys = PERMISSIONS.map((p) => p.key);
    const placeholders = keys.map(() => '?').join(', ');
    conn.prepare(`DELETE FROM permissions WHERE key NOT IN (${placeholders})`).run(...keys);
    conn.prepare(`DELETE FROM role_permissions WHERE permission_key NOT IN (${placeholders}, ?)`)
      .run(...keys, ALL_PERMISSIONS);
  });
}

/**
 * Creates the seeded roles (TANEX_PLAN §4.1) only when the `roles` table is empty. Returns the
 * number of roles created (0 when roles already existed).
 */
export function seedRoles(conn: DatabaseSync, now: number = Date.now()): number {
  const { c } = conn.prepare('SELECT COUNT(*) AS c FROM roles').get() as { c: number };
  if (c > 0) return 0;

  return inTransaction(conn, () => {
    const insertRole = conn.prepare(`
      INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts)
      VALUES (?, ?, ?, 1, ?, ?, ?)
    `);
    const insertGrant = conn.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
    for (const role of SEEDED_ROLES) {
      insertRole.run(role.id, role.name, role.description, role.isLocked ? 1 : 0, now, now);
      for (const key of role.permissions) insertGrant.run(role.id, key);
    }
    return SEEDED_ROLES.length;
  });
}

/** Tables, permission sync and first-run role seeding, in that order. Safe to run on every start. */
export function initIamSchema(conn: DatabaseSync): void {
  createIamTables(conn);
  syncPermissions(conn);
  seedRoles(conn);
}
