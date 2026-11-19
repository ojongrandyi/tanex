// Shop order emails (docs/SHOP_SPEC.md §12, task M.6): the staff alert and the customer's
// confirmation when an order is placed, and the "on its way" and "cancelled" emails that the
// console order actions (M.7) send. Everything goes through the outbox; each email queued is a
// timeline event on the order. Customer emails use the order's language; the staff alert is in
// English. Nothing here throws: a mail problem never blocks an order.
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { EMAIL, MTN_MOMO_NUMBER, OFFICES, ORANGE_MONEY_NUMBER, PHONE, formatPhone } from '../../src/config/brand.js';
import { formatCurrencyAmount } from '../../src/shared/currency.js';
import { SHOP_PAYMENT_METHOD_LABELS, isShopPaymentMethod, type ShopPaymentMethod } from '../../src/shared/shopOrderStatus.js';
import type { ShopSettings } from '../../src/shared/shopSettings.js';
import { whatsAppDigits } from '../../src/shared/whatsapp.js';
import { cleanVar, type EmailItem, type MailLocale } from '../mail/layout.js';
import { queueEmail } from '../mail/outbox.js';
import type { TemplateKey } from '../mail/templates/index.js';
import type { FeeStatus, ShopOrderTotals } from '../mail/templates/shop.vars.js';
import { consoleOrderUrl, returnsUrl, shopMediaAbsoluteUrl, trackUrl } from '../mail/urls.js';
import { CHECKOUT_LIMITS } from '../../src/shared/shopCheckout.js';

interface OrderRow {
  id: string;
  order_number: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  customer_email: string | null;
  locale: string;
  delivery_method: string;
  city_id: string | null;
  zone_id: string | null;
  pickup_office: string | null;
  address_text: string | null;
  customer_note: string | null;
  subtotal: number;
  delivery_fee: number | null;
  delivery_fee_status: string;
  total: number;
  currency: string;
}

interface ItemRow {
  product_code: string;
  name_en: string;
  name_fr: string | null;
  quantity: number;
  line_total: number;
  jpg_600: string | null;
}

const RELATED = (orderId: string) => ({ type: 'shop_order', id: orderId });

const langOf = (o: OrderRow): MailLocale => (o.locale === 'fr' ? 'fr' : 'en');
const intlOf = (lang: MailLocale) => (lang === 'fr' ? 'fr-CM' : 'en-CM');

function loadOrder(conn: DatabaseSync, orderId: string): OrderRow | null {
  return (conn.prepare('SELECT * FROM shop_orders WHERE id = ?').get(orderId) as OrderRow | undefined) ?? null;
}

function loadItems(conn: DatabaseSync, orderId: string): ItemRow[] {
  return conn.prepare(`
    SELECT i.product_code, i.name_en, i.name_fr, i.quantity, i.line_total, m.jpg_600
    FROM shop_order_items i LEFT JOIN shop_media m ON m.id = i.media_id
    WHERE i.order_id = ? ORDER BY i.rowid
  `).all(orderId) as unknown as ItemRow[];
}

/** Items and totals in one language, amounts formatted with the order's currency. */
function totalsOf(o: OrderRow, items: ItemRow[], lang: MailLocale): ShopOrderTotals {
  const money = (n: number) => formatCurrencyAmount(n, o.currency, intlOf(lang));
  const feeStatus: FeeStatus = o.delivery_fee_status === 'NONE' || o.delivery_fee_status === 'QUOTED' ? o.delivery_fee_status : 'TO_CONFIRM';
  return {
    items: items.map((i): EmailItem => ({
      qty: i.quantity,
      name: cleanVar(lang === 'fr' ? i.name_fr || i.name_en : i.name_en, 160),
      code: i.product_code,
      amount: money(i.line_total),
      imageUrl: i.jpg_600 ? shopMediaAbsoluteUrl(i.jpg_600) : null,
    })),
    subtotal: money(o.subtotal),
    fee: feeStatus === 'QUOTED' && o.delivery_fee !== null ? money(o.delivery_fee) : null,
    feeStatus,
    total: money(o.total),
  };
}

