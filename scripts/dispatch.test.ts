// Dispatch data model, job state machine and local pricing (docs/DISPATCH_SPEC.md §3–§5, §12):
// every allowed and forbidden transition, the data each move requires, the mapping to shipment
// status/progress/events, rate fallbacks, express and intercity bands, local shipments never
// auto-advancing, the new tables (empty, no seeded prices) and TX-CSH references.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DISPATCH_STATUSES, DISPATCH_TRANSITIONS, DISPATCH_PROGRESS, DISPATCH_TIMESTAMP_COLUMN, DISPATCH_STATUS_LABELS,
  FAILURE_REASONS, FAILURE_REASON_LABELS, FINAL_DISPATCH_STATUSES, VEHICLE_LABELS,
  allowedActions, checkTransition, dispatchEventVars, findTransition, usesScheduleProgress,
  type DispatchAction, type DispatchActor, type DispatchStatus,
} from '../src/shared/dispatchStatus.ts';
import { EVENT_TITLES, eventTitleColumns, renderEventTitle } from '../src/shared/eventTitles.ts';
import { SHIPMENT_STATUS_OPTIONS } from '../src/shared/shipmentStatus.ts';
import {
  priceIntercityDelivery, priceLocalDelivery, roundMoney, zoneRateFromRow, intercityRateFromRow,
  type IntercityRate, type ZoneRate,
} from '../src/shared/localPricing.ts';
import { REFERENCE_PATTERN } from '../src/shared/references.ts';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-dispatch-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
delete process.env.NODE_ENV;

const { db, initDatabase } = await import('../server/db.ts');
const { syncTimeBasedProgress } = await import('../server/progress.ts');
const { allocateCashRef } = await import('../server/dispatch/cashRef.ts');

initDatabase();

// ---- State machine ----

// DISPATCH_SPEC §4, written out independently of the module: "from|action" -> [to, actor].
const EXPECTED: Record<string, [DispatchStatus, DispatchActor]> = {
  'null|request': ['REQUESTED', 'customer'],
  'null|create': ['CONFIRMED', 'dispatch'],
  'REQUESTED|confirm': ['CONFIRMED', 'dispatch'],
  'CONFIRMED|assign': ['ASSIGNED', 'dispatch'],
  'FAILED_ATTEMPT|assign': ['ASSIGNED', 'dispatch'],
  'ASSIGNED|reassign': ['ASSIGNED', 'dispatch'],
  'ACCEPTED|reassign': ['ASSIGNED', 'dispatch'],
  'ASSIGNED|accept': ['ACCEPTED', 'courier'],
  'ASSIGNED|decline': ['CONFIRMED', 'courier'],
  'ACCEPTED|pick_up': ['PICKED_UP', 'courier'],
  'PICKED_UP|start_delivery': ['ON_THE_WAY', 'courier'],
  'ON_THE_WAY|deliver': ['DELIVERED', 'courier'],
  'ON_THE_WAY|fail': ['FAILED_ATTEMPT', 'courier'],
  'FAILED_ATTEMPT|return': ['RETURNED', 'dispatch'],
  'REQUESTED|cancel': ['CANCELLED', 'dispatch'],
  'CONFIRMED|cancel': ['CANCELLED', 'dispatch'],
  'ASSIGNED|cancel': ['CANCELLED', 'dispatch'],
  'ACCEPTED|cancel': ['CANCELLED', 'dispatch'],
};

const ACTIONS = [...new Set(DISPATCH_TRANSITIONS.map((t) => t.action))] as DispatchAction[];
const FROMS: (DispatchStatus | null)[] = [null, ...DISPATCH_STATUSES];
const ACTORS: DispatchActor[] = ['customer', 'dispatch', 'courier'];

// Input that satisfies every requirement, so only the status/actor rules decide.
const FULL_INPUT = {
  actingUserId: 'u_rider', courierUserId: 'u_rider', podRecipientName: 'Ada Obi', podPhotoFile: 'pod.webp',
  failureReason: 'REFUSED', note: '',
};

