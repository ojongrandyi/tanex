// Users, roles and audit log API (docs/IAM_RBAC_SPEC.md §5.3–§5.7, §6): permissions on the new
// routes, temporary password returned once, no privilege escalation, last Super Admin protection,
// disabling and resetting sign people out, audit filters. Runs against the real /api mounts on
// a file database in a temp folder. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-users-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { canGrant, generateTempPassword } = await import('../server/auth/rules.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);

function addUser(id: string, email: string, roleIds: string[], name = id): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, email, name, HASH, now, now);
  for (const r of roleIds) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
}

// A user manager who is not Super Admin: may manage users and roles and holds Customer Support's
// keys, but not Finance's payments keys or settings.
const now0 = Date.now();
db.prepare(`INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts) VALUES ('role_people', 'People Admin', '', 0, 0, ?, ?)`).run(now0, now0);
const PEOPLE_KEYS = ['users.view', 'users.manage', 'roles.manage', 'audit.view', 'shipments.view', 'tracking.update', 'messages.view', 'messages.manage', 'quotes.view', 'dispatch.view'];
for (const k of PEOPLE_KEYS) {
  db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)').run('role_people', k);
}

addUser('usr_sa', 'sa@example.test', [SUPER_ADMIN_ROLE_ID], 'Owner');
addUser('usr_people', 'people@example.test', ['role_people'], 'People Admin');
addUser('usr_fin', 'fin@example.test', ['role_finance'], 'Finance Person');
addUser('usr_cs', 'cs@example.test', ['role_customer_support'], 'Support Person');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(createSessionMiddleware(new SqliteSessionStore(db, { purgeIntervalMs: false }), 'test-secret'));
app.use('/api', requireJsonOrMultipart);
registerApiRoutes(app);
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method: string, p: string, cookie?: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function json(res: Response): Promise<any> {
  return res.json();
}

async function signIn(identifier: string, password = PASSWORD): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier, password });
  assert.equal(res.status, 200, `sign-in as ${identifier}`);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}

let sa = await signIn('sa@example.test');
const people = await signIn('people@example.test');
const fin = await signIn('fin@example.test');

const lastAudit = (action: string) =>
  db.prepare('SELECT * FROM audit_log WHERE action = ? ORDER BY at_ts DESC, rowid DESC LIMIT 1').get(action) as any;

test('rules: canGrant and temporary passwords', () => {
  assert.equal(canGrant(['*'], ['*', 'users.manage']), true);
  assert.equal(canGrant(['users.manage'], ['users.manage']), true);
  assert.equal(canGrant(['users.manage'], ['users.manage', 'settings.manage']), false);
  assert.equal(canGrant(['users.manage'], ['*']), false);
  assert.equal(canGrant([], []), true);
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const p = generateTempPassword();
    assert.match(p, /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    seen.add(p);
  }
  assert.equal(seen.size, 50);
});

test('new routes: 401 signed out, 403 without the permission', async () => {
  const probes: [string, string, unknown?][] = [
    ['GET', '/api/users'],
    ['POST', '/api/users', { displayName: 'X', email: 'x@example.test' }],
    ['PATCH', '/api/users/usr_cs', { displayName: 'Y' }],
    ['POST', '/api/users/usr_cs/reset-password', {}],
    ['GET', '/api/users/usr_cs/sessions'],
    ['DELETE', '/api/users/usr_cs/sessions'],
    ['GET', '/api/roles'],
    ['POST', '/api/roles', { name: 'Z', permissions: [] }],
    ['PATCH', '/api/roles/role_finance', { name: 'Money' }],
    ['DELETE', '/api/roles/role_finance'],
    ['GET', '/api/permissions'],
    ['GET', '/api/audit'],
    ['GET', '/api/audit/filters']
  ];
  for (const [m, p, b] of probes) {
    assert.equal((await call(m, p, undefined, b)).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await call(m, p, fin, b)).status, 403, `finance ${m} ${p}`);
  }
});

