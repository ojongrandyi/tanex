// Dispatch job lifecycle API (docs/DISPATCH_SPEC.md §4, §6, §9, §11; tracker G.3): staff create,
// price, assign, reassign, cancel and return jobs; couriers act only on their own jobs, with
// idempotency keys; every move writes the job timestamp, a tracking event, the shipment status
// and progress, an audit row and, when money is collected, a cash ledger row; the delivery code
// is hashed with 5 tries; proof-of-delivery files are private; delivered jobs get a Proof of
// Delivery document; courier positions are only taken during a delivery and purged after 30 days.
// Runs against the real /api mounts on a file database in a temp folder. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-jobs-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { purgeOldLocations, LOCATION_RETENTION_MS } = await import('../server/dispatch/locations.ts');
const { parseMultipart, multipartBoundary } = await import('../server/multipart.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');

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
function addCourier(id: string, email: string, name: string, publicName: string, vehicle = 'BIKE'): void {
  addUser(id, email, ['role_courier'], name);
  db.prepare(`
    INSERT INTO couriers (user_id, vehicle_type, public_first_name, is_on_duty, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(id, vehicle, publicName, now0, now0);
}

// A documents-only role: may open the Document Center but not the private POD files.
db.prepare(`INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts) VALUES ('role_docs', 'Docs', '', 0, 0, ?, ?)`).run(now0, now0);
db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)').run('role_docs', 'documents.view');

addUser('usr_sa', 'sa@example.test', [SUPER_ADMIN_ROLE_ID], 'Owner');
addUser('usr_disp', 'disp@example.test', ['role_dispatch_manager'], 'Dispatcher Dee');
addUser('usr_sup', 'sup@example.test', ['role_customer_support'], 'Support Sam');
addUser('usr_fin', 'fin@example.test', ['role_finance'], 'Finance Fay');
addUser('usr_docs', 'docs@example.test', ['role_docs'], 'Docs Dan');
addCourier('usr_c1', 'c1@example.test', 'Ama Rider', 'Ama');
addCourier('usr_c2', 'c2@example.test', 'Bello Rider', 'Bello');
addCourier('usr_c3', 'c3@example.test', 'Chi Driver', 'Chi', 'VAN');

// Admin-entered tariffs (test data only, in a temp database).
db.prepare(`INSERT INTO delivery_cities (id, name, lat, lng) VALUES ('city_b', 'Buea', 4.15, 9.24), ('city_d', 'Douala', 4.05, 9.7)`).run();
db.prepare(`INSERT INTO delivery_zones (id, city_id, name) VALUES ('z_mol', 'city_b', 'Molyko'), ('z_chk', 'city_b', 'Check Point'), ('z_kot', 'city_d', 'Kotto')`).run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge)
            VALUES ('r1', 'city_b', NULL, NULL, 'SMALL', 1000, 'XAF', 500)`).run();

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
async function signIn(identifier: string): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier, password: PASSWORD });
  assert.equal(res.status, 200, `sign-in as ${identifier}`);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}

const sa = await signIn('sa@example.test');
const disp = await signIn('disp@example.test');
const sup = await signIn('sup@example.test');
const fin = await signIn('fin@example.test');
const docs = await signIn('docs@example.test');
const c1 = await signIn('c1@example.test');
const c2 = await signIn('c2@example.test');
const c3 = await signIn('c3@example.test');

const auditCount = (action: string, entityId?: string) => (entityId
  ? db.prepare('SELECT COUNT(*) AS c FROM audit_log WHERE action = ? AND entity_id = ?').get(action, entityId)
  : db.prepare('SELECT COUNT(*) AS c FROM audit_log WHERE action = ?').get(action)) as { c: number };
const shipment = (t: string) => db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(t) as any;
const events = (t: string) => db.prepare('SELECT * FROM tracking_events WHERE shipment_tracking = ? ORDER BY sort_order').all(t) as any[];
const jobRow = (id: string) => db.prepare('SELECT * FROM dispatch_jobs WHERE id = ?').get(id) as any;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const place = (zoneId: string | null, name: string, phone: string, cityId = 'city_b') =>
  ({ cityId, zoneId, landmark: 'Near the junction', contactName: name, contactPhone: phone });
