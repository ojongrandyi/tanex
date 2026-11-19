// Shop SEO, policies and retention (docs/SHOP_SPEC.md §15, §17, §18, task M.8): server-rendered
// titles, canonical, hreflang and Product JSON-LD for shop pages; the shop in sitemap.xml only while
// it is on; the Returns & Refunds tab and its footer row; the daily retention job. File database
// in a temp folder; rows are written directly; nothing is kept. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shopseo-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { publicPages } = await import('../server/publicPages.ts');
const { createIndexRenderer, sitemapXml } = await import('../server/render/pageMeta.ts');
const { resolveShopPage, shopSitemapEntries, metaDescription } = await import('../server/shop/pageData.ts');
const { anonymiseOldOrders, CONTACT_RETENTION_MS } = await import('../server/shop/retention.ts');
const { legalDocs, LEGAL_DOC_IDS } = await import('../src/data/legalDocs.ts');
const { LEGAL_TABS } = await import('../src/shared/pageMeta.ts');

initDatabase();

const indexPath = path.join(process.cwd(), 'index.html');
const render = createIndexRenderer(indexPath);
const app = express();
app.use(publicPages(render, indexPath, undefined, (match, query) => resolveShopPage(db, match, query)));
app.use((_req, res) => { res.status(404).send('not found'); });
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const html = async (p: string) => {
  const res = await fetch(BASE + p, { redirect: 'manual' });
  return { status: res.status, body: await res.text() };
};
const jsonLd = (body: string) => [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const setShop = (enabled: boolean) => db.prepare(`
  INSERT INTO settings (key, value_json) VALUES ('shop', ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`).run(JSON.stringify({ enabled }));

const now = Date.now();
db.prepare(`INSERT INTO shop_media (id, file_1200, file_600, file_300, jpg_1200, jpg_600, bytes_total, uploaded_by, created_at_ts)
  VALUES ('m1', 'a.webp', 'b.webp', 'c.webp', 'big.jpg', 'small.jpg', 1, 'staff', 0)`).run();
db.prepare(`INSERT INTO shop_categories (id, parent_id, slug_en, slug_fr, name_en, name_fr, description_en, description_fr, sort_order, is_visible, created_at_ts, updated_at_ts)
  VALUES ('c1', NULL, 'bags', 'sacs', 'Bags', 'Sacs', 'Strong bags.', 'Des sacs solides.', 0, 1, ?, ?)`).run(now, now);
function addProduct(id: string, slug: string, status: string, stock: number, sale: number | null, seoEn: string | null = null) {
  db.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, name_fr, short_en, short_fr, description_en_html,
      price, sale_price, stock_qty, status, seo_description_en, created_by, published_at_ts, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'Court', '<p>A <b>tough</b> bag &amp; more.</p>', 15000, ?, ?, ?, ?, 'staff', ?, ?, ?)
  `).run(id, `TX-PRD-${id.slice(1).padStart(6, '0')}`, slug, `${slug}-fr`, `Name ${slug}`, `Nom ${slug}`, sale, stock, status, seoEn, now, now, now);
  db.prepare('INSERT INTO shop_product_categories (product_id, category_id) VALUES (?, ?)').run(id, 'c1');
}
addProduct('p00001', 'tote', 'PUBLISHED', 4, 12000);
db.prepare(`INSERT INTO shop_product_images (product_id, media_id, position, alt_en, alt_fr) VALUES ('p00001', 'm1', 0, 'A brown tote', NULL)`).run();
addProduct('p00002', 'pack', 'PUBLISHED', 0, null, 'Custom SEO text.');
addProduct('p00003', 'draft', 'DRAFT', 5, null);

test('shop off: pages are 404 and the sitemap lists no shop page', async () => {
  setShop(false);
  assert.equal((await html('/shop/tote')).status, 404);
  assert.deepEqual(shopSitemapEntries(db), []);
  assert.ok(!sitemapXml(shopSitemapEntries(db)).includes('/shop'));
});

test('product page: title, description, canonical, hreflang and Product JSON-LD', async () => {
  setShop(true);
  const { status, body } = await html('/shop/tote');
  assert.equal(status, 200);
  assert.match(body, /<title>Name tote \| TanEx<\/title>/);
  assert.match(body, /<link rel="canonical" href="[^"]*\/shop\/tote"/);
  assert.match(body, /hreflang="fr" href="[^"]*\/fr\/boutique\/tote-fr"/);
  assert.match(body, /og:image" content="[^"]*\/media\/shop\/big\.jpg"/);
  const [product, crumbs] = jsonLd(body);
  assert.equal(product['@type'], 'Product');
  assert.equal(product.sku, 'TX-PRD-000001');
  assert.equal(product.description, 'A tough bag & more.', 'the description falls back to the plain text of the body');
  assert.equal(product.offers.price, '12000', 'the sale price is what a customer pays');
  assert.equal(product.offers.priceCurrency, 'XAF');
  assert.equal(product.offers.availability, 'https://schema.org/InStock');
  assert.equal(product.offers.seller.name, 'Tanex SARL');
  assert.ok(!('aggregateRating' in product) && !('review' in product), 'no ratings or reviews');
  assert.deepEqual(crumbs.itemListElement.map((i: { name: string }) => i.name), ['Home', 'Marketplace', 'Name tote']);

  const fr = await html('/fr/boutique/pack-fr');
  const [frProduct] = jsonLd(fr.body);
  assert.equal(frProduct.offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(frProduct.description, 'Court', 'French short text first when there is no French SEO text');
  assert.match(fr.body, /<html lang="fr"/);
  const en = jsonLd((await html('/shop/pack')).body)[0];
  assert.equal(en.description, 'Custom SEO text.');
  assert.equal((await html('/shop/draft')).status, 404, 'a draft has no page');
});

test('shop index and category pages carry their own head', async () => {
  const index = await html('/shop');
  assert.match(index.body, /<title>Marketplace \| TanEx<\/title>/);
  assert.ok(!/name="robots" content="noindex/.test(index.body), 'indexable once a product is published');
  const cat = await html('/fr/boutique/categorie/sacs');
  assert.match(cat.body, /<title>Sacs \| Boutique \| TanEx<\/title>/);
  assert.match(cat.body, /Des sacs solides\./);
  assert.match(cat.body, /hreflang="en" href="[^"]*\/shop\/category\/bags"/);
});

test('sitemap: shop, category and published products in both languages', () => {
  const xml = sitemapXml(shopSitemapEntries(db));
  for (const p of ['/shop<', '/fr/boutique<', '/shop/category/bags<', '/fr/boutique/categorie/sacs<', '/shop/tote<', '/fr/boutique/pack-fr<']) {
    assert.ok(xml.includes(p.replace('<', '</loc>')), p);
  }
  assert.ok(!xml.includes('/shop/draft'), 'drafts stay out');
  assert.ok(!xml.includes('/cart'), 'the cart is never listed');
});

test('meta description: plain text, cut at a word', () => {
  assert.equal(metaDescription('<p>Hi&nbsp;<i>there</i></p>'), 'Hi there');
  const long = metaDescription(`<p>${'word '.repeat(60)}</p>`);
  assert.ok(long.length <= 160 && long.endsWith('…'));
});

test('Returns & Refunds: a legal tab in both languages with the approved values; footer order', () => {
  assert.deepEqual([...LEGAL_DOC_IDS], ['privacy', 'terms', 'shipping-terms', 'returns', 'cookies', 'accessibility']);
  assert.ok((LEGAL_TABS as readonly string[]).includes('returns'));
  const contact = { email: 'info@example.test', address: 'Somewhere' };
  for (const lang of ['en', 'fr'] as const) {
    const docs = legalDocs(contact, lang);
    const returns = docs.find((d) => d.id === 'returns')!;
    const text = JSON.stringify(returns);
    assert.equal(returns.sections.length, 11, lang);
    for (const v of ['48', '7', 'TX-PRD', 'info@example.test', '+237']) assert.ok(text.includes(v), `${lang}: ${v}`);
    assert.ok(JSON.stringify(docs.find((d) => d.id === 'cookies')).includes('tx_cart'), `${lang}: tx_cart in the cookie policy`);
    assert.ok(JSON.stringify(docs.find((d) => d.id === 'privacy')).includes('10'), `${lang}: shop orders retention`);
  }
  const footer = fs.readFileSync(path.join(process.cwd(), 'src/components/Footer.tsx'), 'utf8');
  const legal = footer.slice(footer.indexOf("footer.columns.legal"));
  const order = ['privacy', 'terms', 'shippingTerms', 'returns', 'cookies', 'accessibility'].map((k) => legal.indexOf(`footer.links.${k}'`));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), 'Returns sits before Cookies; Accessibility is sixth and overflows to the bottom line');
});