test('every allowed transition, and only those, is accepted for its actor', () => {
  let allowed = 0;
  for (const from of FROMS) {
    for (const action of ACTIONS) {
      const expected = EXPECTED[`${from}|${action}`];
      for (const actor of ACTORS) {
        const res = checkTransition({ status: from, courierUserId: 'u_rider' }, action, actor, FULL_INPUT);
        const label = `${from} --${action}--> as ${actor}`;
        if (expected && expected[1] === actor) {
          assert.ok(res.ok, label);
          if (res.ok) assert.equal(res.transition.to, expected[0], label);
          allowed++;
        } else {
          assert.equal(res.ok, false, label);
          if (!res.ok) assert.equal(res.code, expected ? 'WRONG_ACTOR' : 'INVALID_TRANSITION', label);
        }
      }
    }
  }
  assert.equal(allowed, Object.keys(EXPECTED).length);
  assert.equal(DISPATCH_TRANSITIONS.flatMap((t) => t.from).length, Object.keys(EXPECTED).length);
});

test('final statuses have no way out; nothing moves backwards past pickup', () => {
  for (const s of FINAL_DISPATCH_STATUSES) {
    for (const actor of ACTORS) assert.deepEqual(allowedActions(s, actor), [], s);
  }
  for (const s of ['PICKED_UP', 'ON_THE_WAY'] as const) {
    assert.equal(findTransition(s, 'cancel'), undefined, s);
  }
  assert.equal(findTransition('FAILED_ATTEMPT', 'cancel'), undefined);
  assert.deepEqual(allowedActions('ASSIGNED', 'courier').sort(), ['accept', 'decline']);
  assert.deepEqual(allowedActions('ON_THE_WAY', 'courier').sort(), ['deliver', 'fail']);
  assert.deepEqual(allowedActions(null, 'customer'), ['request']);
});

test('unknown actions are rejected', () => {
  for (const bad of ['', 'DELIVER', 'teleport', null, 42]) {
    assert.deepEqual(checkTransition({ status: 'ON_THE_WAY' }, bad, 'courier', FULL_INPUT), { ok: false, code: 'UNKNOWN_ACTION' });
  }
});

test('a courier can act only on their own job', () => {
  const job = { status: 'ASSIGNED' as const, courierUserId: 'u_rider' };
  assert.equal(checkTransition(job, 'accept', 'courier', { actingUserId: 'u_rider' }).ok, true);
  for (const other of ['u_other', '', null, undefined]) {
    assert.deepEqual(checkTransition(job, 'accept', 'courier', { actingUserId: other }), { ok: false, code: 'NOT_YOUR_JOB' });
  }
  // An unassigned job belongs to no courier.
  assert.deepEqual(checkTransition({ status: 'ASSIGNED', courierUserId: null }, 'accept', 'courier', { actingUserId: 'u_rider' }),
    { ok: false, code: 'NOT_YOUR_JOB' });
});

test('assign needs a courier; delivered needs POD; a failed attempt needs a reason', () => {
  assert.deepEqual(checkTransition({ status: 'CONFIRMED' }, 'assign', 'dispatch', {}), { ok: false, code: 'COURIER_REQUIRED' });
  assert.deepEqual(checkTransition({ status: 'ACCEPTED' }, 'reassign', 'dispatch', { courierUserId: '  ' }), { ok: false, code: 'COURIER_REQUIRED' });

  const onTheWay = { status: 'ON_THE_WAY' as const, courierUserId: 'u_rider' };
  const me = { actingUserId: 'u_rider' };
  assert.deepEqual(checkTransition(onTheWay, 'deliver', 'courier', me), { ok: false, code: 'POD_REQUIRED' });
  assert.deepEqual(checkTransition(onTheWay, 'deliver', 'courier', { ...me, podRecipientName: 'Ada' }), { ok: false, code: 'POD_REQUIRED' });
  assert.deepEqual(checkTransition(onTheWay, 'deliver', 'courier', { ...me, podPhotoFile: 'p.webp' }), { ok: false, code: 'POD_REQUIRED' });
  assert.equal(checkTransition(onTheWay, 'deliver', 'courier', { ...me, podRecipientName: 'Ada', podPhotoFile: 'p.webp' }).ok, true);

  assert.deepEqual(checkTransition(onTheWay, 'fail', 'courier', me), { ok: false, code: 'REASON_REQUIRED' });
  assert.deepEqual(checkTransition(onTheWay, 'fail', 'courier', { ...me, failureReason: 'MOON' }), { ok: false, code: 'REASON_REQUIRED' });
  assert.deepEqual(checkTransition(onTheWay, 'fail', 'courier', { ...me, failureReason: 'OTHER' }), { ok: false, code: 'NOTE_REQUIRED' });
  assert.equal(checkTransition(onTheWay, 'fail', 'courier', { ...me, failureReason: 'OTHER', note: 'Gate locked' }).ok, true);
  for (const r of FAILURE_REASONS.filter((x) => x !== 'OTHER')) {
    assert.equal(checkTransition(onTheWay, 'fail', 'courier', { ...me, failureReason: r }).ok, true, r);
  }
});

