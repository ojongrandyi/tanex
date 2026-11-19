// Public shop (docs/SHOP_SPEC.md §8, §14, task M.4): the public API and the shop page addresses on
// a file database in a temp folder. While the shop is off nothing exists (API and pages 404);
// once on, only PUBLISHED products and visible categories show, stock counts appear only at or below
// the low-stock level, search/sort/filters/pages work, and a product page carries its pictures,
// both addresses and up to four related products, in-stock first. Rows are written directly;
// nothing is kept. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Request, Response, NextFunction } from 'express';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shoppub-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { publicPages, sendIndex } = await import('../server/publicPages.ts');
const { createIndexRenderer, sitemapPaths } = await import('../server/render/pageMeta.ts');
const { resolveShopPage } = await import('../server/shop/pageData.ts');
const { publicStock, orderLimit, effectivePrice, shopListPage } = await import('../src/shared/shopPublic.ts');
const { matchPath, buildPath, pagePath } = await import('../src/router/routes.ts');

initDatabase();

const indexPath = path.join(process.cwd(), 'index.html');
const render = createIndexRenderer(indexPath);
const app = express();
app.use(express.json());
registerApiRoutes(app);
app.use(publicPages(render, indexPath, undefined, (match, query) => resolveShopPage(db, match, query)));
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404);
  sendIndex(res, next, render, { kind: 'not-found', lang: req.path.startsWith('/fr/') ? 'fr' : 'en' }, indexPath);
});
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const api = async (p: string) => {
  const res = await fetch(`${BASE}/api/shop${p}`);
  return { status: res.status, json: await res.json().catch(() => null) as any };
};
const page = (p: string) => fetch(BASE + p, { redirect: 'manual' });
const setShop = (value: Record<string, unknown>) => db.prepare(`
  INSERT INTO settings (key, value_json) VALUES ('shop', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`).run(JSON.stringify(value));

const now = Date.now();
let n = 0;
function addMedia(id: string) {
  db.prepare(`
    INSERT INTO shop_media (id, file_1200, file_600, file_300, jpg_1200, jpg_600, bytes_total, uploaded_by, created_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, 1, 'staff', 0)
  `).run(id, `${id}-a.webp`, `${id}-b.webp`, `${id}-c.webp`, `${id}-d.jpg`, `${id}-e.jpg`);
}
function addProduct(p: {
  slug: string; status?: string; price?: number; sale?: number | null; stock?: number; low?: number | null; max?: number | null;
  featured?: boolean; at?: number; cats?: string[]; images?: { media: string; altEn?: string }[];
}) {
  const id = `prod-${++n}`;
  db.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, name_fr, short_en, short_fr,
      description_en_html, description_fr_html, price, sale_price, stock_qty, low_stock_at, max_per_order, status, is_featured,
      pending_changes_json, review_note, created_by, published_by, published_at_ts, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '<p>About it</p>', '<p>À propos</p>', ?, ?, ?, ?, ?, ?, ?, ?, 'Internal note', 'staff', 'staff', ?, ?, ?)
  `).run(id, `TX-PRD-${String(100000 + n)}`, p.slug, `${p.slug}-fr`, `Name ${p.slug}`, `Nom ${p.slug}`, `Short ${p.slug}`, `Court ${p.slug}`,
    p.price ?? 1000, p.sale ?? null, p.stock ?? 50, p.low ?? null, p.max ?? null, p.status ?? 'PUBLISHED', p.featured ? 1 : 0,
    p.status === 'PUBLISHED' || !p.status ? '{"nameEn":"Secret proposal"}' : null, p.at ?? now - n * 1000, now, now);
  for (const c of p.cats ?? []) db.prepare('INSERT INTO shop_product_categories (product_id, category_id) VALUES (?, ?)').run(id, c);
  (p.images ?? []).forEach((img, i) => db.prepare(`
    INSERT INTO shop_product_images (product_id, media_id, position, alt_en, alt_fr) VALUES (?, ?, ?, ?, NULL)
  `).run(id, img.media, i, img.altEn ?? null));
  return id;
}
function addCategory(id: string, slug: string, opts: { parent?: string; visible?: boolean; sort?: number } = {}) {
  db.prepare(`
    INSERT INTO shop_categories (id, parent_id, slug_en, slug_fr, name_en, name_fr, description_en, description_fr, sort_order, is_visible, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, opts.parent ?? null, slug, `${slug}-fr`, `Cat ${slug}`, `Cat FR ${slug}`, `About ${slug}`, `À propos ${slug}`, opts.sort ?? 0, opts.visible === false ? 0 : 1, now, now);
}