test('retention: contact details of orders closed over 2 years ago are removed, once, with one audit entry', () => {
  const add = (id: string, status: string, updated: number) => db.prepare(`
    INSERT INTO shop_orders (id, order_number, status, payment_method, customer_name, customer_phone, customer_whatsapp, customer_email,
      locale, delivery_method, address_text, landmark, customer_note, subtotal, delivery_fee_status, total, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, 'CASH_ON_DELIVERY', 'Ada', '+237600000000', '+237600000000', 'a@example.test', 'en', 'DELIVERY',
      'Street 1', 'Near the church', 'Ring twice', 1000, 'NONE', 1000, ?, ?)
  `).run(id, `TX-ORD-${id}`, status, updated, updated);
  const old = now - CONTACT_RETENTION_MS - 1000;
  add('100001', 'DELIVERED', old);
  add('100002', 'CANCELLED', now - 1000);
  add('100003', 'NEW', old);

  assert.equal(anonymiseOldOrders(db, now), 1);
  const row = db.prepare("SELECT * FROM shop_orders WHERE id = '100001'").get() as Record<string, unknown>;
  assert.equal(row.customer_phone, '');
  for (const k of ['customer_whatsapp', 'customer_email', 'address_text', 'landmark', 'customer_note']) assert.equal(row[k], null, k);
  assert.equal(row.customer_name, 'Ada', 'the accounting record keeps the name');
  assert.equal(row.total, 1000);
  assert.equal(row.anonymised_at_ts, now);
  for (const id of ['100002', '100003']) {
    assert.equal((db.prepare('SELECT customer_phone FROM shop_orders WHERE id = ?').get(id) as { customer_phone: string }).customer_phone, '+237600000000', id);
  }
  assert.equal(anonymiseOldOrders(db, now), 0, 'a second run changes nothing');
  const audits = db.prepare("SELECT * FROM audit_log WHERE action = 'shop.order.anonymise'").all() as { after_json: string }[];
  assert.equal(audits.length, 1);
  assert.deepEqual(JSON.parse(audits[0].after_json).orderIds, ['100001']);
});
