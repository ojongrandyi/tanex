// Tests for sign-in, SQLite sessions, permission middleware and the audit helper
// (docs/IAM_RBAC_SPEC.md §5–§6). Uses a file database in a temp folder so a "restart" (a new
// connection and a new store on the same file) can be checked. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-auth-test-'));
const DB_FILE = path.join(tmpDir, 'tanex.db');
// server/db.ts opens DB_PATH when first imported, so set it before any server import.
process.env.DB_PATH = DB_FILE;
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db } = await import('../server/db.ts');
const { initIamSchema } = await import('../server/auth/schema.ts');
const { SqliteSessionStore, createSessionMiddleware, COURIER_SESSION_MS, STAFF_SESSION_MS } = await import('../server/auth/sessionStore.ts');
const { createAuthRouter, LOCKOUT_MS } = await import('../server/routes/auth.ts');
const { requireAuth, requirePermission, requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { stripSecrets } = await import('../server/audit.ts');
const { normalizeIdentifier } = await import('../src/shared/identifier.ts');

initIamSchema(db);

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
let userSeq = 0;

function createUser(opts: { email?: string; phone?: string; roles: string[]; status?: string; mustChange?: boolean }): string {
  const id = `usr_test_${++userSeq}`;
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, opts.email ?? null, opts.phone ?? null, `Test user ${userSeq}`, HASH, opts.status ?? 'ACTIVE', opts.mustChange ? 1 : 0, now, now);
  for (const r of opts.roles) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
  return id;
}

// A role with one key, to check any-of matching without '*'.
db.prepare(`INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts) VALUES ('role_test_editor', 'Test editor', '', 0, 0, 0, 0)`).run();
db.prepare(`INSERT INTO role_permissions (role_id, permission_key) VALUES ('role_test_editor', 'shipments.edit')`).run();

interface TestApp { base: string; close: () => Promise<void>; store: InstanceType<typeof SqliteSessionStore> }
const openApps: TestApp[] = [];

async function startApp(conn: DatabaseSync = db): Promise<TestApp> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const store = new SqliteSessionStore(conn, { purgeIntervalMs: false });
  app.use(createSessionMiddleware(store, 'test-secret'));
  app.use('/api', requireJsonOrMultipart);
  app.use('/api/auth', createAuthRouter());
  app.get('/api/any', requireAuth, (_req, res) => { res.json({ ok: true }); });
  app.get('/api/dash', requirePermission('dashboard.view'), (_req, res) => { res.json({ ok: true }); });
  app.post('/api/edit', requirePermission('dashboard.view', 'shipments.edit'), (_req, res) => { res.json({ ok: true }); });
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const t: TestApp = {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    store,
    close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); })
  };
  openApps.push(t);
  return t;
}

