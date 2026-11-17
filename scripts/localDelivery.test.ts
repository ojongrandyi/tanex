// Public local-delivery booking and live tracking (docs/DISPATCH_SPEC.md §5, §8, §11; tracker G.6–G.7).
// Booking: the admin price or "no price", only the public form's fields are accepted, a LOCAL shipment
// and a REQUESTED job with its tracking event. Tracking: the public payload never carries phone numbers,
// emails, landmarks, customer pins, prices or stale positions; the courier (photo only with consent)
// and the live position appear only during the delivery; after delivery only the route and a masked
// proof-of-delivery line remain. Runs against the real /api mounts on a temp database (`npm test`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-local-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { writeImageUpload } = await import('../server/uploads.ts');
const {
  etaMinutes, isPositionFresh, localStepIndex, showsCourier, showsLivePosition, LIVE_POSITION_MAX_AGE_MS,
} = await import('../src/shared/localTracking.ts');
const { buildWhatsAppShareLink } = await import('../src/shared/whatsapp.ts');

initDatabase();
const now0 = Date.now();

// Admin-entered tariffs (test data only, in a temp database).
db.prepare(`INSERT INTO delivery_cities (id, name, lat, lng) VALUES ('city_b', 'Buea', 4.15, 9.24), ('city_l', 'Limbe', 4.02, 9.2), ('city_off', 'Closed', 1, 1)`).run();
db.prepare(`UPDATE delivery_cities SET is_active = 0 WHERE id = 'city_off'`).run();
db.prepare(`INSERT INTO delivery_zones (id, city_id, name, lat, lng) VALUES
  ('z_mol', 'city_b', 'Molyko', 4.155, 9.29), ('z_chk', 'city_b', 'Check Point', 4.16, 9.24), ('z_bota', 'city_l', 'Bota', 4.01, 9.19)`).run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge) VALUES
  ('r1', 'city_b', 'z_mol', 'z_chk', 'SMALL', 1500, 'XAF', 500),
  ('r2', 'city_b', NULL, NULL, 'MEDIUM', 2000, 'XAF', NULL)`).run();

// A courier account (no sign-in needed: the steps are written straight to the job row below).
db.prepare(`INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
            VALUES ('usr_c1', 'c1@example.test', '+237650000009', 'Ama Rider Fullname', 'x', 'ACTIVE', 0, ?, ?)`).run(now0, now0);
db.prepare(`INSERT INTO couriers (user_id, vehicle_type, public_first_name, is_on_duty, created_at_ts, updated_at_ts)
            VALUES ('usr_c1', 'BIKE', 'Ama', 1, ?, ?)`).run(now0, now0);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
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

let ipSeq = 0;
async function call(method: string, p: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'X-Forwarded-For': `203.0.113.${(ipSeq++ % 250) + 1}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const SENDER_PHONE = '+237 651 11 22 33';
const RECIPIENT_PHONE = '691 44 55 66';
const booking = (extra: Record<string, unknown> = {}) => ({
  cityId: 'city_b',
  pickup: { zoneId: 'z_mol', landmark: 'Opposite the Total station, blue gate', contactName: 'Sue Sender', contactPhone: SENDER_PHONE, lat: 4.15511, lng: 9.29022 },
  dropoff: { zoneId: 'z_chk', landmark: 'Behind the stadium, green door', contactName: 'Rita Mbah', contactPhone: RECIPIENT_PHONE },
  sizeClass: 'SMALL',
  itemDescription: 'Documents',
  email: 'sue@example.test',
  locale: 'en',
  ...extra,
});
const jobOf = (t: string) => db.prepare('SELECT * FROM dispatch_jobs WHERE tracking_number = ?').get(t) as any;
const setJob = (t: string, sets: Record<string, unknown>) => {
  const cols = Object.keys(sets);
  db.prepare(`UPDATE dispatch_jobs SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE tracking_number = ?`).run(...cols.map((c) => sets[c] as any), t);
};
async function track(t: string): Promise<any> {
  const res = await call('GET', `/api/track/${t}`);
  assert.equal(res.status, 200);
  return (await res.json()).data;
}
async function book(extra: Record<string, unknown> = {}): Promise<string> {
  const res = await call('POST', '/api/local-delivery', booking(extra));
  assert.equal(res.status, 201, await res.clone().text());
  return (await res.json()).data.trackingNumber;
}

