// Tariffs and couriers admin API (docs/DISPATCH_SPEC.md §3, §5, §11; tracker G.2): permissions,
// cities and areas, the suggested-areas import (names only, no prices), the rate sheet per size,
// intercity bands, average speeds, courier accounts created in one step with a temporary
// password, the couriers.manage grant rule, private photos, and an audit row for every write.
// Runs against the real /api mounts on a file database in a temp folder. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-tariffs-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');
const { SUGGESTED_AREAS } = await import('../src/shared/suggestedAreas.ts');
const { DEFAULT_DISPATCH_SETTINGS, readDispatchSettings } = await import('../src/shared/dispatchSettings.ts');
const { priceLocalDelivery, priceIntercityDelivery, zoneRateFromRow, intercityRateFromRow } = await import('../src/shared/localPricing.ts');

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

// A tariff editor: tariffs.manage only.
const now0 = Date.now();
db.prepare(`INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts) VALUES ('role_tariffs', 'Tariffs', '', 0, 0, ?, ?)`).run(now0, now0);
db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)').run('role_tariffs', 'tariffs.manage');

addUser('usr_sa', 'sa@example.test', [SUPER_ADMIN_ROLE_ID], 'Owner');
addUser('usr_tar', 'tar@example.test', ['role_tariffs'], 'Tariff Editor');
addUser('usr_ops', 'ops@example.test', ['role_operations_manager'], 'Ops Manager');
addUser('usr_disp', 'disp@example.test', ['role_dispatch_manager'], 'Dispatcher');
addUser('usr_fin', 'fin@example.test', ['role_finance'], 'Finance Person');

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

async function signIn(identifier: string, password = PASSWORD): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier, password });
  assert.equal(res.status, 200, `sign-in as ${identifier}`);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}

const sa = await signIn('sa@example.test');
const tar = await signIn('tar@example.test');
const ops = await signIn('ops@example.test');
const disp = await signIn('disp@example.test');
const fin = await signIn('fin@example.test');

const auditCount = (action: string) => (db.prepare('SELECT COUNT(*) AS c FROM audit_log WHERE action = ?').get(action) as { c: number }).c;
const lastAudit = (action: string) =>
  db.prepare('SELECT * FROM audit_log WHERE action = ? ORDER BY at_ts DESC, rowid DESC LIMIT 1').get(action) as any;

// 1×1 PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('tariff routes: 401 signed out, 403 without tariffs.manage; areas list is public', async () => {
  const probes: [string, string, unknown?][] = [
    ['GET', '/api/tariffs'],
    ['POST', '/api/tariffs/cities', { name: 'X' }],
    ['PATCH', '/api/tariffs/cities/x', { name: 'Y' }],
    ['DELETE', '/api/tariffs/cities/x'],
    ['POST', '/api/tariffs/cities/x/zones', { name: 'Z' }],
    ['PUT', '/api/tariffs/cities/x/zone-order', { zoneIds: [] }],
    ['PATCH', '/api/tariffs/zones/x', { name: 'Z' }],
    ['DELETE', '/api/tariffs/zones/x'],
    ['POST', '/api/tariffs/import-suggested', {}],
    ['PUT', '/api/tariffs/cities/x/rates', { sizeClass: 'SMALL', rates: [] }],
    ['PUT', '/api/tariffs/intercity', { bands: [] }],
    ['PUT', '/api/tariffs/settings', { avgSpeedKmh: { BIKE: 10, VAN: 10, TRUCK: 10 } }],
  ];
  for (const [m, p, b] of probes) {
    assert.equal((await call(m, p, undefined, b)).status, 401, `anonymous ${m} ${p}`);
    // Operations Manager and Dispatch Manager don't hold tariffs.manage by default.
    for (const [who, cookie] of [['ops', ops], ['dispatch', disp], ['finance', fin]] as const) {
      assert.equal((await call(m, p, cookie, b)).status, 403, `${who} ${m} ${p}`);
    }
  }
  const pub = await call('GET', '/api/tariffs/areas');
  assert.equal(pub.status, 200);
  assert.deepEqual((await pub.json()).data, [], 'no cities seeded');
});

