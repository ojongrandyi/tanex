// Console shop orders (docs/SHOP_SPEC.md §7.6, §10, §11, §13, §19; task M.7) against the real /api
// mounts on a file database in a temp folder, signed in as the seeded roles: permissions, list and
// search, the status machine with stock put back, the delivery fee, payments and refunds, Send to
// dispatch (job scope, price, COD), the dispatch job moving the order (delivered, delivery
// problem), Finance confirming the courier's cash marking the order PAID, shop settings. Orders are
// placed through the public checkout API. QA rows live only in the temp database. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shopadmin-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
// Mail on (queued only: the outbox worker never runs in tests).
process.env.SMTP_HOST = 'smtp.example.test';
process.env.MAIL_FROM = 'TanEx <info@example.test>';
delete process.env.APP_URL;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');
const { checkOrderTransition, staffNextStatuses } = await import('../src/shared/shopOrderStatus.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now0 = Date.now();
function addUser(id: string, roleIds: string[], phone: string | null = null): void {
  db.prepare(`
    INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, `${id}@example.test`, phone, id, HASH, now0, now0);
  for (const r of roleIds) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
}
// A role that may manage orders but not dispatch (Send to dispatch needs both).
db.prepare(`INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts) VALUES ('role_qa_orders', 'QA orders', NULL, 0, 0, ?, ?)`).run(now0, now0);
for (const k of ['orders.view', 'orders.manage']) db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)').run('role_qa_orders', k);

addUser('admin', [SUPER_ADMIN_ROLE_ID]);
addUser('ops', ['role_operations_manager']);   // orders.manage + dispatch.manage
addUser('fin', ['role_finance']);              // orders.payment, cash.confirm
addUser('mkt', ['role_marketing']);            // orders.view only
addUser('sup', ['role_customer_support']);     // no orders
addUser('ordonly', ['role_qa_orders']);
addUser('c1', ['role_courier'], '+237670000008');
db.prepare(`INSERT INTO couriers (user_id, vehicle_type, public_first_name, is_on_duty, created_at_ts, updated_at_ts) VALUES ('c1', 'BIKE', 'Ama', 1, ?, ?)`).run(now0, now0);

db.prepare("INSERT INTO delivery_cities (id, name, is_active, lat, lng) VALUES ('c-buea', 'Buea', 1, 4.15, 9.24), ('c-dla', 'Douala', 1, 4.05, 9.7)").run();
db.prepare("INSERT INTO delivery_zones (id, city_id, name, is_active) VALUES ('z-mol', 'c-buea', 'Molyko', 1), ('z-gra', 'c-buea', 'GRA', 1)").run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge)
  VALUES ('r1', 'c-buea', 'z-mol', 'z-gra', 'SMALL', 700, 'XAF', NULL)`).run();
const SHOP = { enabled: true, orderEmail: 'orders@example.test', shipFrom: { cityId: 'c-buea', zoneId: 'z-mol', landmark: 'Check Point' } };
db.prepare(`INSERT INTO settings (key, value_json) VALUES ('shop', ?)`).run(JSON.stringify(SHOP));

const app = express();
app.set('trust proxy', 1);
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

const cookies = new Map<string, string>();
async function as(user: string): Promise<string> {
  if (!cookies.has(user)) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: `${user}@example.test`, password: PASSWORD }),
    });
    assert.equal(res.status, 200, `sign-in as ${user}`);
    cookies.set(user, res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0]);
  }
  return cookies.get(user)!;
}
async function api(user: string | null, method: string, p: string, body?: unknown): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {};
  if (user) headers.Cookie = await as(user);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const shop = (user: string | null, method: string, p: string, body?: unknown) => api(user, method, `/api/admin/shop${p}`, body);