after(async () => {
  for (const a of openApps) await a.close().catch(() => {});
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function sidCookie(res: Response): string | null {
  const c = res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='));
  return c ? c.split(';')[0] : null;
}
function sidOf(cookie: string): string {
  // tx.sid=s%3A<sid>.<signature>
  return decodeURIComponent(cookie.slice('tx.sid='.length)).replace(/^s:/, '').replace(/\.[^.]*$/, '');
}

async function login(app: TestApp, identifier: string, password = PASSWORD, cookie?: string) {
  const res = await fetch(`${app.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ identifier, password })
  });
  return { res, json: await res.json() as any, cookie: sidCookie(res) };
}
/** The cookie's Expires is about `ms` from now (cookie dates have 1-second precision). */
function assertLifetime(setCookie: string, ms: number, message?: string): void {
  const m = /Expires=([^;]+)/i.exec(setCookie);
  assert.ok(m, 'cookie has an Expires date');
  const delta = Date.parse(m![1]) - Date.now();
  assert.ok(Math.abs(delta - ms) < 60_000, message ?? `expected ~${ms} ms, got ${delta}`);
}
const get = (app: TestApp, p: string, cookie?: string) =>
  fetch(`${app.base}${p}`, { headers: cookie ? { Cookie: cookie } : {} });
const count = (sql: string, ...params: (string | number)[]) =>
  (db.prepare(sql).get(...params) as { c: number }).c;

// ---- Identifier ----

test('identifier: email lower-cased; phone to E.164 with Cameroon as default; junk rejected', () => {
  assert.deepEqual(normalizeIdentifier('  Boss@TanexSARL.com '), { kind: 'email', value: 'boss@tanexsarl.com' });
  assert.deepEqual(normalizeIdentifier('6 70 00 00 01'), { kind: 'phone', value: '+237670000001' });
  assert.deepEqual(normalizeIdentifier('+237 670-000-001'), { kind: 'phone', value: '+237670000001' });
  assert.equal(normalizeIdentifier('12'), null);
  assert.equal(normalizeIdentifier('   '), null);
});

// ---- Login ----

test('login by email (any case) and by local-format phone; cookie tx.sid is httpOnly + lax; audited', async () => {
  const app = await startApp();
  const id = createUser({ email: 'admin1@example.test', phone: '+237670000001', roles: ['role_super_admin'], mustChange: true });

  const byEmail = await login(app, 'ADMIN1@Example.test');
  assert.equal(byEmail.res.status, 200);
  assert.equal(byEmail.json.user.id, id);
  assert.deepEqual(byEmail.json.user.permissions, ['*']);
  assert.equal(byEmail.json.user.mustChangePassword, true);
  const raw = byEmail.res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!;
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Lax/i);
  assertLifetime(raw, STAFF_SESSION_MS);
  assert.equal(count('SELECT COUNT(*) AS c FROM sessions WHERE sid = ? AND user_id = ?', sidOf(byEmail.cookie!), id), 1);

  const byPhone = await login(app, '670 00 00 01');
  assert.equal(byPhone.res.status, 200);
  assert.equal(byPhone.json.user.id, id);

  assert.equal(count(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'auth.login' AND entity_id = ?`, id), 2);
  assert.ok(count('SELECT last_login_ts AS c FROM users WHERE id = ?', id) > 0);
});

test('unknown account, wrong password and disabled account all get the same 401 message', async () => {
  const app = await startApp();
  createUser({ email: 'gone@example.test', roles: ['role_super_admin'], status: 'DISABLED' });
  createUser({ email: 'here@example.test', roles: ['role_super_admin'] });

  const results = [
    await login(app, 'nobody@example.test'),
    await login(app, 'here@example.test', 'wrong password!'),
    await login(app, 'gone@example.test')
  ];
  for (const r of results) {
    assert.equal(r.res.status, 401);
    assert.equal(r.json.error, 'Incorrect sign-in details.');
    assert.equal(r.cookie, null, 'no session cookie on failure');
  }
  const bad = await fetch(`${app.base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD })
  });
  assert.equal(bad.status, 400);
});

test('lockout: 5 wrong passwords lock the account for 15 minutes, even for the right password', async () => {
  const app = await startApp();
  const id = createUser({ email: 'lock@example.test', roles: ['role_super_admin'] });

  for (let i = 1; i <= 4; i++) {
    assert.equal((await login(app, 'lock@example.test', 'nope nope nope')).res.status, 401);
    assert.equal(count('SELECT failed_logins AS c FROM users WHERE id = ?', id), i);
  }
  const before = Date.now();
  assert.equal((await login(app, 'lock@example.test', 'nope nope nope')).res.status, 401);
  const lockedUntil = count('SELECT locked_until_ts AS c FROM users WHERE id = ?', id);
  assert.ok(lockedUntil >= before + LOCKOUT_MS - 1000 && lockedUntil <= Date.now() + LOCKOUT_MS, 'locked ~15 min');

  const whileLocked = await login(app, 'lock@example.test');
  assert.equal(whileLocked.res.status, 401);
  assert.equal(whileLocked.json.error, 'Incorrect sign-in details.');
  assert.equal(count(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'auth.login_failed' AND entity_id = ?`, id), 6);

  // Lock expired: the right password works again and the counters are cleared.
  db.prepare('UPDATE users SET locked_until_ts = ? WHERE id = ?').run(Date.now() - 1, id);
  const ok = await login(app, 'lock@example.test');
  assert.equal(ok.res.status, 200);
  assert.equal(count('SELECT failed_logins AS c FROM users WHERE id = ?', id), 0);
  assert.equal(count('SELECT COUNT(*) AS c FROM users WHERE id = ? AND locked_until_ts IS NULL', id), 1);
});