let buea = '';
let limbe = '';

test('cities: create, duplicate names refused, rename, pin validation, audited', async () => {
  const res = await call('POST', '/api/tariffs/cities', tar, { name: '  Buea ' });
  assert.equal(res.status, 201);
  const data = (await res.json()).data;
  buea = data.cities.find((c: any) => c.name === 'Buea').id;
  assert.ok(buea.startsWith('city_'));
  assert.equal(lastAudit('tariffs.city_create').entity_id, buea);

  assert.equal((await call('POST', '/api/tariffs/cities', tar, { name: 'buea' })).status, 409);
  assert.equal((await call('POST', '/api/tariffs/cities', tar, { name: '' })).status, 400);
  assert.equal((await call('POST', '/api/tariffs/cities', tar, { name: 'Kumba', lat: 95, lng: 9 })).status, 400);
  assert.equal((await call('POST', '/api/tariffs/cities', tar, { name: 'Kumba', lat: 4.6 })).status, 400, 'pin needs both');

  const lim = await call('POST', '/api/tariffs/cities', tar, { name: 'Limbe', lat: 4.0, lng: 9.2 });
  limbe = (await lim.json()).data.cities.find((c: any) => c.name === 'Limbe').id;

  const patched = await call('PATCH', `/api/tariffs/cities/${limbe}`, tar, { lat: null, lng: null });
  const city = (await patched.json()).data.cities.find((c: any) => c.id === limbe);
  assert.equal(city.lat, null);
  const entry = lastAudit('tariffs.city_update');
  assert.deepEqual(JSON.parse(entry.after_json), { lat: null, lng: null });

  const before = auditCount('tariffs.city_update');
  await call('PATCH', `/api/tariffs/cities/${limbe}`, tar, { name: 'Limbe' });
  assert.equal(auditCount('tariffs.city_update'), before, 'no change, no audit row');
});

test('suggested import: names only, no prices or pins, idempotent', async () => {
  // An area already present is not duplicated.
  await call('POST', `/api/tariffs/cities/${buea}/zones`, tar, { name: 'molyko', aliases: 'UB Junction, ub junction, Mile 17 side' });
  const res = await call('POST', '/api/tariffs/import-suggested', tar, {});
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  const total = SUGGESTED_AREAS.reduce((n, c) => n + c.areas.length, 0);
  assert.equal(data.imported.cities, 1, 'only Douala was missing');
  assert.equal(data.imported.areas, total - 1, 'Molyko already existed');
  assert.equal(data.rates.length, 0);
  assert.equal(data.intercity.length, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM zone_rates').get() as any).c, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM delivery_zones WHERE lat IS NOT NULL').get() as any).c, 0);
  const molyko = data.zones.find((z: any) => z.cityId === buea && z.name === 'molyko');
  assert.equal(molyko.aliases, 'UB Junction, Mile 17 side', 'aliases de-duplicated');
  assert.equal(lastAudit('tariffs.import_suggested').entity_type, 'delivery_city');

  const again = await (await call('POST', '/api/tariffs/import-suggested', tar, { cities: ['Buea'] })).json();
  assert.deepEqual(again.data.imported, { cities: 0, areas: 0 });
  assert.equal((await call('POST', '/api/tariffs/import-suggested', tar, { cities: ['Paris'] })).status, 400);
});