const localJob = (extra: Record<string, unknown> = {}) => ({
  scope: 'LOCAL', sizeClass: 'SMALL',
  pickup: place('z_mol', 'Sender Sue', '+237 651 00 00 01'),
  dropoff: place('z_chk', 'Receiver Rita Mbah', '+237 651 00 00 02'),
  ...extra,
});

let keySeq = 0;
const newKey = () => `test-key-${++keySeq}-${Date.now()}`;
const act = (cookie: string, id: string, action: string, extra: Record<string, unknown> = {}, key = newKey()) =>
  call('POST', `/api/courier/jobs/${id}/action`, cookie, { action, idempotencyKey: key, ...extra });

async function uploadPod(cookie: string, id: string, parts: { photo?: Buffer; signature?: Buffer; recipientName?: string }) {
  const form = new FormData();
  if (parts.photo) form.append('photo', new Blob([new Uint8Array(parts.photo)], { type: 'image/png' }), 'photo.png');
  if (parts.signature) form.append('signature', new Blob([new Uint8Array(parts.signature)], { type: 'image/png' }), 'sig.png');
  if (parts.recipientName) form.append('recipientName', parts.recipientName);
  return fetch(`${BASE}/api/courier/pod/${id}`, { method: 'POST', headers: { Cookie: cookie }, body: form });
}

async function createJob(body: Record<string, unknown> = localJob()): Promise<any> {
  const res = await call('POST', '/api/dispatch/jobs', disp, body);
  const out = await json(res);
  assert.equal(res.status, 201, JSON.stringify(out));
  return out.data;
}

test('routes: 401 signed out, 403 without dispatch / courier permissions', async () => {
  for (const [m, p] of [['GET', '/api/dispatch/jobs'], ['GET', '/api/dispatch/board'], ['POST', '/api/dispatch/jobs'],
    ['GET', '/api/courier/jobs'], ['POST', '/api/courier/location']] as const) {
    assert.equal((await call(m, p, undefined, m === 'POST' ? {} : undefined)).status, 401, `anonymous ${m} ${p}`);
  }
  // Couriers can't use the dispatch API; staff without courier.app can't use the courier API.
  assert.equal((await call('GET', '/api/dispatch/jobs', c1)).status, 403);
  assert.equal((await call('POST', '/api/dispatch/jobs', c1, localJob())).status, 403);
  assert.equal((await call('GET', '/api/courier/jobs', disp)).status, 403);
  // Customer Support may view jobs (dispatch.view) but not change them.
  assert.equal((await call('GET', '/api/dispatch/board', sup)).status, 200);
  assert.equal((await call('POST', '/api/dispatch/jobs', sup, localJob())).status, 403);
  assert.equal((await call('POST', '/api/dispatch/jobs', fin, localJob())).status, 403);
});