/** Records an email on the order's timeline (SHOP_SPEC §12: every email sent is a timeline event). */
function emailEvent(conn: DatabaseSync, orderId: string, template: TemplateKey, note: string, userId: string | null, now: number): void {
  conn.prepare(`
    INSERT INTO shop_order_events (id, order_id, kind, from_value, to_value, note, user_id, at_ts)
    VALUES (?, ?, 'EMAIL', NULL, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), orderId, template, note, userId, now);
}

function pickupOfficeName(key: string | null): string {
  const office = OFFICES.find((o) => o.city.toLowerCase() === key);
  return office ? office.city : cleanVar(key ?? '');
}

function placeNames(conn: DatabaseSync, o: OrderRow): { city: string; area: string | null } {
  const city = o.city_id ? conn.prepare('SELECT name FROM delivery_cities WHERE id = ?').get(o.city_id) as { name: string } | undefined : undefined;
  const zone = o.zone_id ? conn.prepare('SELECT name FROM delivery_zones WHERE id = ?').get(o.zone_id) as { name: string } | undefined : undefined;
  return { city: cleanVar(city?.name ?? ''), area: zone ? cleanVar(zone.name) : null };
}

const paymentKey = (value: string): ShopPaymentMethod => (isShopPaymentMethod(value) ? value : 'CASH_ON_DELIVERY');

export interface PlacedEmails {
  staff: boolean;
  customer: boolean;
}

/**
 * Queues the staff alert (to the order email in Shop settings, Reply-To the customer) and, when
 * the customer gave an email, their confirmation. Called inside the order transaction, after
 * everything else, so the emails exist only if the order does.
 */
export function queueOrderPlacedEmails(conn: DatabaseSync, orderId: string, settings: ShopSettings, now: number = Date.now()): PlacedEmails {
  const result: PlacedEmails = { staff: false, customer: false };
  try {
    const o = loadOrder(conn, orderId);
    if (!o) return result;
    const items = loadItems(conn, orderId);
    const method = paymentKey(o.payment_method);
    const phone = o.customer_phone ? formatPhone(o.customer_phone) : '';
    const whatsapp = o.customer_whatsapp ? formatPhone(o.customer_whatsapp) : phone;
    const digits = whatsAppDigits(o.customer_whatsapp ?? o.customer_phone);

    const staffId = queueEmail({
      to: settings.orderEmail,
      template: 'shop.order_staff_alert',
      locale: 'en',
      replyTo: o.customer_email,
      related: RELATED(orderId),
      now,
      vars: {
        ...totalsOf(o, items, 'en'),
        order: o.order_number,
        count: items.reduce((n, i) => n + i.quantity, 0),
        customer: {
          name: cleanVar(o.customer_name, CHECKOUT_LIMITS.name),
          phone,
          whatsapp,
          whatsappUrl: digits ? `https://wa.me/${digits}` : null,
          email: o.customer_email ? cleanVar(o.customer_email, CHECKOUT_LIMITS.email) : null,
        },
        delivery: o.delivery_method === 'PICKUP'
          ? { method: 'PICKUP', office: pickupOfficeName(o.pickup_office) }
          : { method: 'DELIVERY', ...placeNames(conn, o), address: cleanVar(o.address_text ?? '', CHECKOUT_LIMITS.address) },
        payment: SHOP_PAYMENT_METHOD_LABELS[method].en,
        note: o.customer_note ? cleanVar(o.customer_note, CHECKOUT_LIMITS.note) : null,
        url: consoleOrderUrl(o.order_number),
      },
    }, conn);
    if (staffId) {
      emailEvent(conn, orderId, 'shop.order_staff_alert', 'New order alert queued for the order inbox', null, now);
      result.staff = true;
    }

    if (o.customer_email) {
      const lang = langOf(o);
      const payNumber = method === 'MTN_MOMO' ? formatPhone(MTN_MOMO_NUMBER) : method === 'ORANGE_MONEY' ? formatPhone(ORANGE_MONEY_NUMBER) : null;
      const customerId = queueEmail({
        to: o.customer_email,
        template: 'shop.order_received',
        locale: lang,
        related: RELATED(orderId),
        now,
        vars: {
          ...totalsOf(o, items, lang),
          name: cleanVar(o.customer_name, CHECKOUT_LIMITS.name),
          phone,
          order: o.order_number,
          payment: method,
          payNumber,
          returnsUrl: returnsUrl(lang),
        },
      }, conn);
      if (customerId) {
        emailEvent(conn, orderId, 'shop.order_received', 'Order confirmation queued for the customer', null, now);
        result.customer = true;
      }
    }
  } catch (err) {
    console.error('[shop] order emails could not be queued:', err);
  }
  return result;
}

/** True when the customer's confirmation was queued for this order (the order-placed page says so). */
export function confirmationQueued(conn: DatabaseSync, orderId: string): boolean {
  return !!conn.prepare(`
    SELECT 1 FROM shop_order_events WHERE order_id = ? AND kind = 'EMAIL' AND to_value = 'shop.order_received'
  `).get(orderId);
}

/**
 * "Your order is on its way" with the dispatch job's tracking ID (M.7 Send to dispatch). Returns
 * true when queued; false when the customer gave no email, mail is off, or anything fails.
 */
export function queueOrderDispatchedEmail(
  conn: DatabaseSync, orderId: string, trackingId: string, userId: string | null = null, now: number = Date.now(),
): boolean {
  try {
    const o = loadOrder(conn, orderId);
    if (!o?.customer_email) return false;
    const lang = langOf(o);
    const id = cleanVar(trackingId, 40);
    const queued = queueEmail({
      to: o.customer_email,
      template: 'shop.order_dispatched',
      locale: lang,
      related: RELATED(orderId),
      now,
      vars: { name: cleanVar(o.customer_name, CHECKOUT_LIMITS.name), order: o.order_number, id, link: trackUrl(id, lang) },
    }, conn);
    if (!queued) return false;
    emailEvent(conn, orderId, 'shop.order_dispatched', 'On-its-way email queued for the customer', userId, now);
    return true;
  } catch (err) {
    console.error('[shop] dispatched email could not be queued:', err);
    return false;
  }
}

/**
 * "Your order has been cancelled" with the reason staff gave (M.7 Cancel). Returns true when
 * queued; false when the customer gave no email, mail is off, or anything fails.
 */
export function queueOrderCancelledEmail(
  conn: DatabaseSync, orderId: string, reason: string, userId: string | null = null, now: number = Date.now(),
): boolean {
  try {
    const o = loadOrder(conn, orderId);
    if (!o?.customer_email) return false;
    // The sentence adds its own full stop.
    const why = cleanVar(reason, 300).replace(/[.!\s]+$/, '');
    if (!why) return false;
    const queued = queueEmail({
      to: o.customer_email,
      template: 'shop.order_cancelled',
      locale: langOf(o),
      related: RELATED(orderId),
      now,
      vars: { order: o.order_number, reason: why, email: EMAIL, phone: formatPhone(PHONE) },
    }, conn);
    if (!queued) return false;
    emailEvent(conn, orderId, 'shop.order_cancelled', 'Cancellation email queued for the customer', userId, now);
    return true;
  } catch (err) {
    console.error('[shop] cancellation email could not be queued:', err);
    return false;
  }
}