test('areas: duplicate names, rename, reorder, turn off; public list shows active only', async () => {
  const state = (await (await call('GET', '/api/tariffs', tar)).json()).data;
  const zones = state.zones.filter((z: any) => z.cityId === buea);
  assert.equal((await call('POST', `/api/tariffs/cities/${buea}/zones`, tar, { name: 'Bonduma' })).status, 409);
  const bonduma = zones.find((z: any) => z.name === 'Bonduma');
  const reversed = [...zones].reverse().map((z: any) => z.id);
  const res = await call('PUT', `/api/tariffs/cities/${buea}/zone-order`, tar, { zoneIds: reversed });
  assert.equal(res.status, 200);
  const after1 = (await res.json()).data.zones.filter((z: any) => z.cityId === buea).map((z: any) => z.id);
  assert.deepEqual(after1, reversed);
  assert.equal((await call('PUT', `/api/tariffs/cities/${buea}/zone-order`, tar, { zoneIds: reversed.slice(1) })).status, 400);
  assert.ok(lastAudit('tariffs.zone_reorder'));

  await call('PATCH', `/api/tariffs/zones/${bonduma.id}`, tar, { isActive: false, lat: 4.15, lng: 9.29 });
  const pub = (await (await call('GET', '/api/tariffs/areas')).json()).data;
  const pubBuea = pub.find((c: any) => c.id === buea);
  assert.ok(!pubBuea.zones.some((z: any) => z.id === bonduma.id), 'inactive area hidden from the public');
  assert.ok(!('price' in pubBuea), 'no prices on the public list');
  await call('PATCH', `/api/tariffs/zones/${bonduma.id}`, tar, { isActive: true });
});

test('rate sheet: replace per city and size, validation, fallbacks priced by the shared function', async () => {
  const zones = (await (await call('GET', '/api/tariffs', tar)).json()).data.zones.filter((z: any) => z.cityId === buea);
  const molyko = zones.find((z: any) => z.name === 'molyko').id;
  const bonduma = zones.find((z: any) => z.name === 'Bonduma').id;
  const limbeZone = (await (await call('GET', '/api/tariffs', tar)).json()).data.zones.find((z: any) => z.cityId === limbe).id;

  const bad = [
    { sizeClass: 'HUGE', rates: [] },
    { sizeClass: 'SMALL', rates: [{ fromZoneId: limbeZone, toZoneId: null, price: 500 }] },
    { sizeClass: 'SMALL', rates: [{ fromZoneId: null, toZoneId: null, price: -1 }] },
    { sizeClass: 'SMALL', rates: [{ fromZoneId: null, toZoneId: null, price: 500 }, { fromZoneId: null, toZoneId: null, price: 600 }] },
    { sizeClass: 'SMALL', currency: 'francs', rates: [] },
  ];
  for (const b of bad) assert.equal((await call('PUT', `/api/tariffs/cities/${buea}/rates`, tar, b)).status, 400, JSON.stringify(b));

  const res = await call('PUT', `/api/tariffs/cities/${buea}/rates`, tar, {
    sizeClass: 'SMALL', currency: 'xaf',
    rates: [
      { fromZoneId: null, toZoneId: null, price: 1000.4, expressSurcharge: 500 },
      { fromZoneId: molyko, toZoneId: bonduma, price: 700, expressSurcharge: null },
    ],
  });
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  const small = data.rates.filter((r: any) => r.cityId === buea && r.sizeClass === 'SMALL');
  assert.equal(small.length, 2);
  assert.ok(small.every((r: any) => r.currency === 'XAF'));
  assert.ok(small.some((r: any) => r.price === 1000), 'XAF rounded to whole francs');
  const entry = lastAudit('tariffs.rates_update');
  assert.equal(entry.entity_id, buea);
  assert.deepEqual(Object.keys(JSON.parse(entry.after_json)).sort(), ['Any other area → Any other area', 'molyko → Bonduma']);

  // The stored rows feed the shared price function the booking form will use.
  const rows = (db.prepare('SELECT * FROM zone_rates').all() as any[]).map(zoneRateFromRow);
  const exact = priceLocalDelivery({ cityId: buea, fromZoneId: molyko, toZoneId: bonduma, sizeClass: 'SMALL' }, rows);
  assert.ok(exact.ok && exact.price === 700);
  const reverse = priceLocalDelivery({ cityId: buea, fromZoneId: bonduma, toZoneId: molyko, sizeClass: 'SMALL', express: true }, rows);
  assert.ok(reverse.ok && reverse.price === 1500, 'falls back to the city default with its express surcharge');
  assert.equal(priceLocalDelivery({ cityId: buea, fromZoneId: molyko, toZoneId: bonduma, sizeClass: 'SMALL', express: true }, rows).ok, false);

  // Another size is a separate sheet; saving the same sheet again writes no audit row.
  await call('PUT', `/api/tariffs/cities/${buea}/rates`, tar, { sizeClass: 'MEDIUM', rates: [{ fromZoneId: null, toZoneId: null, price: 1500 }] });
  const n = auditCount('tariffs.rates_update');
  await call('PUT', `/api/tariffs/cities/${buea}/rates`, tar, { sizeClass: 'MEDIUM', rates: [{ fromZoneId: null, toZoneId: null, price: 1500 }] });
  assert.equal(auditCount('tariffs.rates_update'), n);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM zone_rates WHERE size_class = 'SMALL'").get() as any).c, 2, 'SMALL untouched');

  // An area with rates can't be deleted (turn it off instead); a city with areas can't either.
  assert.equal((await call('DELETE', `/api/tariffs/zones/${bonduma}`, tar)).status, 409);
  assert.equal((await call('DELETE', `/api/tariffs/cities/${buea}`, tar)).status, 409);
  const spare = zones.find((z: any) => z.name === 'GRA').id;
  assert.equal((await call('DELETE', `/api/tariffs/zones/${spare}`, tar)).status, 200);
  assert.equal(lastAudit('tariffs.zone_delete').entity_id, spare);
});

