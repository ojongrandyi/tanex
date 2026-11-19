// Shop cart check, delivery fee and order placement (docs/SHOP_SPEC.md §8–§10.2), used by the
// public routes in server/routes/publicShop.ts. Prices, stock and the fee always come from the
// database: anything the browser says about prices is only compared, never used. An order is
// written in one transaction that reserves stock with a conditional UPDATE per line, so two
// customers can never buy the last item twice. The order emails are queued in the same
// transaction (server/shop/orderEmails.ts, M.6).
import crypto from 'node:crypto';
import type { Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { inTransaction } from '../auth/schema.js';
import { audit } from '../audit.js';
import { isDeliverableAddress } from '../mail/outbox.js';
import type { Lang } from '../../src/router/routes.js';
import { intercityRateFromRow, zoneRateFromRow } from '../../src/shared/localPricing.js';
import { generateReference } from '../../src/shared/references.js';
import {
  CHECKOUT_LIMITS, IDEMPOTENCY_KEY_PATTERN, ORDER_MAX_LINES, cameroonPhone, firstName, shopDeliveryFee,
  type FeeItem, type ShopFee,
} from '../../src/shared/shopCheckout.js';
import {
  isDeliveryMethod, isShopPaymentMethod, orderTotal, paymentMethodFits,
  type DeliveryMethod, type ShopPaymentMethod,
} from '../../src/shared/shopOrderStatus.js';
import { effectivePrice } from '../../src/shared/shopPublic.js';
import type { ShopSettings } from '../../src/shared/shopSettings.js';
import type { ProductRow } from './catalog.js';
import { PUBLIC_PRODUCT, formatPublicCard, type PublicProductCard } from './publicCatalog.js';
import { confirmationQueued, queueOrderPlacedEmails } from './orderEmails.js';

export interface Fail {
  status: number;
  code: string;
  error: string;
  details?: Record<string, unknown>;
}
const fail = (status: number, code: string, error: string, details?: Record<string, unknown>): Fail => ({ status, code, error, details });
export const isFail = (v: unknown): v is Fail => !!v && typeof v === 'object' && 'code' in v && 'status' in v && 'error' in v;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// ---- Cart lines ----

export interface CartLineInput {
  id: string;
  qty: number;
}

/** The cart as sent by the browser: 1–20 different products, whole quantities 1–1000. */
export function readCartLines(value: unknown): CartLineInput[] | Fail {
  if (!Array.isArray(value) || value.length === 0) return fail(400, 'EMPTY_CART', 'Your cart is empty.');
  if (value.length > ORDER_MAX_LINES) return fail(400, 'INVALID_CART', `An order can hold up to ${ORDER_MAX_LINES} different products.`);
  const out: CartLineInput[] = [];
  for (const item of value) {
    const { id, qty } = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return fail(400, 'INVALID_CART', 'The cart is not valid.');
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 1000) return fail(400, 'INVALID_CART', 'The cart is not valid.');
    if (out.some((l) => l.id === id)) return fail(400, 'INVALID_CART', 'The cart is not valid.');
    out.push({ id, qty });
  }
  return out;
}

const productLimit = (p: ProductRow, settings: ShopSettings) => p.max_per_order ?? settings.maxPerOrder;

export interface CheckedLine extends PublicProductCard {
  /** Quantity the customer asked for. */
  requested: number;
  /** Quantity they may order now: lowered to the stock and the product's limit. */
  qty: number;
  lineTotal: number;
}

export interface CartCheck {
  lines: CheckedLine[];
  /** Products no longer sold (unpublished or out of stock); the name only when it was published once. */
  removed: { id: string; name: string | null }[];
  subtotal: number;
  currency: string;
}

/**
 * Re-reads every product of the cart (SHOP_SPEC §8): current price, what may be ordered now and
 * what is gone. Products that were never published are reported without a name.
 */