let n = 0;
function addProduct(price: number, size = 'SMALL', stock = 20, weight: number | null = 1) {
  const id = `prod-${++n}`;
  db.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, name_fr, price, sale_price, stock_qty, max_per_order,
      size_class, weight_kg, status, created_by, published_at_ts, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, 'PUBLISHED', 'admin', 1, 1, 1)
  `).run(id, `TX-PRD-${400000 + n}`, `qa-${n}`, `qa-fr-${n}`, `QA item ${n}`, `Article QA ${n}`, price, stock, size, weight);
  return id;
}
const stockOf = (id: string) => (db.prepare('SELECT stock_qty FROM shop_products WHERE id = ?').get(id) as { stock_qty: number }).stock_qty;
const orderRow = (number: string) => db.prepare('SELECT * FROM shop_orders WHERE order_number = ?').get(number) as any;

let seq = 0;
async function placeOrder(lines: { id: string; qty: number }[], extra: Record<string, unknown> = {}): Promise<{ id: string; number: string }> {
  const res = await fetch(`${BASE}/api/shop/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${(++seq % 250) + 1}` },
    body: JSON.stringify({
      idempotencyKey: `admin-key-${String(seq).padStart(8, '0')}`, lines, name: 'Ada Example', phone: '6 51 00 00 00', sameAsPhone: true,
      email: 'ada@example.test', locale: 'en', deliveryMethod: 'DELIVERY', cityId: 'c-buea', zoneId: 'z-gra',
      address: 'Blue gate near the church', paymentMethod: 'CASH_ON_DELIVERY', acceptTerms: true, website: '', ...extra,
    }),
  });
  const json = await res.json() as any;
  assert.equal(res.status, 201, JSON.stringify(json));
  const number = json.data.orderNumber as string;
  return { id: orderRow(number).id, number };
}

// ---- Rules ----

test('rules: an order out for delivery moves only with its job, unless the job ended without a delivery', () => {
  const ctx = { actor: 'staff' as const, deliveryMethod: 'DELIVERY' as const, deliveryFeeStatus: 'QUOTED' as const, reason: 'Customer moved' };
  assert.equal((checkOrderTransition('OUT_FOR_DELIVERY', 'READY', ctx) as any).code, 'ILLEGAL_TRANSITION');
  assert.equal((checkOrderTransition('OUT_FOR_DELIVERY', 'CANCELLED', ctx) as any).code, 'ILLEGAL_TRANSITION');
  assert.deepEqual(checkOrderTransition('OUT_FOR_DELIVERY', 'READY', { ...ctx, jobClosed: true }), { ok: true });
  assert.deepEqual(checkOrderTransition('OUT_FOR_DELIVERY', 'CANCELLED', { ...ctx, jobClosed: true }), { ok: true });
  assert.equal((checkOrderTransition('OUT_FOR_DELIVERY', 'DELIVERED', { ...ctx, jobClosed: true }) as any).code, 'SYSTEM_ONLY');
  assert.deepEqual(staffNextStatuses('OUT_FOR_DELIVERY', { deliveryMethod: 'DELIVERY', deliveryFeeStatus: 'QUOTED' }), []);
  assert.deepEqual(staffNextStatuses('OUT_FOR_DELIVERY', { deliveryMethod: 'DELIVERY', deliveryFeeStatus: 'QUOTED', jobClosed: true }), ['READY', 'CANCELLED']);
});

// ---- Permissions, list, search ----

test('orders need orders.view; changing needs orders.manage; money needs orders.payment', async () => {
  const p = addProduct(2000);
  const { id } = await placeOrder([{ id: p, qty: 1 }]);
  assert.equal((await shop(null, 'GET', '/orders')).status, 401);
  assert.equal((await shop('sup', 'GET', '/orders')).status, 403);
  assert.equal((await shop('sup', 'GET', '/orders-summary')).status, 403);
  assert.equal((await shop('mkt', 'GET', '/orders')).status, 200);
  assert.equal((await shop('mkt', 'POST', `/orders/${id}/status`, { status: 'CONFIRMED' })).status, 403);
  assert.equal((await shop('fin', 'POST', `/orders/${id}/status`, { status: 'CONFIRMED' })).status, 403);
  assert.equal((await shop('ops', 'POST', `/orders/${id}/payment`, { method: 'CASH_ON_DELIVERY', amount: 2700 })).status, 403);
  assert.equal((await shop('mkt', 'POST', `/orders/${id}/notes`, { note: 'x' })).status, 403);
  assert.equal((await shop('ops', 'GET', '/settings')).status, 403, 'settings are the Super Admin’s');
  // The order page holds the customer's details; the summary holds none.
  const page = await shop('mkt', 'GET', `/orders/${id}`);
  assert.equal(page.json.data.customer.phone, '+237651000000');
  const summary = await shop('mkt', 'GET', '/orders-summary');
  assert.ok(!JSON.stringify(summary.json).includes('651000000'));
  // Low stock: published products at or below their level (stock 20 > 3 here, none yet).
  db.prepare('UPDATE shop_products SET stock_qty = 2 WHERE id = ?').run(p);
  assert.equal((await shop('mkt', 'GET', '/orders-summary')).json.data.lowStock, 1);
  db.prepare('UPDATE shop_products SET stock_qty = 19 WHERE id = ?').run(p);
});

test('list: tabs with counts; search by order number, phone digits or product ID; opened by number from the email link', async () => {
  const p = addProduct(1500);
  const { id, number } = await placeOrder([{ id: p, qty: 2 }], { phone: '6 99 88 77 66' });
  const all = await shop('mkt', 'GET', '/orders');
  assert.ok(all.json.counts.ALL >= 2 && all.json.counts.NEW >= 2);
  const byNumber = await shop('mkt', 'GET', `/orders?q=${number.slice(-6)}`);
  assert.deepEqual(byNumber.json.data.map((o: any) => o.id), [id]);
  const byPhone = await shop('mkt', 'GET', `/orders?q=${encodeURIComponent('699 88 77')}`);
  assert.deepEqual(byPhone.json.data.map((o: any) => o.id), [id]);
  const byProduct = await shop('mkt', 'GET', `/orders?q=TX-PRD-${400000 + n}`);
  assert.deepEqual(byProduct.json.data.map((o: any) => o.id), [id]);
  assert.equal(byProduct.json.data[0].itemCount, 2);
  assert.equal(byProduct.json.data[0].cityName, 'Buea');
  assert.equal((await shop('mkt', 'GET', '/orders?tab=COMPLETED')).json.data.length, 0);
  const viaNumber = await shop('mkt', 'GET', `/orders/${number}`);
  assert.equal(viaNumber.json.data.id, id);
  assert.equal((await shop('mkt', 'GET', '/orders/TX-ORD-000000')).status, 404);
});

// ---- Delivery: fee, confirm, dispatch, delivered, cash confirmed → PAID ----

test('delivery order end to end: fee, confirm, ready, send to dispatch with COD, courier delivers, Finance confirms the cash', async () => {
  const big = addProduct(10000, 'LARGE');
  const { id, number } = await placeOrder([{ id: big, qty: 1 }]);
  let o = (await shop('ops', 'GET', `/orders/${id}`)).json.data;
  assert.equal(o.deliveryFeeStatus, 'TO_CONFIRM', 'no LARGE rate: fee to confirm');
  assert.deepEqual(o.nextStatuses, ['CONFIRMED', 'CANCELLED']);
  assert.equal(o.canSetFee, true);

  const early = await shop('ops', 'POST', `/orders/${id}/status`, { status: 'CONFIRMED' });
  assert.equal(early.json.code, 'FEE_TO_CONFIRM');
  assert.equal((await shop('ops', 'POST', `/orders/${id}/fee`, { fee: 12.5 })).json.field, 'fee');
  o = (await shop('ops', 'POST', `/orders/${id}/fee`, { fee: 1500 })).json.data;
  assert.equal(o.total, 11500);
  assert.equal(o.deliveryFeeStatus, 'QUOTED');
  assert.equal((await shop('ops', 'POST', `/orders/${id}/status`, { status: 'READY' })).json.code, 'ILLEGAL_TRANSITION');
  o = (await shop('ops', 'POST', `/orders/${id}/status`, { status: 'CONFIRMED' })).json.data;
  o = (await shop('ops', 'POST', `/orders/${id}/status`, { status: 'READY' })).json.data;
  assert.equal(o.canSetFee, false);
  assert.equal(o.dispatch.ok, true);
  assert.equal(o.dispatch.scope, 'LOCAL');
  assert.equal(o.dispatch.codAmount, 11500);

  // orders.manage alone is not enough to create a dispatch job.
  assert.equal((await shop('ordonly', 'POST', `/orders/${id}/dispatch`, {})).status, 403);
  o = (await shop('ops', 'POST', `/orders/${id}/dispatch`, {})).json.data;
  assert.equal(o.status, 'OUT_FOR_DELIVERY');
  assert.match(o.job.trackingId, /^TX[A-Z0-9]{6}$/);
  const job = db.prepare('SELECT * FROM dispatch_jobs WHERE id = ?').get(o.job.id) as any;
  assert.equal(job.scope, 'LOCAL');
  assert.equal(job.status, 'CONFIRMED');
  assert.equal(job.price, 1500);
  assert.equal(job.cod_amount, 11500);
  assert.equal(job.payer, 'SENDER');
  assert.equal(job.size_class, 'LARGE');
  assert.match(job.item_description, new RegExp(`Shop order ${number}: 1 × TX-PRD-${400000 + n}`));
  assert.equal(JSON.parse(job.dropoff_json).contactPhone, '+237651000000');
  assert.equal(JSON.parse(job.pickup_json).zoneId, 'z-mol');
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM email_outbox WHERE template_key = 'shop.order_dispatched' AND related_id = ?").get(id) as any).c, 1);
  assert.equal((await shop('ops', 'POST', `/orders/${id}/dispatch`, {})).json.code, 'NOT_READY', 'sent once');

  // The courier delivers and collects the total in cash.
  const c1 = await as('c1');
  const act = (action: string, extra: Record<string, unknown> = {}) => fetch(`${BASE}/api/courier/jobs/${job.id}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c1 },
    body: JSON.stringify({ action, idempotencyKey: `shop-${action}-${++seq}-${Date.now()}`, ...extra }),
  });
  assert.equal((await api('ops', 'POST', `/api/dispatch/jobs/${job.id}/assign`, { courierUserId: 'c1' })).status, 200);
  assert.equal((await act('accept')).status, 200);
  assert.equal((await act('pick_up')).status, 200);
  assert.equal((await act('start_delivery')).status, 200);
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), 'photo.png');
  form.append('recipientName', 'Ada Example');
  assert.equal((await fetch(`${BASE}/api/courier/pod/${job.id}`, { method: 'POST', headers: { Cookie: c1 }, body: form })).status, 200);
  const delivered = await act('deliver', { recipientName: 'Ada Example', cash: [{ amount: 11500, method: 'CASH' }] });
  assert.equal(delivered.status, 200, await delivered.clone().text());

  o = (await shop('ops', 'GET', `/orders/${id}`)).json.data;
  assert.equal(o.status, 'DELIVERED', 'the job moved the order');
  assert.equal(o.payment.status, 'UNPAID', 'paid only once Finance confirms the cash');
  const entry = db.prepare(`SELECT id FROM cash_ledger WHERE job_id = ? AND entry_type = 'COLLECTED'`).get(job.id) as { id: string };
  assert.equal((await api('fin', 'POST', `/api/cash/entries/${entry.id}/confirm`, {})).status, 200);
  o = (await shop('fin', 'GET', `/orders/${id}`)).json.data;
  assert.equal(o.payment.status, 'PAID');
  assert.equal(o.payment.amount, 11500);
  assert.match(o.payment.reference, /^TX-CSH-/);
  const kinds = o.events.map((e: any) => `${e.kind}:${e.to ?? ''}`);
  for (const k of ['FEE:1500', 'STATUS:CONFIRMED', 'STATUS:READY', 'STATUS:OUT_FOR_DELIVERY', 'STATUS:DELIVERED', 'PAYMENT:PAID']) {
    assert.ok(kinds.includes(k), `timeline has ${k}`);
  }
  const audits = (db.prepare(`SELECT action FROM audit_log WHERE entity_id = ? ORDER BY rowid`).all(id) as { action: string }[]).map((a) => a.action);
  assert.deepEqual(audits.filter((a) => a !== 'shop.order_placed'),
    ['shop.order_fee', 'shop.order_status', 'shop.order_status', 'shop.order_dispatch', 'shop.order_status', 'shop.order_paid']);
});