test('rate sheet editing: "same price both ways" fills the return trip; directional pricing unchanged', async () => {
  const { cellKey, mirrorKey, setCellValue, isSymmetricSheet } = await import('../src/admin/dispatch/rateSheet.ts');
  const ab = cellKey('a', 'b');
  assert.equal(mirrorKey(ab), cellKey('b', 'a'));
  assert.equal(mirrorKey(cellKey('a', null)), cellKey(null, 'a'), 'area → any mirrors to any → area');
  let cells = setCellValue({}, ab, 'price', '700', true);
  cells = setCellValue(cells, ab, 'express', '200', true);
  assert.deepEqual(cells[cellKey('b', 'a')], { price: '700', express: '200' });
  assert.equal(isSymmetricSheet(cells), true);
  const oneWay = setCellValue(cells, ab, 'price', '900', false);
  assert.equal(oneWay[cellKey('b', 'a')].price, '700');
  assert.equal(isSymmetricSheet(oneWay), false, 'a one-way sheet opens with two-way off');
  assert.equal(isSymmetricSheet({ [cellKey('a', 'a')]: { price: '500', express: '' } }), true, 'diagonal cell is its own return');
  assert.equal(isSymmetricSheet({ [ab]: { price: '1 000', express: '' }, [cellKey('b', 'a')]: { price: '1000', express: '' } }), true);
});

test('intercity bands: per direction, validation, priced by the shared function', async () => {
  const bad = [
    { fromCityId: buea, toCityId: buea, bands: [] },
    { fromCityId: buea, toCityId: 'nope', bands: [] },
    { fromCityId: buea, toCityId: limbe, bands: [{ maxWeightKg: 0, price: 100 }] },
    { fromCityId: buea, toCityId: limbe, bands: [{ maxWeightKg: 5, price: 100 }, { maxWeightKg: 5, price: 200 }] },
  ];
  for (const b of bad) assert.equal((await call('PUT', '/api/tariffs/intercity', tar, b)).status, 400, JSON.stringify(b));
  const res = await call('PUT', '/api/tariffs/intercity', tar, {
    fromCityId: buea, toCityId: limbe, bands: [{ maxWeightKg: 20, price: 5000 }, { maxWeightKg: 5, price: 2000 }],
  });
  assert.equal(res.status, 200);
  const rows = (db.prepare('SELECT * FROM intercity_rates').all() as any[]).map(intercityRateFromRow);
  assert.equal(rows.length, 2);
  const p = priceIntercityDelivery({ fromCityId: buea, toCityId: limbe, weightKg: 4 }, rows);
  assert.ok(p.ok && p.price === 2000);
  assert.equal(priceIntercityDelivery({ fromCityId: limbe, toCityId: buea, weightKg: 4 }, rows).ok, false, 'one direction only');
  assert.ok(lastAudit('tariffs.intercity_update'));
  // An empty list removes that direction.
  await call('PUT', '/api/tariffs/intercity', tar, { fromCityId: buea, toCityId: limbe, bands: [] });
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM intercity_rates').get() as any).c, 0);
});