test('shared rules: stock line, order limit, sale price, page number', () => {
  assert.deepEqual(publicStock(0, 3), { state: 'out' });
  assert.deepEqual(publicStock(-1, 3), { state: 'out' });
  assert.deepEqual(publicStock(3, 3), { state: 'low', left: 3 });
  assert.deepEqual(publicStock(4, 3), { state: 'in' });
  assert.equal(orderLimit({ state: 'out' }, 10), 0);
  assert.equal(orderLimit({ state: 'low', left: 2 }, 10), 2);
  assert.equal(orderLimit({ state: 'low', left: 5 }, 3), 3);
  assert.equal(orderLimit({ state: 'in' }, 10), 10, 'never reveals a count above the low-stock level');
  assert.equal(effectivePrice(1000, 800), 800);
  assert.equal(effectivePrice(1000, 1000), 1000);
  assert.equal(effectivePrice(1000, null), 1000);
  assert.equal(shopListPage('3'), 3);
  assert.equal(shopListPage('0'), 1);
  assert.equal(shopListPage('x'), 1);
});

test('routes: shop, category and product addresses in both languages; reserved words are not products', () => {
  assert.deepEqual(matchPath('/shop'), { id: 'shop', lang: 'en', canonical: '/shop' });
  assert.equal(matchPath('/fr/boutique/sac')?.param, 'sac');
  assert.equal(matchPath('/shop/category/bags')?.id, 'shop-category');
  assert.equal(matchPath('/fr/boutique/categorie/sacs')?.id, 'shop-category');
  // /shop/category alone reads as a product slug, as /blog/category does; "category" is a reserved
  // slug (shopProduct.ts), so no product has it and the page is a 404 (tested below).
  assert.equal(matchPath('/shop/category')?.id, 'shop');
  assert.equal(matchPath('/cart')?.id, 'cart', 'the cart page is live since M.5');
  assert.equal(matchPath('/fr/panier')?.id, 'cart');
  assert.equal(pagePath('shop-product', 'bag', 'fr'), '/fr/boutique/bag');
  assert.equal(buildPath('shop-category', 'bags', 'en'), '/shop/category/bags');
  const sitemap = sitemapPaths().flatMap((p) => [p.en, p.fr]);
  assert.ok(!sitemap.some((p) => p.includes('/shop') || p.includes('/boutique') || p.includes('/cart')), 'shop stays out of the sitemap until M.8');
});

test('shop off (the default): every API route and every shop page is a 404', async () => {
  addCategory('cat-off', 'off');
  addProduct({ slug: 'visible-when-on', cats: ['cat-off'] });
  for (const p of ['/categories', '/products', '/products/visible-when-on']) {
    const r = await api(p);
    assert.equal(r.status, 404, p);
    assert.equal(r.json.code, 'NOT_FOUND');
  }
  for (const p of ['/shop', '/fr/boutique', '/shop/visible-when-on', '/shop/category/off']) {
    assert.equal((await page(p)).status, 404, p);
  }
  db.exec('DELETE FROM shop_product_categories; DELETE FROM shop_products; DELETE FROM shop_categories;');
});

test('shop on and empty: an empty list, the shop page answers 200, an unknown product 404', async () => {
  setShop({ enabled: true });
  const list = await api('/products');
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.data, []);
  assert.equal(list.json.total, 0);
  assert.deepEqual((await api('/categories')).json.data, []);
  assert.equal((await page('/shop')).status, 200);
  assert.equal((await page('/fr/boutique')).status, 200);
  assert.equal((await page('/shop/nothing-here')).status, 404);
  assert.equal((await page('/shop?page=2')).status, 404, 'past the last page');
  assert.equal((await api('/products?locale=de')).status, 400);
});

