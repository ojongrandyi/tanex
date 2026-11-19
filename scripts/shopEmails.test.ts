// Shop order emails (docs/SHOP_SPEC.md §12, §19; task M.6) on a file database in a temp folder:
// a placed order queues the staff alert (every product ID, Reply-To the customer, English) and the
// customer's confirmation in the order's language, both as timeline events; no customer email
// without an address; nothing when mail is off and the order still goes through; the dispatched
// and cancelled emails; the layout escapes what customers type. Rows are written directly; nothing
// is kept. Run with `npm test`.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shopemails-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
process.env.APP_URL = 'https://shop.example.test';
for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_REPLY_TO', 'MAIL_STAFF_ALERTS_TO']) delete process.env[k];
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { setSenderForTests } = await import('../server/mail/mailer.ts');
const { processOutbox } = await import('../server/mail/outbox.ts');
const { renderEmail } = await import('../server/mail/layout.ts');
const { queueOrderCancelledEmail, queueOrderDispatchedEmail } = await import('../server/shop/orderEmails.ts');

initDatabase();

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
registerApiRoutes(app);
app.use((_req, res) => res.status(404).end());
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  setSenderForTests(null);
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let sent: { to: string; subject: string; html: string; text: string; replyTo?: string | null }[] = [];
setSenderForTests(async (msg) => { sent.push(msg); });

const mailOn = () => {
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.MAIL_FROM = 'TanEx <info@example.test>';
};
const mailOff = () => { delete process.env.SMTP_HOST; };

beforeEach(() => {
  sent = [];
  db.exec('DELETE FROM email_outbox');
  mailOn();
});

