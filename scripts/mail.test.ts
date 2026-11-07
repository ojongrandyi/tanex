// Email foundation (docs/NOTIFICATIONS_SPEC.md §3, §6): mailer off when SMTP_HOST is unset,
// templates EN/FR, outbox retry with backoff and give-up, reset bodies blanked, per-address cap,
// Settings → Email routes and their permissions, customer emails from the quote and contact
// forms, no secrets in logs. Sending is replaced by a test function; nothing leaves the machine.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-mail-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_REPLY_TO', 'APP_URL']) delete process.env[k];

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { mailEnabled, mailConfig, setSenderForTests, maskEmail } = await import('../server/mail/mailer.ts');
const outbox = await import('../server/mail/outbox.ts');
const { renderTemplate } = await import('../server/mail/templates/index.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
function addUser(id: string, email: string, roleIds: string[]): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, email, id, HASH, now, now);
  for (const r of roleIds) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
}
addUser('usr_sa', 'sa@example.test', [SUPER_ADMIN_ROLE_ID]);
addUser('usr_ops', 'ops@example.test', ['role_operations_manager']);
addUser('usr_fin', 'fin@example.test', ['role_finance']);

const app = express();
app.use(express.json());
app.use(createSessionMiddleware(new SqliteSessionStore(db, { purgeIntervalMs: false }), 'test-secret'));
app.use('/api', requireJsonOrMultipart);
registerApiRoutes(app);
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  setSenderForTests(null);
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
async function signIn(identifier: string): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier, password: PASSWORD });
  assert.equal(res.status, 200);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}

let sent: { to: string; subject: string; html: string; text: string }[] = [];
let failNext = 0;
setSenderForTests(async (msg) => {
  if (failNext > 0) {
    failNext--;
    throw Object.assign(new Error('Greeting never received'), { code: 'ETIMEDOUT' });
  }
  sent.push(msg);
});

function mailOn(): void {
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'info@example.test';
  process.env.SMTP_PASS = 'smtp-secret-value';
  process.env.MAIL_FROM = 'TanEx <info@example.test>';
}
function mailOff(): void {
  delete process.env.SMTP_HOST;
}

beforeEach(() => {
  sent = [];
  failNext = 0;
  db.exec('DELETE FROM email_outbox');
});

test('mailer is off when SMTP_HOST is unset: nothing queued, reset hidden', async () => {
  mailOff();
  assert.equal(mailEnabled(), false);
  assert.equal(mailConfig(), null);
  assert.equal(outbox.queueEmail({ to: 'a@example.test', template: 'mail.test', locale: 'en', vars: {} }), null);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM email_outbox').get() as any).c, 0);
  const session = await (await call('GET', '/api/auth/session')).json();
  assert.equal(session.passwordReset, false);

  mailOn();
  assert.equal(mailEnabled(), true);
  assert.equal(mailConfig()!.secure, true, 'port 465 defaults to SSL');
  assert.equal(JSON.stringify(mailConfig()).includes('smtp-secret-value'), false, 'config view has no password');
  assert.equal((await (await call('GET', '/api/auth/session')).json()).passwordReset, true);
});