test('delivery problem: a cancelled job flags the order; staff put it back to ready and send it again', async () => {
  const p = addProduct(3000);
  const { id } = await placeOrder([{ id: p, qty: 1 }]);
  for (const s of ['CONFIRMED', 'READY']) assert.equal((await shop('ops', 'POST', `/orders/${id}/status`, { status: s })).status, 200);
  let o = (await shop('ops', 'POST', `/orders/${id}/dispatch`, {})).json.data;
  const jobId = o.job.id;
  assert.deepEqual(o.nextStatuses, [], 'nothing to do while the courier has it');
  assert.equal((await api('ops', 'POST', `/api/dispatch/jobs/${jobId}/cancel`, { reason: 'Rider unavailable' })).status, 200);
  o = (await shop('ops', 'GET', `/orders/${id}`)).json.data;
  assert.equal(o.status, 'OUT_FOR_DELIVERY');
  assert.equal(o.deliveryProblem, true);
  assert.deepEqual(o.nextStatuses, ['READY', 'CANCELLED']);
  assert.ok(o.events.some((e: any) => e.kind === 'DISPATCH' && /cancelled/.test(e.note)));
  const summary = (await shop('ops', 'GET', '/orders-summary')).json.data;
  assert.ok(summary.deliveryProblems >= 1);

  o = (await shop('ops', 'POST', `/orders/${id}/status`, { status: 'READY' })).json.data;
  assert.equal(o.status, 'READY');
  assert.equal(o.job, null);
  assert.equal(o.deliveryProblem, false);
  o = (await shop('ops', 'POST', `/orders/${id}/dispatch`, {})).json.data;
  assert.notEqual(o.job.id, jobId, 'a new job');
});

