// Shop catalogue API (docs/SHOP_SPEC.md §3, §4, §7, task M.3) against the real /api mounts on a
// file database in a temp folder, signed in as the seeded roles: products and their review
// (writer submits, only a publisher publishes, send back needs a note, proposed changes leave the
// live product alone until approved), stock with history, safe descriptions, pictures and
// categories. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shopcat-test-'));
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
function addUser(id: string, roleId: string) {
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, `${id}@example.test`, id, HASH, now0, now0);
  db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, roleId);
}
addUser('mkt', 'role_marketing');            // writer: shop.write, stock, categories
addUser('admin', 'role_super_admin');        // publisher: everything
addUser('ops', 'role_operations_manager');   // shop.view, shop.stock
addUser('fin', 'role_finance');              // shop.view only (for products)

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
async function call(user: string | null, method: string, p: string, body?: unknown): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {};
  if (user) headers.Cookie = await as(user);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api/admin/shop${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const doc = (...blocks: unknown[]) => ({ type: 'doc', content: blocks });
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const COMPLETE = { nameEn: 'Gift box', nameFr: 'Coffret cadeau', shortEn: 'A gift box.', shortFr: 'Un coffret.', price: 5000 };
const fakeMedia = (id: string) => db.prepare(`
  INSERT INTO shop_media (id, file_1200, file_600, file_300, jpg_1200, jpg_600, bytes_total, uploaded_by, created_at_ts)
  VALUES (?, ?, ?, ?, ?, ?, 1, 'mkt', 0)
`).run(id, `${id}-a.webp`, `${id}-b.webp`, `${id}-c.webp`, `${id}-d.jpg`, `${id}-e.jpg`);

test('create: a draft with a product ID, its own web addresses and its starting stock recorded', async () => {
  const r = await call('mkt', 'POST', '/products', { ...COMPLETE, stockQty: 12 });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const p = r.json.data;
  assert.match(p.productCode, /^TX-PRD-\d{6}$/);
  assert.equal(p.status, 'DRAFT');
  assert.equal(p.slugEn, 'gift-box');
  assert.equal(p.slugFr, 'coffret-cadeau');
  assert.equal(p.stockQty, 12);
  const again = await call('mkt', 'POST', '/products', { ...COMPLETE, stockQty: 0 });
  assert.equal(again.json.data.slugEn, 'gift-box-2', 'a free web address is chosen');
  const moves = await call('mkt', 'GET', `/products/${p.id}/stock-moves`);
  assert.deepEqual(moves.json.data.map((m: any) => [m.reason, m.delta, m.stockAfter]), [['INITIAL', 12, 12]]);
  const audits = db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'shop.product_create'").get() as { c: number };
  assert.equal(audits.c, 2);
});

test('input is checked: name, price, sale below price, reserved and taken web addresses', async () => {
  assert.equal((await call('mkt', 'POST', '/products', { price: 100 })).json.field, 'nameEn');
  assert.equal((await call('mkt', 'POST', '/products', { nameEn: 'X', price: 0 })).json.field, 'price');
  assert.equal((await call('mkt', 'POST', '/products', { nameEn: 'X', price: 99.5 })).json.field, 'price');
  assert.equal((await call('mkt', 'POST', '/products', { nameEn: 'X', price: 1000, salePrice: 1000 })).json.field, 'salePrice');
  assert.equal((await call('mkt', 'POST', '/products', { nameEn: 'X', price: 1000, slugEn: 'cart' })).json.field, 'slugEn');
  const taken = await call('mkt', 'POST', '/products', { nameEn: 'X', price: 1000, slugEn: 'gift-box' });
  assert.equal(taken.status, 409);
  assert.equal(taken.json.code, 'SHOP_SLUG_TAKEN');
  assert.equal((await call('mkt', 'POST', '/products', { nameEn: 'X', price: 1000, stockQty: -1 })).json.field, 'stockQty');
});

test('review: writer submits, cannot publish; publish needs both languages; send back needs a note', async () => {
  const draft = (await call('mkt', 'POST', '/products', { nameEn: 'Phone case', price: 3000 })).json.data;
  assert.equal((await call('mkt', 'POST', `/products/${draft.id}/status`, { status: 'PUBLISHED' })).status, 403);
  assert.equal((await call('mkt', 'POST', `/products/${draft.id}/status`, { status: 'IN_REVIEW' })).json.data.status, 'IN_REVIEW');

  const notReady = await call('admin', 'POST', `/products/${draft.id}/status`, { status: 'PUBLISHED' });
  assert.equal(notReady.status, 400);
  assert.equal(notReady.json.code, 'SHOP_NOT_READY');
  assert.deepEqual(notReady.json.missing, ['name_fr', 'short_en', 'short_fr']);

  assert.equal((await call('admin', 'POST', `/products/${draft.id}/status`, { status: 'DRAFT' })).json.code, 'SHOP_NOTE_REQUIRED');
  const back = await call('admin', 'POST', `/products/${draft.id}/status`, { status: 'DRAFT', note: 'Add the French name' });
  assert.equal(back.json.data.status, 'DRAFT');
  assert.equal(back.json.data.reviewNote, 'Add the French name');

  await call('mkt', 'PUT', `/products/${draft.id}`, { nameFr: 'Coque', shortEn: 'A case.', shortFr: 'Une coque.' });
  await call('mkt', 'POST', `/products/${draft.id}/status`, { status: 'IN_REVIEW' });
  const live = await call('admin', 'POST', `/products/${draft.id}/status`, { status: 'PUBLISHED' });
  assert.equal(live.json.data.status, 'PUBLISHED');
  assert.equal(live.json.data.reviewNote, null);
  assert.equal(live.json.data.publishedBy, 'admin');
});

test('proposed changes: a writer edit to a live product waits; approve applies it, reject clears it', async () => {
  const p = (await call('admin', 'POST', '/products', { ...COMPLETE, nameEn: 'Lamp', price: 8000 })).json.data;
  await call('admin', 'POST', `/products/${p.id}/status`, { status: 'PUBLISHED' });

  const proposed = await call('mkt', 'PUT', `/products/${p.id}`, { price: 7500, nameEn: 'Desk lamp' });
  assert.equal(proposed.json.mode, 'proposed');
  assert.equal(proposed.json.data.price, 8000, 'live price unchanged');
  assert.equal(proposed.json.data.nameEn, 'Lamp');
  assert.deepEqual(proposed.json.data.pending.changes, { price: 7500, nameEn: 'Desk lamp' });
  await call('mkt', 'PUT', `/products/${p.id}`, { price: 7000 });
  const merged = (await call('mkt', 'GET', `/products/${p.id}`)).json.data;
  assert.deepEqual(merged.pending.changes, { price: 7000, nameEn: 'Desk lamp' }, 'later edits win field by field');
  const review = await call('admin', 'GET', '/products?status=NEEDS_REVIEW');
  assert.ok(review.json.data.some((x: any) => x.id === p.id && x.hasPending));

  assert.equal((await call('mkt', 'POST', `/products/${p.id}/pending/approve`)).status, 403);
  const approved = await call('admin', 'POST', `/products/${p.id}/pending/approve`);
  assert.equal(approved.json.data.price, 7000);
  assert.equal(approved.json.data.nameEn, 'Desk lamp');
  assert.equal(approved.json.data.pending, null);

  await call('mkt', 'PUT', `/products/${p.id}`, { price: 1 });
  assert.equal((await call('admin', 'POST', `/products/${p.id}/pending/reject`, {})).json.code, 'SHOP_NOTE_REQUIRED');
  const rejected = await call('admin', 'POST', `/products/${p.id}/pending/reject`, { note: 'Price too low' });
  assert.equal(rejected.json.data.price, 7000);
  assert.equal(rejected.json.data.pending, null);
  assert.equal(rejected.json.data.reviewNote, 'Price too low');
  assert.equal((await call('admin', 'POST', `/products/${p.id}/pending/approve`)).json.code, 'SHOP_NO_PENDING');

  // A publisher's own edits apply directly.
  assert.equal((await call('admin', 'PUT', `/products/${p.id}`, { price: 6500 })).json.mode, 'saved');
});

test('hide, archive (read-only), restore; only drafts are deleted', async () => {
  const p = (await call('admin', 'POST', '/products', { ...COMPLETE, nameEn: 'Mug' })).json.data;
  await call('admin', 'POST', `/products/${p.id}/status`, { status: 'PUBLISHED' });
  assert.equal((await call('mkt', 'POST', `/products/${p.id}/status`, { status: 'HIDDEN' })).status, 403);
  assert.equal((await call('admin', 'POST', `/products/${p.id}/status`, { status: 'ARCHIVED' })).json.data.status, 'ARCHIVED');
  assert.equal((await call('admin', 'PUT', `/products/${p.id}`, { price: 10 })).json.code, 'SHOP_PRODUCT_LOCKED');
  assert.equal((await call('admin', 'DELETE', `/products/${p.id}`)).json.code, 'SHOP_PRODUCT_NOT_DRAFT');
  assert.ok(!(await call('admin', 'GET', '/products')).json.data.some((x: any) => x.id === p.id), 'archived hidden from the default list');
  assert.ok((await call('admin', 'GET', '/products?status=ARCHIVED')).json.data.some((x: any) => x.id === p.id));
  assert.equal((await call('admin', 'POST', `/products/${p.id}/status`, { status: 'HIDDEN' })).json.data.status, 'HIDDEN');

  const d = (await call('mkt', 'POST', '/products', { nameEn: 'Temp', price: 100, stockQty: 3 })).json.data;
  assert.equal((await call('mkt', 'DELETE', `/products/${d.id}`)).status, 200);
  assert.equal((await call('mkt', 'GET', `/products/${d.id}`)).status, 404);
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM shop_stock_moves WHERE product_id = ?').get(d.id) as { c: number }).c, 0);
});

test('stock: set or add with a reason, never below 0, history kept; only shop.stock may change it', async () => {
  const p = (await call('mkt', 'POST', '/products', { nameEn: 'Torch', price: 2500, stockQty: 5 })).json.data;
  assert.equal((await call('ops', 'POST', `/products/${p.id}/stock`, { mode: 'add', quantity: 10, reason: 'RECEIVED' })).json.data.stockQty, 15);
  assert.equal((await call('mkt', 'POST', `/products/${p.id}/stock`, { mode: 'set', quantity: 14, reason: 'COUNTED' })).json.data.stockQty, 14);
  const neg = await call('ops', 'POST', `/products/${p.id}/stock`, { mode: 'add', quantity: -20, reason: 'DAMAGED' });
  assert.equal(neg.json.code, 'SHOP_STOCK_NEGATIVE');
  assert.equal((await call('ops', 'POST', `/products/${p.id}/stock`, { mode: 'set', quantity: 14, reason: 'COUNTED' })).json.code, 'SHOP_STOCK_UNCHANGED');
  assert.equal((await call('ops', 'POST', `/products/${p.id}/stock`, { mode: 'add', quantity: -1, reason: 'OTHER' })).json.code, 'SHOP_NOTE_REQUIRED');
  assert.equal((await call('fin', 'POST', `/products/${p.id}/stock`, { mode: 'add', quantity: 1, reason: 'RECEIVED' })).status, 403);
  const moves = (await call('fin', 'GET', `/products/${p.id}/stock-moves`)).json.data;
  assert.deepEqual(moves.map((m: any) => [m.delta, m.stockAfter, m.by]), [[-1, 14, 'mkt'], [10, 15, 'ops'], [5, 5, 'mkt']]);
  const low = await call('ops', 'GET', '/products?stock=low');
  assert.ok(!low.json.data.some((x: any) => x.id === p.id), '14 is above the default low-stock level of 3');
  await call('ops', 'POST', `/products/${p.id}/stock`, { mode: 'set', quantity: 2, reason: 'COUNTED' });
  assert.ok((await call('ops', 'GET', '/products?stock=low')).json.data.some((x: any) => x.id === p.id));
  // Stock changes apply at once even on a live product (no approval).
  assert.equal(db.prepare('SELECT stock_qty FROM shop_products WHERE id = ?').get(p.id)!.stock_qty, 2);
});

test('descriptions keep only headings, lists, bold, italic and links; scripts and tables never survive', async () => {
  const p = (await call('mkt', 'POST', '/products', {
    nameEn: 'Bag', price: 9000,
    descriptionEn: doc(
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Strong', marks: [{ type: 'bold' }] }, { type: 'text', text: '<script>alert(1)</script>' }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para('In a table')] }] }] },
      { type: 'image', attrs: { src: 'https://evil.example/x.png', alt: 'x' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    ),
  })).json.data;
  const html = (db.prepare('SELECT description_en_html AS h FROM shop_products WHERE id = ?').get(p.id) as { h: string }).h;
  assert.match(html, /<h2>Details<\/h2>/);
  assert.match(html, /<strong>Strong<\/strong>/);
  assert.match(html, /In a table/);
  assert.doesNotMatch(html, /<script|<table|<img|javascript:/i);
  assert.match(html, /&lt;script&gt;/);
  const empty = (await call('mkt', 'PUT', `/products/${p.id}`, { descriptionEn: doc({ type: 'paragraph' }) })).json.data;
  assert.equal(empty.descriptionEn, null, 'an empty editor clears the description');
});

test('pictures: linked in order with alt text, up to 8, only stored pictures', async () => {
  for (let i = 1; i <= 9; i++) fakeMedia(`m${i}`);
  const p = (await call('mkt', 'POST', '/products', { nameEn: 'Shoes', price: 15000 })).json.data;
  const saved = (await call('mkt', 'PUT', `/products/${p.id}`, {
    images: [{ mediaId: 'm2', altEn: 'Side', altFr: 'Côté' }, { mediaId: 'm1', altEn: null, altFr: null }],
  })).json.data;
  assert.deepEqual(saved.images.map((i: any) => i.mediaId), ['m2', 'm1']);
  assert.equal(saved.images[0].altFr, 'Côté');
  assert.match(saved.thumbnail, /m2-c\.webp$/, 'the first picture is the main one');
  const nine = Array.from({ length: 9 }, (_, i) => ({ mediaId: `m${i + 1}` }));
  assert.equal((await call('mkt', 'PUT', `/products/${p.id}`, { images: nine })).json.field, 'images');
  assert.equal((await call('mkt', 'PUT', `/products/${p.id}`, { images: [{ mediaId: 'nope' }] })).json.field, 'images');
  assert.equal((await call('mkt', 'PUT', `/products/${p.id}`, { images: [{ mediaId: 'm1' }, { mediaId: 'm1' }] })).json.field, 'images');
  // A used picture can't be deleted from the library.
  assert.equal((await call('mkt', 'DELETE', '/media/m2')).json.code, 'SHOP_MEDIA_IN_USE');
});

test('categories: one level, both names required, unique web addresses, order, delete only when empty', async () => {
  assert.equal((await call('mkt', 'POST', '/categories', { nameEn: 'Home' })).json.field, 'nameFr');
  const home = (await call('mkt', 'POST', '/categories', { nameEn: 'Home & living', nameFr: 'Maison' })).json.data;
  assert.equal(home.slugEn, 'home-living');
  assert.equal(home.slugFr, 'maison');
  const kitchen = (await call('mkt', 'POST', '/categories', { nameEn: 'Kitchen', nameFr: 'Cuisine', parentId: home.id })).json.data;
  assert.equal(kitchen.parentId, home.id);
  assert.equal((await call('mkt', 'POST', '/categories', { nameEn: 'Pans', nameFr: 'Poêles', parentId: kitchen.id })).json.field, 'parentId', 'one level only');
  assert.equal((await call('mkt', 'PUT', `/categories/${home.id}`, { parentId: kitchen.id })).json.field, 'parentId');
  assert.equal((await call('fin', 'POST', '/categories', { nameEn: 'X', nameFr: 'X' })).status, 403);

  const p = (await call('mkt', 'POST', '/products', { nameEn: 'Pan', price: 4000, categoryIds: [kitchen.id] })).json.data;
  assert.deepEqual(p.categoryIds, [kitchen.id]);
  assert.equal((await call('mkt', 'POST', '/products', { nameEn: 'Pan 2', price: 4000, categoryIds: ['nope'] })).json.field, 'categoryIds');
  const inUse = await call('mkt', 'DELETE', `/categories/${kitchen.id}`);
  assert.equal(inUse.json.code, 'SHOP_CATEGORY_IN_USE');
  assert.equal(inUse.json.products, 1);
  assert.equal((await call('mkt', 'DELETE', `/categories/${home.id}`)).json.code, 'SHOP_CATEGORY_HAS_CHILDREN');
  assert.equal((await call('mkt', 'GET', `/products?category=${kitchen.id}`)).json.data.length, 1);

  await call('mkt', 'PUT', '/categories-order', { ids: [kitchen.id, home.id] });
  const list = (await call('fin', 'GET', '/categories')).json.data;
  assert.deepEqual(list.map((c: any) => c.id), [kitchen.id, home.id]);
  assert.equal(list[0].productCount, 1);

  await call('mkt', 'PUT', `/products/${p.id}`, { categoryIds: [] });
  assert.equal((await call('mkt', 'DELETE', `/categories/${kitchen.id}`)).status, 200);
});

test('permissions: signed out 401; Finance reads but cannot write; Operations cannot create products', async () => {
  assert.equal((await call(null, 'GET', '/products')).status, 401);
  assert.equal((await call('fin', 'GET', '/products')).status, 200);
  assert.equal((await call('fin', 'POST', '/products', { nameEn: 'X', price: 1 })).status, 403);
  assert.equal((await call('ops', 'POST', '/products', { nameEn: 'X', price: 1 })).status, 403);
  assert.equal((await call('ops', 'GET', '/categories')).status, 200);
});