test('create: rate-sheet price, LOCAL shipment, confirmed event and audit; no rate needs a price by hand', async () => {
  const job = await createJob();
  assert.equal(job.status, 'CONFIRMED');
  assert.equal(job.price, 1000);
  assert.equal(job.currency, 'XAF');
  assert.equal(job.priceOverridden, false);
  assert.equal(job.vehicleRequired, 'BIKE');
  assert.match(job.trackingNumber, /^TX[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(job.pickup.zoneName, 'Molyko');
  const ship = shipment(job.trackingNumber);
  assert.equal(ship.service_scope, 'LOCAL');
  assert.equal(ship.status, 'BOOKED');
  assert.equal(ship.progress_percent, 0);
  const ev = events(job.trackingNumber);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title_key, 'event.local_confirmed');
  assert.equal(ev[0].recorded_by, 'Dispatcher Dee');
  assert.equal(ev[0].time_zone, 'Africa/Douala');
  assert.ok(jobRow(job.id).confirmed_at_ts > 0);
  assert.equal(auditCount('dispatch.create', job.id).c, 1);

  // Express adds the surcharge.
  assert.equal((await createJob(localJob({ isExpress: true }))).price, 1500);
  // No MEDIUM rate: refused until a price is set by hand, with a reason.
  const noRate = await call('POST', '/api/dispatch/jobs', disp, localJob({ sizeClass: 'MEDIUM' }));
  assert.equal(noRate.status, 409);
  assert.equal((await json(noRate)).code, 'PRICE_REQUIRED');
  const noReason = await call('POST', '/api/dispatch/jobs', disp, localJob({ sizeClass: 'MEDIUM', price: 2500 }));
  assert.equal((await json(noReason)).code, 'REASON_REQUIRED');
  const manual = await createJob(localJob({ sizeClass: 'MEDIUM', price: 2500, priceReason: 'Phone order, agreed with customer' }));
  assert.equal(manual.price, 2500);
  assert.equal(manual.priceOverridden, true);
  // Local means one city; intercity needs a weight and two cities.
  const cross = await call('POST', '/api/dispatch/jobs', disp, localJob({ dropoff: place('z_kot', 'R', '+237 651 00 00 03', 'city_d') }));
  assert.equal((await json(cross)).code, 'CITY_MISMATCH');
  const inter = await createJob({
    scope: 'INTERCITY', weightKg: 12, price: 8000, priceReason: 'No band yet',
    pickup: place(null, 'S', '+237 651 00 00 04'), dropoff: place('z_kot', 'R', '+237 651 00 00 05', 'city_d'),
  });
  assert.equal(inter.vehicleRequired, 'TRUCK');
  assert.equal(shipment(inter.trackingNumber).service_scope, 'INTERCITY');
  // Bad phone / unknown zone.
  assert.equal((await json(await call('POST', '/api/dispatch/jobs', disp, localJob({ pickup: place('z_mol', 'S', '12') })))).code, 'INVALID_PICKUP');
  assert.equal((await json(await call('POST', '/api/dispatch/jobs', disp, localJob({ dropoff: place('z_kot', 'R', '+237 651 00 00 06') })))).code, 'INVALID_DROPOFF');
});

test('price: set by hand with a reason, back to the rate sheet, audited', async () => {
  const job = await createJob();
  const res = await call('POST', `/api/dispatch/jobs/${job.id}/price`, disp, { price: 1200, reason: 'Long stairs' });
  assert.equal(res.status, 200);
  assert.equal((await json(res)).data.price, 1200);
  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/price`, disp, { price: 1200 }))).code, 'REASON_REQUIRED');
  const back = await json(await call('POST', `/api/dispatch/jobs/${job.id}/price`, disp, { price: null }));
  assert.equal(back.data.price, 1000);
  assert.equal(back.data.priceOverridden, false);
  assert.equal(auditCount('dispatch.price', job.id).c, 2);
});

test('full delivery: assign, courier steps with idempotency, cash, POD, delivery code, POD document', async () => {
  const job = await createJob(localJob({ deliveryCode: '4821', codAmount: 15000, collectDeliveryFee: true }));
  assert.equal(job.hasDeliveryCode, true);
  assert.equal(jobRow(job.id).delivery_code_hash.startsWith('$2'), true, 'code stored hashed');
  assert.ok(!JSON.stringify(job).includes('4821'));

  // Assign to courier 1.
  const assigned = await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' }));
  assert.equal(assigned.data.status, 'ASSIGNED');
  assert.equal(shipment(job.trackingNumber).progress_percent, 20);
  assert.equal(events(job.trackingNumber).at(-1).title_key, 'event.local_assigned');

  // Courier 2 can't see or touch courier 1's job.
  assert.equal((await call('GET', `/api/courier/jobs/${job.id}`, c2)).status, 404);
  const steal = await act(c2, job.id, 'accept');
  assert.equal(steal.status, 403);
  assert.equal((await json(steal)).code, 'NOT_YOUR_JOB');
  assert.ok(!(await json(await call('GET', '/api/courier/jobs', c2))).data.some((j: any) => j.id === job.id));
  assert.equal(jobRow(job.id).status, 'ASSIGNED');

  // Idempotency key required; accept; replay returns the stored answer without a second write.
  assert.equal((await json(await call('POST', `/api/courier/jobs/${job.id}/action`, c1, { action: 'accept' }))).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const key = newKey();
  const first = await json(await act(c1, job.id, 'accept', {}, key));
  assert.equal(first.data.status, 'ACCEPTED');
  const auditsBefore = auditCount('dispatch.accept', job.id).c;
  const replay = await json(await act(c1, job.id, 'accept', {}, key));
  assert.equal(replay.replayed, true);
  assert.equal(replay.data.status, 'ACCEPTED');
  assert.equal(auditCount('dispatch.accept', job.id).c, auditsBefore);
  assert.equal((await act(c1, job.id, 'pick_up', {}, key)).status, 409, 'key reused for another action');
  // A second accept with a fresh key is an invalid transition.
  assert.equal((await json(await act(c1, job.id, 'accept'))).code, 'INVALID_TRANSITION');
  // Accept is internal: no public event.
  assert.equal(events(job.trackingNumber).at(-1).title_key, 'event.local_assigned');

  // No position before pickup.
  assert.equal((await json(await call('POST', '/api/courier/location', c1, { lat: 4.15, lng: 9.24 }))).code, 'NO_ACTIVE_JOB');

  // Pick up, collecting the delivery fee in cash; MoMo needs a reference.
  assert.equal((await json(await act(c1, job.id, 'pick_up', { cash: [{ amount: 1000, method: 'MTN_MOMO' }] }))).code, 'MOMO_REFERENCE_REQUIRED');
  const picked = await json(await act(c1, job.id, 'pick_up', { cash: [{ amount: 1000, method: 'CASH' }] }));
  assert.equal(picked.data.status, 'PICKED_UP');
  let ship = shipment(job.trackingNumber);
  assert.equal(ship.status, 'RECEIVED');
  assert.equal(ship.progress_percent, 40);
  const pickEvent = events(job.trackingNumber).at(-1);
  assert.equal(pickEvent.title, 'Picked up by Ama');
  assert.equal(pickEvent.recorded_by, 'Ama Rider');
  const cash1 = db.prepare("SELECT * FROM cash_ledger WHERE job_id = ? ORDER BY created_at_ts").all(job.id) as any[];
  assert.equal(cash1.length, 1);
  assert.match(cash1[0].ref, /^TX-CSH-\d{6}$/);
  assert.equal(cash1[0].entry_type, 'COLLECTED');
  assert.equal(cash1[0].status, 'PENDING');
  assert.equal(cash1[0].courier_user_id, 'usr_c1');

  // Positions are taken during the delivery; courier 2 has no active job.
  const loc = await json(await call('POST', '/api/courier/location', c1, { points: [{ lat: 4.151, lng: 9.241, accuracyM: 12 }, { lat: 4.152, lng: 9.242 }] }));
  assert.equal(loc.data.accepted, 2);
  assert.equal(loc.data.jobId, job.id);
  assert.equal((await call('POST', '/api/courier/location', c2, { lat: 4.15, lng: 9.24 })).status, 409);
  assert.equal((await call('POST', '/api/courier/location', c1, { lat: 99, lng: 9.24 })).status, 400);

  const onWay = await json(await act(c1, job.id, 'start_delivery'));
  assert.equal(onWay.data.status, 'ON_THE_WAY');
  ship = shipment(job.trackingNumber);
  assert.equal(ship.status, 'OUT_FOR_DELIVERY');
  assert.equal(ship.progress_percent, 60);

  // Delivered needs POD (name + photo).
  assert.equal((await json(await act(c1, job.id, 'deliver', { recipientName: 'Rita Mbah', deliveryCode: '4821' }))).code, 'POD_REQUIRED');
  // Courier 2 can't upload POD for it.
  assert.equal((await uploadPod(c2, job.id, { photo: PNG })).status, 403);
  // Not an image → refused.
  assert.equal((await uploadPod(c1, job.id, { photo: Buffer.from('not an image at all') })).status, 400);
  const pod = await uploadPod(c1, job.id, { photo: PNG, signature: PNG, recipientName: 'Rita Mbah' });
  const podOut = await json(pod);
  assert.equal(pod.status, 200, JSON.stringify(podOut));
  assert.ok(podOut.data.pod.photoUrl.startsWith(`/api/courier/jobs/${job.id}/pod/photo`));
  const files = fs.readdirSync(path.join(tmpDir, 'uploads', 'pod'));
  assert.equal(files.length, 2);

  // POD files: dispatch, finance and the courier; nobody else.
  assert.equal((await call('GET', `/api/dispatch/jobs/${job.id}/pod/photo`, disp)).headers.get('content-type'), 'image/png');
  assert.equal((await call('GET', `/api/dispatch/jobs/${job.id}/pod/signature`, fin)).status, 200);
  assert.equal((await call('GET', `/api/courier/jobs/${job.id}/pod/photo`, c1)).status, 200);
  assert.equal((await call('GET', `/api/courier/jobs/${job.id}/pod/photo`, c2)).status, 404);
  assert.equal((await call('GET', `/api/dispatch/jobs/${job.id}/pod/photo`, c2)).status, 403);
  assert.equal((await call('GET', `/api/dispatch/jobs/${job.id}/pod/photo`, docs)).status, 403);
  assert.equal((await call('GET', `/api/dispatch/jobs/${job.id}/pod/photo`)).status, 401);

  // Delivery code: 4 wrong tries count down, the 5th locks, dispatch lifts it.
  for (let left = 4; left >= 1; left--) {
    const wrong = await json(await act(c1, job.id, 'deliver', { deliveryCode: '0000' }));
    assert.equal(wrong.code, 'DELIVERY_CODE_WRONG');
    assert.equal(wrong.details.triesLeft, left);
  }
  const locked = await act(c1, job.id, 'deliver', { deliveryCode: '0000' });
  assert.equal(locked.status, 423);
  // Even the right code is refused once locked.
  assert.equal((await act(c1, job.id, 'deliver', { deliveryCode: '4821' })).status, 423);
  assert.equal(auditCount('dispatch.code_wrong', job.id).c, 5);
  assert.equal(jobRow(job.id).status, 'ON_THE_WAY');
  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/delivery-code-override`, disp, {}))).code, 'REASON_REQUIRED');
  const lifted = await json(await call('POST', `/api/dispatch/jobs/${job.id}/delivery-code-override`, disp, { reason: 'Recipient lost the SMS; ID checked by phone' }));
  assert.equal(lifted.data.hasDeliveryCode, false);

  const delivered = await json(await act(c1, job.id, 'deliver', { cash: [{ amount: 15000, method: 'ORANGE_MONEY', momoReference: 'OM123456' }] }));
  assert.equal(delivered.data.status, 'DELIVERED');
  ship = shipment(job.trackingNumber);
  assert.equal(ship.status, 'DELIVERED');
  assert.equal(ship.progress_percent, 100);
  const last = events(job.trackingNumber).at(-1);
  assert.equal(last.title_key, 'event.local_delivered');
  assert.equal(last.title, 'Delivered, received by R*** M***', 'recipient masked in the public event');
  // Public events never carry phones or full names.
  for (const e of events(job.trackingNumber)) {
    const all = `${e.title} ${e.description} ${e.operator_notes ?? ''} ${e.location}`;
    assert.ok(!/651 00 00|\+2376/.test(all), `no phone in ${all}`);
    assert.ok(!all.includes('Rita'), `no full name in ${all}`);
  }
  assert.ok(jobRow(job.id).delivered_at_ts > 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM cash_ledger WHERE job_id = ?').get(job.id) as any).c, 2);

  // Proof of Delivery document.
  const doc = db.prepare("SELECT * FROM documents WHERE shipment_tracking = ? AND doc_type = 'POD'").get(job.trackingNumber) as any;
  assert.ok(doc, 'POD document written');
  assert.match(doc.id, /^POD-\d{4}-\d{5}$/);
  assert.equal(doc.title, 'Proof of Delivery');
  const details = JSON.parse(doc.details_json);
  assert.equal(details.jobId, job.id);
  assert.equal(details.receivedBy, 'Rita Mbah');
  assert.equal(details.hasPhoto, true);
  assert.equal(details.hasSignature, true);
  assert.equal(details.cashRefs.length, 1);
  const listed = await json(await call('GET', '/api/documents', sa));
  assert.ok(listed.data.some((d: any) => d.id === doc.id && d.docType === 'POD' && d.details.jobId === job.id));

  // Finished: no more steps, no more POD uploads, no cancel.
  assert.equal((await act(c1, job.id, 'fail', { failureReason: 'REFUSED' })).status, 409);
  assert.equal((await uploadPod(c1, job.id, { photo: PNG })).status, 409);
  assert.equal((await call('POST', `/api/dispatch/jobs/${job.id}/cancel`, disp, { reason: 'x' })).status, 409);
  // Every step was audited.
  for (const a of ['create', 'assign', 'accept', 'pick_up', 'start_delivery', 'deliver']) {
    assert.equal(auditCount(`dispatch.${a}`, job.id).c, 1, a);
  }
  assert.equal(auditCount('dispatch.pod_upload', job.id).c, 1);
});