// ---- Cancel, pickup, return, stock ----

test('cancel puts the stock back with a stock move and emails the customer; a reason is required', async () => {
  const p = addProduct(1000, 'SMALL', 10);
  const { id } = await placeOrder([{ id: p, qty: 3 }]);
  assert.equal(stockOf(p), 7);
  assert.equal((await shop('ops', 'POST', `/orders/${id}/status`, { status: 'CANCELLED' })).json.code, 'REASON_REQUIRED');
  const o = (await shop('ops', 'POST', `/orders/${id}/status`, { status: 'CANCELLED', reason: 'Customer asked to cancel.' })).json.data;
  assert.equal(o.status, 'CANCELLED');
  assert.equal(o.cancelReason, 'Customer asked to cancel.');
  assert.equal(stockOf(p), 10);
  const move = db.prepare(`SELECT delta, reason, user_id FROM shop_stock_moves WHERE product_id = ? ORDER BY rowid DESC LIMIT 1`).get(p) as any;
  assert.deepEqual({ ...move }, { delta: 3, reason: 'CANCEL', user_id: 'ops' });
  const mail = db.prepare("SELECT text FROM email_outbox WHERE template_key = 'shop.order_cancelled' AND related_id = ?").get(id) as { text: string };
  assert.match(mail.text, /Reason: Customer asked to cancel\./);
  assert.equal((await shop('ops', 'POST', `/orders/${id}/status`, { status: 'NEW' })).status, 409);
  assert.equal((await shop('fin', 'POST', `/orders/${id}/payment`, { method: 'CASH_ON_DELIVERY', amount: o.total })).json.code, 'ORDER_CANCELLED');
});