test('average speeds: defaults from the spec, validated, audited', async () => {
  assert.deepEqual(readDispatchSettings(null), DEFAULT_DISPATCH_SETTINGS);
  assert.deepEqual(readDispatchSettings({ avgSpeedKmh: { BIKE: 'fast', VAN: 25 } }).avgSpeedKmh, { BIKE: 18, VAN: 25, TRUCK: 30 });
  const state = (await (await call('GET', '/api/tariffs', tar)).json()).data;
  assert.deepEqual(state.settings, DEFAULT_DISPATCH_SETTINGS);
  assert.equal((await call('PUT', '/api/tariffs/settings', tar, { avgSpeedKmh: { BIKE: 0, VAN: 30, TRUCK: 30 } })).status, 400);
  const res = await call('PUT', '/api/tariffs/settings', tar, { avgSpeedKmh: { BIKE: 15, VAN: 30, TRUCK: 25 } });
  assert.deepEqual((await res.json()).data.settings.avgSpeedKmh, { BIKE: 15, VAN: 30, TRUCK: 25 });
  const entry = lastAudit('tariffs.settings_update');
  assert.deepEqual(JSON.parse(entry.after_json), { avgSpeedKmh: { BIKE: 15, TRUCK: 25 } });
});

let courierId = '';

test('courier routes: 401 signed out; view vs manage', async () => {
  const probes: [string, string, unknown?][] = [
    ['GET', '/api/couriers'],
    ['GET', '/api/couriers/x/photo'],
    ['POST', '/api/couriers', { displayName: 'X' }],
    ['PATCH', '/api/couriers/x', { notes: 'x' }],
    ['POST', '/api/couriers/x/photo', { image: PNG }],
    ['DELETE', '/api/couriers/x/photo'],
    ['POST', '/api/couriers/x/reset-password', {}],
  ];
  for (const [m, p, b] of probes) {
    assert.equal((await call(m, p, undefined, b)).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await call(m, p, fin, b)).status, 403, `finance ${m} ${p}`);
  }
  assert.equal((await call('GET', '/api/couriers', disp)).status, 200, 'couriers.view can list');
  assert.equal((await call('POST', '/api/couriers', disp, { displayName: 'X' })).status, 403, 'couriers.view cannot create');
});

