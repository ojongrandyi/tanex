// Follow-up to the phase B security review: masking of contact details on public look-ups
// (including Cameroonian phone numbers), generic 500 answers, the session secret without
// SESSION_SECRET, the secure cookie over HTTPS without NODE_ENV, what a visitor may add through
// POST /api/documents/generate, and staff alert emails.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-hardening-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
delete process.env.APP_URL;
process.env.SMTP_HOST = 'smtp.example.test';
process.env.MAIL_FROM = 'TanEx <info@example.test>';
process.env.MAIL_STAFF_ALERTS_TO = 'alerts@example.test';

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { maskEmail, maskName, maskPhone } = await import('../src/shared/masking.ts');
const { serverError, SERVER_ERROR_MESSAGE } = await import('../server/errors.ts');
const { resolveSessionSecret, SESSION_SECRET_FILE } = await import('../server/auth/sessionSecret.ts');
const { setSenderForTests } = await import('../server/mail/mailer.ts');
const outbox = await import('../server/mail/outbox.ts');

initDatabase();
setSenderForTests(async () => {});

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now = Date.now();
for (const [id, role] of [['usr_ops', 'role_operations_manager'], ['usr_fin', 'role_finance']]) {
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, `${id}@example.test`, id, HASH, now, now);
  db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, role);
}

const app = express();
app.set('trust proxy', 1);
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

let ipSeq = 0;
async function call(method: string, p: string, cookie?: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const h: Record<string, string> = { 'X-Forwarded-For': `203.0.113.${(ipSeq++ % 250) + 1}`, ...headers };
  if (cookie) h.Cookie = cookie;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function signIn(email: string): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier: email, password: PASSWORD });
  assert.equal(res.status, 200);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}

test('masking: names, emails, and phone numbers in any format (incl. Cameroon)', () => {
  assert.equal(maskName('Ada Obi'), 'A** O**');
  assert.equal(maskName(''), 'Customer');
  assert.equal(maskEmail('daniel@example.com'), 'da****@example.com');
  assert.equal(maskEmail('nope'), undefined);
  assert.equal(maskPhone('+237 651 05 93 45'), '+••• ••• •• •3 45');
  assert.equal(maskPhone('651059345'), '••••••345');
  assert.equal(maskPhone('(310) 555-0892'), '(•••) •••-•892');
  assert.equal(maskPhone(''), undefined);
});

test('public quote look-up masks contact details; staff with quotes.view see them', async () => {
  const created = await call('POST', '/api/quotes', undefined, {
    customerName: 'Ada Obi', customerEmail: 'ada.obi@example.test', customerPhone: '+237 651 05 93 45'
  });
  const id = (await created.json()).data.id;
  const pub = (await (await call('GET', `/api/quotes/${id}`)).json()).data;
  assert.equal(pub.customerName, 'A** O**');
  assert.equal(pub.requesterEmail, 'ad*****@example.test');
  assert.equal(pub.customerPhone, '+••• ••• •• •3 45');
  const body = JSON.stringify(pub);
  assert.ok(!body.includes('ada.obi') && !body.includes('93 45'.replace(' ', '')) && !body.includes('Ada Obi'));

  const fin = await signIn('usr_fin@example.test'); // Finance holds quotes.view
  const staff = (await (await call('GET', `/api/quotes/${id}`, fin)).json()).data;
  assert.equal(staff.customerEmail, 'ada.obi@example.test');
  assert.equal(staff.customerPhone, '+237 651 05 93 45');
});

test('unexpected errors: generic answer with a reference; details only in the log', () => {
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  let status = 0;
  let sent: any = null;
  const res: any = {
    req: { method: 'GET', originalUrl: '/api/x?secret=1' },
    headersSent: false,
    status(s: number) { status = s; return this; },
    json(b: unknown) { sent = b; return this; }
  };
  try {
    serverError(res, new Error('SQLITE_ERROR: no such column: password_hash in /home/user/app/x.ts'));
  } finally {
    console.error = original;
  }
  assert.equal(status, 500);
  assert.equal(sent.code, 'SERVER_ERROR');
  assert.match(sent.ref, /^[0-9A-F]{8}$/);
  assert.equal(sent.error, `${SERVER_ERROR_MESSAGE} (ref ${sent.ref})`);
  assert.ok(!JSON.stringify(sent).includes('SQLITE'));
  assert.ok(logged[0].includes(sent.ref) && logged[0].includes('SQLITE_ERROR') && !logged[0].includes('secret=1'));
});

test('no route answers a 500 with err.message any more', () => {
  const dirs = ['server', 'server/routes'];
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      assert.ok(!/status\(500\)[^;]*err\.message/.test(src), `${dir}/${f}`);
    }
  }
});

test('session secret: env wins; otherwise one random secret is generated, stored and reused', () => {
  const dir = path.join(tmpDir, 'secret');
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(resolveSessionSecret(dir, { SESSION_SECRET: 'x'.repeat(64) }), 'x'.repeat(64));
    assert.equal(fs.existsSync(path.join(dir, SESSION_SECRET_FILE)), false);
    const first = resolveSessionSecret(dir, {});
    assert.match(first, /^[0-9a-f]{96}$/);
    assert.notEqual(first, 'dev-only-insecure-fallback-secret');
    assert.equal(resolveSessionSecret(dir, {}), first, 'reused after a restart');
  } finally {
    console.warn = warn;
  }
});