export function checkCart(conn: DatabaseSync, lines: CartLineInput[], lang: Lang, settings: ShopSettings): CartCheck {
  const out: CheckedLine[] = [];
  const removed: CartCheck['removed'] = [];
  for (const line of lines) {
    const p = conn.prepare('SELECT * FROM shop_products WHERE id = ?').get(line.id) as ProductRow | undefined;
    if (!p || p.status !== 'PUBLISHED' || p.stock_qty <= 0) {
      const named = p && p.published_at_ts !== null;
      removed.push({ id: line.id, name: named ? (lang === 'fr' ? p.name_fr || p.name_en : p.name_en) : null });
      continue;
    }
    const card = formatPublicCard(conn, p, lang, settings);
    const qty = Math.min(line.qty, p.stock_qty, productLimit(p, settings));
    const unit = effectivePrice(p.price, p.sale_price);
    out.push({ ...card, requested: line.qty, qty, lineTotal: unit * qty });
  }
  const currency = out[0]?.currency ?? 'XAF';
  return { lines: out, removed, subtotal: out.reduce((n, l) => n + l.lineTotal, 0), currency };
}

// ---- Delivery fee ----

interface CityRow { id: string; is_active: number }
interface ZoneRow { id: string; city_id: string; is_active: number }

/** An active delivery city and, when given, one of its active areas. */
export function readDestination(conn: DatabaseSync, cityId: unknown, zoneId: unknown): { cityId: string; zoneId: string | null } | Fail {
  const city = typeof cityId === 'string' && cityId
    ? conn.prepare('SELECT id, is_active FROM delivery_cities WHERE id = ?').get(cityId) as CityRow | undefined
    : undefined;
  if (!city || city.is_active !== 1) return fail(400, 'INVALID_CITY', 'Choose your city and area.');
  if (zoneId === undefined || zoneId === null || zoneId === '') return { cityId: city.id, zoneId: null };
  const zone = typeof zoneId === 'string'
    ? conn.prepare('SELECT id, city_id, is_active FROM delivery_zones WHERE id = ?').get(zoneId) as ZoneRow | undefined
    : undefined;
  if (!zone || zone.city_id !== city.id || zone.is_active !== 1) return fail(400, 'INVALID_AREA', 'Choose your city and area.');
  return { cityId: city.id, zoneId: zone.id };
}

/** The fee for these products, read with the admin's current rates (SHOP_SPEC §9). */
export function orderDeliveryFee(
  conn: DatabaseSync,
  settings: ShopSettings,
  method: DeliveryMethod,
  to: { cityId: string | null; zoneId: string | null },
  items: FeeItem[],
  currency: string,
): ShopFee {
  const from = settings.shipFrom.cityId;
  const zone = from && to.cityId === from
    ? (conn.prepare('SELECT * FROM zone_rates WHERE city_id = ?').all(from) as unknown[]).map(zoneRateFromRow)
    : [];
  const intercity = from && to.cityId && to.cityId !== from
    ? (conn.prepare('SELECT * FROM intercity_rates WHERE from_city_id = ? AND to_city_id = ?').all(from, to.cityId) as unknown[]).map(intercityRateFromRow)
    : [];
  return shopDeliveryFee({ method, shipFrom: settings.shipFrom, to, items, currency }, { zone, intercity });
}

/** Fee items of the products in a cart check. */
export function feeItemsOf(conn: DatabaseSync, lines: { id: string; qty: number }[]): FeeItem[] {
  return lines.map((l) => {
    const p = conn.prepare('SELECT size_class, weight_kg FROM shop_products WHERE id = ?').get(l.id) as
      { size_class: string; weight_kg: number | null } | undefined;
    return { sizeClass: p?.size_class ?? 'SMALL', weightKg: p?.weight_kg ?? null, qty: l.qty };
  });
}

// ---- Checkout options ----

/** What the checkout may offer: the payment methods and pickup offices switched on in settings. */
export function checkoutOptions(settings: ShopSettings) {
  return { paymentMethods: settings.paymentMethods, pickupOffices: settings.pickupOffices };
}

// ---- Order input ----

export interface OrderInput {
  idempotencyKey: string;
  lines: CartLineInput[];
  /** Prices the customer last saw, per product id: compared with the database, never used. */
  seenPrices: Record<string, number>;
  name: string;
  phone: string;
  whatsapp: string;
  email: string | null;
  locale: Lang;
  deliveryMethod: DeliveryMethod;
  cityId: string | null;
  zoneId: string | null;
  pickupOffice: string | null;
  address: string | null;
  note: string | null;
  paymentMethod: ShopPaymentMethod;
}