test('login regenerates the session id; the old id stops working', async () => {
  const app = await startApp();
  createUser({ email: 'regen@example.test', roles: ['role_super_admin'] });

  const first = await login(app, 'regen@example.test');
  const second = await login(app, 'regen@example.test', PASSWORD, first.cookie!);
  assert.ok(first.cookie && second.cookie);
  assert.notEqual(sidOf(first.cookie!), sidOf(second.cookie!));
  assert.equal(count('SELECT COUNT(*) AS c FROM sessions WHERE sid = ?', sidOf(first.cookie!)), 0);
  assert.equal((await get(app, '/api/any', first.cookie!)).status, 401);
  assert.equal((await get(app, '/api/any', second.cookie!)).status, 200);
});

// ---- Sessions ----

test('session survives a server restart (new connection + new store on the same file)', async () => {
  const app1 = await startApp();
  const id = createUser({ email: 'restart@example.test', roles: ['role_super_admin'] });
  const { cookie } = await login(app1, 'restart@example.test');
  await app1.close();

  const conn2 = new DatabaseSync(DB_FILE);
  try {
    const app2 = await startApp(conn2);
    const res = await get(app2, '/api/auth/session', cookie!);
    const json = await res.json() as any;
    assert.equal(json.user?.id, id);
    assert.equal((await get(app2, '/api/dash', cookie!)).status, 200);
    await app2.close();
  } finally {
    conn2.close();
  }
});

test('store: expired rows are not returned and purgeExpired deletes them', async () => {
  const store = new SqliteSessionStore(db, { purgeIntervalMs: false });
  const past = new Date(Date.now() - 1000);
  await new Promise<void>((r, j) => store.set('sid_expired', { cookie: { expires: past, originalMaxAge: 1 } } as any, (e) => (e ? j(e) : r())));
  const got = await new Promise((r) => store.get('sid_expired', (_e, s) => r(s)));
  assert.equal(got, null);
  await new Promise<void>((r) => store.set('sid_expired2', { cookie: { expires: past, originalMaxAge: 1 } } as any, () => r()));
  assert.ok(store.purgeExpired() >= 1);
  assert.equal(count(`SELECT COUNT(*) AS c FROM sessions WHERE sid LIKE 'sid_expired%'`), 0);
});

test('logout deletes the session row and the session then reads as signed out', async () => {
  const app = await startApp();
  const id = createUser({ email: 'bye@example.test', roles: ['role_super_admin'] });
  const { cookie } = await login(app, 'bye@example.test');
  const res = await fetch(`${app.base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie! } });
  assert.equal(res.status, 200);
  assert.equal(count('SELECT COUNT(*) AS c FROM sessions WHERE sid = ?', sidOf(cookie!)), 0);
  const session = await (await get(app, '/api/auth/session', cookie!)).json() as any;
  assert.equal(session.user, null);
  assert.equal(count(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'auth.logout' AND entity_id = ?`, id), 1);
});

// ---- 401 / 403 ----