test('failed attempt needs a reason (and a note for Other), then return to sender', async () => {
  const job = await createJob();
  await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c2' });
  for (const a of ['accept', 'pick_up', 'start_delivery']) assert.equal((await act(c2, job.id, a)).status, 200, a);
  assert.equal((await json(await act(c2, job.id, 'fail'))).code, 'REASON_REQUIRED');
  assert.equal((await json(await act(c2, job.id, 'fail', { failureReason: 'OTHER' }))).code, 'NOTE_REQUIRED');
  const failed = await json(await act(c2, job.id, 'fail', { failureReason: 'OTHER', note: 'Gate locked, dog at 0651000002' }));
  assert.equal(failed.data.status, 'FAILED_ATTEMPT');
  assert.equal(failed.data.attempts, 1);
  assert.equal(shipment(job.trackingNumber).status, 'DELAYED');
  const ev = events(job.trackingNumber).at(-1);
  assert.equal(ev.title_key, 'event.local_failed');
  assert.equal(ev.delay_flag, 1);
  assert.ok(!JSON.stringify(ev).includes('Gate locked'), 'courier note stays internal');
  assert.equal(jobRow(job.id).failure_note, 'Gate locked, dog at 0651000002');
  // Couriers can't return; dispatch can.
  assert.equal((await act(c2, job.id, 'return')).status, 403);
  const ret = await json(await call('POST', `/api/dispatch/jobs/${job.id}/return`, disp, {}));
  assert.equal(ret.data.status, 'RETURNED');
  assert.equal(shipment(job.trackingNumber).status, 'RETURNED');
  assert.equal(events(job.trackingNumber).at(-1).title_key, 'event.local_returned');
});