/** The checkout form, checked field by field (CONTENT §17.5 errors). */
export function readOrderInput(conn: DatabaseSync, b: Record<string, unknown>, settings: ShopSettings): OrderInput | Fail {
  // A hidden field people never see; a form robot fills it.
  if (str(b.website)) return fail(400, 'INVALID_REQUEST', 'The order could not be placed.');
  const key = str(b.idempotencyKey);
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) return fail(400, 'INVALID_REQUEST', 'The order could not be placed.');
  const lines = readCartLines(b.lines);
  if (isFail(lines)) return lines;

  const seenPrices: Record<string, number> = {};
  if (b.seenPrices && typeof b.seenPrices === 'object' && !Array.isArray(b.seenPrices)) {
    for (const l of lines) {
      const v = (b.seenPrices as Record<string, unknown>)[l.id];
      if (typeof v === 'number' && Number.isFinite(v)) seenPrices[l.id] = v;
    }
  }

  const name = str(b.name);
  if (!name || name.length > CHECKOUT_LIMITS.name) return fail(400, 'INVALID_NAME', 'Please enter your name.');
  const phone = cameroonPhone(b.phone);
  if (!phone) return fail(400, 'INVALID_PHONE', 'Enter a valid Cameroon phone number.');
  let whatsapp = phone;
  if (b.sameAsPhone === false) {
    const wa = cameroonPhone(b.whatsapp);
    if (!wa) return fail(400, 'INVALID_WHATSAPP', 'Enter a valid Cameroon phone number.');
    whatsapp = wa;
  }
  const email = str(b.email);
  if (email && (email.length > CHECKOUT_LIMITS.email || !isDeliverableAddress(email))) {
    return fail(400, 'INVALID_EMAIL', 'Enter a valid email address, or leave it empty.');
  }
  const note = str(b.note);
  if (note.length > CHECKOUT_LIMITS.note) return fail(400, 'INVALID_NOTE', `Keep the note under ${CHECKOUT_LIMITS.note} characters.`);

  if (!isDeliveryMethod(b.deliveryMethod)) return fail(400, 'INVALID_DELIVERY_METHOD', 'Choose delivery or pickup.');
  const deliveryMethod = b.deliveryMethod;
  let cityId: string | null = null;
  let zoneId: string | null = null;
  let pickupOffice: string | null = null;
  let address: string | null = null;
  if (deliveryMethod === 'DELIVERY') {
    const dest = readDestination(conn, b.cityId, b.zoneId);
    if (isFail(dest)) return dest;
    ({ cityId, zoneId } = dest);
    address = str(b.address);
    if (!address) return fail(400, 'ADDRESS_REQUIRED', 'Tell us your address or a landmark.');
    if (address.length > CHECKOUT_LIMITS.address) return fail(400, 'ADDRESS_REQUIRED', `Keep the address under ${CHECKOUT_LIMITS.address} characters.`);
  } else {
    const office = str(b.pickupOffice);
    if (!settings.pickupOffices.includes(office)) return fail(400, 'INVALID_PICKUP_OFFICE', 'Choose a pickup office.');
    pickupOffice = office;
  }

  const method = b.paymentMethod;
  if (!isShopPaymentMethod(method) || !settings.paymentMethods.includes(method) || !paymentMethodFits(method, deliveryMethod)) {
    return fail(400, 'INVALID_PAYMENT_METHOD', 'Choose how you will pay.');
  }
  if (b.acceptTerms !== true) return fail(400, 'TERMS_REQUIRED', 'Please accept the terms to place your order.');

  return {
    idempotencyKey: key, lines, seenPrices, name, phone, whatsapp, email: email || null,
    locale: b.locale === 'fr' ? 'fr' : 'en',
    deliveryMethod, cityId, zoneId, pickupOffice, address, note: note || null, paymentMethod: method,
  };
}

// ---- Placing an order ----

interface OrderRow {
  id: string; order_number: string; customer_name: string; locale: string; delivery_method: string;
  pickup_office: string | null; payment_method: string; subtotal: number; delivery_fee: number | null;
  delivery_fee_status: string; total: number; currency: string;
}
interface ItemRow { product_code: string; name_en: string; name_fr: string | null; unit_price: number; quantity: number; line_total: number }

