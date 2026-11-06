// Tests for the permission catalogue, IAM schema/seeding and the Super Admin bootstrap
// (docs/IAM_RBAC_SPEC.md §3, §4, §8). In-memory databases only. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  SEEDED_ROLES,
  SUPER_ADMIN_ROLE_ID,
  hasPermission,
  isPermissionKey
} from '../src/shared/permissions.ts';
import { checkNewPassword } from '../src/shared/passwordPolicy.ts';
import { createIamTables, initIamSchema, seedRoles, syncPermissions } from '../server/auth/schema.ts';
import { bootstrapSuperAdmin, isBcryptHash, recoverSuperAdmin } from '../server/auth/bootstrap.ts';

// Spec §4, verbatim.
const SPEC_KEYS = [
  'dashboard.view',
  'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.delete',
  'tracking.update',
  'documents.view', 'documents.manage',
  'quotes.view', 'quotes.manage',
  'messages.view', 'messages.manage',
  'payments.view', 'payments.manage',
  'dispatch.view', 'dispatch.manage', 'tariffs.manage', 'couriers.view', 'couriers.manage',
  'courier.app',
  'cash.view', 'cash.confirm',
  'blog.view', 'blog.write', 'blog.edit_any', 'blog.publish', 'blog.categories',
  'users.view', 'users.manage', 'roles.manage', 'settings.view', 'settings.manage', 'audit.view'
];

const silent = { log() {}, warn() {}, error() {} };
const HASH = bcrypt.hashSync('correct horse battery', 4);

function freshDb(): DatabaseSync {
  const conn = new DatabaseSync(':memory:');
  initIamSchema(conn);
  return conn;
}
const count = (conn: DatabaseSync, sql: string, ...params: (string | number)[]) =>
  (conn.prepare(sql).get(...params) as { c: number }).c;

// ---- Catalogue ----

test('catalogue holds exactly the spec §4 keys, each once', () => {
  const keys = PERMISSIONS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate keys');
  assert.deepEqual([...keys].sort(), [...SPEC_KEYS].sort());
});

test('every permission has a known group and EN + FR descriptions; every group is used', () => {
  const groups = new Set<string>(PERMISSION_GROUPS.map((g) => g.key));
  assert.equal(groups.size, PERMISSION_GROUPS.length, 'duplicate groups');
  for (const p of PERMISSIONS) {
    assert.ok(groups.has(p.group), `${p.key}: unknown group ${p.group}`);
    assert.ok(p.description.en.trim(), `${p.key}: EN description`);
    assert.ok(p.description.fr.trim(), `${p.key}: FR description`);
    assert.match(p.key, /^[a-z]+\.[a-z_]+$/);
  }
  for (const g of PERMISSION_GROUPS) {
    assert.ok(g.label.en && g.label.fr, `${g.key}: labels`);
    assert.ok(PERMISSIONS.some((p) => p.group === g.key), `${g.key}: unused group`);
  }
  assert.ok(!isPermissionKey(ALL_PERMISSIONS));
});

test('seeded roles: the §4.1 set, valid keys only, one locked Super Admin holding *', () => {
  assert.deepEqual(SEEDED_ROLES.map((r) => r.name), [
    'Super Admin', 'Operations Manager', 'Dispatch Manager', 'Courier', 'Marketing', 'Finance', 'Customer Support'
  ]);
  assert.equal(new Set(SEEDED_ROLES.map((r) => r.id)).size, SEEDED_ROLES.length);
  const locked = SEEDED_ROLES.filter((r) => r.isLocked);
  assert.equal(locked.length, 1);
  assert.equal(locked[0].id, SUPER_ADMIN_ROLE_ID);
  assert.deepEqual(locked[0].permissions, [ALL_PERMISSIONS]);
  for (const role of SEEDED_ROLES) {
    assert.ok(role.permissions.length > 0, `${role.name}: no permissions`);
    assert.equal(new Set(role.permissions).size, role.permissions.length, `${role.name}: duplicates`);
    if (!role.isLocked) {
      for (const k of role.permissions) assert.ok(isPermissionKey(k), `${role.name}: ${k}`);
    }
  }
  assert.deepEqual(SEEDED_ROLES.find((r) => r.name === 'Courier')!.permissions, ['courier.app']);
});