let ipSeq = 1;
const post = async (p: string, body: unknown) => {
  const res = await fetch(`${BASE}/api/shop${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${(ipSeq++ % 250) + 1}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) as any };
};

// QA rows in the temp database only.
db.prepare("INSERT INTO delivery_cities (id, name, is_active) VALUES ('c-buea', 'Buea', 1)").run();
db.prepare("INSERT INTO delivery_zones (id, city_id, name, is_active) VALUES ('z-mol', 'c-buea', 'Molyko', 1), ('z-gra', 'c-buea', 'GRA', 1)").run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge)
  VALUES ('r1', 'c-buea', 'z-mol', 'z-gra', 'SMALL', 700, 'XAF', NULL)`).run();
db.prepare(`INSERT INTO settings (key, value_json) VALUES ('shop', ?)`).run(JSON.stringify({
  enabled: true, orderEmail: 'orders@example.test', shipFrom: { cityId: 'c-buea', zoneId: 'z-mol', landmark: '' },
}));

let n = 0;
function addProduct(price: number, withPicture = false) {
  const id = `prod-${++n}`;
  db.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, name_fr, price, sale_price, stock_qty, max_per_order,
      size_class, weight_kg, status, created_by, published_at_ts, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 50, NULL, 'SMALL', 1, 'PUBLISHED', 'staff', 1, 1, 1)
  `).run(id, `TX-PRD-${300000 + n}`, `item-${n}`, `article-${n}`, `Item ${n}`, `Article ${n}`, price);
  if (withPicture) {
    db.prepare(`INSERT INTO shop_media (id, file_1200, file_600, file_300, jpg_1200, jpg_600, bytes_total, uploaded_by, created_at_ts)
      VALUES (?, 'a.webp', 'b.webp', 'c.webp', 'd.jpg', ?, 1, 'staff', 1)`).run(`m-${n}`, `pic-${n}-600.jpg`);
    db.prepare('INSERT INTO shop_product_images (product_id, media_id, position) VALUES (?, ?, 0)').run(id, `m-${n}`);
  }
  return id;
}

let keySeq = 0;
const order = (lines: { id: string; qty: number }[], extra: Record<string, unknown> = {}) => ({
  idempotencyKey: `mail-key-${String(++keySeq).padStart(8, '0')}`,
  lines,
  name: 'Ada Example',
  phone: '6 51 00 00 00',
  sameAsPhone: true,
  email: 'ada@example.test',
  locale: 'en',
  deliveryMethod: 'DELIVERY',
  cityId: 'c-buea',
  zoneId: 'z-gra',
  address: 'Blue gate near the church',
  paymentMethod: 'MTN_MOMO',
  acceptTerms: true,
  website: '',
  ...extra,
});

const outbox = () => db.prepare('SELECT * FROM email_outbox ORDER BY created_at_ts, rowid').all() as any[];
const orderId = (number: string) => (db.prepare('SELECT id FROM shop_orders WHERE order_number = ?').get(number) as { id: string }).id;
const emailEvents = (id: string) => (db.prepare(`SELECT to_value FROM shop_order_events WHERE order_id = ? AND kind = 'EMAIL' ORDER BY rowid`).all(id) as { to_value: string }[]).map((e) => e.to_value);

test('a placed order queues the staff alert with every product ID and the customer confirmation', async () => {
  const a = addProduct(4500, true);
  const b = addProduct(1000);
  const body = order([{ id: a, qty: 2 }, { id: b, qty: 1 }], { note: 'Call after 5 pm <b>please</b>' });
  const r = await post('/orders', body);
  assert.equal(r.status, 201);
  assert.equal(r.json.data.confirmationSent, true);
  const number = r.json.data.orderNumber as string;

  const rows = outbox();
  assert.equal(rows.length, 2);
  const [staff, customer] = rows;

  // Staff alert: to the order email, English, Reply-To the customer, linked to the order.
  assert.equal(staff.template_key, 'shop.order_staff_alert');
  assert.equal(staff.to_addr, 'orders@example.test');
  assert.equal(staff.locale, 'en');
  assert.equal(staff.reply_to, 'ada@example.test');
  assert.equal(staff.related_type, 'shop_order');
  assert.equal(staff.subject, `New order ${number} · 3 items · 10,700 FCFA`);
  for (const body of [staff.text, staff.html]) {
    assert.ok(body.includes(`TX-PRD-${300000 + n - 1}`) && body.includes(`TX-PRD-${300000 + n}`), 'every product ID');
    assert.ok(body.includes('+237 651 00 00 00'));
    assert.ok(body.includes('https://wa.me/237651000000'));
    assert.ok(body.includes('Molyko') === false && body.includes('GRA') && body.includes('Blue gate near the church'));
    assert.ok(body.includes('MTN MoMo'));
    assert.ok(body.includes(`https://shop.example.test/private-user/#order=${number}`));
  }
  assert.ok(staff.text.includes('2 × Item'));
  assert.ok(staff.text.includes('Delivery fee: 700 FCFA'));
  // What the customer typed is escaped in HTML.
  assert.ok(staff.html.includes('Call after 5 pm &lt;b&gt;please&lt;/b&gt;'));
  assert.ok(!staff.html.includes('<b>please</b>'));

  // Customer confirmation: own language, product IDs, picture, payment text, returns link.
  assert.equal(customer.template_key, 'shop.order_received');
  assert.equal(customer.to_addr, 'ada@example.test');
  assert.equal(customer.reply_to, null);
  assert.equal(customer.subject, `We've received your order ${number}`);
  assert.ok(customer.text.includes('will call you on +237 651 00 00 00'));
  assert.ok(customer.text.includes(`TX-PRD-${300000 + n - 1}`));
  assert.ok(customer.html.includes(`https://shop.example.test/media/shop/pic-${n - 1}-600.jpg`));
  assert.ok(customer.text.includes(`Pay by MTN MoMo to +237 651 05 93 45 after we confirm your order, with ${number} as the reference.`));
  assert.ok(customer.text.includes('https://shop.example.test/legal/returns'));

  assert.deepEqual(emailEvents(orderId(number)), ['shop.order_staff_alert', 'shop.order_received']);

  // The worker sends both; the alert carries the customer as Reply-To.
  assert.equal(await processOutbox(), 2);
  assert.equal(sent.find((m) => m.to === 'orders@example.test')?.replyTo, 'ada@example.test');

  // The same order sent again (idempotency key) queues nothing more.
  const again = await post('/orders', body);
  assert.equal(again.status, 200);
  assert.equal(again.json.data.confirmationSent, true);
  assert.equal(outbox().length, 2);
});

test('French order: the customer email is in French, the staff alert stays English', async () => {
  const a = addProduct(2000);
  const r = await post('/orders', order([{ id: a, qty: 1 }], {
    locale: 'fr', deliveryMethod: 'PICKUP', cityId: null, zoneId: null, address: '', pickupOffice: 'douala', paymentMethod: 'PAY_AT_OFFICE',
  }));
  assert.equal(r.status, 201);
  const [staff, customer] = outbox();
  assert.equal(staff.locale, 'en');
  assert.ok(staff.text.includes('PICKUP AT DOUALA'));
  assert.ok(staff.text.includes('Free (pickup)'));
  assert.ok(staff.text.includes('Article') === false && staff.text.includes(`Item ${n}`));
  assert.equal(customer.locale, 'fr');
  assert.equal(customer.subject, `Nous avons bien reçu votre commande ${r.json.data.orderNumber}`);
  assert.ok(customer.text.includes(`Article ${n}`));
  assert.ok(customer.text.includes('Gratuite (retrait)'));
  assert.ok(customer.text.includes('Paiement en agence : Payez au retrait de votre commande.'));
  assert.ok(customer.text.includes('https://shop.example.test/fr/mentions-legales/returns'));
  assert.ok(customer.html.startsWith('<!doctype html>\n<html lang="fr">'));
});