/** What the "order placed" screen shows: no phone, address or other contact details. */
export function orderSummary(conn: DatabaseSync, id: string) {
  const o = conn.prepare('SELECT * FROM shop_orders WHERE id = ?').get(id) as unknown as OrderRow;
  const lang: Lang = o.locale === 'fr' ? 'fr' : 'en';
  const items = conn.prepare('SELECT * FROM shop_order_items WHERE order_id = ? ORDER BY rowid').all(id) as unknown as ItemRow[];
  return {
    orderNumber: o.order_number,
    firstName: firstName(o.customer_name),
    items: items.map((i) => ({
      code: i.product_code, name: lang === 'fr' ? i.name_fr || i.name_en : i.name_en,
      qty: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    deliveryFeeStatus: o.delivery_fee_status,
    total: o.total,
    currency: o.currency,
    deliveryMethod: o.delivery_method,
    pickupOffice: o.pickup_office,
    paymentMethod: o.payment_method,
    /** The customer's confirmation email was queued (the page then says so; the address itself is not sent back). */
    confirmationSent: confirmationQueued(conn, id),
  };
}
export type OrderSummary = ReturnType<typeof orderSummary>;

/** Thrown inside the transaction to roll it back with a customer-facing answer. */
class OrderRefused extends Error {
  constructor(readonly refusal: Fail) {
    super(refusal.code);
  }
}

const nameOf = (p: ProductRow, lang: Lang) => (lang === 'fr' ? p.name_fr || p.name_en : p.name_en);

/**
 * Places an order (SHOP_SPEC §10.2). The same idempotency key returns the order already placed.
 * 409 answers: PRODUCT_UNAVAILABLE, OUT_OF_STOCK (with the quantity still available),
 * QUANTITY_LIMIT, PRICE_CHANGED; the cart page then checks the cart again.
 */
export function placeOrder(
  conn: DatabaseSync, req: Request, input: OrderInput, settings: ShopSettings,
): { created: boolean; order: OrderSummary } | Fail {
  const existing = conn.prepare('SELECT id FROM shop_orders WHERE idempotency_key = ?').get(input.idempotencyKey) as { id: string } | undefined;
  if (existing) return { created: false, order: orderSummary(conn, existing.id) };

  const lang = input.locale;
  const now = Date.now();
  try {
    const id = inTransaction(conn, () => {
      const products: { p: ProductRow; qty: number; unit: number }[] = [];
      for (const line of input.lines) {
        const p = conn.prepare(`SELECT p.* FROM shop_products p WHERE p.id = ? AND ${PUBLIC_PRODUCT}`).get(line.id) as ProductRow | undefined;
        if (!p) throw new OrderRefused(fail(409, 'PRODUCT_UNAVAILABLE', 'A product in your cart is no longer available.', { productId: line.id }));
        const name = nameOf(p, lang);
        if (p.stock_qty < line.qty) {
          throw new OrderRefused(fail(409, 'OUT_OF_STOCK', `Only ${p.stock_qty} of ${name} left. Update your cart and try again.`,
            { productId: p.id, code: p.product_code, name, available: p.stock_qty }));
        }
        const limit = productLimit(p, settings);
        if (line.qty > limit) {
          throw new OrderRefused(fail(409, 'QUANTITY_LIMIT', `You can order up to ${limit} of ${name}.`,
            { productId: p.id, code: p.product_code, name, max: limit }));
        }
        const unit = effectivePrice(p.price, p.sale_price);
        const seen = input.seenPrices[p.id];
        if (seen !== undefined && seen !== unit) {
          throw new OrderRefused(fail(409, 'PRICE_CHANGED', `The price of ${name} has changed.`,
            { productId: p.id, code: p.product_code, name, price: unit }));
        }
        products.push({ p, qty: line.qty, unit });
      }
      const currency = products[0].p.currency;
      if (products.some((x) => x.p.currency !== currency)) {
        throw new OrderRefused(fail(409, 'MIXED_CURRENCY', 'These products cannot be ordered together. Please order them separately.'));
      }

      const subtotal = products.reduce((n, x) => n + x.unit * x.qty, 0);
      const fee = orderDeliveryFee(conn, settings, input.deliveryMethod, { cityId: input.cityId, zoneId: input.zoneId },
        products.map((x) => ({ sizeClass: x.p.size_class, weightKg: x.p.weight_kg, qty: x.qty })), currency);
      const total = orderTotal(subtotal, fee.fee);

      let number = generateReference('order');
      for (let i = 0; conn.prepare('SELECT 1 FROM shop_orders WHERE order_number = ?').get(number); i++) {
        if (i >= 20) throw new Error('Could not allocate an order number.');
        number = generateReference('order');
      }
      const orderId = 'ord_' + crypto.randomBytes(12).toString('hex');
      conn.prepare(`
        INSERT INTO shop_orders (id, order_number, status, payment_status, payment_method, customer_name, customer_phone,
          customer_whatsapp, customer_email, locale, delivery_method, city_id, zone_id, pickup_office, address_text, landmark,
          customer_note, subtotal, delivery_fee, delivery_fee_status, total, currency, idempotency_key, created_at_ts, updated_at_ts)
        VALUES (?, ?, 'NEW', 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orderId, number, input.paymentMethod, input.name, input.phone, input.whatsapp, input.email, lang,
        input.deliveryMethod, input.cityId, input.zoneId, input.pickupOffice, input.address, input.note,
        subtotal, fee.fee, fee.status, total, currency, input.idempotencyKey, now, now);

      for (const { p, qty, unit } of products) {
        const media = conn.prepare('SELECT media_id FROM shop_product_images WHERE product_id = ? ORDER BY position LIMIT 1').get(p.id) as
          { media_id: string } | undefined;
        conn.prepare(`
          INSERT INTO shop_order_items (id, order_id, product_id, product_code, name_en, name_fr, unit_price, quantity, line_total, media_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), orderId, p.id, p.product_code, p.name_en, p.name_fr, unit, qty, unit * qty, media?.media_id ?? null);

        // Reserve the stock: only if it is still there (SHOP_SPEC §10.2).
        const taken = conn.prepare('UPDATE shop_products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?').run(qty, p.id, qty);
        if (Number(taken.changes) !== 1) {
          const left = (conn.prepare('SELECT stock_qty FROM shop_products WHERE id = ?').get(p.id) as { stock_qty: number }).stock_qty;
          const name = nameOf(p, lang);
          throw new OrderRefused(fail(409, 'OUT_OF_STOCK', `Only ${left} of ${name} left. Update your cart and try again.`,
            { productId: p.id, code: p.product_code, name, available: left }));
        }
        const after = (conn.prepare('SELECT stock_qty FROM shop_products WHERE id = ?').get(p.id) as { stock_qty: number }).stock_qty;
        conn.prepare(`
          INSERT INTO shop_stock_moves (id, product_id, delta, reason, order_id, note, user_id, stock_after, at_ts)
          VALUES (?, ?, ?, 'ORDER', ?, ?, NULL, ?, ?)
        `).run(crypto.randomUUID(), p.id, -qty, orderId, number, after, now);
      }

      conn.prepare(`
        INSERT INTO shop_order_events (id, order_id, kind, from_value, to_value, note, user_id, at_ts)
        VALUES (?, ?, 'STATUS', NULL, 'NEW', 'Order placed on the website', NULL, ?)
      `).run(crypto.randomUUID(), orderId, now);

      audit(req, 'shop.order_placed', 'shop_order', orderId, `Order placed online: ${number}`, undefined, {
        orderNumber: number, lines: products.length, items: products.reduce((n, x) => n + x.qty, 0),
        subtotal, deliveryFee: fee.fee, deliveryFeeStatus: fee.status, total, currency,
        deliveryMethod: input.deliveryMethod, paymentMethod: input.paymentMethod, email: input.email ? 'given' : 'none',
      }, { actor: { userId: null, name: 'Online order' }, conn });

      // Last step of the transaction: the emails exist only if the order does (SHOP_SPEC §10.2, §12).
      queueOrderPlacedEmails(conn, orderId, settings, now);

      return orderId;
    });
    return { created: true, order: orderSummary(conn, id) };
  } catch (err) {
    if (err instanceof OrderRefused) return err.refusal;
    // The same key sent twice at once: the second insert hits the unique index.
    const again = conn.prepare('SELECT id FROM shop_orders WHERE idempotency_key = ?').get(input.idempotencyKey) as { id: string } | undefined;
    if (again) return { created: false, order: orderSummary(conn, again.id) };
    throw err;
  }
}