test('hasPermission: union of grants, * grants everything', () => {
  const union = new Set(['blog.write', 'messages.view']);
  assert.ok(hasPermission(union, 'messages.view'));
  assert.ok(!hasPermission(union, 'messages.manage'));
  assert.ok(hasPermission([ALL_PERMISSIONS], 'users.manage'));
  assert.ok(!hasPermission([], 'dashboard.view'));
});

test('password policy: minimum 10 characters, not the email or phone', () => {
  assert.equal(checkNewPassword('short'), 'too_short');
  assert.equal(checkNewPassword('owner@example.com', { email: 'Owner@Example.com' }), 'same_as_identifier');
  assert.equal(checkNewPassword('+237600000000', { phone: '+237600000000' }), 'same_as_identifier');
  assert.equal(checkNewPassword('a long enough secret'), null);
});

// ---- Schema and seeding ----

test('schema creates every spec §3 table and index', () => {
  const conn = freshDb();
  const names = (type: string) =>
    (conn.prepare('SELECT name FROM sqlite_master WHERE type = ?').all(type) as { name: string }[]).map((r) => r.name);
  for (const t of ['users', 'roles', 'permissions', 'role_permissions', 'user_roles', 'sessions', 'password_resets', 'audit_log']) {
    assert.ok(names('table').includes(t), t);
  }
  for (const i of ['idx_sessions_expires', 'idx_sessions_user', 'idx_audit_at', 'idx_audit_entity', 'idx_audit_actor']) {
    assert.ok(names('index').includes(i), i);
  }
  // A user needs an email or a phone.
  assert.throws(() => conn.prepare(
    `INSERT INTO users (id, display_name, password_hash, created_at_ts, updated_at_ts) VALUES ('usr_x', 'X', 'h', 1, 1)`
  ).run());
});

test('permissions table mirrors the catalogue and stale keys are removed', () => {
  const conn = freshDb();
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM permissions'), PERMISSIONS.length);
  conn.prepare(`INSERT INTO permissions (key, group_key, description) VALUES ('old.key', 'admin', 'x')`).run();
  conn.prepare(`INSERT INTO role_permissions (role_id, permission_key) VALUES ('role_finance', 'old.key')`).run();
  conn.prepare(`UPDATE permissions SET description = 'changed' WHERE key = 'audit.view'`).run();
  syncPermissions(conn);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM permissions'), PERMISSIONS.length);
  assert.equal(count(conn, `SELECT COUNT(*) AS c FROM role_permissions WHERE permission_key = 'old.key'`), 0);
  assert.equal(count(conn, `SELECT COUNT(*) AS c FROM role_permissions WHERE permission_key = '*'`), 1);
  const row = conn.prepare(`SELECT description FROM permissions WHERE key = 'audit.view'`).get() as { description: string };
  assert.equal(row.description, PERMISSIONS.find((p) => p.key === 'audit.view')!.description.en);
});

test('role seeding is idempotent and never re-seeds once roles exist', () => {
  const conn = freshDb();
  const grants = SEEDED_ROLES.reduce((n, r) => n + r.permissions.length, 0);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM roles'), SEEDED_ROLES.length);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM role_permissions'), grants);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM roles WHERE is_locked = 1'), 1);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM roles WHERE is_system = 1'), SEEDED_ROLES.length);

  // Running the whole init again changes nothing.
  initIamSchema(conn);
  assert.equal(seedRoles(conn), 0);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM roles'), SEEDED_ROLES.length);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM role_permissions'), grants);

  // A role the Super Admin deleted stays deleted.
  conn.prepare(`DELETE FROM role_permissions WHERE role_id = 'role_marketing'`).run();
  conn.prepare(`DELETE FROM roles WHERE id = 'role_marketing'`).run();
  initIamSchema(conn);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM roles'), SEEDED_ROLES.length - 1);
});

test('createIamTables leaves existing rows alone', () => {
  const conn = freshDb();
  createIamTables(conn);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM roles'), SEEDED_ROLES.length);
});

// ---- Bootstrap ----

