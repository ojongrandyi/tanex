// Dispatch board (docs/DISPATCH_SPEC.md §7; tracker G.5): the shared board rules (columns, problems,
// "today" in Africa/Douala, courier suggestions) and the board's API additions: GET /summary (sidebar
// badge), GET /jobs/:id/history (drawer timeline, cash, notifications), POST /quote (create form),
// and the cities/zones on GET /board. Runs against the real /api mounts on a file database in a temp
// folder. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import {
  LOCATION_STALE_MS, boardColumn, distanceKm, jobProblems, needsAttention, placePoint, startOfDay, suggestCouriers,
  type BoardJob, type SuggestCourier,
} from '../src/shared/dispatchBoard.ts';

// ---- Shared rules ----

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0); // 13:00 in Douala (UTC+1)
const job = (over: Partial<BoardJob> = {}): BoardJob => ({
  status: 'CONFIRMED', courierUserId: null, scheduledForTs: null, etaTs: null, pickedUpAt: null, onTheWayAt: null,
  deliveredAt: null, cancelledAt: null, updatedAt: NOW - 60_000, hasDeliveryCode: false, deliveryCodeTriesLeft: null, ...over,
});

test('startOfDay: midnight in Africa/Douala (UTC+1)', () => {
  assert.equal(startOfDay(NOW), Date.UTC(2026, 10, 13, 23, 0, 0));
  // 23:30 UTC is already the next day in Douala.
  assert.equal(startOfDay(Date.UTC(2026, 10, 14, 23, 30)), Date.UTC(2026, 10, 14, 23, 0, 0));
});

test('boardColumn: each status in its column; problems take precedence; done only today', () => {
  assert.equal(boardColumn(job({ status: 'REQUESTED' }), null, NOW), 'REQUESTED');
  assert.equal(boardColumn(job({ status: 'CONFIRMED' }), null, NOW), 'TO_ASSIGN');
  assert.equal(boardColumn(job({ status: 'ASSIGNED', courierUserId: 'c' }), null, NOW), 'ASSIGNED');
  assert.equal(boardColumn(job({ status: 'ACCEPTED', courierUserId: 'c' }), null, NOW), 'ASSIGNED');
  assert.equal(boardColumn(job({ status: 'PICKED_UP', courierUserId: 'c', pickedUpAt: NOW - 30_000 }), null, NOW), 'IN_PROGRESS');
  assert.equal(boardColumn(job({ status: 'ON_THE_WAY', courierUserId: 'c', pickedUpAt: NOW - 600_000, onTheWayAt: NOW - 500_000 }), NOW - 10_000, NOW), 'IN_PROGRESS');
  assert.equal(boardColumn(job({ status: 'FAILED_ATTEMPT' }), null, NOW), 'PROBLEMS');
  assert.equal(boardColumn(job({ status: 'DELIVERED', deliveredAt: NOW - 3_600_000 }), null, NOW), 'DONE_TODAY');
  // Delivered yesterday (Douala time): not on the board.
  assert.equal(boardColumn(job({ status: 'DELIVERED', deliveredAt: Date.UTC(2026, 10, 13, 22, 30) }), null, NOW), null);
  assert.equal(boardColumn(job({ status: 'CANCELLED', cancelledAt: NOW - 1000 }), null, NOW), 'DONE_TODAY');
  assert.equal(needsAttention('REQUESTED'), true);
  assert.equal(needsAttention('TO_ASSIGN'), true);
  assert.equal(needsAttention('PROBLEMS'), true);
  assert.equal(needsAttention('IN_PROGRESS'), false);
  assert.equal(needsAttention(null), false);
});