/** No phone digits, emails, landmarks, customer pins, notes or prices anywhere in the public answer. */
function assertPrivate(payload: unknown, label: string) {
  const text = JSON.stringify(payload);
  for (const leak of ['651 11 22 33', '651112233', '691445566', '44 55 66', '650000009', 'sue@example', 'Total station', 'green door',
    '4.15511', '9.29022', 'Ama Rider Fullname', 'Rita Mbah', 'Sue Sender', '"price"', 'contactPhone', 'contactName', 'landmark']) {
    assert.ok(!text.includes(leak), `${label}: public payload must not contain ${leak}`);
  }
}

test('shared rules: stepper, who and what is shown when, freshness, ETA rounding', () => {
  assert.deepEqual(['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'FAILED_ATTEMPT'].map((s) => localStepIndex(s as any)), [0, 0, 1, 1, 2, 3, 4, 3]);
  assert.equal(showsCourier('REQUESTED'), false);
  assert.equal(showsCourier('ASSIGNED'), true);
  assert.equal(showsCourier('DELIVERED'), false);
  assert.equal(showsLivePosition('ACCEPTED'), false);
  assert.equal(showsLivePosition('ON_THE_WAY'), true);
  assert.equal(isPositionFresh(1000, 1000 + LIVE_POSITION_MAX_AGE_MS), true);
  assert.equal(isPositionFresh(1000, 1001 + LIVE_POSITION_MAX_AGE_MS), false);
  // ~1.11 km north × 1.4 at 18 km/h ≈ 5.2 min → 6; long trips round up to 5 minutes.
  assert.equal(etaMinutes({ lat: 4.15, lng: 9.24 }, { lat: 4.16, lng: 9.24 }, 18), 6);
  assert.equal(etaMinutes({ lat: 4.0, lng: 9.2 }, { lat: 4.15, lng: 9.24 }, 18)! % 5, 0);
  assert.equal(etaMinutes({ lat: 4.15, lng: 9.24 }, { lat: 4.15, lng: 9.24 }, 18), 1);
  assert.equal(etaMinutes({ lat: 4.15, lng: 9.24 }, { lat: 4.16, lng: 9.24 }, 0), null);
  assert.match(buildWhatsAppShareLink('local.share_tracking', { link: 'https://x.test/track/TX7K2M9P' }, 'fr'), /^https:\/\/wa\.me\/\?text=Suivez/);
});

test('quote: admin price, express surcharge, no rate, no express price, bad input', async () => {
  const q = async (body: Record<string, unknown>) => {
    const res = await call('POST', '/api/local-delivery/quote', { cityId: 'city_b', sizeClass: 'SMALL', ...body });
    return { status: res.status, body: await res.json() };
  };
  assert.deepEqual((await q({ pickupZoneId: 'z_mol', dropoffZoneId: 'z_chk' })).body.data, { priced: true, price: 1500, currency: 'XAF' });
  assert.equal((await q({ pickupZoneId: 'z_mol', dropoffZoneId: 'z_chk', isExpress: true })).body.data.price, 2000);
  assert.deepEqual((await q({ pickupZoneId: 'z_chk', dropoffZoneId: 'z_mol' })).body.data, { priced: false, reason: 'NO_RATE' });
  assert.deepEqual((await q({ sizeClass: 'MEDIUM', isExpress: true })).body.data, { priced: false, reason: 'NO_EXPRESS_RATE' });
  assert.equal((await q({ sizeClass: 'MEDIUM' })).body.data.price, 2000);
  assert.equal((await q({ cityId: 'city_off' })).body.code, 'INVALID_CITY');
  assert.equal((await q({ pickupZoneId: 'z_bota' })).body.code, 'INVALID_AREA');
  assert.equal((await q({ sizeClass: 'HUGE' })).body.code, 'INVALID_SIZE');
});

test('booking: LOCAL shipment, REQUESTED job with the rate-sheet price, "Delivery requested" event, audit', async () => {
  const t = await book();
  assert.match(t, /^TX[A-Z0-9]{6}$/);
  const job = jobOf(t);
  assert.equal(job.status, 'REQUESTED');
  assert.equal(job.scope, 'LOCAL');
  assert.equal(job.price, 1500);
  assert.equal(job.vehicle_required, 'BIKE');
  assert.equal(job.collect_delivery_fee, 0);
  assert.ok(job.requested_at_ts > 0);
  const ship = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(t) as any;
  assert.equal(ship.service_scope, 'LOCAL');
  assert.equal(JSON.parse(ship.sender_json).email, 'sue@example.test');
  const ev = db.prepare('SELECT title_key FROM tracking_events WHERE shipment_tracking = ?').all(t) as any[];
  assert.deepEqual(ev.map((e) => e.title_key), ['event.local_requested']);
  assert.ok((db.prepare(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'dispatch.request' AND entity_id = ?`).get(job.id) as any).c === 1);

  // No rate: booked anyway, price left for dispatch.
  const t2 = await book({ pickup: { ...booking().pickup, zoneId: 'z_chk' }, dropoff: { ...booking().dropoff, zoneId: null }, payer: 'RECIPIENT', sizeClass: 'LARGE' });
  const j2 = jobOf(t2);
  assert.equal(j2.price, null);
  assert.equal(j2.vehicle_required, 'VAN');
  assert.equal(j2.collect_delivery_fee, 1, 'the courier collects the fee when the recipient pays');
});

test('booking: the customer cannot set the price, vehicle, delivery code or status; bad input refused', async () => {
  const t = await book({ price: 1, priceReason: 'cheap', vehicleRequired: 'TRUCK', deliveryCode: '1234', collectDeliveryFee: true, status: 'DELIVERED', scope: 'INTERCITY' });
  const job = jobOf(t);
  assert.equal(job.price, 1500);
  assert.equal(job.price_overridden, 0);
  assert.equal(job.vehicle_required, 'BIKE');
  assert.equal(job.delivery_code_hash, null);
  assert.equal(job.collect_delivery_fee, 0);
  assert.equal(job.status, 'REQUESTED');
  assert.equal(job.scope, 'LOCAL');

  const refuse = async (extra: Record<string, unknown>, code: string) => {
    const res = await call('POST', '/api/local-delivery', booking(extra));
    assert.equal(res.status, 400, code);
    assert.equal((await res.json()).code, code);
  };
  await refuse({ cityId: 'city_off' }, 'INVALID_CITY');
  await refuse({ pickup: { ...booking().pickup, zoneId: 'z_bota' } }, 'INVALID_AREA');
  await refuse({ dropoff: { ...booking().dropoff, contactPhone: '12' } }, 'INVALID_DROPOFF');
  await refuse({ pickup: { ...booking().pickup, zoneId: null, landmark: '' } }, 'INVALID_PICKUP');
  await refuse({ sizeClass: undefined }, 'INVALID_SIZE');
  await refuse({ scheduledForTs: Date.now() - 3_600_000 }, 'INVALID_TIME');
  await refuse({ scheduledForTs: Date.now() + 40 * 86_400_000 }, 'INVALID_TIME');
  await refuse({ email: 'not-an-email' }, 'INVALID_EMAIL');
  await refuse({ codAmount: -5 }, 'INVALID_COD');
});

test('track: requested job shows the stepper and the route, nothing private', async () => {
  const t = await book();
  const data = await track(t);
  assertPrivate(data, 'requested');
  assert.equal(data.serviceScope, 'LOCAL');
  const ld = data.localDelivery;
  assert.equal(ld.step, 0);
  assert.equal(ld.outcome, 'ACTIVE');
  assert.equal(ld.courier, null);
  assert.equal(ld.live, false);
  assert.equal(ld.position, null);
  assert.equal(ld.pollMs, 20_000);
  // Area pins, not the customer's own pin.
  assert.deepEqual(ld.route.pickup, { lat: 4.155, lng: 9.29 });
  assert.equal(ld.route.pickupArea, 'Molyko');
  assert.equal(ld.route.dropoffCity, 'Buea');
  assert.equal(data.sender.phone, undefined);
  assert.deepEqual(data.documents, []);
});

test('track: courier card from assignment, photo only with consent; live position only while on the way and fresh', async () => {
  const t = await book();
  const job = jobOf(t);
  setJob(t, { status: 'ASSIGNED', courier_user_id: 'usr_c1', assigned_at_ts: Date.now() });
  let ld = (await track(t)).localDelivery;
  assert.deepEqual(ld.courier, { firstName: 'Ama', vehicle: 'BIKE', photoUrl: null });
  assert.equal(ld.step, 1);
  assert.equal((await call('GET', `/api/track/${t}/courier-photo`)).status, 404, 'no photo without consent');

  // Consent recorded with a photo: shown, and served by the public route.
  const photo = writeImageUpload('couriers', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'), 'png');
  db.prepare('UPDATE couriers SET photo_file = ?, show_photo_publicly = 1 WHERE user_id = ?').run(photo.fileName, 'usr_c1');
  ld = (await track(t)).localDelivery;
  assert.match(ld.courier.photoUrl, new RegExp(`^/api/track/${t}/courier-photo\\?v=`));
  const img = await call('GET', `/api/track/${t}/courier-photo`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  db.prepare('UPDATE couriers SET show_photo_publicly = 0 WHERE user_id = ?').run('usr_c1');
  assert.equal((await call('GET', `/api/track/${t}/courier-photo`)).status, 404, 'withdrawn consent hides the photo');
  db.prepare('UPDATE couriers SET show_photo_publicly = 1 WHERE user_id = ?').run('usr_c1');

  // Accepted but not picked up: positions are never shown, even fresh ones.
  const addPoint = (jobId: string, lat: number, lng: number, at: number) =>
    db.prepare('INSERT INTO courier_locations (courier_user_id, job_id, lat, lng, recorded_at_ts) VALUES (?, ?, ?, ?, ?)').run('usr_c1', jobId, lat, lng, at);
  setJob(t, { status: 'ACCEPTED', accepted_at_ts: Date.now() });
  addPoint(job.id, 4.158, 9.27, Date.now());
  ld = (await track(t)).localDelivery;
  assert.equal(ld.live, false);
  assert.equal(ld.position, null);

  // On the way with only a stale point (3 min): live map on, no position, no ETA.
  db.prepare('DELETE FROM courier_locations').run();
  setJob(t, { status: 'ON_THE_WAY', picked_up_at_ts: Date.now() - 600_000, on_the_way_at_ts: Date.now() - 300_000 });
  addPoint(job.id, 4.158, 9.27, Date.now() - 3 * 60_000);
  // A fresh point from another job must not leak onto this page.
  addPoint('job_other', 4.0, 9.0, Date.now());
  let data = await track(t);
  assertPrivate(data, 'on the way, stale');
  assert.equal(data.localDelivery.live, true);
  assert.equal(data.localDelivery.position, null);
  assert.equal(data.localDelivery.etaMinutes, null);

  // A fresh point: shown with its age and an approximate ETA to the drop-off.
  addPoint(job.id, 4.158, 9.27, Date.now() - 5_000);
  data = await track(t);
  assertPrivate(data, 'on the way, fresh');
  ld = data.localDelivery;
  assert.equal(ld.step, 3);
  assert.equal(ld.position.lat, 4.158);
  assert.ok(ld.position.ageMs >= 5_000 && ld.position.ageMs < 60_000);
  assert.ok(Number.isInteger(ld.etaMinutes) && ld.etaMinutes >= 1);
  assert.equal(data.currentLocation.lat, ld.route.dropoff.lat, 'current location is the area pin, not the courier');
});

test('track: after delivery only the route and a masked proof line; no courier, position or polling', async () => {
  const t = await book();
  const job = jobOf(t);
  const at = Date.now() - 60_000;
  setJob(t, { status: 'DELIVERED', courier_user_id: 'usr_c1', delivered_at_ts: at, pod_recipient_name: 'Rita Mbah', pod_photo_file: 'x.png' });
  db.prepare('INSERT INTO courier_locations (courier_user_id, job_id, lat, lng, recorded_at_ts) VALUES (?, ?, ?, ?, ?)').run('usr_c1', job.id, 4.16, 9.24, Date.now());
  const data = await track(t);
  assertPrivate(data, 'delivered');
  const ld = data.localDelivery;
  assert.equal(ld.outcome, 'DELIVERED');
  assert.equal(ld.step, 4);
  assert.equal(ld.courier, null);
  assert.equal(ld.live, false);
  assert.equal(ld.position, null);
  assert.equal(ld.pollMs, null);
  assert.deepEqual(ld.pod, { recipient: 'R*** M***', deliveredAt: at, photo: true });
  assert.ok(ld.route.pickup && ld.route.dropoff);
  assert.equal((await call('GET', `/api/track/${t}/courier-photo`)).status, 404);

  // Failed attempt: reason code, on the "On the way" step, courier hidden.
  const t2 = await book();
  setJob(t2, { status: 'FAILED_ATTEMPT', courier_user_id: 'usr_c1', failure_reason: 'RECIPIENT_ABSENT', failure_note: 'Neighbour said call 677 00 00 00' });
  const d2 = await track(t2);
  assertPrivate(d2, 'failed');
  assert.ok(!JSON.stringify(d2).includes('677 00'), 'failure note stays internal');
  assert.equal(d2.localDelivery.outcome, 'FAILED');
  assert.equal(d2.localDelivery.failureReason, 'RECIPIENT_ABSENT');
  assert.equal(d2.localDelivery.courier, null);
  assert.equal(d2.localDelivery.pollMs, 20_000);
});

test('track: masking switched off in settings still hides local delivery contacts', async () => {
  db.prepare(`INSERT INTO settings (key, value_json) VALUES ('general', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`)
    .run(JSON.stringify({ piiMaskingEnabled: false, cloakInternalNotes: false }));
  try {
    const t = await book();
    assertPrivate(await track(t), 'masking off');
  } finally {
    db.prepare(`DELETE FROM settings WHERE key = 'general'`).run();
  }
});