test('create user: temporary password returned once, must change, audited without secrets', async () => {
  const res = await call('POST', '/api/users', sa, {
    displayName: '  Ada   Rider ', phone: '670 00 00 01', locale: 'fr', roleIds: ['role_courier']
  });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { data } = await json(res);
  assert.equal(data.user.displayName, 'Ada Rider');
  assert.equal(data.user.phone, '+237670000001');
  assert.equal(data.user.email, null);
  assert.equal(data.user.mustChangePassword, true);
  assert.deepEqual(data.user.roles.map((r: any) => r.id), ['role_courier']);
  assert.ok(typeof data.tempPassword === 'string' && data.tempPassword.length >= 10);

  // The list never carries a password or hash.
  const list = await json(await call('GET', '/api/users', sa));
  const listed = list.data.find((u: any) => u.id === data.user.id);
  assert.ok(listed);
  assert.ok(!JSON.stringify(list).includes(data.tempPassword));
  assert.ok(!JSON.stringify(list).includes('$2'));

  // Signs in with the temporary password (local phone format) and must change it.
  const cookie = await signIn('670000001', data.tempPassword);
  const session = await json(await call('GET', '/api/auth/session', cookie));
  assert.equal(session.user.mustChangePassword, true);

  const row = lastAudit('user.create');
  assert.equal(row.entity_id, data.user.id);
  assert.equal(row.actor_user_id, 'usr_sa');
  assert.ok(!String(row.after_json).includes(data.tempPassword));
  assert.deepEqual(JSON.parse(row.after_json).roles, ['Courier']);
});

test('create user: validation and duplicates', async () => {
  assert.equal((await call('POST', '/api/users', sa, { displayName: 'No Contact' })).status, 400);
  assert.equal((await json(await call('POST', '/api/users', sa, { displayName: 'Bad', email: 'nope' }))).code, 'INVALID_EMAIL');
  assert.equal((await json(await call('POST', '/api/users', sa, { displayName: 'Bad', phone: '12' }))).code, 'INVALID_PHONE');
  assert.equal((await json(await call('POST', '/api/users', sa, { displayName: 'Bad', email: 'a@b.test', roleIds: ['role_nope'] }))).code, 'UNKNOWN_ROLE');
  const dup = await call('POST', '/api/users', sa, { displayName: 'Dup', email: 'FIN@example.test' });
  assert.equal(dup.status, 409);
  assert.equal((await json(dup)).code, 'EMAIL_TAKEN');
});

test('no privilege escalation: roles and users with permissions the actor lacks', async () => {
  // Finance holds payments.manage, which People Admin does not.
  let res = await call('POST', '/api/users', people, { displayName: 'P1', email: 'p1@example.test', roleIds: ['role_finance'] });
  assert.equal(res.status, 403);
  assert.equal((await json(res)).code, 'CANNOT_GRANT');
  res = await call('POST', '/api/users', people, { displayName: 'P2', email: 'p2@example.test', roleIds: [SUPER_ADMIN_ROLE_ID] });
  assert.equal(res.status, 403);
  // A role within their own permissions is fine.
  res = await call('POST', '/api/users', people, { displayName: 'P3', email: 'p3@example.test', roleIds: ['role_people'] });
  assert.equal(res.status, 201);
  const p3 = (await json(res)).data.user.id;

  // Can't give an existing user a stronger role, can't touch a stronger account.
  assert.equal((await call('PATCH', `/api/users/${p3}`, people, { roleIds: ['role_people', 'role_finance'] })).status, 403);
  for (const [m, p, b] of [
    ['PATCH', '/api/users/usr_sa', { displayName: 'Hijacked' }],
    ['POST', '/api/users/usr_sa/reset-password', {}],
    ['PATCH', '/api/users/usr_fin', { status: 'DISABLED' }],
    ['DELETE', '/api/users/usr_sa/sessions', undefined]
  ] as [string, string, unknown][]) {
    const r = await call(m, p, people, b);
    assert.equal(r.status, 403, `${m} ${p}`);
    assert.equal((await json(r)).code, 'CANNOT_MANAGE_USER');
  }

  // Roles: can't create or extend a role beyond their own keys, nor strip keys they lack.
  res = await call('POST', '/api/roles', people, { name: 'Sneaky', permissions: ['settings.manage'] });
  assert.equal(res.status, 403);
  res = await call('PATCH', '/api/roles/role_people', people, { permissions: [...PEOPLE_KEYS, 'settings.manage'] });
  assert.equal(res.status, 403);
  res = await call('PATCH', '/api/roles/role_finance', people, { permissions: ['shipments.view'] });
  assert.equal(res.status, 403);
  // '*' is never a choice, even for Super Admin.
  res = await call('POST', '/api/roles', sa, { name: 'All', permissions: ['*'] });
  assert.equal(res.status, 400);
  // Within their keys: allowed.
  res = await call('POST', '/api/roles', people, { name: 'Viewer', description: 'Reads shipments', permissions: ['shipments.view'] });
  assert.equal(res.status, 201);
  assert.deepEqual((await json(res)).data.permissions, ['shipments.view']);
});