test('bootstrap creates exactly one Super Admin, and only on an empty users table', () => {
  const conn = freshDb();
  const env = { SUPER_ADMIN_EMAIL: '  Owner@Example.com ', ADMIN_PASSWORD_HASH: HASH, SUPER_ADMIN_NAME: 'Owner' };
  const first = bootstrapSuperAdmin(conn, env, silent);
  assert.equal(first.outcome, 'created');

  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM users'), 1);
  const user = conn.prepare('SELECT * FROM users').get() as Record<string, unknown>;
  assert.equal(user.email, 'owner@example.com');
  assert.equal(user.display_name, 'Owner');
  assert.equal(user.password_hash, HASH);
  assert.equal(user.must_change_password, 1);
  assert.equal(user.status, 'ACTIVE');
  assert.match(String(user.id), /^usr_[0-9a-f]{24}$/);
  const roles = conn.prepare('SELECT role_id FROM user_roles WHERE user_id = ?').all(String(user.id)) as { role_id: string }[];
  assert.deepEqual(roles.map((r) => r.role_id), [SUPER_ADMIN_ROLE_ID]);
  const audit = conn.prepare('SELECT action, entity_id, after_json FROM audit_log').all() as Record<string, string>[];
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'user.create');
  assert.ok(!audit[0].after_json.includes(HASH), 'hash must not be audited');

  assert.equal(bootstrapSuperAdmin(conn, env, silent).outcome, 'users_exist');
  assert.equal(bootstrapSuperAdmin(conn, { ...env, SUPER_ADMIN_EMAIL: 'other@example.com' }, silent).outcome, 'users_exist');
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM users'), 1);
});

test('bootstrap without configuration logs how to create one and creates nothing', () => {
  const conn = freshDb();
  const warnings: string[] = [];
  const result = bootstrapSuperAdmin(conn, {}, { ...silent, warn: (m: string) => warnings.push(m) });
  assert.equal(result.outcome, 'not_configured');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /npm run create-super-admin/);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM users'), 0);
});

test('bootstrap rejects a placeholder hash or a bad email and never logs secrets', () => {
  const conn = freshDb();
  const logged: string[] = [];
  const logger = { log: (m: string) => logged.push(m), warn: (m: string) => logged.push(m), error: (m: string) => logged.push(m) };
  const placeholder = 'replace-with-a-bcrypt-hash-see-instructions-above';
  assert.equal(bootstrapSuperAdmin(conn, { SUPER_ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD_HASH: placeholder }, logger).outcome, 'invalid_config');
  assert.equal(bootstrapSuperAdmin(conn, { SUPER_ADMIN_EMAIL: 'not-an-email', ADMIN_PASSWORD_HASH: HASH }, logger).outcome, 'invalid_config');
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM users'), 0);
  bootstrapSuperAdmin(conn, { SUPER_ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD_HASH: HASH }, logger);
  for (const line of logged) assert.ok(!line.includes(HASH) && !line.includes(placeholder), line);
  assert.ok(isBcryptHash(HASH));
  assert.ok(!isBcryptHash(placeholder));
});

test('recovery resets the password, re-enables, unlocks, restores the role and ends sessions', () => {
  const conn = freshDb();
  const created = bootstrapSuperAdmin(conn, { SUPER_ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD_HASH: HASH }, silent);
  assert.equal(created.outcome, 'created');
  const id = (created as { userId: string }).userId;
  conn.prepare(`UPDATE users SET status = 'DISABLED', failed_logins = 5, locked_until_ts = 9e12 WHERE id = ?`).run(id);
  conn.prepare('DELETE FROM user_roles WHERE user_id = ?').run(id);
  conn.prepare(`INSERT INTO sessions (sid, user_id, data_json, expires_at_ts, created_at_ts) VALUES ('s1', ?, '{}', 9e12, 1)`).run(id);

  const newHash = bcrypt.hashSync('another long secret', 4);
  recoverSuperAdmin(conn, { userId: id, passwordHash: newHash, mustChangePassword: false, actorName: 'test' });
  const user = conn.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
  assert.equal(user.password_hash, newHash);
  assert.equal(user.status, 'ACTIVE');
  assert.equal(user.failed_logins, 0);
  assert.equal(user.locked_until_ts, null);
  assert.equal(user.must_change_password, 0);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM user_roles WHERE user_id = ? AND role_id = ?', id, SUPER_ADMIN_ROLE_ID), 1);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?', id), 0);
  assert.equal(count(conn, 'SELECT COUNT(*) AS c FROM users'), 1);
});