test('each move maps to a real shipment status, event title, progress and timestamp column', () => {
  const shipmentCodes = new Set(SHIPMENT_STATUS_OPTIONS.map((s) => s.value));
  const jobColumns = new Set((db.prepare('PRAGMA table_info(dispatch_jobs)').all() as any[]).map((c) => c.name));
  for (const t of DISPATCH_TRANSITIONS) {
    if (t.shipmentStatus) assert.ok(shipmentCodes.has(t.shipmentStatus), `${t.action}: ${t.shipmentStatus}`);
    if (t.eventKey) assert.ok(t.eventKey in EVENT_TITLES, `${t.action}: ${t.eventKey}`);
  }
  for (const col of Object.values(DISPATCH_TIMESTAMP_COLUMN)) assert.ok(jobColumns.has(col!), col);

  // DISPATCH_SPEC §4 table.
  const map = (a: DispatchAction) => DISPATCH_TRANSITIONS.find((t) => t.action === a)!;
  assert.equal(map('request').shipmentStatus, 'BOOKED');
  assert.equal(map('pick_up').shipmentStatus, 'RECEIVED');
  assert.equal(map('start_delivery').shipmentStatus, 'OUT_FOR_DELIVERY');
  assert.equal(map('deliver').shipmentStatus, 'DELIVERED');
  assert.equal(map('fail').shipmentStatus, 'DELAYED');
  assert.equal(map('return').shipmentStatus, 'RETURNED');
  assert.equal(map('cancel').shipmentStatus, null);
  for (const a of ['accept', 'decline'] as const) {
    assert.equal(map(a).eventKey, null, a);
    assert.equal(map(a).shipmentStatus, null, a);
  }

  // Progress 0/20/40/60/100 along the happy path, never decreasing.
  const path: DispatchStatus[] = ['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
  const values = path.map((s) => DISPATCH_PROGRESS[s]);
  assert.deepEqual(values, [0, 0, 20, 20, 40, 60, 100]);
});

test('event titles: EN and FR, masked recipient, failure reason in the page language', () => {
  const t = (a: DispatchAction) => DISPATCH_TRANSITIONS.find((x) => x.action === a)!;
  const picked = eventTitleColumns(t('pick_up').eventKey!, dispatchEventVars(t('pick_up'), { riderFirstName: ' Junior ' }));
  assert.equal(picked.title, 'Picked up by Junior');
  assert.equal(renderEventTitle('event.local_picked_up', { rider: 'Junior' }, 'fr'), 'Récupéré par Junior');

  const delivered = dispatchEventVars(t('deliver'), { maskedRecipientName: 'A** O**' });
  assert.equal(renderEventTitle('event.local_delivered', delivered), 'Delivered, received by A** O**');

  const failed = eventTitleColumns('event.local_failed', dispatchEventVars(t('fail'), { failureReason: 'RECIPIENT_ABSENT' }));
  assert.equal(failed.title, 'Delivery attempt unsuccessful: Recipient not available');
  assert.equal(failed.titleVarsJson, '{"failureReason":"RECIPIENT_ABSENT"}');
  assert.equal(renderEventTitle('event.local_failed', { failureReason: 'RECIPIENT_ABSENT' }, 'fr'),
    'Tentative de livraison infructueuse : Destinataire absent');
  assert.deepEqual(dispatchEventVars(t('assign'), { riderFirstName: 'x' }), {});
});

test('labels exist in both languages and differ', () => {
  for (const s of DISPATCH_STATUSES) {
    assert.ok(DISPATCH_STATUS_LABELS[s].en && DISPATCH_STATUS_LABELS[s].fr, s);
    assert.notEqual(DISPATCH_STATUS_LABELS[s].en, DISPATCH_STATUS_LABELS[s].fr, s);
  }
  for (const r of FAILURE_REASONS) assert.notEqual(FAILURE_REASON_LABELS[r].en, FAILURE_REASON_LABELS[r].fr, r);
  for (const v of Object.values(VEHICLE_LABELS)) assert.notEqual(v.en, v.fr);
});

// ---- Pricing ----

const rate = (id: string, from: string | null, to: string | null, size: string, price: number, express: number | null = null, city = 'buea'): ZoneRate =>
  ({ id, cityId: city, fromZoneId: from, toZoneId: to, sizeClass: size, price, currency: 'XAF', expressSurcharge: express });

// Test-only figures; none of these are TanEx prices.
const RATES: ZoneRate[] = [
  rate('exact', 'molyko', 'bonduma', 'SMALL', 101, 11),
  rate('from', 'molyko', null, 'SMALL', 202, null),
  rate('to', null, 'bonduma', 'SMALL', 303, 33),
  rate('any', null, null, 'SMALL', 404, 44),
  rate('other-city', null, null, 'SMALL', 999, 99, 'limbe'),
  rate('bad', null, null, 'MEDIUM', Number.NaN),
];

test('local price: most specific rate wins, falling back to "any other zone"', () => {
  const q = (from: string | null, to: string | null, extra: object = {}) =>
    priceLocalDelivery({ cityId: 'buea', fromZoneId: from, toZoneId: to, sizeClass: 'SMALL', ...extra }, RATES);
  assert.deepEqual(q('molyko', 'bonduma'), { ok: true, price: 101, currency: 'XAF', basePrice: 101, expressSurcharge: 0, rateId: 'exact', match: 'EXACT' });
  assert.equal((q('molyko', 'gra') as any).rateId, 'from');
  assert.equal((q('gra', 'bonduma') as any).rateId, 'to');
  assert.equal((q('gra', 'mile16') as any).rateId, 'any');
  assert.equal((q(null, null) as any).rateId, 'any');
  // Directional: the reverse pair isn't the exact rate.
  assert.equal((q('bonduma', 'molyko') as any).rateId, 'any');
  // Other cities' rates never apply.
  assert.equal((priceLocalDelivery({ cityId: 'limbe', fromZoneId: 'x', toZoneId: 'y', sizeClass: 'SMALL' }, RATES) as any).rateId, 'other-city');
});

test('local price: express, no rate, invalid input', () => {
  const base = { cityId: 'buea', sizeClass: 'SMALL', express: true };
  assert.deepEqual(priceLocalDelivery({ ...base, fromZoneId: 'molyko', toZoneId: 'bonduma' }, RATES),
    { ok: true, price: 112, currency: 'XAF', basePrice: 101, expressSurcharge: 11, rateId: 'exact', match: 'EXACT' });
  // The matched rate has no express surcharge: no automatic price (no fall-through to a cheaper rate).
  assert.deepEqual(priceLocalDelivery({ ...base, fromZoneId: 'molyko', toZoneId: 'gra' }, RATES), { ok: false, reason: 'NO_EXPRESS_RATE' });

  assert.deepEqual(priceLocalDelivery({ cityId: 'buea', fromZoneId: 'a', toZoneId: 'b', sizeClass: 'LARGE' }, RATES), { ok: false, reason: 'NO_RATE' });
  assert.deepEqual(priceLocalDelivery({ cityId: 'buea', fromZoneId: 'a', toZoneId: 'b', sizeClass: 'MEDIUM' }, RATES), { ok: false, reason: 'NO_RATE' });
  assert.deepEqual(priceLocalDelivery({ cityId: 'douala', fromZoneId: 'a', toZoneId: 'b', sizeClass: 'SMALL' }, RATES), { ok: false, reason: 'NO_RATE' });
  assert.deepEqual(priceLocalDelivery({ cityId: 'buea', fromZoneId: 'a', toZoneId: 'b', sizeClass: 'HUGE' }, RATES), { ok: false, reason: 'INVALID_REQUEST' });
  assert.deepEqual(priceLocalDelivery({ cityId: '', fromZoneId: 'a', toZoneId: 'b', sizeClass: 'SMALL' }, RATES), { ok: false, reason: 'INVALID_REQUEST' });
  assert.deepEqual(priceLocalDelivery({ cityId: 'buea', fromZoneId: 'a', toZoneId: 'b', sizeClass: 'SMALL' }, []), { ok: false, reason: 'NO_RATE' });
});

test('intercity price: smallest weight band that fits, directional, nothing over the top band', () => {
  const band = (id: string, max: number, price: number, from = 'buea', to = 'douala'): IntercityRate =>
    ({ id, fromCityId: from, toCityId: to, maxWeightKg: max, price, currency: 'XAF' });
  const rates = [band('b20', 20, 2), band('b5', 5, 1), band('b100', 100, 3), band('rev', 50, 9, 'douala', 'buea')];
  const q = (kg: number, from = 'buea', to = 'douala') => priceIntercityDelivery({ fromCityId: from, toCityId: to, weightKg: kg }, rates);
  assert.equal((q(0.5) as any).rateId, 'b5');
  assert.equal((q(5) as any).rateId, 'b5');
  assert.equal((q(5.1) as any).rateId, 'b20');
  assert.equal((q(100) as any).rateId, 'b100');
  assert.deepEqual(q(100.5), { ok: false, reason: 'NO_RATE' });
  assert.equal((q(10, 'douala', 'buea') as any).rateId, 'rev');
  assert.deepEqual(q(10, 'buea', 'limbe'), { ok: false, reason: 'NO_RATE' });
  for (const bad of [0, -1, Number.NaN]) assert.deepEqual(q(bad), { ok: false, reason: 'INVALID_REQUEST' });
  assert.deepEqual(q(10, 'buea', 'buea'), { ok: false, reason: 'INVALID_REQUEST' });
});

test('money: XAF has no decimals; rows map from the database shape', () => {
  assert.equal(roundMoney(1499.6, 'XAF'), 1500);
  assert.equal(roundMoney(10.005, 'EUR'), 10.01);
  assert.deepEqual(zoneRateFromRow({ id: 'r', city_id: 'c', from_zone_id: null, to_zone_id: 'z', size_class: 'SMALL', price: 5, currency: 'XAF', express_surcharge: null }),
    { id: 'r', cityId: 'c', fromZoneId: null, toZoneId: 'z', sizeClass: 'SMALL', price: 5, currency: 'XAF', expressSurcharge: null });
  assert.deepEqual(intercityRateFromRow({ id: 'i', from_city_id: 'a', to_city_id: 'b', max_weight_kg: 5, price: 7, currency: 'XAF' }),
    { id: 'i', fromCityId: 'a', toCityId: 'b', maxWeightKg: 5, price: 7, currency: 'XAF' });
});

// ---- Database ----

test('dispatch tables exist and start empty (no seeded prices or demo data)', () => {
  initDatabase(); // idempotent
  for (const table of ['couriers', 'delivery_cities', 'delivery_zones', 'zone_rates', 'intercity_rates', 'dispatch_jobs', 'courier_locations', 'cash_ledger']) {
    assert.equal((db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as any).c, 0, table);
  }
  const shipmentCols = (db.prepare('PRAGMA table_info(shipments)').all() as any[]).map((c) => c.name);
  assert.ok(shipmentCols.includes('service_scope'));
});

function insertShipment(tracking: string, scope: string | null, progressUpdatedAt: number) {
  db.prepare(`
    INSERT INTO shipments (
      tracking_number, barcode_code, status, status_text, progress_percent, last_updated, created_at,
      estimated_delivery_date, estimated_delivery_time, service, shipment_type, cargo_description,
      total_weight_lbs, total_pieces, origin_city, origin_state, origin_lat, origin_lng,
      destination_city, destination_state, destination_lat, destination_lng,
      current_location_city, current_location_state, current_location_lat, current_location_lng,
      current_facility, sender_json, recipient_json, dimensions_json,
      progress_updated_at_ts, created_at_ts, service_scope
    ) VALUES (?, ?, 'RECEIVED', 'Collected', 0, '', '', '', '', 'Standard', 'Parcel', 'Parcel',
      1, 1, 'Buea', 'SW', 4.1527, 9.2410, 'Douala', 'LT', 4.0511, 9.7679,
      'Buea', 'SW', 4.1527, 9.2410, '', '{}', '{}', '{}', ?, ?, ?)
  `).run(tracking, tracking, progressUpdatedAt, progressUpdatedAt, scope);
}

test('local and intercity shipments never auto-advance; international ones still do', () => {
  const longAgo = Date.now() - 48 * 3600_000;
  insertShipment('TXLOCAL1', 'LOCAL', longAgo);
  insertShipment('TXINTER1', 'INTERCITY', longAgo);
  insertShipment('TXINTL01', 'INTERNATIONAL', longAgo);
  insertShipment('TXOLDROW', null, longAgo);

  for (const id of ['TXLOCAL1', 'TXINTER1']) {
    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(id) as any;
    assert.equal(syncTimeBasedProgress(row), 0, id);
    const after = db.prepare('SELECT status, progress_percent, progress_updated_at_ts FROM shipments WHERE tracking_number = ?').get(id) as any;
    assert.deepEqual({ ...after }, { status: 'RECEIVED', progress_percent: 0, progress_updated_at_ts: longAgo }, id);
    assert.equal((db.prepare('SELECT COUNT(*) AS c FROM tracking_events WHERE shipment_tracking = ?').get(id) as any).c, 0, id);
  }
  for (const id of ['TXINTL01', 'TXOLDROW']) {
    const row = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(id) as any;
    assert.ok(syncTimeBasedProgress(row) > 0, id);
    assert.equal((db.prepare('SELECT status FROM shipments WHERE tracking_number = ?').get(id) as any).status, 'IN_TRANSIT', id);
  }

  assert.equal(usesScheduleProgress(null), true);
  assert.equal(usesScheduleProgress('INTERNATIONAL'), true);
  assert.equal(usesScheduleProgress('local'), false);
  assert.equal(usesScheduleProgress(' INTERCITY '), false);
});

test('cash ledger references are TX-CSH + 6 digits and never reused', () => {
  const ref = allocateCashRef(db);
  assert.match(ref, REFERENCE_PATTERN);
  assert.ok(ref.startsWith('TX-CSH-'));

  db.prepare(`INSERT INTO cash_ledger (id, ref, courier_user_id, entry_type, method, amount, status, recorded_by, created_at_ts)
    VALUES ('c1', 'TX-CSH-000001', 'u', 'COLLECTED', 'CASH', 1, 'PENDING', 'u', 1)`).run();
  const seq = ['TX-CSH-000001', 'TX-CSH-000001', 'TX-CSH-000002'];
  assert.equal(allocateCashRef(db, () => seq.shift()!), 'TX-CSH-000002');
  assert.throws(() => allocateCashRef(db, () => 'TX-CSH-000001'));
  assert.throws(() => db.prepare(`INSERT INTO cash_ledger (id, ref, courier_user_id, entry_type, method, amount, status, recorded_by, created_at_ts)
    VALUES ('c2', 'TX-CSH-000001', 'u', 'COLLECTED', 'CASH', 1, 'PENDING', 'u', 1)`).run());
});
