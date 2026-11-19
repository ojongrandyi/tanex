// Shop cart, delivery fee and orders (docs/SHOP_SPEC.md §8–§10.2, §19; task M.5) on a file
// database in a temp folder: the delivery fee rules (same price as the local delivery form, TO_CONFIRM
// with no rate), the cart check, and POST /api/shop/orders (browser prices ignored, stock reserved,
// last item sold once, idempotent submit, stock moves, field checks, honeypot, rate limit, shop off).
// Rows are written directly; nothing is kept. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shoporders-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { publicPages } = await import('../server/publicPages.ts');
const { createIndexRenderer } = await import('../server/render/pageMeta.ts');
const { resolveShopPage } = await import('../server/shop/pageData.ts');
const { shopDeliveryFee, largestSizeClass, cartWeightKg, cameroonPhone } = await import('../src/shared/shopCheckout.ts');
const { priceLocalDelivery, zoneRateFromRow } = await import('../src/shared/localPricing.ts');
const { isReferenceOf } = await import('../src/shared/references.ts');

initDatabase();

const indexPath = path.join(process.cwd(), 'index.html');
const render = createIndexRenderer(indexPath);
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
registerApiRoutes(app);
app.use(publicPages(render, indexPath, undefined, (match, query) => resolveShopPage(db, match, query)));
app.use((_req, res) => res.status(404).end());
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let ipSeq = 1;
const post = async (p: string, body: unknown, ip = `203.0.113.${(ipSeq++ % 250) + 1}`) => {
  const res = await fetch(`${BASE}/api/shop${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) as any };
};

const setShop = (value: Record<string, unknown>) => db.prepare(`
  INSERT INTO settings (key, value_json) VALUES ('shop', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`).run(JSON.stringify(value));

// Dispatch tables: Buea (ship-from, two areas) and Douala, with rates (QA rows in a temp DB only).
db.prepare("INSERT INTO delivery_cities (id, name, is_active) VALUES ('c-buea', 'Buea', 1), ('c-dla', 'Douala', 1), ('c-off', 'Kumba', 0)").run();
db.prepare("INSERT INTO delivery_zones (id, city_id, name, is_active) VALUES ('z-mol', 'c-buea', 'Molyko', 1), ('z-gra', 'c-buea', 'GRA', 1), ('z-bon', 'c-dla', 'Bonamoussadi', 1)").run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge) VALUES
  ('r1', 'c-buea', 'z-mol', 'z-gra', 'SMALL', 700, 'XAF', 300),
  ('r2', 'c-buea', 'z-mol', 'z-gra', 'LARGE', 2000, 'XAF', NULL),
  ('r3', 'c-buea', NULL, NULL, 'SMALL', 500, 'XAF', NULL)`).run();
db.prepare(`INSERT INTO intercity_rates (id, from_city_id, to_city_id, max_weight_kg, price, currency) VALUES
  ('i1', 'c-buea', 'c-dla', 5, 3000, 'XAF'), ('i2', 'c-buea', 'c-dla', 20, 6000, 'XAF')`).run();

const SHOP_ON = { enabled: true, shipFrom: { cityId: 'c-buea', zoneId: 'z-mol', landmark: 'Check Point' }, lowStockAt: 3, maxPerOrder: 10 };
setShop(SHOP_ON);

let n = 0;
function addProduct(p: { price?: number; sale?: number | null; stock?: number; status?: string; size?: string; weight?: number | null; max?: number | null }) {
  const id = `prod-${++n}`;
  db.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, name_fr, price, sale_price, stock_qty, max_per_order,
      size_class, weight_kg, status, created_by, published_at_ts, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'staff', ?, 1, 1)
  `).run(id, `TX-PRD-${200000 + n}`, `item-${n}`, `article-${n}`, `Item ${n}`, `Article ${n}`, p.price ?? 1000, p.sale ?? null,
    p.stock ?? 50, p.max ?? null, p.size ?? 'SMALL', p.weight === undefined ? 1 : p.weight, p.status ?? 'PUBLISHED',
    (p.status ?? 'PUBLISHED') === 'DRAFT' ? null : 1);
  return id;
}
const stockOf = (id: string) => (db.prepare('SELECT stock_qty FROM shop_products WHERE id = ?').get(id) as { stock_qty: number }).stock_qty;

let keySeq = 0;
const order = (lines: { id: string; qty: number }[], extra: Record<string, unknown> = {}) => ({
  idempotencyKey: `test-key-${String(++keySeq).padStart(8, '0')}`,
  lines,
  name: 'Ada Example',
  phone: '6 51 00 00 00',
  sameAsPhone: true,
  email: '',
  locale: 'en',
  deliveryMethod: 'DELIVERY',
  cityId: 'c-buea',
  zoneId: 'z-gra',
  address: 'Blue gate near the church',
  paymentMethod: 'CASH_ON_DELIVERY',
  acceptTerms: true,
  website: '',
  ...extra,
});

// ---- Rules ----

test('delivery fee: pickup none, local rate for the largest size, intercity by weight, to confirm otherwise', () => {
  const zone = (db.prepare('SELECT * FROM zone_rates').all() as unknown[]).map(zoneRateFromRow);
  const intercity = [
    { id: 'i1', fromCityId: 'c-buea', toCityId: 'c-dla', maxWeightKg: 5, price: 3000, currency: 'XAF' },
    { id: 'i2', fromCityId: 'c-buea', toCityId: 'c-dla', maxWeightKg: 20, price: 6000, currency: 'XAF' },
  ];
  const rates = { zone, intercity };
  const shipFrom = { cityId: 'c-buea', zoneId: 'z-mol' };
  const small = { sizeClass: 'SMALL', weightKg: 1, qty: 2 };
  const large = { sizeClass: 'LARGE', weightKg: 4, qty: 1 };

  assert.deepEqual(shopDeliveryFee({ method: 'PICKUP', shipFrom, to: { cityId: null, zoneId: null }, items: [small], currency: 'XAF' }, rates), { status: 'NONE', fee: 0 });
  // Same price as the local delivery form for the same trip and size.
  const form = priceLocalDelivery({ cityId: 'c-buea', fromZoneId: 'z-mol', toZoneId: 'z-gra', sizeClass: 'SMALL' }, zone);
  assert.ok(form.ok);
  assert.deepEqual(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-buea', zoneId: 'z-gra' }, items: [small], currency: 'XAF' }, rates),
    { status: 'QUOTED', fee: form.ok ? form.price : -1 });
  assert.equal(largestSizeClass([small, large]), 'LARGE');
  assert.deepEqual(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-buea', zoneId: 'z-gra' }, items: [small, large], currency: 'XAF' }, rates),
    { status: 'QUOTED', fee: 2000 });
  // Other area: the city default for SMALL; none for LARGE.
  assert.deepEqual(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-buea', zoneId: null }, items: [small], currency: 'XAF' }, rates),
    { status: 'QUOTED', fee: 500 });
  assert.equal(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-buea', zoneId: null }, items: [large], currency: 'XAF' }, rates).status, 'TO_CONFIRM');
  // Intercity: total weight 2 × 1 + 4 = 6 kg → the 20 kg band.
  assert.equal(cartWeightKg([small, large]), 6);
  assert.deepEqual(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-dla', zoneId: 'z-bon' }, items: [small, large], currency: 'XAF' }, rates),
    { status: 'QUOTED', fee: 6000 });
  // A missing weight, a weight above every band, no ship-from city, another currency: to confirm.
  const noWeight = { sizeClass: 'SMALL', weightKg: null, qty: 1 };
  assert.equal(cartWeightKg([small, noWeight]), null);
  assert.equal(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-dla', zoneId: null }, items: [small, noWeight], currency: 'XAF' }, rates).status, 'TO_CONFIRM');
  assert.equal(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-dla', zoneId: null }, items: [{ ...large, qty: 10 }], currency: 'XAF' }, rates).status, 'TO_CONFIRM');
  assert.equal(shopDeliveryFee({ method: 'DELIVERY', shipFrom: { cityId: null, zoneId: null }, to: { cityId: 'c-buea', zoneId: 'z-gra' }, items: [small], currency: 'XAF' }, rates).status, 'TO_CONFIRM');
  assert.equal(shopDeliveryFee({ method: 'DELIVERY', shipFrom, to: { cityId: 'c-buea', zoneId: 'z-gra' }, items: [small], currency: 'EUR' }, rates).status, 'TO_CONFIRM');
});

test('customer phone must be a Cameroon number', () => {
  assert.equal(cameroonPhone('651 05 93 45'), '+237651059345');
  assert.equal(cameroonPhone('+237 691 19 46 63'), '+237691194663');
  assert.equal(cameroonPhone('+33 6 12 34 56 78'), null);
  assert.equal(cameroonPhone('12345'), null);
  assert.equal(cameroonPhone(42), null);
});

// ---- Cart check and delivery fee API ----

test('cart check re-reads prices and stock, lowers quantities and drops products no longer sold', async () => {
  const a = addProduct({ price: 5000, sale: 4000, stock: 2 });
  const b = addProduct({ stock: 50, max: 3 });
  const hidden = addProduct({ status: 'HIDDEN' });
  const draft = addProduct({ status: 'DRAFT' });
  const gone = addProduct({ stock: 0 });
  const r = await post('/cart/check', { locale: 'fr', lines: [{ id: a, qty: 5 }, { id: b, qty: 9 }, { id: hidden, qty: 1 }, { id: draft, qty: 1 }, { id: gone, qty: 1 }, { id: 'nope', qty: 1 }] });
  assert.equal(r.status, 200);
  const d = r.json.data;
  assert.equal(d.lines.length, 2);
  assert.equal(d.lines[0].qty, 2);
  assert.equal(d.lines[0].requested, 5);
  assert.equal(d.lines[0].salePrice, 4000);
  assert.equal(d.lines[0].lineTotal, 8000);
  assert.equal(d.lines[0].name, `Article ${n - 4}`);
  assert.equal(d.lines[1].qty, 3);
  assert.equal(d.subtotal, 8000 + 3000);
  assert.deepEqual(d.removed.map((x: any) => x.name), [`Article ${n - 2}`, null, `Article ${n}`, null]);
  assert.ok(Array.isArray(d.options.paymentMethods) && d.options.pickupOffices.includes('buea'));
  // Nothing private leaves: no stock count above the low-stock level, no staff fields.
  assert.equal(JSON.stringify(d).includes('stock_qty'), false);

  assert.equal((await post('/cart/check', { lines: [] })).status, 200);
  assert.equal((await post('/cart/check', { lines: [{ id: a, qty: 0 }] })).json.code, 'INVALID_CART');
  assert.equal((await post('/cart/check', { lines: Array.from({ length: 21 }, (_, i) => ({ id: `x${i}`, qty: 1 })) })).json.code, 'INVALID_CART');
});

test('delivery fee API answers what the order will store', async () => {
  const p = addProduct({ size: 'SMALL', weight: 2 });
  const lines = [{ id: p, qty: 1 }];
  assert.deepEqual((await post('/delivery-fee', { lines, deliveryMethod: 'DELIVERY', cityId: 'c-buea', zoneId: 'z-gra' })).json.data,
    { status: 'QUOTED', fee: 700, currency: 'XAF' });
  assert.deepEqual((await post('/delivery-fee', { lines, deliveryMethod: 'DELIVERY', cityId: 'c-dla' })).json.data,
    { status: 'QUOTED', fee: 3000, currency: 'XAF' });
  assert.deepEqual((await post('/delivery-fee', { lines, deliveryMethod: 'PICKUP' })).json.data, { status: 'NONE', fee: 0, currency: 'XAF' });
  assert.equal((await post('/delivery-fee', { lines, deliveryMethod: 'DELIVERY', cityId: 'c-off' })).json.code, 'INVALID_CITY');
  assert.equal((await post('/delivery-fee', { lines, deliveryMethod: 'DELIVERY', cityId: 'c-buea', zoneId: 'z-bon' })).json.code, 'INVALID_AREA');
});

// ---- Orders ----

test('an order takes prices from the database, reserves stock and records every move', async () => {
  const a = addProduct({ price: 5000, sale: 4500, stock: 10 });
  const b = addProduct({ price: 1200, stock: 4, size: 'LARGE', weight: 3 });
  const r = await post('/orders', order([{ id: a, qty: 2 }, { id: b, qty: 1 }], { price: 1, prices: { [a]: 1 }, subtotal: 5, total: 5 }));
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const o = r.json.data;
  assert.ok(isReferenceOf('order', o.orderNumber));
  assert.equal(o.firstName, 'Ada');
  assert.equal(o.subtotal, 2 * 4500 + 1200);
  assert.equal(o.deliveryFeeStatus, 'QUOTED');
  assert.equal(o.deliveryFee, 2000);
  assert.equal(o.total, 2 * 4500 + 1200 + 2000);
  assert.deepEqual(o.items.map((i: any) => [i.code, i.qty, i.unitPrice]), [[`TX-PRD-${200000 + n - 1}`, 2, 4500], [`TX-PRD-${200000 + n}`, 1, 1200]]);
  // No contact details in the answer.
  assert.equal(JSON.stringify(o).includes('+237'), false);

  assert.equal(stockOf(a), 8);
  assert.equal(stockOf(b), 3);
  const row = db.prepare('SELECT * FROM shop_orders WHERE order_number = ?').get(o.orderNumber) as any;
  assert.equal(row.status, 'NEW');
  assert.equal(row.payment_status, 'UNPAID');
  assert.equal(row.customer_phone, '+237651000000');
  assert.equal(row.customer_whatsapp, '+237651000000');
  assert.equal(row.city_id, 'c-buea');
  assert.equal(row.address_text, 'Blue gate near the church');
  const moves = db.prepare("SELECT product_id, delta, reason, stock_after FROM shop_stock_moves WHERE order_id = ? ORDER BY product_id").all(row.id) as any[];
  assert.deepEqual(moves.map((m) => [m.product_id, m.delta, m.reason, m.stock_after]), [[a, -2, 'ORDER', 8], [b, -1, 'ORDER', 3]]);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM shop_order_events WHERE order_id = ? AND kind = 'STATUS' AND to_value = 'NEW'").get(row.id) as any).c, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'shop.order_placed' AND entity_id = ?").get(row.id) as any).c, 1);
});

test('two orders for the last item: one 201, one 409 with what is left, stock never below 0', async () => {
  const p = addProduct({ stock: 1 });
  const [r1, r2] = await Promise.all([post('/orders', order([{ id: p, qty: 1 }])), post('/orders', order([{ id: p, qty: 1 }]))]);
  assert.deepEqual([r1.status, r2.status].sort(), [201, 409]);
  const refused = r1.status === 409 ? r1 : r2;
  assert.equal(refused.json.code, 'OUT_OF_STOCK');
  assert.equal(refused.json.details.available, 0);
  assert.equal(stockOf(p), 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM shop_order_items WHERE product_id = ?').get(p) as any).c, 1);
});

test('a refused line rolls the whole order back', async () => {
  const ok = addProduct({ stock: 5 });
  const short = addProduct({ stock: 1 });
  const before = (db.prepare('SELECT COUNT(*) AS c FROM shop_orders').get() as any).c;
  const r = await post('/orders', order([{ id: ok, qty: 2 }, { id: short, qty: 3 }]));
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'OUT_OF_STOCK');
  assert.equal(r.json.details.available, 1);
  assert.equal(stockOf(ok), 5);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM shop_orders').get() as any).c, before);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM shop_stock_moves WHERE product_id = ?').get(ok) as any).c, 0);

  const limited = addProduct({ stock: 50, max: 2 });
  assert.equal((await post('/orders', order([{ id: limited, qty: 3 }]))).json.code, 'QUANTITY_LIMIT');
  const hidden = addProduct({ status: 'HIDDEN' });
  assert.equal((await post('/orders', order([{ id: hidden, qty: 1 }]))).json.code, 'PRODUCT_UNAVAILABLE');
  // A price the customer saw that is no longer the price: they are told before ordering.
  const changed = addProduct({ price: 3000 });
  const pc = await post('/orders', order([{ id: changed, qty: 1 }], { seenPrices: { [changed]: 2500 } }));
  assert.equal(pc.json.code, 'PRICE_CHANGED');
  assert.equal(pc.json.details.price, 3000);
  assert.equal(stockOf(changed), 50);
});

test('the same submit twice makes one order', async () => {
  const p = addProduct({ stock: 10 });
  const body = order([{ id: p, qty: 2 }]);
  const first = await post('/orders', body);
  const again = await post('/orders', body);
  assert.equal(first.status, 201);
  assert.equal(again.status, 200);
  assert.equal(again.json.data.orderNumber, first.json.data.orderNumber);
  assert.equal(stockOf(p), 8);
});

test('pickup, intercity and the fee to confirm', async () => {
  const p = addProduct({ stock: 10, weight: null });
  const pickup = await post('/orders', order([{ id: p, qty: 1 }], { deliveryMethod: 'PICKUP', pickupOffice: 'douala', paymentMethod: 'PAY_AT_OFFICE', locale: 'fr' }));
  assert.equal(pickup.status, 201);
  assert.equal(pickup.json.data.deliveryFeeStatus, 'NONE');
  assert.equal(pickup.json.data.deliveryFee, 0);
  assert.equal(pickup.json.data.items[0].name, `Article ${n}`);
  const row = db.prepare('SELECT * FROM shop_orders WHERE order_number = ?').get(pickup.json.data.orderNumber) as any;
  assert.equal(row.pickup_office, 'douala');
  assert.equal(row.locale, 'fr');
  assert.equal(row.city_id, null);
  // Intercity with an item that has no weight: placed, fee to confirm, total = subtotal.
  const far = await post('/orders', order([{ id: p, qty: 1 }], { cityId: 'c-dla', zoneId: null, paymentMethod: 'MTN_MOMO' }));
  assert.equal(far.status, 201);
  assert.equal(far.json.data.deliveryFeeStatus, 'TO_CONFIRM');
  assert.equal(far.json.data.deliveryFee, null);
  assert.equal(far.json.data.total, far.json.data.subtotal);
});

test('every field is checked on the server', async () => {
  const p = addProduct({ stock: 10 });
  const lines = [{ id: p, qty: 1 }];
  const code = async (extra: Record<string, unknown>) => (await post('/orders', order(lines, extra))).json.code;
  assert.equal(await code({ name: '  ' }), 'INVALID_NAME');
  assert.equal(await code({ phone: '+33612345678' }), 'INVALID_PHONE');
  assert.equal(await code({ sameAsPhone: false, whatsapp: 'abc' }), 'INVALID_WHATSAPP');
  assert.equal(await code({ email: 'not-an-email' }), 'INVALID_EMAIL');
  assert.equal(await code({ cityId: 'c-off' }), 'INVALID_CITY');
  assert.equal(await code({ zoneId: 'z-bon' }), 'INVALID_AREA');
  assert.equal(await code({ address: '' }), 'ADDRESS_REQUIRED');
  assert.equal(await code({ deliveryMethod: 'PICKUP', pickupOffice: 'paris', paymentMethod: 'PAY_AT_OFFICE' }), 'INVALID_PICKUP_OFFICE');
  assert.equal(await code({ paymentMethod: 'CARD' }), 'INVALID_PAYMENT_METHOD');
  assert.equal(await code({ paymentMethod: 'PAY_AT_OFFICE' }), 'INVALID_PAYMENT_METHOD');
  assert.equal(await code({ acceptTerms: false }), 'TERMS_REQUIRED');
  assert.equal(await code({ website: 'http://spam.example' }), 'INVALID_REQUEST');
  assert.equal(await code({ idempotencyKey: 'short' }), 'INVALID_REQUEST');
  assert.equal(await code({ lines: [] }), 'EMPTY_CART');
  // A payment method switched off in the shop settings is refused.
  setShop({ ...SHOP_ON, paymentMethods: ['CASH_ON_DELIVERY'] });
  assert.equal(await code({ paymentMethod: 'MTN_MOMO' }), 'INVALID_PAYMENT_METHOD');
  setShop(SHOP_ON);
  assert.equal(stockOf(p), 10);
});

test('orders are rate-limited per address', async () => {
  const p = addProduct({ stock: 100 });
  const ip = '198.51.100.7';
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await post('/orders', order([{ id: p, qty: 1 }]), ip)).status);
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});

test('while the shop is off the cart page and the order API do not exist', async () => {
  const p = addProduct({ stock: 5 });
  assert.equal((await fetch(`${BASE}/cart`)).status, 200);
  assert.equal((await fetch(`${BASE}/fr/panier`)).status, 200);
  setShop({ ...SHOP_ON, enabled: false });
  try {
    assert.equal((await fetch(`${BASE}/cart`)).status, 404);
    assert.equal((await post('/cart/check', { lines: [{ id: p, qty: 1 }] })).status, 404);
    assert.equal((await post('/orders', order([{ id: p, qty: 1 }]))).status, 404);
    assert.equal(stockOf(p), 5);
  } finally {
    setShop(SHOP_ON);
  }
});