test('jobProblems: failed, late pickup or ETA, stale position, locked code', () => {
  assert.deepEqual(jobProblems(job({ status: 'FAILED_ATTEMPT' }), null, NOW), ['FAILED']);
  assert.deepEqual(jobProblems(job({ scheduledForTs: NOW - 1 }), null, NOW), ['LATE']);
  assert.deepEqual(jobProblems(job({ scheduledForTs: NOW + 60_000 }), null, NOW), []);
  // The preferred pickup time no longer matters once the parcel is picked up.
  assert.deepEqual(jobProblems(job({ status: 'PICKED_UP', scheduledForTs: NOW - 1, pickedUpAt: NOW - 1000 }), NOW - 1000, NOW), []);
  assert.deepEqual(jobProblems(job({ status: 'ON_THE_WAY', etaTs: NOW - 1, onTheWayAt: NOW - 1000 }), NOW - 1000, NOW), ['LATE']);
  // Stale: no ping for over 2 minutes while carrying, counted from pickup when none came yet.
  const carrying = job({ status: 'ON_THE_WAY', pickedUpAt: NOW - 600_000, onTheWayAt: NOW - 500_000 });
  assert.deepEqual(jobProblems(carrying, NOW - LOCATION_STALE_MS - 1, NOW), ['STALE_LOCATION']);
  assert.deepEqual(jobProblems(carrying, NOW - LOCATION_STALE_MS + 1000, NOW), []);
  assert.deepEqual(jobProblems(job({ status: 'PICKED_UP', pickedUpAt: NOW - 60_000 }), null, NOW), []);
  assert.deepEqual(jobProblems(job({ status: 'PICKED_UP', pickedUpAt: NOW - 180_000 }), null, NOW), ['STALE_LOCATION']);
  // An assigned job isn't stale: positions are only shared while carrying.
  assert.deepEqual(jobProblems(job({ status: 'ASSIGNED', courierUserId: 'c' }), null, NOW), []);
  assert.deepEqual(jobProblems(job({ status: 'ON_THE_WAY', onTheWayAt: NOW - 1000, hasDeliveryCode: true, deliveryCodeTriesLeft: 0 }), NOW, NOW), ['CODE_LOCKED']);
  assert.deepEqual(jobProblems(job({ status: 'DELIVERED', scheduledForTs: NOW - 1 }), null, NOW), []);
});

test('suggestCouriers: on duty, same city, right vehicle; nearest then least loaded; others with reasons', () => {
  const pickup = { lat: 4.155, lng: 9.24 };
  const c = (userId: string, over: Partial<SuggestCourier> = {}): SuggestCourier => ({
    userId, displayName: userId, vehicleType: 'BIKE', homeCityId: 'buea', isOnDuty: true, accountStatus: 'ACTIVE', activeJobs: 0,
    lastPosition: null, ...over,
  });
  const near = c('near', { lastPosition: { lat: 4.156, lng: 9.241, recordedAt: NOW - 30_000 }, activeJobs: 2 });
  const far = c('far', { lastPosition: { lat: 4.2, lng: 9.3, recordedAt: NOW - 30_000 } });
  const busyNoPos = c('busy', { activeJobs: 3 });
  const idleNoPos = c('idle', { activeJobs: 0 });
  const off = c('off', { isOnDuty: false, lastPosition: { lat: 4.155, lng: 9.24, recordedAt: NOW } });
  const van = c('van', { vehicleType: 'VAN' });
  const douala = c('douala', { homeCityId: 'douala' });
  const disabled = c('disabled', { accountStatus: 'DISABLED' });
  const current = c('current');
  const list = suggestCouriers({ pickupCityId: 'buea', pickup, vehicleRequired: 'BIKE', courierUserId: 'current' },
    [far, busyNoPos, off, van, douala, disabled, current, idleNoPos, near], NOW);
  assert.deepEqual(list.filter((s) => s.recommended).map((s) => s.courier.userId), ['near', 'far', 'idle', 'busy']);
  assert.deepEqual(list.filter((s) => !s.recommended).map((s) => s.courier.userId), ['off', 'douala', 'van']);
  assert.deepEqual(list.find((s) => s.courier.userId === 'van')!.misses, ['OTHER_VEHICLE']);
  assert.ok(!list.some((s) => s.courier.userId === 'disabled' || s.courier.userId === 'current'));
  assert.equal(list[0].distanceKm, 0.2);
  assert.equal(list[0].positionAgeMs, 30_000);
  assert.equal(list.find((s) => s.courier.userId === 'idle')!.distanceKm, null);
});

test('placePoint and distanceKm', () => {
  const zones = [{ id: 'z', lat: 4.1, lng: 9.2 }, { id: 'nopin', lat: null, lng: null }];
  const cities = [{ id: 'c', lat: 4.0, lng: 9.0 }];
  assert.deepEqual(placePoint({ lat: 4.5, lng: 9.5, zoneId: 'z', cityId: 'c' }, zones, cities), { lat: 4.5, lng: 9.5 });
  assert.deepEqual(placePoint({ lat: null, lng: null, zoneId: 'z', cityId: 'c' }, zones, cities), { lat: 4.1, lng: 9.2 });
  assert.deepEqual(placePoint({ lat: null, lng: null, zoneId: 'nopin', cityId: 'c' }, zones, cities), { lat: 4.0, lng: 9.0 });
  assert.equal(placePoint({ lat: null, lng: null, zoneId: null, cityId: 'x' }, zones, cities), null);
  // Buea to Douala is roughly 50 km as the crow flies.
  const d = distanceKm({ lat: 4.155, lng: 9.24 }, { lat: 4.05, lng: 9.7 });
  assert.ok(d > 45 && d < 55, String(d));
});