test('seed: categories (one hidden, one sub-category) and products in every status', () => {
  setShop({ enabled: true, lowStockAt: 3, maxPerOrder: 10 });
  addMedia('m1');
  addMedia('m2');
  addCategory('c-bags', 'bags', { sort: 1 });
  addCategory('c-small', 'small-bags', { parent: 'c-bags', sort: 2 });
  addCategory('c-hidden', 'hidden', { visible: false });
  addCategory('c-under-hidden', 'under-hidden', { parent: 'c-hidden' });
  addCategory('c-empty', 'empty');
  addProduct({ slug: 'tote', price: 15000, stock: 40, featured: true, cats: ['c-bags'], images: [{ media: 'm1', altEn: 'A brown tote' }, { media: 'm2' }] });
  addProduct({ slug: 'purse', price: 8000, sale: 6000, stock: 2, cats: ['c-small'] });
  addProduct({ slug: 'wallet', price: 7000, stock: 0, cats: ['c-bags'] });
  addProduct({ slug: 'belt', price: 5000, stock: 5, low: 5, max: 3, cats: ['c-hidden'] });
  addProduct({ slug: 'draft-thing', status: 'DRAFT', cats: ['c-bags'] });
  addProduct({ slug: 'review-thing', status: 'IN_REVIEW', cats: ['c-bags'] });
  addProduct({ slug: 'hidden-thing', status: 'HIDDEN', cats: ['c-bags'] });
  addProduct({ slug: 'archived-thing', status: 'ARCHIVED', cats: ['c-bags'] });
});

test('list: only published products; stock shown only at or below the low-stock level; no private fields', async () => {
  const r = await api('/products');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.data.map((p: any) => p.slug).sort(), ['belt', 'purse', 'tote', 'wallet']);
  const by = Object.fromEntries(r.json.data.map((p: any) => [p.slug, p]));
  assert.deepEqual(by.tote.stock, { state: 'in' });
  assert.equal(by.tote.maxQty, 10);
  assert.deepEqual(by.purse.stock, { state: 'low', left: 2 });
  assert.equal(by.purse.maxQty, 2);
  assert.equal(by.purse.salePrice, 6000);
  assert.deepEqual(by.wallet.stock, { state: 'out' });
  assert.equal(by.wallet.maxQty, 0);
  assert.deepEqual(by.belt.stock, { state: 'low', left: 5 }, "the product's own low-stock level wins");
  assert.equal(by.belt.maxQty, 3, "the product's own limit wins");
  assert.equal(by.tote.image.alt, 'A brown tote');
  assert.match(by.tote.image.urls.w1200, /^\/media\/shop\/m1-a\.webp$/);
  assert.equal(by.tote.path, '/shop/tote');
  const text = JSON.stringify(r.json);
  for (const secret of ['stock_qty', 'stockQty', 'Secret proposal', 'Internal note', 'staff', 'pending', 'review']) {
    assert.ok(!text.includes(secret), `public list must not include ${secret}`);
  }
  assert.ok(!text.includes('"40"') && !/"left":40/.test(text), 'a stock count above the low-stock level never leaves');
});

test('list: sort orders use the price paid; in-stock filter; search by name and product ID; French', async () => {
  const order = async (q: string) => (await api(`/products?${q}`)).json.data.map((p: any) => p.slug);
  assert.deepEqual(await order('sort=price-asc'), ['belt', 'purse', 'wallet', 'tote'], 'purse sells at 6,000');
  assert.deepEqual(await order('sort=price-desc'), ['tote', 'wallet', 'purse', 'belt']);
  assert.equal((await order('sort=featured'))[0], 'tote');
  assert.deepEqual(await order('sort=newest'), ['tote', 'purse', 'wallet', 'belt']);
  assert.ok(!(await order('inStock=1')).includes('wallet'));
  assert.deepEqual(await order('q=purse'), ['purse']);
  assert.deepEqual(await order('q=%25'), [], 'LIKE wildcards are plain text');
  const code = (await api('/products?q=purse')).json.data[0].code;
  assert.deepEqual(await order(`q=${code}`), ['purse']);
  const fr = await api('/products?locale=fr&q=Nom%20tote');
  assert.equal(fr.json.data[0].slug, 'tote-fr');
  assert.equal(fr.json.data[0].path, '/fr/boutique/tote-fr');
  assert.equal(fr.json.data[0].name, 'Nom tote');
});

