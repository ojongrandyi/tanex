// Forgot/reset password (docs/IAM_RBAC_SPEC.md §6, §10) and the phase B security checks added
// with B.6: one answer whether or not an account exists, token stored hashed, 30 minutes,
// single use, a new request replaces the old link, reset signs out everywhere and clears the
// lock, per-account limit; temporary passwords block every console route until changed; no
// tokens or passwords in the audit log or the server log.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-reset-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_PASS = 'smtp-secret-value';
process.env.MAIL_FROM = 'TanEx <info@example.test>';
process.env.APP_URL = 'https://app.example.test';

// Everything the server prints, to check that no secret is ever logged.
const logged: string[] = [];
for (const level of ['log', 'warn', 'error', 'info'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    logged.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    original(...args);
  };
}

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { setSenderForTests } = await import('../server/mail/mailer.ts');
const { processOutbox } = await import('../server/mail/outbox.ts');
const { hashResetToken, RESET_REQUESTS_PER_HOUR, RESET_TOKEN_TTL_MS, createResetToken } = await import('../server/auth/passwordReset.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
function addUser(id: string, opts: { email?: string; phone?: string; roles: string[]; status?: string; mustChange?: boolean; locale?: string }): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password, locale, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, opts.email ?? null, opts.phone ?? null, id, HASH, opts.status ?? 'ACTIVE', opts.mustChange ? 1 : 0, opts.locale ?? 'en', now, now);
  for (const r of opts.roles) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
}
addUser('usr_ann', { email: 'ann@example.test', roles: ['role_finance'] });
addUser('usr_fr', { email: 'fr@example.test', roles: ['role_finance'], locale: 'fr' });
addUser('usr_off', { email: 'off@example.test', roles: ['role_finance'], status: 'DISABLED' });
addUser('usr_cap', { email: 'cap@example.test', roles: ['role_finance'] });
addUser('usr_temp', { email: 'temp@example.test', roles: [SUPER_ADMIN_ROLE_ID], mustChange: true });

const app = express();
// As in production (server/index.ts): the client address comes from X-Forwarded-For, which lets
// each test act from its own address under the per-IP limits.
app.set('trust proxy', 1);
app.use(express.json());
app.use(createSessionMiddleware(new SqliteSessionStore(db, { purgeIntervalMs: false }), 'test-secret'));
app.use('/api', requireJsonOrMultipart);
registerApiRoutes(app);
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const sent: { to: string; subject: string; text: string; html: string }[] = [];
setSenderForTests(async (m) => { sent.push(m); });