test('session cookie is Secure on HTTPS requests even without NODE_ENV, not on plain http', async () => {
  const https = await call('POST', '/api/auth/login', undefined, { identifier: 'usr_ops@example.test', password: PASSWORD }, { 'X-Forwarded-Proto': 'https' });
  assert.match(https.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!, /;\s*Secure/i);
  const http = await call('POST', '/api/auth/login', undefined, { identifier: 'usr_ops@example.test', password: PASSWORD });
  assert.doesNotMatch(http.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!, /;\s*Secure/i);
});

test('document generate: a visitor may only add one bill of lading to a shipment they just booked', async () => {
  const booked = await call('POST', '/api/shipments', undefined, { status: 'AWAITING_PICKUP', origin: { city: 'Buea' }, destination: { city: 'Douala' } });
  const tracking = (await booked.json()).data.trackingNumber;

  const ok = await call('POST', '/api/documents/generate', undefined, { docType: 'BOL', id: 'BOL-2026-00001', shipmentTracking: tracking.toLowerCase() });
  assert.equal(ok.status, 201);
  const doc = (await ok.json()).data;
  assert.notEqual(doc.id, 'BOL-2026-00001', 'a visitor cannot choose the id');
  assert.match(doc.id, /^BOL-\d{4}-\d{5}$/);
  assert.equal((await call('POST', '/api/documents/generate', undefined, { docType: 'BOL', shipmentTracking: tracking })).status, 409, 'only one');
  assert.equal((await call('POST', '/api/documents/generate', undefined, { docType: 'INVOICE', shipmentTracking: tracking })).status, 403);
  assert.equal((await call('POST', '/api/documents/generate', undefined, { docType: 'BOL', shipmentTracking: 'TX0000AA' })).status, 403);
  assert.equal((await call('POST', '/api/documents/generate', undefined, { docType: 'BOL' })).status, 403);

  // A booking older than 30 minutes, or one made by staff, can't get a visitor's document.
  const old = (await (await call('POST', '/api/shipments', undefined, { origin: { city: 'Buea' }, destination: { city: 'Limbe' } })).json()).data.trackingNumber;
  db.prepare('UPDATE shipments SET created_at_ts = ? WHERE tracking_number = ?').run(Date.now() - 31 * 60 * 1000, old);
  assert.equal((await call('POST', '/api/documents/generate', undefined, { docType: 'BOL', shipmentTracking: old })).status, 403);

  const ops = await signIn('usr_ops@example.test');
  const staffShip = (await (await call('POST', '/api/shipments', ops, { origin: { city: 'Buea' }, destination: { city: 'Kumba' } })).json()).data.trackingNumber;
  assert.equal((await call('POST', '/api/documents/generate', undefined, { docType: 'BOL', shipmentTracking: staffShip })).status, 403);

  // Staff keep the console's id and any document type.
  const mine = await call('POST', '/api/documents/generate', ops, { docType: 'INVOICE', id: 'INV-2026-12345', shipmentTracking: staffShip });
  assert.equal(mine.status, 201);
  assert.equal((await mine.json()).data.id, 'INV-2026-12345');
  const badId = await call('POST', '/api/documents/generate', ops, { docType: 'BOL', id: '<x>', shipmentTracking: staffShip });
  assert.match((await badId.json()).data.id, /^BOL-\d{4}-\d{5}$/);
});

test('staff alerts: contact message and proof alert go to MAIL_STAFF_ALERTS_TO, capped per hour', async () => {
  db.exec('DELETE FROM email_outbox');
  const res = await call('POST', '/api/messages', undefined, { name: 'Ann\nX', email: 'ann@example.test', subject: 'Rates', message: 'Click http://evil.example' });
  const ref = (await res.json()).data.id;
  const alert = db.prepare(`SELECT * FROM email_outbox WHERE template_key = 'contact.staff_alert'`).get() as any;
  assert.equal(alert.to_addr, 'alerts@example.test');
  assert.equal(alert.subject, `New message from Ann X (${ref})`);
  assert.ok(alert.text.includes('/private-user/'));
  assert.ok(!alert.text.includes('evil.example'), "the visitor's message is not copied into the alert");

  assert.ok(outbox.queueStaffAlert('payment.proof_received', { id: 'TX7K2M9P', url: 'https://x.test/private-user/' }));
  for (let i = 0; i < outbox.STAFF_ALERTS_PER_HOUR; i++) outbox.queueStaffAlert('payment.proof_received', { id: 'TX7K2M9P', url: 'u' });
  const count = (db.prepare(`SELECT COUNT(*) AS c FROM email_outbox WHERE template_key = 'payment.proof_received'`).get() as any).c;
  assert.equal(count, outbox.STAFF_ALERTS_PER_HOUR);

  delete process.env.MAIL_STAFF_ALERTS_TO;
  assert.equal(outbox.queueStaffAlert('contact.staff_alert', { name: 'A', ref: 'R', subject: 'S', url: 'u' }), null);
  process.env.MAIL_STAFF_ALERTS_TO = 'alerts@example.test';
});