test('pickup: collected, then returned with or without putting the items back', async () => {
  const p = addProduct(2500, 'SMALL', 10);
  const pickup = { deliveryMethod: 'PICKUP', cityId: null, zoneId: null, address: '', pickupOffice: 'buea', paymentMethod: 'PAY_AT_OFFICE' };
  const a = await placeOrder([{ id: p, qty: 2 }], pickup);
  for (const s of ['CONFIRMED', 'READY']) await shop('ops', 'POST', `/orders/${a.id}/status`, { status: s });
  let o = (await shop('ops', 'GET', `/orders/${a.id}`)).json.data;
  assert.deepEqual(o.nextStatuses, ['COLLECTED', 'CANCELLED']);
  assert.equal(o.dispatch, null, 'pickup orders are not sent to dispatch');
  assert.equal((await shop('ops', 'POST', `/orders/${a.id}/dispatch`, {})).json.code, 'NOT_READY');
  o = (await shop('ops', 'POST', `/orders/${a.id}/status`, { status: 'COLLECTED' })).json.data;
  assert.equal(stockOf(p), 8);
  o = (await shop('ops', 'POST', `/orders/${a.id}/status`, { status: 'RETURNED', reason: 'Wrong colour', putBackInStock: true })).json.data;
  assert.equal(o.status, 'RETURNED');
  assert.equal(stockOf(p), 10);

  const b = await placeOrder([{ id: p, qty: 1 }], pickup);
  for (const s of ['CONFIRMED', 'READY', 'COLLECTED']) await shop('ops', 'POST', `/orders/${b.id}/status`, { status: s });
  await shop('ops', 'POST', `/orders/${b.id}/status`, { status: 'RETURNED', reason: 'Damaged', putBackInStock: false });
  assert.equal(stockOf(p), 9, 'damaged items stay out of stock');
});

