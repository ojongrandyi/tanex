// Shop foundation (docs/SHOP_SPEC.md, task M.1): tables, the one-time permission grant, product IDs
// and order numbers, order/payment/product rules and the settings reader. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initIamSchema } from '../server/auth/schema.ts';
import { createShopTables, grantShopPermissionsOnce, SHOP_GRANT_MIGRATION_KEY } from '../server/shop/schema.ts';
import { SEEDED_ROLES, isPermissionKey, PERMISSIONS } from '../src/shared/permissions.ts';
import { generateReference, isReferenceOf, REFERENCE_PATTERN } from '../src/shared/references.ts';
import {
  checkOrderTransition, checkPaymentChange, staffNextStatuses, restocksOn, paymentMethodFits, orderTotal,
  ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderMoveContext,
} from '../src/shared/shopOrderStatus.ts';
import {
  checkProductTransition, missingForPublish, isValidPrice, isValidSalePrice, effectivePrice, isValidShopSlug,
  editIsProposal, canEditContent, isPublicProductStatus,
} from '../src/shared/shopProduct.ts';
import { readShopSettings, DEFAULT_SHOP_SETTINGS, PICKUP_OFFICE_KEYS } from '../src/shared/shopSettings.ts';
import { EMAIL } from '../src/config/brand.ts';

const SHOP_TABLES = [
  'shop_categories', 'shop_products', 'shop_product_categories', 'shop_media', 'shop_product_images',
  'shop_stock_moves', 'shop_orders', 'shop_order_items', 'shop_order_events',
];

function freshDb(): DatabaseSync {
  const conn = new DatabaseSync(':memory:');
  conn.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);');
  initIamSchema(conn);
  return conn;
}

const grantsOf = (conn: DatabaseSync, roleId: string): string[] =>
  (conn.prepare("SELECT permission_key AS k FROM role_permissions WHERE role_id = ? AND (permission_key LIKE 'shop.%' OR permission_key LIKE 'orders.%') ORDER BY k")
    .all(roleId) as { k: string }[]).map((r) => r.k);

// ---- Tables ----

test('createShopTables: every table exists, empty, and it can run twice', () => {
  const conn = freshDb();
  createShopTables(conn);
  createShopTables(conn);
  for (const t of SHOP_TABLES) {
    const row = conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
    assert.ok(row, `${t} missing`);
    const { c } = conn.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number };
    assert.equal(c, 0, `${t} must start empty (no demo data)`);
  }
});