test('failed attempt can be assigned again for another try', async () => {
  const job = await createJob();
  await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' });
  for (const a of ['accept', 'pick_up', 'start_delivery']) await act(c1, job.id, a);
  await act(c1, job.id, 'fail', { failureReason: 'RECIPIENT_ABSENT' });
  const again = await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c2' }));
  assert.equal(again.data.status, 'ASSIGNED');
  assert.equal(again.data.courierUserId, 'usr_c2');
});

test('decline returns the job to dispatch; reassign keeps history; disabled or unknown couriers refused', async () => {
  const job = await createJob();
  await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' });
  const declined = await json(await act(c1, job.id, 'decline'));
  assert.equal(declined.data.status, 'CONFIRMED');
  assert.equal(jobRow(job.id).courier_user_id, null);
  // Once declined, it's no longer the courier's.
  assert.equal((await call('GET', `/api/courier/jobs/${job.id}`, c1)).status, 404);

  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, {}))).code, 'COURIER_REQUIRED');
  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_disp' }))).code, 'UNKNOWN_COURIER');
  await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' });
  await act(c1, job.id, 'accept');
  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' }))).code, 'SAME_COURIER');
  const re = await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c3' }));
  assert.equal(re.data.status, 'ASSIGNED');
  assert.equal(re.data.courierUserId, 'usr_c3');
  assert.equal(re.data.acceptedAt, null);
  assert.equal(auditCount('dispatch.reassign', job.id).c, 1);
  const audit = db.prepare("SELECT before_json, after_json FROM audit_log WHERE action = 'dispatch.reassign' AND entity_id = ?").get(job.id) as any;
  assert.equal(JSON.parse(audit.before_json).courierUserId, 'usr_c1');
  // The previous courier lost access; the new one has it.
  assert.equal((await act(c1, job.id, 'pick_up')).status, 403);
  assert.equal((await act(c3, job.id, 'accept')).status, 200);

  db.prepare("UPDATE users SET status = 'DISABLED' WHERE id = 'usr_c2'").run();
  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c2' }))).code, 'COURIER_DISABLED');
  db.prepare("UPDATE users SET status = 'ACTIVE' WHERE id = 'usr_c2'").run();
});