test('401 when signed out; 403 without the permission; any-of; courier-only gets 7 days', async () => {
  const app = await startApp();
  createUser({ email: 'rider@example.test', roles: ['role_courier'] });
  createUser({ email: 'editor@example.test', roles: ['role_test_editor'] });

  assert.equal((await get(app, '/api/any')).status, 401);
  assert.equal((await get(app, '/api/dash')).status, 401);

  const rider = await login(app, 'rider@example.test');
  assertLifetime(rider.res.headers.getSetCookie().join(';'), COURIER_SESSION_MS);
  const riderAgain = await get(app, '/api/any', rider.cookie!);
  assert.equal(riderAgain.status, 200);
  assertLifetime(riderAgain.headers.getSetCookie().join(';'), COURIER_SESSION_MS, 'rolling keeps 7 days');
  assert.equal((await get(app, '/api/dash', rider.cookie!)).status, 403);

  const editor = await login(app, 'editor@example.test');
  assertLifetime(editor.res.headers.getSetCookie().join(';'), STAFF_SESSION_MS);
  assert.equal((await get(app, '/api/dash', editor.cookie!)).status, 403);
  const edit = await fetch(`${app.base}/api/edit`, { method: 'POST', headers: { Cookie: editor.cookie!, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(edit.status, 200, 'any-of: shipments.edit is enough');
});

test('disabling a signed-in user takes effect on the next request', async () => {
  const app = await startApp();
  const id = createUser({ email: 'soon-off@example.test', roles: ['role_super_admin'] });
  const { cookie } = await login(app, 'soon-off@example.test');
  assert.equal((await get(app, '/api/dash', cookie!)).status, 200);
  db.prepare(`UPDATE users SET status = 'DISABLED' WHERE id = ?`).run(id);
  assert.equal((await get(app, '/api/dash', cookie!)).status, 401);
});

test('state-changing /api requests must be JSON or multipart', async () => {
  const app = await startApp();
  for (const type of ['application/x-www-form-urlencoded', 'text/plain']) {
    const res = await fetch(`${app.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': type }, body: 'identifier=a&password=b' });
    assert.equal(res.status, 415, type);
  }
  // No body, no type (e.g. logout) is fine.
  assert.equal((await fetch(`${app.base}/api/auth/logout`, { method: 'POST' })).status, 200);
});

// ---- Change password ----

test('change-password: checks the current password and policy, clears must-change, signs out other sessions', async () => {
  const app = await startApp();
  const id = createUser({ email: 'cp@example.test', phone: '+237670000002', roles: ['role_super_admin'], mustChange: true });
  const a = await login(app, 'cp@example.test');
  const b = await login(app, 'cp@example.test');
  const change = (body: object) => fetch(`${app.base}/api/auth/change-password`, {
    method: 'POST', headers: { Cookie: a.cookie!, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  assert.equal((await fetch(`${app.base}/api/auth/change-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'x'.repeat(12) })
  })).status, 401);
  assert.equal((await change({ currentPassword: 'wrong wrong', newPassword: 'a brand new secret' })).status, 400);
  assert.equal((await change({ currentPassword: PASSWORD, newPassword: 'short' })).status, 400);
  assert.equal((await change({ currentPassword: PASSWORD, newPassword: 'CP@example.test' })).status, 400);

  const ok = await change({ currentPassword: PASSWORD, newPassword: 'a brand new secret' });
  assert.equal(ok.status, 200);
  assert.equal(count('SELECT must_change_password AS c FROM users WHERE id = ?', id), 0);
  assert.equal((await get(app, '/api/any', a.cookie!)).status, 200, 'current session kept');
  assert.equal((await get(app, '/api/any', b.cookie!)).status, 401, 'other session signed out');
  assert.equal((await login(app, 'cp@example.test')).res.status, 401);
  assert.equal((await login(app, '670000002', 'a brand new secret')).res.status, 200);

  const rows = db.prepare(`SELECT before_json, after_json, summary FROM audit_log WHERE entity_id = ?`).all(id) as any[];
  for (const r of rows) assert.ok(!JSON.stringify(r).includes('a brand new secret'), 'no password in the audit log');
});

// ---- Audit ----

test('stripSecrets drops passwords, hashes and tokens at any depth', () => {
  assert.deepEqual(
    stripSecrets({ name: 'A', password: 'x', passwordHash: 'h', nested: { token: 't', resetToken: 'r', keep: 1 }, list: [{ secret: 's', ok: true }] }),
    { name: 'A', nested: { keep: 1 }, list: [{ ok: true }] }
  );
});