test('stock can never go below zero, and product IDs / order numbers are unique', () => {
  const conn = freshDb();
  createShopTables(conn);
  const insert = conn.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, price, stock_qty, created_by, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'Item', 1000, ?, 'u1', 0, 0)
  `);
  insert.run('p1', 'TX-PRD-000001', 'item', 'article', 2);
  assert.throws(() => insert.run('p2', 'TX-PRD-000001', 'item-2', 'article-2', 1), /UNIQUE/);
  // The order code's reservation: decrement only while enough stock is left.
  const take = conn.prepare('UPDATE shop_products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?');
  assert.equal(Number(take.run(2, 'p1', 2).changes), 1);
  assert.equal(Number(take.run(1, 'p1', 1).changes), 0, 'the last item cannot be sold twice');
  assert.throws(() => conn.prepare("UPDATE shop_products SET stock_qty = -1 WHERE id = 'p1'").run(), /CHECK/);
});

// ---- One-time permission grant ----

test('grant on a new database: roles already have their shop keys, nothing added, recorded once', () => {
  const conn = freshDb();
  createShopTables(conn);
  assert.equal(grantShopPermissionsOnce(conn), 0);
  assert.ok(conn.prepare('SELECT 1 FROM settings WHERE key = ?').get(SHOP_GRANT_MIGRATION_KEY));
  assert.deepEqual(grantsOf(conn, 'role_marketing'),
    ['orders.view', 'shop.categories', 'shop.stock', 'shop.view', 'shop.write']);
});

test('grant on a database from before the shop: adds the keys once, skips deleted roles, never overrides later edits', () => {
  const conn = freshDb();
  createShopTables(conn);
  // A pre-shop database: seeded roles without shop keys, and the Finance role deleted by the owner.
  conn.exec("DELETE FROM role_permissions WHERE permission_key LIKE 'shop.%' OR permission_key LIKE 'orders.%'");
  conn.exec("DELETE FROM roles WHERE id = 'role_finance'");

  const added = grantShopPermissionsOnce(conn, 1);
  assert.equal(added, 5 + 4, 'Marketing 5 + Operations Manager 4');
  assert.deepEqual(grantsOf(conn, 'role_marketing'),
    ['orders.view', 'shop.categories', 'shop.stock', 'shop.view', 'shop.write']);
  assert.deepEqual(grantsOf(conn, 'role_operations_manager'),
    ['orders.manage', 'orders.view', 'shop.stock', 'shop.view']);
  assert.deepEqual(grantsOf(conn, 'role_finance'), [], 'a deleted role is not recreated');
  assert.deepEqual(grantsOf(conn, 'role_super_admin'), [], 'Super Admin keeps only *');
  assert.deepEqual(grantsOf(conn, 'role_courier'), []);

  // The owner later removes a key: a restart must not put it back.
  conn.exec("DELETE FROM role_permissions WHERE role_id = 'role_marketing' AND permission_key = 'shop.stock'");
  assert.equal(grantShopPermissionsOnce(conn, 2), 0);
  assert.ok(!grantsOf(conn, 'role_marketing').includes('shop.stock'));
});

test('seeded roles get the shop permissions of SHOP_SPEC §3', () => {
  const shopKeys = (id: string) => SEEDED_ROLES.find((r) => r.id === id)!.permissions.filter((k) => k.startsWith('shop.') || k.startsWith('orders.')).sort();
  assert.deepEqual(shopKeys('role_marketing'), ['orders.view', 'shop.categories', 'shop.stock', 'shop.view', 'shop.write']);
  assert.deepEqual(shopKeys('role_operations_manager'), ['orders.manage', 'orders.view', 'shop.stock', 'shop.view']);
  assert.deepEqual(shopKeys('role_finance'), ['orders.payment', 'orders.view', 'shop.view']);
  for (const id of ['role_dispatch_manager', 'role_courier', 'role_customer_support']) assert.deepEqual(shopKeys(id), []);
  // Publishing and settings stay with the Super Admin (the admin's approval step).
  for (const role of SEEDED_ROLES.filter((r) => !r.isLocked)) {
    assert.ok(!role.permissions.includes('shop.publish' as never), role.name);
    assert.ok(!role.permissions.includes('shop.settings' as never), role.name);
  }
  for (const k of ['shop.view', 'shop.write', 'shop.publish', 'shop.stock', 'shop.categories',
    'orders.view', 'orders.manage', 'orders.payment', 'shop.settings']) {
    assert.ok(isPermissionKey(k), k);
  }
  assert.equal(PERMISSIONS.filter((p) => p.group === 'shop').length, 9);
});

// ---- References ----

test('product IDs and order numbers: TX-PRD- / TX-ORD- + 6 digits', () => {
  for (let i = 0; i < 300; i++) {
    const p = generateReference('product');
    const o = generateReference('order');
    assert.match(p, /^TX-PRD-\d{6}$/);
    assert.match(o, /^TX-ORD-\d{6}$/);
    assert.match(p, REFERENCE_PATTERN);
    assert.ok(isReferenceOf('product', p) && isReferenceOf('order', o));
    assert.ok(!isReferenceOf('order', p) && !isReferenceOf('product', o));
  }
  for (const bad of ['TX-ORD-12345', 'TX-ORD-1234567', 'tx-ord-123456', 'TX-PRD-12345A', null, 42]) {
    assert.ok(!isReferenceOf('order', bad) && !isReferenceOf('product', bad), String(bad));
  }
});

// ---- Order rules ----

const delivery: OrderMoveContext = { actor: 'staff', deliveryMethod: 'DELIVERY', deliveryFeeStatus: 'QUOTED' };
const pickup: OrderMoveContext = { actor: 'staff', deliveryMethod: 'PICKUP', deliveryFeeStatus: 'NONE' };

test('order moves follow SHOP_SPEC §10.1', () => {
  assert.deepEqual(checkOrderTransition('NEW', 'CONFIRMED', delivery), { ok: true });
  assert.deepEqual(checkOrderTransition('CONFIRMED', 'READY', delivery), { ok: true });
  assert.deepEqual(checkOrderTransition('READY', 'OUT_FOR_DELIVERY', { ...delivery, actor: 'system' }), { ok: true });
  assert.deepEqual(checkOrderTransition('OUT_FOR_DELIVERY', 'DELIVERED', { ...delivery, actor: 'system' }), { ok: true });
  assert.deepEqual(checkOrderTransition('READY', 'COLLECTED', pickup), { ok: true });
  assert.deepEqual(checkOrderTransition('DELIVERED', 'RETURNED', { ...delivery, reason: 'Wrong size' }), { ok: true });

  const code = (r: ReturnType<typeof checkOrderTransition>) => (r.ok ? 'ok' : r.code);
  assert.equal(code(checkOrderTransition('NEW', 'READY', delivery)), 'ILLEGAL_TRANSITION');
  assert.equal(code(checkOrderTransition('OUT_FOR_DELIVERY', 'CANCELLED', { ...delivery, reason: 'x' })), 'ILLEGAL_TRANSITION');
  assert.equal(code(checkOrderTransition('CANCELLED', 'NEW', delivery)), 'ILLEGAL_TRANSITION');
  assert.equal(code(checkOrderTransition('READY', 'OUT_FOR_DELIVERY', delivery)), 'SYSTEM_ONLY', 'only Send to dispatch');
  assert.equal(code(checkOrderTransition('OUT_FOR_DELIVERY', 'DELIVERED', delivery)), 'SYSTEM_ONLY', 'only the dispatch job');
  assert.equal(code(checkOrderTransition('NEW', 'CONFIRMED', { ...delivery, deliveryFeeStatus: 'TO_CONFIRM' })), 'FEE_TO_CONFIRM');
  assert.equal(code(checkOrderTransition('READY', 'COLLECTED', delivery)), 'WRONG_DELIVERY_METHOD');
  assert.equal(code(checkOrderTransition('READY', 'OUT_FOR_DELIVERY', { ...pickup, actor: 'system' })), 'WRONG_DELIVERY_METHOD');
  assert.equal(code(checkOrderTransition('NEW', 'CANCELLED', delivery)), 'REASON_REQUIRED');
  assert.equal(code(checkOrderTransition('NEW', 'CANCELLED', { ...delivery, reason: '  ' })), 'REASON_REQUIRED');
  assert.equal(code(checkOrderTransition('NEW', 'CANCELLED', { ...delivery, reason: 'Customer asked' })), 'ok');
});

test('the console offers only staff moves; stock goes back on cancel, and on return only when ticked', () => {
  assert.deepEqual(staffNextStatuses('NEW', { deliveryMethod: 'DELIVERY', deliveryFeeStatus: 'TO_CONFIRM' }), ['CONFIRMED', 'CANCELLED']);
  assert.deepEqual(staffNextStatuses('READY', { deliveryMethod: 'DELIVERY', deliveryFeeStatus: 'QUOTED' }), ['CANCELLED']);
  assert.deepEqual(staffNextStatuses('READY', { deliveryMethod: 'PICKUP', deliveryFeeStatus: 'NONE' }), ['COLLECTED', 'CANCELLED']);
  assert.deepEqual(staffNextStatuses('OUT_FOR_DELIVERY', { deliveryMethod: 'DELIVERY', deliveryFeeStatus: 'QUOTED' }), []);
  assert.ok(restocksOn('CANCELLED'));
  assert.ok(!restocksOn('RETURNED') && restocksOn('RETURNED', true));
  assert.ok(!restocksOn('DELIVERED', true));
  for (const s of ORDER_STATUSES) assert.ok(ORDER_STATUS_LABELS[s].en && ORDER_STATUS_LABELS[s].fr, s);
});

test('payments: methods fit the delivery choice; refunds and corrections need a reason', () => {
  assert.ok(paymentMethodFits('CASH_ON_DELIVERY', 'DELIVERY') && !paymentMethodFits('CASH_ON_DELIVERY', 'PICKUP'));
  assert.ok(paymentMethodFits('PAY_AT_OFFICE', 'PICKUP') && !paymentMethodFits('PAY_AT_OFFICE', 'DELIVERY'));
  assert.ok(paymentMethodFits('MTN_MOMO', 'DELIVERY') && paymentMethodFits('ORANGE_MONEY', 'PICKUP'));
  assert.deepEqual(checkPaymentChange('UNPAID', 'PAID'), { ok: true });
  assert.deepEqual(checkPaymentChange('PAID', 'REFUNDED', 'Returned item'), { ok: true });
  assert.deepEqual(checkPaymentChange('PAID', 'REFUNDED'), { ok: false, code: 'REASON_REQUIRED' });
  assert.deepEqual(checkPaymentChange('PAID', 'UNPAID', 'Reference rejected'), { ok: true });
  assert.deepEqual(checkPaymentChange('UNPAID', 'REFUNDED', 'x'), { ok: false, code: 'ILLEGAL_TRANSITION' });
  assert.deepEqual(checkPaymentChange('REFUNDED', 'PAID', 'x'), { ok: false, code: 'ILLEGAL_TRANSITION' });
  assert.equal(orderTotal(45000, 1500), 46500);
  assert.equal(orderTotal(45000, null), 45000);
});

// ---- Product rules ----

test('products: writers submit, only publishers publish, send back needs a note', () => {
  assert.deepEqual(checkProductTransition('DRAFT', 'IN_REVIEW', 'writer'), { ok: true });
  assert.deepEqual(checkProductTransition('DRAFT', 'PUBLISHED', 'writer'), { ok: false, code: 'ILLEGAL_TRANSITION' });
  assert.deepEqual(checkProductTransition('IN_REVIEW', 'PUBLISHED', 'writer'), { ok: false, code: 'ILLEGAL_TRANSITION' });
  assert.deepEqual(checkProductTransition('IN_REVIEW', 'PUBLISHED', 'publisher'), { ok: true });
  assert.deepEqual(checkProductTransition('IN_REVIEW', 'DRAFT', 'publisher'), { ok: false, code: 'REASON_REQUIRED' });
  assert.deepEqual(checkProductTransition('IN_REVIEW', 'DRAFT', 'publisher', 'Add the French name'), { ok: true });
  assert.deepEqual(checkProductTransition('PUBLISHED', 'HIDDEN', 'writer'), { ok: false, code: 'ILLEGAL_TRANSITION' });
  assert.deepEqual(checkProductTransition('ARCHIVED', 'PUBLISHED', 'publisher'), { ok: false, code: 'ILLEGAL_TRANSITION' });
  assert.deepEqual(checkProductTransition('ARCHIVED', 'HIDDEN', 'publisher'), { ok: true });
  assert.ok(isPublicProductStatus('PUBLISHED') && !isPublicProductStatus('HIDDEN') && !isPublicProductStatus('IN_REVIEW'));
  // A writer's edit to a live product waits for approval; drafts are edited directly.
  assert.ok(editIsProposal('PUBLISHED', 'writer') && !editIsProposal('PUBLISHED', 'publisher') && !editIsProposal('DRAFT', 'writer'));
  assert.ok(canEditContent('DRAFT', 'writer') && canEditContent('PUBLISHED', 'writer') && !canEditContent('ARCHIVED', 'publisher'));
});

test('products need both languages and a valid price to publish', () => {
  const full = { name_en: 'Gift box', name_fr: 'Coffret', short_en: 'A box.', short_fr: 'Un coffret.', slug_en: 'gift-box', slug_fr: 'coffret', price: 5000 };
  assert.deepEqual(missingForPublish(full), []);
  assert.deepEqual(missingForPublish({ ...full, name_fr: ' ', short_fr: null }), ['name_fr', 'short_fr']);
  assert.deepEqual(missingForPublish({ ...full, price: 0 }), ['price']);
  assert.ok(isValidPrice(500) && !isValidPrice(0) && !isValidPrice(499.5) && !isValidPrice('500'));
  assert.ok(isValidSalePrice(null, 5000) && isValidSalePrice(4000, 5000));
  assert.ok(!isValidSalePrice(5000, 5000) && !isValidSalePrice(6000, 5000) && !isValidSalePrice(0, 5000));
  assert.equal(effectivePrice(5000, 4000), 4000);
  assert.equal(effectivePrice(5000, null), 5000);
  assert.ok(isValidShopSlug('gift-box-2') && !isValidShopSlug('Gift-Box') && !isValidShopSlug('gift--box'));
  for (const reserved of ['category', 'categorie', 'cart', 'panier']) assert.ok(!isValidShopSlug(reserved), reserved);
});

// ---- Settings ----

test('shop settings: off by default, orders to info@, invalid values fall back', () => {
  assert.equal(DEFAULT_SHOP_SETTINGS.enabled, false);
  assert.equal(DEFAULT_SHOP_SETTINGS.orderEmail, EMAIL);
  assert.equal(EMAIL, 'info@tanexsarl.com');
  assert.deepEqual(PICKUP_OFFICE_KEYS, ['buea', 'douala']);
  assert.deepEqual(readShopSettings(undefined), DEFAULT_SHOP_SETTINGS);
  const s = readShopSettings({
    enabled: 'yes', orderEmail: 'not an email', pickupOffices: ['douala', 'paris', 'douala'],
    paymentMethods: ['MTN_MOMO', 'BITCOIN'], lowStockAt: -1, maxPerOrder: 5,
    shipFrom: { cityId: 'city_buea', zoneId: '', landmark: '  Check Point  ' },
  });
  assert.equal(s.enabled, false, 'only a real true opens the shop');
  assert.equal(s.orderEmail, EMAIL);
  assert.deepEqual(s.pickupOffices, ['douala']);
  assert.deepEqual(s.paymentMethods, ['MTN_MOMO']);
  assert.equal(s.lowStockAt, 3);
  assert.equal(s.maxPerOrder, 5);
  assert.deepEqual(s.shipFrom, { cityId: 'city_buea', zoneId: null, landmark: 'Check Point' });
  assert.deepEqual(readShopSettings({ paymentMethods: [] }).paymentMethods, DEFAULT_SHOP_SETTINGS.paymentMethods, 'at least one method stays offered');
  assert.equal(readShopSettings({ enabled: true, orderEmail: ' sales@example.test ' }).orderEmail, 'sales@example.test');
});