test('cancel before pickup only, with a reason; can move the shipment to the trash', async () => {
  const job = await createJob();
  assert.equal((await json(await call('POST', `/api/dispatch/jobs/${job.id}/cancel`, disp, {}))).code, 'REASON_REQUIRED');
  const cancelled = await json(await call('POST', `/api/dispatch/jobs/${job.id}/cancel`, disp, { reason: 'Customer cancelled by phone', trashShipment: true }));
  assert.equal(cancelled.data.status, 'CANCELLED');
  assert.ok(jobRow(job.id).cancelled_at_ts > 0);
  assert.ok(shipment(job.trackingNumber).deleted_at_ts > 0);
  assert.equal(events(job.trackingNumber).at(-1).title_key, 'event.local_cancelled');

  const job2 = await createJob();
  await call('POST', `/api/dispatch/jobs/${job2.id}/assign`, disp, { courierUserId: 'usr_c1' });
  await act(c1, job2.id, 'accept');
  await act(c1, job2.id, 'pick_up');
  const late = await call('POST', `/api/dispatch/jobs/${job2.id}/cancel`, disp, { reason: 'Too late' });
  assert.equal(late.status, 409);
  assert.equal((await json(late)).code, 'INVALID_TRANSITION');
  assert.equal(shipment(job2.trackingNumber).deleted_at_ts, null);
  // Editing is locked after pickup.
  assert.equal((await json(await call('PATCH', `/api/dispatch/jobs/${job2.id}`, disp, { itemDescription: 'x' }))).code, 'JOB_LOCKED');
});