test('templates: EN and FR from CONTENT §14, escaped HTML, plain-text twin, signature', () => {
  const en = renderTemplate('quote.received', 'en', { name: '<b>Ann</b>', ref: 'QR-2026-12345', url: 'https://tanexsarl.com/#/quote/QR-2026-12345' });
  assert.equal(en.subject, "We've received your quote request QR-2026-12345");
  assert.match(en.text, /Thank you, <b>Ann<\/b>\. Our team will review your request and send you a price\. View it any time: https:\/\/tanexsarl\.com\/#\/quote\/QR-2026-12345/);
  assert.match(en.text, /— TanEx/);
  assert.ok(en.html.includes('&lt;b&gt;Ann&lt;/b&gt;'), 'visitor text is escaped in HTML');
  assert.ok(!en.html.includes('<b>Ann</b>'));
  assert.ok(en.html.includes('lang="en"'));

  const fr = renderTemplate('auth.reset', 'fr', { url: 'https://x.test/private-user/#reset=abc' });
  assert.equal(fr.subject, 'Réinitialiser votre mot de passe TanEx');
  assert.match(fr.text, /Utilisez ce lien dans les 30 minutes : https:\/\/x\.test\/private-user\/#reset=abc/);
  assert.ok(fr.html.includes('lang="fr"'));

  const c = renderTemplate('contact.received', 'fr', { name: 'Ann', ref: 'TX-TKT-000001' });
  assert.equal(c.subject, 'Nous avons bien reçu votre message (TX-TKT-000001)');
  // No tracking pixels: the only image is the logo on the company's own domain.
  const imgs = en.html.match(/<img [^>]*src="([^"]+)"/g) || [];
  assert.equal(imgs.length, 1);
  assert.match(imgs[0], /src="https:\/\/tanexsarl\.com\/brand\/logo-white\.png/);
});

test('outbox: sends, retries after 1/5/15/60 min, gives up after 5 attempts', async () => {
  mailOn();
  const t0 = 1_000_000;
  const id = outbox.queueEmail({ to: 'Retry@Example.test', template: 'mail.test', locale: 'en', vars: {}, now: t0 })!;
  assert.ok(id);
  const row = () => db.prepare('SELECT * FROM email_outbox WHERE id = ?').get(id) as any;
  assert.equal(row().to_addr, 'retry@example.test');

  failNext = 99;
  let now = t0;
  const delays = [1, 5, 15, 60];
  for (let attempt = 1; attempt <= 4; attempt++) {
    await outbox.processOutbox(db, now);
    assert.equal(row().status, 'QUEUED');
    assert.equal(row().attempts, attempt);
    assert.equal(row().next_attempt_at_ts, now + delays[attempt - 1] * 60_000);
    assert.match(row().last_error, /ETIMEDOUT/);
    // Not due yet: nothing happens.
    await outbox.processOutbox(db, now + delays[attempt - 1] * 60_000 - 1);
    assert.equal(row().attempts, attempt);
    now += delays[attempt - 1] * 60_000;
  }
  await outbox.processOutbox(db, now);
  assert.equal(row().status, 'FAILED');
  assert.equal(row().attempts, 5);
  assert.equal(outbox.outboxSummary(db, now).failed, 1);

  // Retry from the console puts it back; this time it goes out.
  failNext = 0;
  assert.equal(outbox.retryFailed(id, db, now), true);
  await outbox.processOutbox(db, now);
  assert.equal(row().status, 'SENT');
  assert.equal(sent.length, 1);
  assert.equal(outbox.retryFailed(id, db, now), false, 'only FAILED rows can be retried');
});

test('outbox: a reset email body is blanked once sent or given up, and cannot be retried', async () => {
  mailOn();
  const ok = outbox.queueEmail({ to: 'u@example.test', template: 'auth.reset', locale: 'en', vars: { url: 'https://x.test/#reset=SECRET1' } })!;
  await outbox.processOutbox(db);
  const sentRow = db.prepare('SELECT * FROM email_outbox WHERE id = ?').get(ok) as any;
  assert.equal(sentRow.status, 'SENT');
  assert.equal(sentRow.html, '');
  assert.equal(sentRow.text, '');
  assert.ok(sent[0].text.includes('SECRET1'), 'the message itself had the link');

  const bad = outbox.queueEmail({ to: 'u@example.test', template: 'auth.reset', locale: 'en', vars: { url: 'https://x.test/#reset=SECRET2' } })!;
  db.prepare('UPDATE email_outbox SET attempts = 4 WHERE id = ?').run(bad);
  failNext = 1;
  await outbox.processOutbox(db);
  const failedRow = db.prepare('SELECT * FROM email_outbox WHERE id = ?').get(bad) as any;
  assert.equal(failedRow.status, 'FAILED');
  assert.equal(failedRow.html, '');
  assert.equal(outbox.retryFailed(bad), false);
});

test('outbox: rejects address lists and header tricks; caps customer emails per address', () => {
  mailOn();
  for (const to of ['a@x.test, b@x.test', 'a@x.test\r\nBcc: c@x.test', 'Name <a@x.test>', 'no-at-sign', '']) {
    assert.equal(outbox.queueEmail({ to, template: 'contact.received', locale: 'en', vars: { name: 'A', ref: 'R' } }), null, to);
  }
  for (let i = 0; i < outbox.CUSTOMER_EMAILS_PER_HOUR; i++) {
    assert.ok(outbox.queueEmail({ to: 'victim@example.test', template: 'contact.received', locale: 'en', vars: { name: 'A', ref: 'R' } }));
  }
  assert.equal(outbox.queueEmail({ to: 'victim@example.test', template: 'quote.received', locale: 'en', vars: { name: 'A', ref: 'R', url: 'u' } }), null);
  // Staff templates are not capped by the customer limit.
  assert.ok(outbox.queueEmail({ to: 'victim@example.test', template: 'mail.test', locale: 'en', vars: {} }));
  assert.equal(maskEmail('victim@example.test'), 'v***@example.test');
});

test('quote and contact forms queue the customer email; the server assigns the quote id', async () => {
  mailOn();
  process.env.APP_URL = 'https://staging.example.test/';
  const quote = await call('POST', '/api/quotes', undefined, {
    id: 'QR-2026-<script>', customerName: 'Ann\r\nBcc: x@evil.test', customerEmail: 'ann@example.test', locale: 'fr',
    origin: { city: 'Buea' }, destination: { city: 'Douala' }, cargoDescription: 'Box', weightLbs: 2
  });
  assert.equal(quote.status, 201);
  const q = (await quote.json()).data;
  assert.match(q.id, /^QR-\d{4}-\d{5}$/, 'a browser-sent id is ignored');
  const qMail = db.prepare(`SELECT * FROM email_outbox WHERE template_key = 'quote.received'`).get() as any;
  assert.equal(qMail.to_addr, 'ann@example.test');
  assert.equal(qMail.locale, 'fr');
  assert.equal(qMail.related_id, q.id);
  assert.ok(qMail.subject.endsWith(q.id));
  assert.ok(qMail.text.includes(`https://staging.example.test/#/quote/${q.id}`));
  assert.ok(qMail.text.includes('Merci, Ann Bcc: x@evil.test.'), 'line breaks in a name are flattened');

  // No email typed (the server's placeholder address) → nothing queued.
  db.exec('DELETE FROM email_outbox');
  assert.equal((await call('POST', '/api/quotes', undefined, { customerName: 'Bob' })).status, 201);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM email_outbox').get() as any).c, 0);

  const msg = await call('POST', '/api/messages', undefined, { name: 'Cleo', email: 'cleo@example.test', message: 'Hello' });
  assert.equal(msg.status, 201);
  const m = (await msg.json()).data;
  const cMail = db.prepare(`SELECT * FROM email_outbox WHERE template_key = 'contact.received'`).get() as any;
  assert.equal(cMail.to_addr, 'cleo@example.test');
  assert.equal(cMail.locale, 'en');
  assert.equal(cMail.subject, `We've received your message (${m.id})`);

  // Callback request with a phone only: no email.
  db.exec('DELETE FROM email_outbox');
  assert.equal((await call('POST', '/api/messages', undefined, { name: 'Dan', phone: '+237 651 000 000', message: 'Call me' })).status, 201);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM email_outbox').get() as any).c, 0);

  // Mail off: forms still work, nothing queued.
  mailOff();
  assert.equal((await call('POST', '/api/messages', undefined, { name: 'Eve', email: 'eve@example.test', message: 'Hi' })).status, 201);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM email_outbox').get() as any).c, 0);
  delete process.env.APP_URL;
});

test('Settings → Email routes: permissions, status without secrets, test email, retry', async () => {
  mailOn();
  const sa = await signIn('sa@example.test');
  const ops = await signIn('ops@example.test');
  const fin = await signIn('fin@example.test');

  // Signed out 401; Finance (no settings keys) 403; Operations Manager has no settings keys either.
  for (const [m, p, b] of [['GET', '/api/mail/status'], ['POST', '/api/mail/test', {}], ['POST', '/api/mail/outbox/x/retry', {}]] as [string, string, unknown?][]) {
    assert.equal((await call(m, p, undefined, b)).status, 401, `${m} ${p} signed out`);
    assert.equal((await call(m, p, fin, b)).status, 403, `${m} ${p} finance`);
    assert.equal((await call(m, p, ops, b)).status, 403, `${m} ${p} operations`);
  }

  const test1 = await call('POST', '/api/mail/test', sa, {});
  assert.equal(test1.status, 200);
  const r1 = (await test1.json()).data;
  assert.equal(r1.sent, true);
  assert.equal(sent.at(-1)!.to, 'sa@example.test');
  assert.equal(sent.at(-1)!.subject, 'TanEx test email');
  const auditRow = db.prepare(`SELECT * FROM audit_log WHERE action = 'mail.test' ORDER BY at_ts DESC LIMIT 1`).get() as any;
  assert.equal(auditRow.actor_user_id, 'usr_sa');

  failNext = 1;
  const test2 = await (await call('POST', '/api/mail/test', sa, { to: 'other@example.test' })).json();
  assert.equal(test2.data.sent, false);
  assert.match(test2.data.error, /ETIMEDOUT/);
  assert.equal((await call('POST', '/api/mail/test', sa, { to: 'not an address' })).status, 400);

  const status = await call('GET', '/api/mail/status', sa);
  const body = await status.text();
  assert.equal(status.status, 200);
  assert.ok(!body.includes('smtp-secret-value'), 'no SMTP password');
  assert.ok(!body.includes('"html"') && !body.includes('"text"'), 'no message bodies');
  const data = JSON.parse(body).data;
  assert.equal(data.enabled, true);
  assert.equal(data.host, 'smtp.example.test');
  assert.equal(data.summary.queued, 1, 'the failed test is waiting for a retry');

  db.prepare(`UPDATE email_outbox SET status = 'FAILED' WHERE to_addr = 'other@example.test'`).run();
  const failedId = (db.prepare(`SELECT id FROM email_outbox WHERE to_addr = 'other@example.test'`).get() as any).id;
  assert.equal((await (await call('GET', '/api/mail/status', sa)).json()).data.failed.length, 1);
  assert.equal((await call('POST', `/api/mail/outbox/${failedId}/retry`, sa, {})).status, 200);
  assert.equal((await call('POST', `/api/mail/outbox/${failedId}/retry`, sa, {})).status, 409);
  assert.ok(db.prepare(`SELECT 1 FROM audit_log WHERE action = 'mail.retry' AND entity_id = ?`).get(failedId));

  mailOff();
  assert.equal((await call('POST', '/api/mail/test', sa, {})).status, 409);
  assert.equal((await (await call('GET', '/api/mail/status', sa)).json()).data.enabled, false);
});