// ---- API ----

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-board-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');

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
addUser('usr_sup', 'sup@example.test', ['role_customer_support'], 'Support Sam');
addUser('usr_mkt', 'mkt@example.test', ['role_marketing'], 'Marketing Max');
addUser('usr_c1', 'c1@example.test', ['role_courier'], 'Ama Rider');
db.prepare(`INSERT INTO couriers (user_id, vehicle_type, home_city_id, public_first_name, is_on_duty, created_at_ts, updated_at_ts)
            VALUES ('usr_c1', 'BIKE', 'city_b', 'Ama', 1, ?, ?)`).run(now0, now0);

// Admin-entered tariffs (test data only, in a temp database).
db.prepare(`INSERT INTO delivery_cities (id, name, lat, lng) VALUES ('city_b', 'Buea', 4.15, 9.24), ('city_d', 'Douala', 4.05, 9.7)`).run();
db.prepare(`INSERT INTO delivery_zones (id, city_id, name, lat, lng) VALUES ('z_mol', 'city_b', 'Molyko', 4.155, 9.29), ('z_chk', 'city_b', 'Check Point', NULL, NULL)`).run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge)
            VALUES ('r1', 'city_b', NULL, NULL, 'SMALL', 1000, 'XAF', NULL)`).run();

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
const sup = await signIn('sup@example.test');
const mkt = await signIn('mkt@example.test');
const c1 = await signIn('c1@example.test');

const place = (zoneId: string | null, name: string, phone: string, cityId = 'city_b') =>
  ({ cityId, zoneId, landmark: 'Near the junction', contactName: name, contactPhone: phone });
async function createJob(extra: Record<string, unknown> = {}): Promise<any> {
  const res = await call('POST', '/api/dispatch/jobs', disp, {
    scope: 'LOCAL', sizeClass: 'SMALL', pickup: place('z_mol', 'Sender Sue', '+237 651 00 00 01'),
    dropoff: place('z_chk', 'Receiver Rita', '+237 651 00 00 02'), ...extra,
  });
  const out = await res.json() as any;
  assert.equal(res.status, 201, JSON.stringify(out));
  return out.data;
}

test('board API: permissions', async () => {
  for (const [m, p] of [['GET', '/api/dispatch/summary'], ['POST', '/api/dispatch/quote'], ['GET', '/api/dispatch/jobs/x/history']] as const) {
    assert.equal((await call(m, p, undefined, m === 'POST' ? {} : undefined)).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await call(m, p, mkt, m === 'POST' ? {} : undefined)).status, 403, `marketing ${m} ${p}`);
    assert.equal((await call(m, p, c1, m === 'POST' ? {} : undefined)).status, 403, `courier ${m} ${p}`);
  }
  // Viewing (Customer Support has dispatch.view) reads the badge; pricing a new job needs dispatch.manage.
  assert.equal((await call('GET', '/api/dispatch/summary', sup)).status, 200);
  assert.equal((await call('POST', '/api/dispatch/quote', sup, {})).status, 403);
});

test('board: cities and zones come with the jobs and couriers', async () => {
  const res = await call('GET', '/api/dispatch/board', sup);
  const { data } = await res.json() as any;
  assert.deepEqual(data.cities.map((c: any) => c.name), ['Buea', 'Douala']);
  assert.deepEqual(data.zones.find((z: any) => z.id === 'z_mol'), { id: 'z_mol', cityId: 'city_b', name: 'Molyko', lat: 4.155, lng: 9.29, isActive: true });
  assert.equal(data.couriers[0].homeCityId, 'city_b');
});

test('quote: rate-sheet price without contacts; no rate and no express surcharge are explained', async () => {
  const q = async (body: unknown) => (await (await call('POST', '/api/dispatch/quote', disp, body)).json() as any);
  const ok = await q({ pickup: { cityId: 'city_b', zoneId: 'z_mol' }, dropoff: { cityId: 'city_b', zoneId: 'z_chk' }, sizeClass: 'SMALL' });
  assert.deepEqual(ok.data, { ok: true, price: 1000, currency: 'XAF', match: 'ANY_ZONE' });
  const none = await q({ pickup: { cityId: 'city_b' }, dropoff: { cityId: 'city_b' }, sizeClass: 'LARGE' });
  assert.equal(none.data.ok, false);
  const express = await q({ pickup: { cityId: 'city_b' }, dropoff: { cityId: 'city_b' }, sizeClass: 'SMALL', isExpress: true });
  assert.deepEqual(express.data, { ok: false, reason: 'NO_EXPRESS_RATE' });
  const bad = await call('POST', '/api/dispatch/quote', disp, { pickup: { cityId: 'city_b' }, dropoff: {}, sizeClass: 'SMALL' });
  assert.equal(bad.status, 400);
  const badSize = await call('POST', '/api/dispatch/quote', disp, { pickup: { cityId: 'city_b' }, dropoff: { cityId: 'city_b' }, sizeClass: 'HUGE' });
  assert.equal((await badSize.json() as any).code, 'INVALID_SIZE');
});

test('summary counts requested, to assign and problems with the board rules', async () => {
  const count = async () => (await (await call('GET', '/api/dispatch/summary', disp)).json() as any).data;
  const before = await count();
  const a = await createJob();
  const b = await createJob({ scheduledForTs: Date.now() - 60_000 }); // late pickup → Problems
  let s = await count();
  assert.equal(s.toAssign, before.toAssign + 1);
  assert.equal(s.problems, before.problems + 1);
  assert.equal(s.attention, before.attention + 2);
  // Assigned jobs no longer need dispatch.
  assert.equal((await call('POST', `/api/dispatch/jobs/${a.id}/assign`, disp, { courierUserId: 'usr_c1' })).status, 200);
  s = await count();
  assert.equal(s.toAssign, before.toAssign);
  assert.equal(s.attention, before.attention + 1);
  // A requested job (public form, G.6) counts under Requested.
  db.prepare(`UPDATE dispatch_jobs SET status = 'REQUESTED', price = NULL, scheduled_for_ts = NULL WHERE id = ?`).run(b.id);
  s = await count();
  assert.equal(s.requested, before.requested + 1);
  assert.equal(s.problems, before.problems);
  // Carrying a parcel with no position for over 2 minutes is a problem.
  db.prepare(`UPDATE dispatch_jobs SET status = 'ON_THE_WAY', picked_up_at_ts = ?, on_the_way_at_ts = ? WHERE id = ?`)
    .run(Date.now() - 600_000, Date.now() - 300_000, a.id);
  s = await count();
  assert.equal(s.problems, before.problems + 1);
  db.prepare('INSERT INTO courier_locations (courier_user_id, job_id, lat, lng, recorded_at_ts) VALUES (?, ?, 4.15, 9.24, ?)').run('usr_c1', a.id, Date.now());
  s = await count();
  assert.equal(s.problems, before.problems);
});

test('history: audit timeline with reasons, cash rows, emails; no full audit record', async () => {
  const job = await createJob();
  assert.equal((await call('POST', `/api/dispatch/jobs/${job.id}/price`, disp, { price: 1500, reason: 'Agreed by phone' })).status, 200);
  assert.equal((await call('POST', `/api/dispatch/jobs/${job.id}/cancel`, disp, { reason: 'Customer changed plans', trashShipment: false })).status, 200);
  db.prepare(`INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, momo_reference, status, recorded_by, created_at_ts)
              VALUES ('csh_t', 'TX-CSH-000001', 'usr_c1', ?, 'COLLECTED', 'MTN_MOMO', 1500, 'XAF', 'MP123', 'PENDING', 'usr_c1', ?)`).run(job.id, Date.now());
  db.prepare(`INSERT INTO email_outbox (id, to_addr, subject, html, text, template_key, locale, status, related_type, related_id, created_at_ts, next_attempt_at_ts)
              VALUES ('m1', 'recipient@example.test', 's', 'h', 't', 'local.confirmed', 'en', 'SENT', 'shipment', ?, ?, ?)`).run(job.trackingNumber, Date.now(), Date.now());
  const res = await call('GET', `/api/dispatch/jobs/${job.id}/history`, sup);
  assert.equal(res.status, 200);
  const { data } = await res.json() as any;
  assert.deepEqual(data.timeline.map((e: any) => e.action), ['dispatch.create', 'dispatch.price', 'dispatch.cancel']);
  assert.equal(data.timeline[0].actorName, 'Dispatcher Dee');
  assert.equal(data.timeline[1].reason, 'Agreed by phone');
  assert.equal(data.timeline[2].reason, 'Customer changed plans');
  assert.ok(!('after' in data.timeline[0]) && !('afterJson' in data.timeline[0]));
  assert.deepEqual(data.cash.map((c: any) => [c.ref, c.method, c.amount, c.momoReference]), [['TX-CSH-000001', 'MTN_MOMO', 1500, 'MP123']]);
  assert.equal(data.notifications.length, 1);
  assert.notEqual(data.notifications[0].to, 'recipient@example.test');
  assert.match(data.notifications[0].to, /\*/);
  assert.equal((await call('GET', '/api/dispatch/jobs/job_missing/history', sup)).status, 404);
});