test('Super Admin role is locked; system roles cannot be deleted; roles in use cannot be deleted', async () => {
  for (const [m, b] of [['PATCH', { name: 'Boss' }], ['DELETE', undefined]] as [string, unknown][]) {
    const r = await call(m, `/api/roles/${SUPER_ADMIN_ROLE_ID}`, sa, b);
    assert.equal(r.status, 409);
    assert.equal((await json(r)).code, 'ROLE_LOCKED');
  }
  assert.equal((await json(await call('DELETE', '/api/roles/role_marketing', sa))).code, 'ROLE_SYSTEM');
  assert.equal((await json(await call('DELETE', '/api/roles/role_people', sa))).code, 'ROLE_IN_USE');
  assert.equal((await call('POST', '/api/roles', sa, { name: 'people admin', permissions: [] })).status, 409);

  const created = (await json(await call('POST', '/api/roles', sa, { name: 'Temp Role', permissions: ['blog.view'] }))).data;
  const edited = await json(await call('PATCH', `/api/roles/${created.id}`, sa, { permissions: ['blog.view', 'blog.write'] }));
  assert.deepEqual(edited.data.permissions, ['blog.view', 'blog.write']);
  const row = lastAudit('role.permissions.set');
  assert.deepEqual(JSON.parse(row.before_json), { permissions: ['blog.view'] });
  assert.deepEqual(JSON.parse(row.after_json), { permissions: ['blog.view', 'blog.write'] });
  assert.equal((await call('DELETE', `/api/roles/${created.id}`, sa)).status, 200);

  const roles = (await json(await call('GET', '/api/roles', people))).data;
  const superAdmin = roles.find((r: any) => r.id === SUPER_ADMIN_ROLE_ID);
  assert.equal(superAdmin.isLocked, true);
  assert.equal(superAdmin.userCount, 1);
  const catalogue = (await json(await call('GET', '/api/permissions', people))).data;
  assert.ok(catalogue.permissions.some((p: any) => p.key === 'audit.view' && p.description.fr));
});

test('last active Super Admin cannot be disabled or demoted; self-disable refused', async () => {
  let res = await call('PATCH', '/api/users/usr_sa', sa, { status: 'DISABLED' });
  assert.equal(res.status, 409);
  assert.equal((await json(res)).code, 'SELF_DISABLE');
  res = await call('PATCH', '/api/users/usr_sa', sa, { roleIds: ['role_operations_manager'] });
  assert.equal(res.status, 409);
  assert.equal((await json(res)).code, 'LAST_SUPER_ADMIN');

  // A second Super Admin makes it possible, and then that one becomes the last.
  const created = (await json(await call('POST', '/api/users', sa, { displayName: 'Second Owner', email: 'sa2@example.test', roleIds: [SUPER_ADMIN_ROLE_ID] }))).data;
  db.prepare('UPDATE users SET must_change_password = 0 WHERE id = ?').run(created.user.id);
  const sa2 = await signIn('sa2@example.test', created.tempPassword);
  res = await call('PATCH', '/api/users/usr_sa', sa2, { status: 'DISABLED' });
  assert.equal(res.status, 200);
  res = await call('PATCH', `/api/users/${created.user.id}`, sa2, { roleIds: [] });
  assert.equal(res.status, 409);
  assert.equal((await json(res)).code, 'LAST_SUPER_ADMIN');
  // Put things back for the remaining tests.
  assert.equal((await call('PATCH', '/api/users/usr_sa', sa2, { status: 'ACTIVE' })).status, 200);
  assert.equal(lastAudit('user.enable').entity_id, 'usr_sa');
  assert.equal(lastAudit('user.disable').entity_id, 'usr_sa');
  // Disabling signed the owner out; sign in again.
  sa = await signIn('sa@example.test');
});