// ---- Payments and refunds ----

test('payments: amount must be the total, mobile money needs a reference; refund and payment removal need a reason', async () => {
  const p = addProduct(4000);
  const { id } = await placeOrder([{ id: p, qty: 1 }], { paymentMethod: 'MTN_MOMO' });
  const total = orderRow((await shop('fin', 'GET', `/orders/${id}`)).json.data.orderNumber).total;
  assert.equal(total, 4700);
  assert.equal((await shop('fin', 'POST', `/orders/${id}/payment`, { method: 'MTN_MOMO', amount: 4000, reference: 'MP1' })).json.code, 'AMOUNT_MISMATCH');
  assert.equal((await shop('fin', 'POST', `/orders/${id}/payment`, { method: 'MTN_MOMO', amount: total })).json.code, 'REFERENCE_REQUIRED');
  let o = (await shop('fin', 'POST', `/orders/${id}/payment`, { method: 'MTN_MOMO', amount: total, reference: 'MP241119.1234' })).json.data;
  assert.equal(o.payment.status, 'PAID');
  assert.equal(o.payment.reference, 'MP241119.1234');
  assert.equal(o.payment.paidBy, 'fin');
  assert.equal((await shop('fin', 'POST', `/orders/${id}/payment`, { method: 'MTN_MOMO', amount: total, reference: 'x' })).json.code, 'ALREADY_PAID');
  assert.equal((await shop('ops', 'POST', `/orders/${id}/fee`, { fee: 100 })).json.code, 'FEE_LOCKED', 'no fee change once paid');

  assert.equal((await shop('fin', 'POST', `/orders/${id}/unpaid`, {})).json.code, 'REASON_REQUIRED');
  o = (await shop('fin', 'POST', `/orders/${id}/unpaid`, { reason: 'Reference not found on the MoMo statement' })).json.data;
  assert.equal(o.payment.status, 'UNPAID');
  assert.equal(o.payment.reference, null);
  o = (await shop('fin', 'POST', `/orders/${id}/payment`, { method: 'MTN_MOMO', amount: total, reference: 'MP241119.9999' })).json.data;

  assert.equal((await shop('fin', 'POST', `/orders/${id}/refund`, { method: 'MTN_MOMO', amount: total + 1, reference: 'R1', reason: 'x' })).json.code, 'INVALID_AMOUNT');
  assert.equal((await shop('fin', 'POST', `/orders/${id}/refund`, { method: 'MTN_MOMO', amount: total, reference: 'R1' })).json.code, 'REASON_REQUIRED');
  o = (await shop('fin', 'POST', `/orders/${id}/refund`, { method: 'MTN_MOMO', amount: total, reference: 'RF241119.1', reason: 'Order cancelled after payment' })).json.data;
  assert.equal(o.payment.status, 'REFUNDED');
  assert.deepEqual({ amount: o.payment.refund.amount, method: o.payment.refund.method, reference: o.payment.refund.reference, by: o.payment.refund.by },
    { amount: total, method: 'MTN_MOMO', reference: 'RF241119.1', by: 'fin' });
  assert.equal((await api(null, 'GET', '/api/shop/products')).status, 200, 'public side unaffected');
});