test('edit before pickup: re-prices from the rate sheet, resets the code tries, keeps the shipment in step', async () => {
  const job = await createJob();
  const res = await json(await call('PATCH', `/api/dispatch/jobs/${job.id}`, disp, {
    isExpress: true, itemDescription: 'Laptop', deliveryCode: '1234',
    dropoff: place('z_mol', 'New Receiver', '+237 651 00 00 09'),
  }));
  assert.equal(res.success, true, JSON.stringify(res));
  assert.equal(res.data.price, 1500);
  assert.equal(res.data.hasDeliveryCode, true);
  assert.equal(res.data.deliveryCodeTriesLeft, 5);
  const ship = shipment(job.trackingNumber);
  assert.equal(JSON.parse(ship.recipient_json).name, 'New Receiver');
  assert.equal(ship.cargo_description, 'Laptop');
  const a = db.prepare("SELECT after_json FROM audit_log WHERE action = 'dispatch.update' AND entity_id = ?").get(job.id) as any;
  assert.ok(!a.after_json.includes('1234'), 'the code is never logged');
  assert.equal((await json(await call('PATCH', `/api/dispatch/jobs/${job.id}`, disp, { deliveryCode: '12' }))).code, 'INVALID_DELIVERY_CODE');
});

test('first-mile leg on a worldwide shipment: pick-up event only, no status change', async () => {
  const t = 'TXFM2345';
  db.prepare(`
    INSERT INTO shipments (tracking_number, barcode_code, status, status_text, progress_percent, last_updated, created_at,
      estimated_delivery_date, estimated_delivery_time, service, shipment_type, cargo_description, total_weight_lbs, total_pieces,
      origin_city, origin_state, origin_lat, origin_lng, destination_city, destination_state, destination_lat, destination_lng,
      current_location_city, current_location_state, current_location_lat, current_location_lng, current_facility,
      sender_json, recipient_json, dimensions_json, created_at_ts)
    VALUES (?, '*', 'IN_TRANSIT', 'In transit', 55, '', '', '', '', 'Express', 'Parcel', 'Box', 1, 1,
      'Buea', '', 0, 0, 'Paris', '', 0, 0, 'Buea', '', 0, 0, '', '{}', '{}', '{}', ?)
  `).run(t, Date.now());
  const job = await createJob({ scope: 'FIRST_MILE', trackingNumber: t, sizeClass: 'SMALL',
    pickup: place('z_mol', 'S', '+237 651 00 00 11'), dropoff: place('z_chk', 'TanEx office', '+237 651 00 00 12') });
  assert.equal(job.trackingNumber, t);
  await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' });
  await act(c1, job.id, 'accept');
  await act(c1, job.id, 'pick_up');
  const ship = shipment(t);
  assert.equal(ship.status, 'IN_TRANSIT');
  assert.equal(ship.progress_percent, 55);
  const ev = events(t);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title_key, 'event.local_picked_up');
});