test('disabling a user deletes their sessions at once', async () => {
  const cs = await signIn('cs@example.test');
  assert.ok((await json(await call('GET', '/api/auth/session', cs))).user);
  const res = await call('PATCH', '/api/users/usr_cs', people, { status: 'DISABLED' });
  assert.equal(res.status, 200);
  assert.equal((await json(res)).data.status, 'DISABLED');
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?').get('usr_cs') as { c: number };
  assert.equal(c, 0);
  assert.equal((await json(await call('GET', '/api/auth/session', cs))).user, null);
  assert.equal((await call('POST', '/api/auth/login', undefined, { identifier: 'cs@example.test', password: PASSWORD })).status, 401);

  // Enabling clears a lockout too.
  db.prepare('UPDATE users SET locked_until_ts = ?, failed_logins = 3 WHERE id = ?').run(Date.now() + 60_000, 'usr_cs');
  assert.equal((await call('PATCH', '/api/users/usr_cs', people, { status: 'ACTIVE' })).status, 200);
  await signIn('cs@example.test');
});

test('reset password: new temporary password once, old one stops working, sessions and lock cleared', async () => {
  const cs = await signIn('cs@example.test');
  db.prepare('UPDATE users SET locked_until_ts = ? WHERE id = ?').run(Date.now() + 60_000, 'usr_cs');
  const res = await call('POST', '/api/users/usr_cs/reset-password', people, {});
  assert.equal(res.status, 200);
  const { data } = await json(res);
  assert.equal(data.user.mustChangePassword, true);
  assert.equal(data.user.locked, false);
  assert.equal((await json(await call('GET', '/api/auth/session', cs))).user, null);
  assert.equal((await call('POST', '/api/auth/login', undefined, { identifier: 'cs@example.test', password: PASSWORD })).status, 401);
  await signIn('cs@example.test', data.tempPassword);
  const row = lastAudit('user.reset_password');
  assert.equal(row.entity_id, 'usr_cs');
  assert.ok(!JSON.stringify(row).includes(data.tempPassword));

  // Own password goes through My account instead.
  const self = await call('POST', '/api/users/usr_people/reset-password', people, {});
  assert.equal(self.status, 409);
  assert.equal((await json(self)).code, 'SELF_RESET');
});

test('sessions: list without session ids, sign out everywhere', async () => {
  await signIn('fin@example.test');
  const list = await json(await call('GET', '/api/users/usr_fin/sessions', sa));
  assert.ok(list.data.length >= 2);
  assert.ok(list.data.every((s: any) => !('sid' in s)));
  const res = await json(await call('DELETE', '/api/users/usr_fin/sessions', sa));
  assert.ok(res.data.signedOut >= 2);
  assert.equal((await json(await call('GET', '/api/auth/session', fin))).user, null);
  assert.equal(lastAudit('user.sessions_revoke').entity_id, 'usr_fin');
});

