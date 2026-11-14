// Courier app (docs/DISPATCH_SPEC.md §6, §9; tracker G.4): the courier's own profile, on/off duty,
// withdrawing photo consent (never granting it), cash balance by currency and handovers queued
// offline with idempotency keys; plus the app's pure job rules (status after waiting steps, money
// to collect at pickup and delivery, links). Runs against the real /api mounts on a temp database.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-courier-app-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { viewStatus, pickupCollect, deliveryCollect, mapsLink, telLink, whatsAppLink, courierActions } = await import('../src/courier/jobLogic.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now0 = Date.now();

function addUser(id: string, email: string, roleIds: string[], name = id): void {
  db.prepare(`
    INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, NULL, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, email, name, HASH, now0, now0);
  for (const r of roleIds) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
}

addUser('usr_disp', 'disp@example.test', ['role_dispatch_manager'], 'Dispatcher Dee');
addUser('usr_c1', 'c1@example.test', ['role_courier'], 'Ama Rider');
addUser('usr_c2', 'c2@example.test', ['role_courier'], 'Bello Rider');
addUser('usr_c0', 'c0@example.test', ['role_courier'], 'No Profile');
db.prepare(`INSERT INTO delivery_cities (id, name, lat, lng) VALUES ('city_b', 'Buea', 4.15, 9.24)`).run();
db.prepare(`
  INSERT INTO couriers (user_id, vehicle_type, plate_number, home_city_id, public_first_name, show_photo_publicly, photo_file, is_on_duty, created_at_ts, updated_at_ts)
  VALUES ('usr_c1', 'BIKE', 'SW 123 AB', 'city_b', 'Ama', 1, 'abc.webp', 0, ?, ?), ('usr_c2', 'VAN', NULL, NULL, 'Bello', 0, NULL, 0, ?, ?)
`).run(now0, now0, now0, now0);

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
async function signIn(identifier: string): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier, password: PASSWORD });
  assert.equal(res.status, 200, `sign-in as ${identifier}`);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}
const disp = await signIn('disp@example.test');
const c1 = await signIn('c1@example.test');
const c2 = await signIn('c2@example.test');
const c0 = await signIn('c0@example.test');
const auditCount = (action: string) => (db.prepare('SELECT COUNT(*) AS c FROM audit_log WHERE action = ?').get(action) as { c: number }).c;

test('profile routes: courier.app only; own profile; 404 without a courier profile', async () => {
  for (const [m, p] of [['GET', '/api/courier/me'], ['PATCH', '/api/courier/me'], ['GET', '/api/courier/cash'], ['POST', '/api/courier/cash/handover']] as const) {
    assert.equal((await call(m, p, undefined, m === 'GET' ? undefined : {})).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await call(m, p, disp, m === 'GET' ? undefined : {})).status, 403, `staff ${m} ${p}`);
  }
  const res = await call('GET', '/api/courier/me', c1);
  assert.equal(res.status, 200);
  const me = (await res.json()).data;
  assert.equal(me.publicFirstName, 'Ama');
  assert.equal(me.vehicleType, 'BIKE');
  assert.equal(me.homeCityName, 'Buea');
  assert.equal(me.isOnDuty, false);
  assert.match(me.photoUrl, /^\/api\/courier\/me\/photo\?v=abc$/);
  const none = await call('GET', '/api/courier/me', c0);
  assert.equal(none.status, 404);
  assert.equal((await none.json()).code, 'NO_COURIER_PROFILE');
});

test('duty: the courier switches on and off; each change audited, repeats are no-ops', async () => {
  const before = auditCount('courier.duty');
  let res = await call('PATCH', '/api/courier/me', c1, { isOnDuty: true });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.isOnDuty, true);
  assert.equal((db.prepare('SELECT is_on_duty FROM couriers WHERE user_id = ?').get('usr_c1') as any).is_on_duty, 1);
  await call('PATCH', '/api/courier/me', c1, { isOnDuty: true });
  assert.equal(auditCount('courier.duty'), before + 1);
  res = await call('PATCH', '/api/courier/me', c1, { isOnDuty: 'yes' });
  assert.equal(res.status, 400);
  res = await call('PATCH', '/api/courier/me', c1, { isOnDuty: false });
  assert.equal((await res.json()).data.isOnDuty, false);
  assert.equal(auditCount('courier.duty'), before + 2);
  // The other courier is untouched.
  assert.equal((db.prepare('SELECT is_on_duty FROM couriers WHERE user_id = ?').get('usr_c2') as any).is_on_duty, 0);
});

test('photo consent: the courier can withdraw it but never grant it', async () => {
  let res = await call('PATCH', '/api/courier/me', c2, { showPhotoPublicly: true });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'CONSENT_BY_STAFF');
  res = await call('PATCH', '/api/courier/me', c1, { showPhotoPublicly: false });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.showPhotoPublicly, false);
  assert.equal((db.prepare('SELECT show_photo_publicly FROM couriers WHERE user_id = ?').get('usr_c1') as any).show_photo_publicly, 0);
  assert.equal(auditCount('courier.consent_withdrawn'), 1);
});

test('cash: balance by currency = collected (not rejected) + confirmed adjustments − confirmed handovers', async () => {
  const ins = db.prepare(`
    INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, status, recorded_by, created_at_ts)
    VALUES (?, ?, ?, NULL, ?, 'CASH', ?, ?, ?, ?, ?)
  `);
  ins.run('l1', 'TX-CSH-900001', 'usr_c2', 'COLLECTED', 5000, 'XAF', 'PENDING', 'usr_c2', now0);
  ins.run('l2', 'TX-CSH-900002', 'usr_c2', 'COLLECTED', 3000, 'XAF', 'CONFIRMED', 'usr_c2', now0);
  ins.run('l3', 'TX-CSH-900003', 'usr_c2', 'COLLECTED', 9999, 'XAF', 'REJECTED', 'usr_c2', now0);
  ins.run('l4', 'TX-CSH-900004', 'usr_c2', 'HANDOVER', 2000, 'XAF', 'CONFIRMED', 'usr_c2', now0);
  ins.run('l5', 'TX-CSH-900005', 'usr_c2', 'HANDOVER', 1000, 'XAF', 'PENDING', 'usr_c2', now0);
  ins.run('l6', 'TX-CSH-900006', 'usr_c2', 'ADJUSTMENT', -500, 'XAF', 'CONFIRMED', 'usr_disp', now0);
  ins.run('l7', 'TX-CSH-900007', 'usr_c2', 'COLLECTED', 20, 'EUR', 'PENDING', 'usr_c2', now0);
  ins.run('l8', 'TX-CSH-900008', 'usr_c1', 'COLLECTED', 7000, 'XAF', 'PENDING', 'usr_c1', now0);
  const res = await call('GET', '/api/courier/cash', c2);
  assert.equal(res.status, 200);
  const { balances, entries } = (await res.json()).data;
  const xaf = balances.find((b: any) => b.currency === 'XAF');
  assert.deepEqual(xaf, { currency: 'XAF', collected: 8000, handedOver: 2000, pendingHandover: 1000, balance: 5500 });
  assert.equal(balances.find((b: any) => b.currency === 'EUR').balance, 20);
  // Only the courier's own entries.
  assert.equal(entries.length, 7);
  assert.ok(entries.every((e: any) => e.id !== 'l8'));
});

test('handover: pending entry, audited, idempotent by key, validated', async () => {
  const key = 'handover-key-0001';
  const before = auditCount('cash.handover');
  const first = await call('POST', '/api/courier/cash/handover', c2, { amount: 4000, note: 'At the Buea office', idempotencyKey: key, deviceTs: Date.now() - 60_000 });
  assert.equal(first.status, 200);
  const a = (await first.json()).data;
  assert.equal(a.type, 'HANDOVER');
  assert.equal(a.status, 'PENDING');
  assert.equal(a.amount, 4000);
  assert.match(a.ref, /^TX-CSH-\d{6}$/);
  // A retry from the phone's queue returns the same entry and writes nothing new.
  const again = await call('POST', '/api/courier/cash/handover', c2, { amount: 4000, idempotencyKey: key });
  const b = await again.json();
  assert.equal(b.replayed, true);
  assert.equal(b.data.id, a.id);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM cash_ledger WHERE entry_type = 'HANDOVER' AND courier_user_id = 'usr_c2' AND amount = 4000").get() as any).c, 1);
  assert.equal(auditCount('cash.handover'), before + 1);
  // The pending handover shows in the summary but doesn't lower the balance until confirmed.
  const xaf = (await (await call('GET', '/api/courier/cash', c2)).json()).data.balances.find((x: any) => x.currency === 'XAF');
  assert.equal(xaf.pendingHandover, 5000);
  assert.equal(xaf.balance, 5500);
  // Validation.
  assert.equal((await call('POST', '/api/courier/cash/handover', c2, { amount: 100 })).status, 400);
  assert.equal((await call('POST', '/api/courier/cash/handover', c2, { amount: 0, idempotencyKey: 'handover-key-0002' })).status, 400);
  assert.equal((await call('POST', '/api/courier/cash/handover', c2, { amount: '50', idempotencyKey: 'handover-key-0003' })).status, 400);
  // A handover key can't be replayed as a job action, nor the other way round.
  const reuse = await call('POST', '/api/courier/jobs/job_x/action', c2, { action: 'accept', idempotencyKey: key });
  assert.equal(reuse.status, 409);
  assert.equal((await reuse.json()).code, 'IDEMPOTENCY_KEY_REUSED');
});

// ---- Pure app rules (src/courier/jobLogic.ts) ----

const baseJob = {
  id: 'job_1', status: 'ASSIGNED', payer: 'SENDER', price: 1500, currency: 'XAF', codAmount: null, collectDeliveryFee: false,
  pickup: { lat: 4.15, lng: 9.24, landmark: 'Opposite the stadium', zoneName: 'Molyko', cityName: 'Buea', contactPhone: '651059345' },
} as any;
const item = (action: string, jobId = 'job_1') => ({ key: action, userId: 'u', kind: 'action', jobId, createdAt: 1, body: { action } }) as any;

test('viewStatus: applies the steps waiting on the phone in order; ignores other jobs and impossible steps', () => {
  assert.equal(viewStatus(baseJob, []), 'ASSIGNED');
  assert.equal(viewStatus(baseJob, [item('accept'), item('pick_up')]), 'PICKED_UP');
  assert.equal(viewStatus(baseJob, [item('accept'), item('pick_up'), item('start_delivery'), item('deliver')]), 'DELIVERED');
  assert.equal(viewStatus(baseJob, [item('accept', 'job_2')]), 'ASSIGNED');
  assert.equal(viewStatus(baseJob, [item('deliver')]), 'ASSIGNED');
  assert.deepEqual(courierActions('ASSIGNED'), ['accept', 'decline']);
  assert.deepEqual(courierActions('ON_THE_WAY'), ['deliver', 'fail']);
  assert.deepEqual(courierActions('DELIVERED'), []);
});

test('money to collect: fee at pickup when the sender pays on the spot; COD plus fee at delivery when the recipient pays', () => {
  assert.equal(pickupCollect(baseJob), 0);
  assert.equal(pickupCollect({ ...baseJob, collectDeliveryFee: true }), 1500);
  assert.deepEqual(deliveryCollect({ ...baseJob, collectDeliveryFee: true }), { cod: 0, fee: 0, total: 0 });
  assert.deepEqual(deliveryCollect({ ...baseJob, payer: 'RECIPIENT', collectDeliveryFee: true, codAmount: 10000 }), { cod: 10000, fee: 1500, total: 11500 });
  assert.equal(pickupCollect({ ...baseJob, payer: 'RECIPIENT', collectDeliveryFee: true }), 0);
});

test('links: call, WhatsApp and Maps (pin, else landmark search)', () => {
  assert.equal(telLink('651059345'), 'tel:+237651059345');
  assert.equal(whatsAppLink('651059345'), 'https://wa.me/237651059345');
  assert.equal(whatsAppLink(null), null);
  assert.equal(mapsLink(baseJob.pickup), 'https://www.google.com/maps/search/?api=1&query=4.15,9.24');
  assert.equal(mapsLink({ ...baseJob.pickup, lat: null, lng: null }),
    'https://www.google.com/maps/search/?api=1&query=Opposite%20the%20stadium%2C%20Molyko%2C%20Buea%2C%20Cameroon');
});