test('categories: visible ones with a published product; a parent lists its sub-category products', async () => {
  const cats = (await api('/categories')).json.data;
  assert.deepEqual(cats.map((c: any) => c.slug), ['bags', 'small-bags'], 'hidden, under-hidden and empty are left out');
  assert.equal(cats[1].parentSlug, 'bags');
  assert.deepEqual(cats[0].paths, { en: '/shop/category/bags', fr: '/fr/boutique/categorie/bags-fr' });
  const bags = await api('/products?category=bags');
  assert.deepEqual(bags.json.data.map((p: any) => p.slug).sort(), ['purse', 'tote', 'wallet']);
  assert.equal(bags.json.category.name, 'Cat bags');
  assert.equal((await api('/products?category=hidden')).status, 404);
  assert.equal((await api('/products?category=empty')).status, 404);
  assert.equal((await page('/shop/category/bags')).status, 200);
  assert.equal((await page('/fr/boutique/categorie/bags-fr')).status, 200);
  assert.equal((await page('/shop/category/hidden')).status, 404);
  assert.equal((await page('/shop/category')).status, 404);
  assert.equal((await page('/shop/category/bags?page=2')).status, 404);
});

test('product: pictures, description, both addresses, visible categories, related in-stock first; others 404', async () => {
  const r = await api('/products/tote');
  assert.equal(r.status, 200);
  const p = r.json.data;
  assert.equal(p.images.length, 2);
  assert.equal(p.images[1].alt, 'Name tote', 'alt text falls back to the product name');
  assert.equal(p.descriptionHtml, '<p>About it</p>');
  assert.deepEqual(p.paths, { en: '/shop/tote', fr: '/fr/boutique/tote-fr' });
  assert.deepEqual(p.categories.map((c: any) => c.slug), ['bags']);
  assert.deepEqual(p.related.map((x: any) => x.slug), ['wallet'], 'same category, published only, not itself');
  assert.equal(p.seoTitle, 'Name tote');
  assert.ok(!JSON.stringify(p).includes('Secret proposal'));

  addProduct({ slug: 'bag-out', stock: 0, cats: ['c-bags'] });
  for (let i = 0; i < 4; i++) addProduct({ slug: `bag-in-${i}`, stock: 9, cats: ['c-bags'] });
  const related = (await api('/products/tote')).json.data.related;
  assert.equal(related.length, 4);
  assert.ok(related.every((x: any) => x.stock.state !== 'out'), 'in-stock products come first');

  const belt = (await api('/products/belt')).json.data;
  assert.deepEqual(belt.categories, [], 'a hidden category is not shown');
  assert.deepEqual(belt.related, []);

  for (const slug of ['draft-thing', 'review-thing', 'hidden-thing', 'archived-thing', 'tote-fr']) {
    assert.equal((await api(`/products/${slug}`)).status, 404, slug);
    assert.equal((await page(`/shop/${slug}`)).status, 404, slug);
  }
  assert.equal((await api('/products/tote-fr?locale=fr')).status, 200);
  assert.equal((await page('/shop/tote')).status, 200);
  assert.equal((await page('/fr/boutique/tote-fr')).status, 200);
});

test('pages: 24 per page with a real second page; switching the shop off hides everything again', async () => {
  for (let i = 0; i < 20; i++) addProduct({ slug: `extra-${i}` });
  const first = await api('/products');
  assert.equal(first.json.data.length, 24);
  assert.equal(first.json.totalPages, 2);
  const second = await api('/products?page=2');
  assert.equal(second.json.page, 2);
  assert.ok(second.json.data.length > 0);
  assert.equal((await page('/shop?page=2')).status, 200);
  assert.equal((await page('/shop?page=3')).status, 404);

  setShop({ enabled: false });
  assert.equal((await api('/products')).status, 404);
  assert.equal((await page('/shop/tote')).status, 404);
});