test('edit user: changed fields only in the audit row, duplicates refused', async () => {
  const res = await call('PATCH', '/api/users/usr_cs', sa, { displayName: 'Support Lead', email: 'cs@example.test', locale: 'fr' });
  assert.equal(res.status, 200);
  const row = lastAudit('user.update');
  assert.deepEqual(JSON.parse(row.before_json), { displayName: 'Support Person', locale: 'en' });
  assert.deepEqual(JSON.parse(row.after_json), { displayName: 'Support Lead', locale: 'fr' });
  assert.equal((await json(await call('PATCH', '/api/users/usr_cs', sa, { email: 'fin@example.test' }))).code, 'EMAIL_TAKEN');
  assert.equal((await json(await call('PATCH', '/api/users/usr_cs', sa, { email: '' }))).code, 'IDENTIFIER_REQUIRED');
  assert.equal((await call('PATCH', '/api/users/usr_nope', sa, { displayName: 'X' })).status, 404);
});

test('audit log: filters, pagination, before/after', async () => {
  let page = (await json(await call('GET', '/api/audit?pageSize=2&page=1', people))).data;
  assert.equal(page.items.length, 2);
  assert.ok(page.total > 2);
  assert.ok(page.items[0].at >= page.items[1].at);
  const page2 = (await json(await call('GET', '/api/audit?pageSize=2&page=2', people))).data;
  assert.notEqual(page2.items[0].id, page.items[0].id);

  page = (await json(await call('GET', '/api/audit?action=user.update&entityType=user&entityId=USR_CS', people))).data;
  assert.ok(page.total >= 1);
  assert.ok(page.items.every((i: any) => i.action === 'user.update' && i.entityId === 'usr_cs'));
  assert.equal(page.items[0].after.displayName, 'Support Lead');

  page = (await json(await call('GET', '/api/audit?actor=usr_people', people))).data;
  assert.ok(page.items.every((i: any) => i.actorUserId === 'usr_people'));

  const future = Date.now() + 86_400_000;
  assert.equal((await json(await call('GET', `/api/audit?from=${future}`, people))).data.total, 0);
  assert.equal((await json(await call('GET', `/api/audit?to=1`, people))).data.total, 0);

  const filters = (await json(await call('GET', '/api/audit/filters', people))).data;
  assert.ok(filters.actions.includes('user.create'));
  assert.ok(filters.entityTypes.includes('role'));
  assert.ok(filters.actors.some((a: any) => a.id === 'usr_sa' && a.name === 'Owner'));
});

test('public writes made while signed in are audited; anonymous ones are not', async () => {
  const before = (db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'message.create'").get() as { c: number }).c;
  const body = { name: 'Walk-in', email: 'walkin@example.test', message: 'Called the office.' };
  assert.equal((await call('POST', '/api/messages', undefined, body)).status, 201);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'message.create'").get() as { c: number }).c, before);
  const res = await call('POST', '/api/messages', sa, body);
  assert.equal(res.status, 201);
  const id = (await json(res)).data.id;
  // The audit row is written when the response finishes.
  await new Promise((r) => setTimeout(r, 20));
  const row = lastAudit('message.create');
  assert.equal(row.entity_id, id);
  assert.equal(row.actor_user_id, 'usr_sa');
});

test('own sessions (My account): list without ids, sign out other devices keeps this one', async () => {
  assert.equal((await call('GET', '/api/auth/sessions')).status, 401);
  assert.equal((await call('DELETE', '/api/auth/sessions')).status, 401);
  const here = await signIn('people@example.test');
  const other = await signIn('people@example.test');
  const list = (await json(await call('GET', '/api/auth/sessions', here))).data;
  assert.ok(list.length >= 2);
  assert.equal(list.filter((s: any) => s.current).length, 1);
  assert.ok(list.every((s: any) => !('sid' in s)));
  const res = await json(await call('DELETE', '/api/auth/sessions', here));
  assert.ok(res.data.signedOut >= 1);
  assert.ok((await json(await call('GET', '/api/auth/session', here))).user);
  assert.equal((await json(await call('GET', '/api/auth/session', other))).user, null);
  const left = (await json(await call('GET', '/api/auth/sessions', here))).data;
  assert.equal(left.length, 1);
  assert.equal(left[0].current, true);
  assert.equal(lastAudit('auth.sessions_revoke_others').entity_id, 'usr_people');
});