test('create courier: user + profile + Courier role in one step, temporary password once, audited', async () => {
  const missing = await call('POST', '/api/couriers', ops, { displayName: 'Ade Rider', vehicleType: 'BIKE', publicFirstName: 'Ade' });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, 'PHONE_REQUIRED');
  assert.equal((await call('POST', '/api/couriers', ops, { displayName: 'Ade', phone: '670000101', vehicleType: 'CAR', publicFirstName: 'Ade' })).status, 400);
  assert.equal((await call('POST', '/api/couriers', ops, { displayName: 'Ade', phone: '670000101', vehicleType: 'BIKE', publicFirstName: 'Ade', homeCityId: 'nope' })).status, 400);
  assert.equal((await call('POST', '/api/couriers', ops, { displayName: 'Ade', phone: '670000101', vehicleType: 'BIKE', publicFirstName: 'Ade', photo: 'data:image/png;base64,AAAA' })).status, 400);

  // Operations Manager holds couriers.manage but not courier.app, and may still create couriers.
  const res = await call('POST', '/api/couriers', ops, {
    displayName: '  Ade   Rider ', phone: '670 00 01 01', email: '', locale: 'fr', vehicleType: 'BIKE', plateNumber: ' lt 123 ab ',
    homeCityId: buea, publicFirstName: 'Ade', showPhotoPublicly: true, photo: PNG, notes: 'Knows Molyko well',
  });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { data } = await res.json();
  courierId = data.courier.userId;
  assert.match(data.tempPassword, /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
  assert.equal(data.user.displayName, 'Ade Rider');
  assert.equal(data.user.phone, '+237670000101');
  assert.equal(data.user.email, null);
  assert.equal(data.user.locale, 'fr');
  assert.equal(data.user.mustChangePassword, true);
  assert.deepEqual(data.user.roles.map((r: any) => r.id), ['role_courier']);
  assert.equal(data.courier.plateNumber, 'LT 123 AB');
  assert.equal(data.courier.homeCityName, 'Buea');
  assert.equal(data.courier.showPhotoPublicly, true);
  assert.equal(data.courier.isOnDuty, false);
  assert.ok(data.courier.photoUrl.startsWith(`/api/couriers/${courierId}/photo?v=`));

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(courierId) as any;
  assert.ok(bcrypt.compareSync(data.tempPassword, row.password_hash));
  const entry = lastAudit('courier.create');
  assert.equal(entry.entity_id, courierId);
  assert.ok(!entry.after_json.includes(data.tempPassword), 'no password in the audit log');
  assert.deepEqual(JSON.parse(entry.after_json).roles, ['Courier']);

  // The courier signs in with the phone number and the temporary password.
  const login = await call('POST', '/api/auth/login', undefined, { identifier: '670000101', password: data.tempPassword });
  assert.equal(login.status, 200);

  // Same phone twice is refused.
  const dup = await call('POST', '/api/couriers', ops, { displayName: 'Other', phone: '+237670000101', vehicleType: 'VAN', publicFirstName: 'O' });
  assert.equal(dup.status, 409);
});

test('courier photo is private: console route only, never under /media', async () => {
  const list = (await (await call('GET', '/api/couriers', disp)).json()).data;
  const c = list.find((x: any) => x.userId === courierId);
  const photo = await call('GET', c.photoUrl, disp);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.equal((await call('GET', c.photoUrl)).status, 401);
  const file = (db.prepare('SELECT photo_file FROM couriers WHERE user_id = ?').get(courierId) as any).photo_file;
  assert.equal((await call('GET', `/media/avatars/${file}`)).status, 404);
  assert.equal((await call('GET', `/media/${file}`)).status, 404);

  assert.equal(c.showPhotoPublicly, true, 'consent recorded with the first photo');
  const replaced = await call('POST', `/api/couriers/${courierId}/photo`, ops, { image: PNG });
  assert.equal(replaced.status, 200);
  assert.equal((await replaced.json()).data.showPhotoPublicly, false, 'a new photo needs a new agreement (#161)');
  assert.deepEqual(JSON.parse(lastAudit('courier.photo_update').after_json).showPhotoPublicly, false);
  // Agreement recorded again for the new photo, then cleared when the photo is removed.
  assert.equal((await call('PATCH', `/api/couriers/${courierId}`, ops, { showPhotoPublicly: true })).status, 200);
  assert.ok(!fs.existsSync(path.join(tmpDir, 'uploads', 'couriers', file)), 'old photo deleted');
  assert.ok(lastAudit('courier.photo_update'));
  await call('DELETE', `/api/couriers/${courierId}/photo`, ops);
  const afterRemove = (await (await call('GET', '/api/couriers', ops)).json()).data[0];
  assert.equal(afterRemove.photoUrl, null);
  assert.equal(afterRemove.showPhotoPublicly, false, 'no photo, no public consent');
  assert.ok(lastAudit('courier.photo_remove'));
  // Consent needs a photo, on edit and on create.
  const noPhoto = await call('PATCH', `/api/couriers/${courierId}`, ops, { showPhotoPublicly: true });
  assert.equal(noPhoto.status, 400);
  assert.equal((await noPhoto.json()).code, 'CONSENT_NEEDS_PHOTO');
  const createNoPhoto = await call('POST', '/api/couriers', ops, { displayName: 'C', phone: '670000303', vehicleType: 'BIKE', publicFirstName: 'C', showPhotoPublicly: true });
  assert.equal(createNoPhoto.status, 400);
});