test('device time is used for the step when plausible', async () => {
  const job = await createJob();
  await call('POST', `/api/dispatch/jobs/${job.id}/assign`, disp, { courierUserId: 'usr_c1' });
  const assignedAt = jobRow(job.id).assigned_at_ts as number;
  // Before the previous step: impossible, so the server time is used.
  const job2 = await createJob();
  await call('POST', `/api/dispatch/jobs/${job2.id}/assign`, disp, { courierUserId: 'usr_c1' });
  await act(c1, job2.id, 'accept', { deviceTs: assignedAt - 60_000 });
  assert.ok(jobRow(job2.id).accepted_at_ts >= jobRow(job2.id).assigned_at_ts);
  const t = Math.max(assignedAt, Date.now() - 1);
  await act(c1, job.id, 'accept', { deviceTs: t });
  assert.equal(jobRow(job.id).accepted_at_ts, t);
  await act(c1, job.id, 'pick_up', { deviceTs: Date.now() + 3_600_000 });
  assert.ok(jobRow(job.id).picked_up_at_ts <= Date.now(), 'future device time replaced by server time');
});

test('board: active jobs and couriers with their last position', async () => {
  const board = await json(await call('GET', '/api/dispatch/board', disp));
  assert.ok(board.data.jobs.length > 0);
  const ama = board.data.couriers.find((c: any) => c.userId === 'usr_c1');
  assert.ok(ama.lastPosition, 'last ping shown');
  assert.equal(ama.lastPosition.lat, 4.152);
  assert.ok(!JSON.stringify(board).includes('delivery_code_hash'));
});

test('location purge removes positions older than 30 days only', () => {
  const now = Date.now();
  const ins = db.prepare('INSERT INTO courier_locations (courier_user_id, job_id, lat, lng, recorded_at_ts) VALUES (?, NULL, 1, 1, ?)');
  ins.run('usr_c9', now - LOCATION_RETENTION_MS - 1000);
  ins.run('usr_c9', now - LOCATION_RETENTION_MS + 60_000);
  const removed = purgeOldLocations(db, now);
  assert.equal(removed, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM courier_locations WHERE courier_user_id = 'usr_c9'").get() as any).c, 1);
});

test('multipart reader: fields and files, boundary parsing, malformed bodies refused', () => {
  assert.equal(multipartBoundary('multipart/form-data; boundary=abc123'), 'abc123');
  assert.equal(multipartBoundary('multipart/form-data; boundary="q b"'), 'q b');
  assert.equal(multipartBoundary('application/json'), null);
  const bin = Buffer.from([0, 1, 2, 13, 10, 45, 45, 255]);
  const body = Buffer.concat([
    Buffer.from('--XX\r\nContent-Disposition: form-data; name="recipientName"\r\n\r\nRita\r\n'),
    Buffer.from('--XX\r\nContent-Disposition: form-data; name="photo"; filename="a.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'),
    bin,
    Buffer.from('\r\n--XX--\r\n'),
  ]);
  const parsed = parseMultipart(body, 'XX')!;
  assert.equal(parsed.fields.recipientName, 'Rita');
  assert.deepEqual([...parsed.files.photo.data], [...bin]);
  assert.equal(parseMultipart(Buffer.from('--XX\r\nno headers end'), 'XX'), null);
  assert.equal(parseMultipart(Buffer.from('--XX\r\nContent-Disposition: form-data; name="__proto__"\r\n\r\nx\r\n--XX--'), 'XX'), null);
});