after(async () => {
  setSenderForTests(null);
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let clientIp = '203.0.113.1';
async function call(method: string, p: string, cookie?: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'X-Forwarded-For': clientIp };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function signIn(identifier: string, password = PASSWORD): Promise<Response> {
  return call('POST', '/api/auth/login', undefined, { identifier, password });
}
const cookieOf = (res: Response) => res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
// /forgot answers before it does the work; give it a moment.
const settle = () => new Promise((r) => setTimeout(r, 50));

async function forgot(email: unknown): Promise<{ status: number; body: string }> {
  const res = await call('POST', '/api/auth/forgot', undefined, { email });
  const body = await res.text();
  await settle();
  await processOutbox(db);
  return { status: res.status, body };
}
function tokenFrom(text: string): string {
  const m = text.match(/#reset=([A-Za-z0-9_-]+)/);
  assert.ok(m, 'reset link in the email');
  return decodeURIComponent(m![1]);
}
const usedNewPasswords: string[] = [];
async function reset(token: string, newPassword: string): Promise<Response> {
  usedNewPasswords.push(newPassword);
  return call('POST', '/api/auth/reset', undefined, { token, newPassword });
}

test('forgot: the same answer for a known, unknown, disabled, phone or malformed identifier', async () => {
  const answers = await Promise.all([
    forgot('ann@example.test'),
    forgot('nobody@example.test'),
    forgot('off@example.test'),
    forgot('+237651000000'),
    forgot({ $ne: null }),
    forgot('')
  ]);
  for (const a of answers) {
    assert.equal(a.status, 200);
    assert.equal(a.body, answers[0].body);
  }
  assert.deepEqual(sent.map((m) => m.to), ['ann@example.test'], 'only the active account gets an email');
  assert.equal(sent[0].subject, 'Reset your TanEx password');
  assert.match(sent[0].text, /^Someone asked to reset the password for your TanEx account\. Use this link within 30 minutes: https:\/\/app\.example\.test\/private-user\/#reset=/);
  const audits = db.prepare(`SELECT * FROM audit_log WHERE action = 'auth.password_reset_request'`).all() as any[];
  assert.equal(audits.length, 3, 'known account, unknown address, disabled account (as unknown)');
});

test('reset: token stored hashed, 30 minutes, works once, signs out everywhere, clears the lock', async () => {
  const before = await signIn('ann@example.test');
  const oldSession = cookieOf(before);
  db.prepare('UPDATE users SET failed_logins = 3, locked_until_ts = ? WHERE id = ?').run(Date.now() + 60_000, 'usr_ann');

  sent.length = 0;
  await forgot('ANN@example.test');
  const token = tokenFrom(sent[0].text);
  assert.equal(Buffer.from(token, 'base64url').length, 32, '32 random bytes');
  const rows = db.prepare(`SELECT * FROM password_resets WHERE user_id = 'usr_ann' AND used_at_ts IS NULL`).all() as any[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, hashResetToken(token));
  assert.notEqual(rows[0].token_hash, token, 'raw token is not stored');
  const ttl = rows[0].expires_at_ts - Date.now();
  assert.ok(ttl > RESET_TOKEN_TTL_MS - 5_000 && ttl <= RESET_TOKEN_TTL_MS);
  // The outbox copy of the email no longer holds the link.
  const stored = db.prepare(`SELECT html, text FROM email_outbox WHERE template_key = 'auth.reset' ORDER BY created_at_ts DESC LIMIT 1`).get() as any;
  assert.equal(stored.text.includes(token), false);

  // Password policy still applies.
  const short = await reset(token, 'short');
  assert.equal(short.status, 400);
  assert.equal((await short.json()).code, 'TOO_SHORT');
  assert.equal((await reset(token, 'ann@example.test')).status, 400);

  const ok = await reset(token, 'a brand new password 1');
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/auth/session', oldSession).then((r) => r.json())).user, null, 'old session ended');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('usr_ann') as any;
  assert.equal(user.locked_until_ts, null);
  assert.equal(user.failed_logins, 0);
  assert.equal(user.must_change_password, 0);
  assert.equal((await signIn('ann@example.test')).status, 401, 'old password no longer works');
  assert.equal((await signIn('ann@example.test', 'a brand new password 1')).status, 200);

  const again = await reset(token, 'another new password 2');
  assert.equal(again.status, 400);
  assert.equal((await again.json()).code, 'INVALID_TOKEN', 'single use');
  assert.ok(db.prepare(`SELECT 1 FROM audit_log WHERE action = 'auth.password_reset' AND entity_id = 'usr_ann'`).get());
});

test('reset: expired, replaced, unknown and disabled-account links are refused the same way', async () => {
  clientIp = '203.0.113.6';
  sent.length = 0;
  await forgot('fr@example.test');
  const first = tokenFrom(sent[0].text);
  assert.equal(sent[0].subject, 'Réinitialiser votre mot de passe TanEx', "in the account's language");
  await forgot('fr@example.test');
  const second = tokenFrom(sent[1].text);
  const replaced = await reset(first, 'a brand new password 3');
  assert.equal(replaced.status, 400);
  const invalidBody = await replaced.text();

  // Expired.
  db.prepare('UPDATE password_resets SET expires_at_ts = ? WHERE token_hash = ?').run(Date.now() - 1, hashResetToken(second));
  const expired = await reset(second, 'a brand new password 3');
  assert.equal(expired.status, 400);
  assert.equal(await expired.text(), invalidBody);

  const unknown = await reset('A'.repeat(43), 'a brand new password 3');
  assert.equal(await unknown.text(), invalidBody);

  // A link issued before the account was disabled stops working.
  const token = createResetToken(db, 'usr_cap')!;
  db.prepare(`UPDATE users SET status = 'DISABLED' WHERE id = 'usr_cap'`).run();
  assert.equal(await (await reset(token, 'a brand new password 3')).text(), invalidBody);
  db.prepare(`UPDATE users SET status = 'ACTIVE' WHERE id = 'usr_cap'`).run();
  db.prepare(`DELETE FROM password_resets WHERE user_id = 'usr_cap'`).run();
});

test('forgot: at most 3 emails per account per hour; the answer does not change', async () => {
  clientIp = '203.0.113.2';
  sent.length = 0;
  for (let i = 0; i < RESET_REQUESTS_PER_HOUR + 2; i++) {
    const a = await forgot('cap@example.test');
    assert.equal(a.status, 200);
  }
  assert.equal(sent.length, RESET_REQUESTS_PER_HOUR);
  assert.ok(db.prepare(`SELECT 1 FROM audit_log WHERE action = 'auth.password_reset_request' AND summary LIKE '%hourly limit%'`).get());
});

test('forgot: 10 requests per address per hour, then 429', async () => {
  clientIp = '203.0.113.3';
  for (let i = 0; i < 10; i++) assert.equal((await forgot('nobody@example.test')).status, 200);
  assert.equal((await forgot('nobody@example.test')).status, 429);
  clientIp = '203.0.113.4';
  assert.equal((await forgot('nobody@example.test')).status, 200, 'other addresses unaffected');
});

test('forgot is hidden and does nothing while email is off', async () => {
  clientIp = '203.0.113.5';
  delete process.env.SMTP_HOST;
  sent.length = 0;
  const session = await (await call('GET', '/api/auth/session')).json();
  assert.equal(session.passwordReset, false);
  const a = await forgot('fr@example.test');
  assert.equal(a.status, 200);
  assert.equal(sent.length, 0);
  process.env.SMTP_HOST = 'smtp.example.test';
});

test('temporary password: every console route answers 403 PASSWORD_CHANGE_REQUIRED until changed', async () => {
  clientIp = '203.0.113.7';
  const cookie = cookieOf(await signIn('temp@example.test'));
  for (const [m, p, b] of [
    ['GET', '/api/shipments'], ['GET', '/api/users'], ['POST', '/api/users', { displayName: 'X', email: 'x@example.test' }],
    ['GET', '/api/audit'], ['PUT', '/api/settings', {}], ['GET', '/api/stats'], ['GET', '/api/mail/status'],
    ['GET', '/api/payments/proofs'], ['GET', '/api/quotes']
  ] as [string, string, unknown?][]) {
    const res = await call(m, p, cookie, b);
    assert.equal(res.status, 403, `${m} ${p}`);
    assert.equal((await res.json()).code, 'PASSWORD_CHANGE_REQUIRED', `${m} ${p}`);
  }
  // Staff-only settings fields are not given out either.
  const settings = await (await call('GET', '/api/settings', cookie)).json();
  const anon = await (await call('GET', '/api/settings')).json();
  assert.deepEqual(Object.keys(settings.data ?? settings).sort(), Object.keys(anon.data ?? anon).sort());

  // The account routes stay open so the password can be changed.
  assert.equal((await call('GET', '/api/auth/session', cookie)).status, 200);
  assert.equal((await call('GET', '/api/auth/sessions', cookie)).status, 200);
  const changed = await call('POST', '/api/auth/change-password', cookie, { currentPassword: PASSWORD, newPassword: 'my own password 42' });
  usedNewPasswords.push('my own password 42');
  assert.equal(changed.status, 200);
  assert.equal((await call('GET', '/api/users', cookie)).status, 200, 'console opens after the change');
});

test('no reset tokens, passwords or SMTP password in the audit log or server log', async () => {
  const tokens = db.prepare('SELECT token_hash FROM password_resets').all() as any[];
  assert.ok(tokens.length > 0);
  const auditText = JSON.stringify(db.prepare('SELECT * FROM audit_log').all());
  const logText = logged.join('\n');
  const secrets = [PASSWORD, 'smtp-secret-value', ...usedNewPasswords, ...tokens.map((t) => t.token_hash)];
  for (const s of sent) {
    const m = s.text.match(/#reset=([A-Za-z0-9_-]+)/);
    if (m) secrets.push(m[1]);
  }
  for (const secret of secrets) {
    assert.equal(auditText.includes(secret), false, `audit log contains ${secret.slice(0, 6)}…`);
    assert.equal(logText.includes(secret), false, `server log contains ${secret.slice(0, 6)}…`);
  }
});