test('edit, disable and reset a courier; audited; disabling signs out and ends duty', async () => {
  db.prepare('UPDATE couriers SET is_on_duty = 1 WHERE user_id = ?').run(courierId);
  const res = await call('PATCH', `/api/couriers/${courierId}`, ops, { vehicleType: 'VAN', publicFirstName: 'Adé', phone: '' });
  assert.equal(res.status, 400, 'phone cannot be cleared');
  const ok = await call('PATCH', `/api/couriers/${courierId}`, ops, { vehicleType: 'VAN', publicFirstName: 'Adé' });
  assert.equal(ok.status, 200);
  const upd = lastAudit('courier.update');
  assert.deepEqual(JSON.parse(upd.before_json), { vehicleType: 'BIKE', publicFirstName: 'Ade' });

  const dis = await call('PATCH', `/api/couriers/${courierId}`, ops, { status: 'DISABLED' });
  const c = (await dis.json()).data;
  assert.equal(c.user.status, 'DISABLED');
  assert.equal(c.isOnDuty, false);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?').get(courierId) as any).c, 0);
  assert.ok(lastAudit('courier.disable'));
  await call('PATCH', `/api/couriers/${courierId}`, ops, { status: 'ACTIVE' });
  assert.ok(lastAudit('courier.enable'));

  const reset = await call('POST', `/api/couriers/${courierId}/reset-password`, ops, {});
  assert.equal(reset.status, 200);
  const r = (await reset.json()).data;
  assert.ok(r.tempPassword && r.user.mustChangePassword);
  assert.ok(lastAudit('courier.reset_password'));
});

test('couriers.manage cannot use this screen on staff accounts or beyond its own permissions', async () => {
  // Not a courier: 404 (no courier profile), even for a real user.
  assert.equal((await call('POST', '/api/couriers/usr_fin/reset-password', ops, {})).status, 404);
  // A courier profile on an account that also holds Finance's keys (which Ops lacks): 403.
  const now = Date.now();
  db.prepare(`INSERT INTO couriers (user_id, vehicle_type, public_first_name, created_at_ts, updated_at_ts) VALUES ('usr_fin', 'BIKE', 'Fin', ?, ?)`).run(now, now);
  const res = await call('POST', '/api/couriers/usr_fin/reset-password', ops, {});
  assert.equal(res.status, 403);
  assert.equal((await call('PATCH', '/api/couriers/usr_fin', ops, { status: 'DISABLED' })).status, 403);
  db.prepare("DELETE FROM couriers WHERE user_id = 'usr_fin'").run();

  // If the Courier role is changed to grant more than the courier app, creating couriers stops
  // (no role gives only courier.app) rather than handing out the extra permission.
  db.prepare("INSERT INTO role_permissions (role_id, permission_key) VALUES ('role_courier', 'cash.view')").run();
  const blocked = await call('POST', '/api/couriers', ops, { displayName: 'B', phone: '670000202', vehicleType: 'BIKE', publicFirstName: 'B' });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'COURIER_ROLE_MISSING');
  db.prepare("DELETE FROM role_permissions WHERE role_id = 'role_courier' AND permission_key = 'cash.view'").run();
});