test('no email given: only the staff alert, without Reply-To; delivery fee to confirm is said', async () => {
  const a = addProduct(1500);
  const r = await post('/orders', order([{ id: a, qty: 1 }], { email: '', zoneId: null, paymentMethod: 'CASH_ON_DELIVERY' }));
  assert.equal(r.status, 201);
  assert.equal(r.json.data.confirmationSent, false);
  const rows = outbox();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].template_key, 'shop.order_staff_alert');
  assert.equal(rows[0].reply_to, null);
  assert.ok(rows[0].text.includes('Delivery fee: to confirm'));
  assert.ok(rows[0].text.includes('Total (delivery fee to confirm): 1,500 FCFA'));
  assert.ok(!rows[0].text.includes('Email:'));
  assert.deepEqual(emailEvents(orderId(r.json.data.orderNumber)), ['shop.order_staff_alert']);
});

test('mail off: the order is placed, nothing is queued, no timeline email event', async () => {
  mailOff();
  const a = addProduct(1000);
  const r = await post('/orders', order([{ id: a, qty: 1 }]));
  assert.equal(r.status, 201);
  assert.equal(r.json.data.confirmationSent, false);
  assert.equal(outbox().length, 0);
  assert.deepEqual(emailEvents(orderId(r.json.data.orderNumber)), []);
});

test('dispatched and cancelled emails: order language, tracking link, reason, timeline', async () => {
  const a = addProduct(1000);
  const r = await post('/orders', order([{ id: a, qty: 1 }], { locale: 'fr' }));
  const id = orderId(r.json.data.orderNumber);
  db.exec('DELETE FROM email_outbox');

  assert.equal(queueOrderDispatchedEmail(db, id, 'TX7K2M9P', 'staff-1'), true);
  assert.equal(queueOrderCancelledEmail(db, id, 'Out of stock at the supplier.', 'staff-1'), true);
  const [dispatched, cancelled] = outbox();
  assert.equal(dispatched.subject, `Votre commande ${r.json.data.orderNumber} est en route`);
  assert.ok(dispatched.text.includes('Numéro de suivi : TX7K2M9P'));
  assert.ok(dispatched.text.includes('https://shop.example.test/fr/suivi/TX7K2M9P'));
  assert.equal(cancelled.subject, `Votre commande ${r.json.data.orderNumber} a été annulée`);
  // One full stop, not two.
  assert.ok(cancelled.text.includes('Motif : Out of stock at the supplier.\n'));
  assert.ok(cancelled.text.includes('info@tanexsarl.com · +237 651 05 93 45'));
  assert.deepEqual(emailEvents(id).slice(-2), ['shop.order_dispatched', 'shop.order_cancelled']);
  const by = db.prepare(`SELECT user_id FROM shop_order_events WHERE order_id = ? AND to_value = 'shop.order_cancelled'`).get(id) as { user_id: string };
  assert.equal(by.user_id, 'staff-1');

  // An order without an email gets neither.
  const r2 = await post('/orders', order([{ id: a, qty: 1 }], { email: '' }));
  const id2 = orderId(r2.json.data.orderNumber);
  assert.equal(queueOrderDispatchedEmail(db, id2, 'TX7K2M9P'), false);
  assert.equal(queueOrderCancelledEmail(db, id2, 'Customer asked'), false);
});

test('layout: headings, rows, items and buttons are escaped and only http(s) links become buttons', () => {
  const e = renderEmail('en', 'Subject <x>', [
    { heading: 'A <b>' },
    { rows: [{ label: 'L<1>', value: 'V&2', strong: true }] },
    { items: [{ qty: 1, name: '<img src=x>', code: 'TX-PRD-1', amount: '1 FCFA', imageUrl: 'javascript:alert(1)' }] },
    { button: { label: 'Go', url: 'javascript:alert(1)' } },
    { button: { label: 'Open', url: 'https://example.test/?a=1&b=2' } },
  ]);
  assert.ok(e.html.includes('A &lt;b&gt;') && e.html.includes('L&lt;1&gt;') && e.html.includes('V&amp;2'));
  assert.ok(e.html.includes('&lt;img src=x&gt;'));
  assert.ok(!e.html.includes('javascript:'));
  assert.ok(e.html.includes('href="https://example.test/?a=1&amp;b=2"'));
  assert.ok(e.text.includes('1 × <img src=x> (TX-PRD-1) · 1 FCFA'));
  assert.ok(e.text.includes('Open: https://example.test/?a=1&b=2'));
});