test('internal notes are on the timeline, not in the audit text', async () => {
  const p = addProduct(1000);
  const { id } = await placeOrder([{ id: p, qty: 1 }]);
  assert.equal((await shop('ops', 'POST', `/orders/${id}/notes`, { note: '' })).json.code, 'NOTE_REQUIRED');
  const o = (await shop('fin', 'POST', `/orders/${id}/notes`, { note: 'Customer prefers a call after 5 pm.' })).json.data;
  const note = o.events.find((e: any) => e.kind === 'NOTE');
  assert.equal(note.note, 'Customer prefers a call after 5 pm.');
  assert.equal(note.by, 'fin');
  const a = db.prepare(`SELECT after_json FROM audit_log WHERE action = 'shop.order_note' AND entity_id = ?`).get(id) as { after_json: string };
  assert.ok(!a.after_json.includes('5 pm'));
});

// ---- Settings ----

test('shop settings: Super Admin only, checked, audited; the shop cannot be switched on without a ship-from point', async () => {
  assert.equal((await shop('mkt', 'PUT', '/settings', {})).status, 403);
  const view = (await shop('admin', 'GET', '/settings')).json.data;
  assert.equal(view.settings.enabled, true);
  assert.deepEqual(view.cities.map((c: any) => c.name), ['Buea', 'Douala']);
  assert.ok(view.zones.some((z: any) => z.cityId === 'c-buea'));
  const base = { ...view.settings };
  assert.equal((await shop('admin', 'PUT', '/settings', { ...base, orderEmail: 'not an email' })).json.field, 'orderEmail');
  assert.equal((await shop('admin', 'PUT', '/settings', { ...base, shipFrom: { cityId: 'c-dla', zoneId: 'z-mol', landmark: '' } })).json.field, 'zoneId');
  assert.equal((await shop('admin', 'PUT', '/settings', { ...base, shipFrom: { cityId: null, zoneId: null, landmark: '' } })).json.code, 'SHIP_FROM_REQUIRED');
  assert.equal((await shop('admin', 'PUT', '/settings', { ...base, paymentMethods: ['PAY_AT_OFFICE'] })).json.code, 'INVALID_METHODS');
  assert.equal((await shop('admin', 'PUT', '/settings', { ...base, maxPerOrder: 0 })).json.field, 'maxPerOrder');
  const saved = (await shop('admin', 'PUT', '/settings', { ...base, lowStockAt: 5, pickupOffices: ['douala'] })).json.data.settings;
  assert.equal(saved.lowStockAt, 5);
  assert.deepEqual(saved.pickupOffices, ['douala']);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'shop.settings'").get() as any).c, 1);
  assert.equal((await shop('admin', 'POST', '/settings/test-email', {})).status, 200);
  assert.equal((db.prepare("SELECT to_addr FROM email_outbox WHERE template_key = 'mail.test' ORDER BY rowid DESC").get() as any).to_addr, 'orders@example.test');
  // Switched off, the public shop disappears.
  await shop('admin', 'PUT', '/settings', { ...base, enabled: false });
  assert.equal((await api(null, 'GET', '/api/shop/products')).status, 404);
  await shop('admin', 'PUT', '/settings', base);
});
