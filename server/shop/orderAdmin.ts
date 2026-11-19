// Console shop orders (docs/SHOP_SPEC.md §7.6, §10, §11, §13, task M.7): the list and its search,
// the order page, status changes (with stock put back on cancel and, when ticked, on return), the
// delivery fee, payments and refunds, internal notes, Send to dispatch, and the shop settings.
// Routes: server/routes/shopAdmin.ts. Every write is checked against src/shared/shopOrderStatus.ts,
// runs in one transaction, lands on the order's timeline and in the audit log.
import crypto from 'node:crypto';
import type { Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { audit } from '../audit.js';
import { inTransaction } from '../auth/schema.js';
import { COMPANY, PHONE } from '../../src/config/brand.js';
import { formatCurrencyAmount } from '../../src/shared/currency.js';
import { isSizeClass, SIZE_CLASSES } from '../../src/shared/localPricing.js';
import {
  ORDER_STATUSES, SHOP_PAYMENT_METHODS, checkOrderTransition, checkPaymentChange, isOrderStatus, isShopPaymentMethod,
  orderTotal, paymentMethodFits, restocksOn, staffNextStatuses,
  type DeliveryFeeStatus, type DeliveryMethod, type OrderStatus, type PaymentStatus, type ShopRuleFail,
} from '../../src/shared/shopOrderStatus.js';
import {
  LANDMARK_MAX, LOW_STOCK_MAX, MAX_PER_ORDER_MAX, PICKUP_OFFICE_KEYS, SHOP_SETTINGS_KEY, isValidOrderEmail,
  type ShopSettings,
} from '../../src/shared/shopSettings.js';
import { largestSizeClass, cartWeightKg } from '../../src/shared/shopCheckout.js';
import { insertConfirmedJob, PRICE_MAX, TEXT_MAX, type Place } from '../dispatch/jobs.js';
import { queueEmail, isDeliverableAddress } from '../mail/outbox.js';
import { mailEnabled } from '../mail/mailer.js';
import { queueOrderCancelledEmail, queueOrderDispatchedEmail } from './orderEmails.js';
import { orderEvent } from './orderSync.js';
import { loadShopSettings } from './settings.js';
import { shopMediaUrl } from './media.js';

export class OrderError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly field?: string) {
    super(message);
  }
}
const refuse = (status: number, code: string, message: string, field?: string): never => {
  throw new OrderError(status, code, message, field);
};

export const ORDER_NOTE_MAX = 1000;
export const ORDER_REASON_MAX = 300;
export const ORDER_REFERENCE_MAX = 100;
/** Ways a refund is paid back (SHOP_SPEC §11). */
export const REFUND_METHODS = ['CASH', 'MTN_MOMO', 'ORANGE_MONEY'] as const;

// ---- Rows ----

export interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  payment_reference: string | null;
  paid_amount: number | null;
  paid_at_ts: number | null;
  paid_by: string | null;
  refund_amount: number | null;
  refund_method: string | null;
  refund_reference: string | null;
  refunded_at_ts: number | null;
  refunded_by: string | null;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp: string | null;
  customer_email: string | null;
  locale: string;
  delivery_method: DeliveryMethod;
  city_id: string | null;
  zone_id: string | null;
  pickup_office: string | null;
  address_text: string | null;
  landmark: string | null;
  customer_note: string | null;
  subtotal: number;
  delivery_fee: number | null;
  delivery_fee_status: DeliveryFeeStatus;
  total: number;
  currency: string;
  job_id: string | null;
  tracking_id: string | null;
  cancel_reason: string | null;
  delivery_problem_at_ts: number | null;
  anonymised_at_ts: number | null;
  created_at_ts: number;
  updated_at_ts: number;
  updated_by: string | null;
}

interface ItemRow {
  id: string; product_id: string; product_code: string; name_en: string; name_fr: string | null;
  unit_price: number; quantity: number; line_total: number; media_id: string | null;
}

export const loadOrder = (conn: DatabaseSync, id: string) =>
  conn.prepare('SELECT * FROM shop_orders WHERE id = ?').get(id) as OrderRow | undefined;

/** By id, or by order number (TX-ORD-######) for links from emails. */
export function findOrder(conn: DatabaseSync, idOrNumber: string): OrderRow | undefined {
  if (/^TX-ORD-\d{6}$/i.test(idOrNumber)) {
    return conn.prepare('SELECT * FROM shop_orders WHERE order_number = ?').get(idOrNumber.toUpperCase()) as OrderRow | undefined;
  }
  return loadOrder(conn, idOrNumber);
}

const str = (v: unknown) => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim() : '');
const nameOf = (conn: DatabaseSync, userId: string | null) =>
  userId ? (conn.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string } | undefined)?.display_name ?? null : null;
const jobStatusOf = (conn: DatabaseSync, jobId: string | null) =>
  jobId ? (conn.prepare('SELECT status FROM dispatch_jobs WHERE id = ?').get(jobId) as { status: string } | undefined)?.status ?? null : null;
const jobClosed = (status: string | null) => status === 'RETURNED' || status === 'CANCELLED';
const money = (o: { currency: string }, n: number) => formatCurrencyAmount(n, o.currency, 'en-CM');

// ---- List ----

/** Tabs of the orders list (SHOP_SPEC §7.6). */
export const ORDER_TABS: Record<string, readonly OrderStatus[] | null> = {
  ALL: null,
  NEW: ['NEW'],
  CONFIRMED: ['CONFIRMED'],
  READY: ['READY'],
  OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY'],
  COMPLETED: ['DELIVERED', 'COLLECTED'],
  CLOSED: ['CANCELLED', 'RETURNED'],
};

export function listOrders(conn: DatabaseSync, q: { tab?: unknown; q?: unknown }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const tab = typeof q.tab === 'string' && q.tab in ORDER_TABS ? q.tab : 'ALL';
  const statuses = ORDER_TABS[tab];
  if (statuses) {
    where.push(`o.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  const text = str(q.q).slice(0, 100);
  if (text) {
    const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const parts = ["o.order_number LIKE ? ESCAPE '\\'", "o.customer_name LIKE ? ESCAPE '\\'",
      "EXISTS (SELECT 1 FROM shop_order_items i WHERE i.order_id = o.id AND i.product_code LIKE ? ESCAPE '\\')"];
    params.push(like(text.toUpperCase()), like(text), like(text.toUpperCase()));
    // Phone: digits only, so "6 51 05 93 45" finds +237651059345.
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 4) {
      parts.push("o.customer_phone LIKE ? ESCAPE '\\'", "o.customer_whatsapp LIKE ? ESCAPE '\\'");
      params.push(like(digits), like(digits));
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  const rows = conn.prepare(`
    SELECT o.*, c.name AS city_name,
      (SELECT COALESCE(SUM(i.quantity), 0) FROM shop_order_items i WHERE i.order_id = o.id) AS item_count
    FROM shop_orders o LEFT JOIN delivery_cities c ON c.id = o.city_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.created_at_ts DESC LIMIT 500
  `).all(...params) as unknown as (OrderRow & { city_name: string | null; item_count: number })[];

  const counts: Record<string, number> = Object.fromEntries(Object.keys(ORDER_TABS).map((k) => [k, 0]));
  for (const r of conn.prepare('SELECT status, COUNT(*) AS c FROM shop_orders GROUP BY status').all() as { status: string; c: number }[]) {
    counts.ALL += r.c;
    for (const [k, list] of Object.entries(ORDER_TABS)) if (list?.includes(r.status as OrderStatus)) counts[k] += r.c;
  }
  return {
    data: rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      createdAt: o.created_at_ts,
      customerName: o.anonymised_at_ts ? null : o.customer_name,
      deliveryMethod: o.delivery_method,
      cityName: o.city_name,
      pickupOffice: o.pickup_office,
      itemCount: o.item_count,
      total: o.total,
      currency: o.currency,
      deliveryFeeStatus: o.delivery_fee_status,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      status: o.status,
      deliveryProblem: o.delivery_problem_at_ts !== null,
    })),
    counts,
  };
}

/** Numbers for the console badge, the bell and the dashboard tiles. */
export function ordersSummary(conn: DatabaseSync) {
  const count = (sql: string) => (conn.prepare(`SELECT COUNT(*) AS c FROM shop_orders WHERE ${sql}`).get() as { c: number }).c;
  const latest = conn.prepare(`SELECT MAX(created_at_ts) AS t FROM shop_orders WHERE status = 'NEW'`).get() as { t: number | null };
  return {
    newOrders: count("status = 'NEW'"),
    feeToConfirm: count("status = 'NEW' AND delivery_fee_status = 'TO_CONFIRM'"),
    ready: count("status = 'READY'"),
    outForDelivery: count("status = 'OUT_FOR_DELIVERY'"),
    deliveryProblems: count("status = 'OUT_FOR_DELIVERY' AND delivery_problem_at_ts IS NOT NULL"),
    unpaidCompleted: count("status IN ('DELIVERED', 'COLLECTED') AND payment_status = 'UNPAID'"),
    // Published products at or below their low-stock level (a count only, no product data).
    lowStock: (conn.prepare(`
      SELECT COUNT(*) AS c FROM shop_products WHERE status = 'PUBLISHED' AND stock_qty <= COALESCE(low_stock_at, ?)
    `).get(loadShopSettings(conn).lowStockAt) as { c: number }).c,
    latestNewAt: latest.t ?? null,
  };
}

// ---- Order page ----

export function orderDetail(conn: DatabaseSync, o: OrderRow) {
  const items = conn.prepare(`
    SELECT i.*, m.file_300 FROM shop_order_items i LEFT JOIN shop_media m ON m.id = i.media_id
    WHERE i.order_id = ? ORDER BY i.rowid
  `).all(o.id) as unknown as (ItemRow & { file_300: string | null })[];
  const events = conn.prepare(`
    SELECT e.kind, e.from_value, e.to_value, e.note, e.user_id, e.at_ts, u.display_name
    FROM shop_order_events e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.order_id = ? ORDER BY e.at_ts, e.rowid
  `).all(o.id) as { kind: string; from_value: string | null; to_value: string | null; note: string | null; user_id: string | null; at_ts: number; display_name: string | null }[];
  const city = o.city_id ? conn.prepare('SELECT id, name FROM delivery_cities WHERE id = ?').get(o.city_id) as { id: string; name: string } | undefined : undefined;
  const zone = o.zone_id ? conn.prepare('SELECT id, name FROM delivery_zones WHERE id = ?').get(o.zone_id) as { id: string; name: string } | undefined : undefined;
  const jobStatus = jobStatusOf(conn, o.job_id);
  const closed = jobClosed(jobStatus);
  const anonymised = o.anonymised_at_ts !== null;
  const dispatchCheck = dispatchBlockers(conn, o, loadShopSettings(conn));
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at_ts,
    updatedAt: o.updated_at_ts,
    locale: o.locale,
    anonymised,
    customer: {
      name: o.customer_name,
      phone: anonymised ? null : o.customer_phone,
      whatsapp: anonymised ? null : o.customer_whatsapp,
      email: anonymised ? null : o.customer_email,
    },
    deliveryMethod: o.delivery_method,
    city: city ?? null,
    zone: zone ?? null,
    pickupOffice: o.pickup_office,
    address: anonymised ? null : o.address_text,
    customerNote: anonymised ? null : o.customer_note,
    items: items.map((i) => ({
      productId: i.product_id, code: i.product_code, nameEn: i.name_en, nameFr: i.name_fr,
      unitPrice: i.unit_price, qty: i.quantity, lineTotal: i.line_total,
      image: i.file_300 ? shopMediaUrl(i.file_300) : null,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    deliveryFeeStatus: o.delivery_fee_status,
    total: o.total,
    currency: o.currency,
    payment: {
      method: o.payment_method,
      status: o.payment_status,
      reference: o.payment_reference,
      amount: o.paid_amount,
      paidAt: o.paid_at_ts,
      paidBy: nameOf(conn, o.paid_by),
      refund: o.payment_status === 'REFUNDED' ? {
        amount: o.refund_amount, method: o.refund_method, reference: o.refund_reference,
        at: o.refunded_at_ts, by: nameOf(conn, o.refunded_by),
      } : null,
    },
    job: o.job_id ? { id: o.job_id, trackingId: o.tracking_id, status: jobStatus } : null,
    cancelReason: o.cancel_reason,
    deliveryProblem: o.delivery_problem_at_ts !== null,
    nextStatuses: staffNextStatuses(o.status, {
      deliveryMethod: o.delivery_method, deliveryFeeStatus: o.delivery_fee_status, jobClosed: closed,
    }),
    canSetFee: canSetFee(o),
    dispatch: o.status === 'READY' && o.delivery_method === 'DELIVERY' ? dispatchCheck : null,
    events: events.map((e) => ({ kind: e.kind, from: e.from_value, to: e.to_value, note: e.note, by: e.display_name, at: e.at_ts })),
  };
}

// ---- Status ----

const RULE_TEXT: Record<ShopRuleFail, string> = {
  ILLEGAL_TRANSITION: 'This order cannot move to that status from where it is now.',
  SYSTEM_ONLY: 'This step is made by dispatch, not by a status button.',
  FEE_TO_CONFIRM: 'Set the delivery fee before confirming the order.',
  WRONG_DELIVERY_METHOD: 'This step does not fit how the customer receives the order.',
  REASON_REQUIRED: 'Give a reason.',
};
const ruleFail = (code: ShopRuleFail): never => refuse(code === 'ILLEGAL_TRANSITION' || code === 'SYSTEM_ONLY' ? 409 : 400, code, RULE_TEXT[code],
  code === 'REASON_REQUIRED' ? 'reason' : undefined);

/** Puts each line back in stock, with a stock move (CANCEL or RETURN) per product. */
function restock(conn: DatabaseSync, o: OrderRow, reason: 'CANCEL' | 'RETURN', userId: string, now: number): void {
  const items = conn.prepare('SELECT product_id, quantity FROM shop_order_items WHERE order_id = ?').all(o.id) as { product_id: string; quantity: number }[];
  for (const i of items) {
    const changed = conn.prepare('UPDATE shop_products SET stock_qty = stock_qty + ?, updated_at_ts = ? WHERE id = ?').run(i.quantity, now, i.product_id);
    if (Number(changed.changes) !== 1) continue;
    const after = (conn.prepare('SELECT stock_qty FROM shop_products WHERE id = ?').get(i.product_id) as { stock_qty: number }).stock_qty;
    conn.prepare(`
      INSERT INTO shop_stock_moves (id, product_id, delta, reason, order_id, note, user_id, stock_after, at_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), i.product_id, i.quantity, reason, o.id, o.order_number, userId, after, now);
  }
}

export function changeOrderStatus(conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, userId: string): void {
  if (!isOrderStatus(b.status)) refuse(400, 'INVALID_STATUS', 'Choose a status.', 'status');
  const to = b.status as OrderStatus;
  const reason = str(b.reason).slice(0, ORDER_REASON_MAX) || null;
  const putBack = b.putBackInStock === true;
  const jobStatus = jobStatusOf(conn, o.job_id);
  const check = checkOrderTransition(o.status, to, {
    actor: 'staff', deliveryMethod: o.delivery_method, deliveryFeeStatus: o.delivery_fee_status, reason, jobClosed: jobClosed(jobStatus),
  });
  if (!check.ok) ruleFail(check.code);
  const now = Date.now();
  inTransaction(conn, () => {
    const backToReady = o.status === 'OUT_FOR_DELIVERY' && to === 'READY';
    const changed = conn.prepare(`
      UPDATE shop_orders SET status = ?, updated_at_ts = ?, updated_by = ?
        ${to === 'CANCELLED' ? ', cancel_reason = ?' : ''}
        ${backToReady || to === 'CANCELLED' ? ', delivery_problem_at_ts = NULL' : ''}
        ${backToReady ? ', job_id = NULL, tracking_id = NULL' : ''}
      WHERE id = ? AND status = ?
    `).run(...[to, now, userId, ...(to === 'CANCELLED' ? [reason] : []), o.id, o.status]);
    if (Number(changed.changes) !== 1) refuse(409, 'ORDER_CHANGED', 'Someone else changed this order. Reload it and try again.');
    if (restocksOn(to, putBack)) restock(conn, o, to === 'CANCELLED' ? 'CANCEL' : 'RETURN', userId, now);
    const note = backToReady
      ? `Back to ready: delivery job ${o.tracking_id ?? ''} ended without delivery${reason ? `. ${reason}` : ''}`
      : to === 'RETURNED' ? `${reason ?? ''}${putBack ? ' (items put back in stock)' : ' (items not put back in stock)'}`.trim()
        : reason;
    orderEvent(conn, o.id, 'STATUS', note, { from: o.status, to, userId, at: now });
    audit(req, 'shop.order_status', 'shop_order', o.id, `Order ${o.order_number}: ${o.status.toLowerCase()} → ${to.toLowerCase()}`,
      { status: o.status }, { status: to, ...(reason ? { reason } : {}), ...(to === 'RETURNED' ? { putBackInStock: putBack } : {}),
        ...(restocksOn(to, putBack) ? { restocked: true } : {}) }, { conn });
    if (to === 'CANCELLED' && reason) queueOrderCancelledEmail(conn, o.id, reason, userId, now);
  });
}

// ---- Delivery fee ----

export function canSetFee(o: OrderRow): boolean {
  return o.delivery_method === 'DELIVERY' && (o.status === 'NEW' || o.status === 'CONFIRMED') && o.payment_status === 'UNPAID';
}

export function setDeliveryFee(conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, userId: string): void {
  if (!canSetFee(o)) refuse(409, 'FEE_LOCKED', 'The delivery fee can be set on a new or confirmed delivery order that is not paid yet.');
  const fee = b.fee;
  if (typeof fee !== 'number' || !Number.isInteger(fee) || fee < 0 || fee > PRICE_MAX) {
    refuse(400, 'INVALID_FEE', 'Enter the delivery fee as a whole amount (0 or more).', 'fee');
  }
  const total = orderTotal(o.subtotal, fee as number);
  const now = Date.now();
  inTransaction(conn, () => {
    conn.prepare(`
      UPDATE shop_orders SET delivery_fee = ?, delivery_fee_status = 'QUOTED', total = ?, updated_at_ts = ?, updated_by = ? WHERE id = ?
    `).run(fee as number, total, now, userId, o.id);
    const before = o.delivery_fee === null ? 'to confirm' : money(o, o.delivery_fee);
    orderEvent(conn, o.id, 'FEE', `Delivery fee ${before} → ${money(o, fee as number)}. Total ${money(o, total)}.`,
      { from: o.delivery_fee === null ? null : String(o.delivery_fee), to: String(fee), userId, at: now });
    audit(req, 'shop.order_fee', 'shop_order', o.id, `Order ${o.order_number}: delivery fee set`,
      { deliveryFee: o.delivery_fee, deliveryFeeStatus: o.delivery_fee_status, total: o.total },
      { deliveryFee: fee, deliveryFeeStatus: 'QUOTED', total, currency: o.currency }, { conn });
  });
}

// ---- Payments ----

function readReference(value: unknown, required: boolean, field = 'reference'): string | null {
  const ref = str(value);
  if (ref.length > ORDER_REFERENCE_MAX) refuse(400, 'INVALID_REFERENCE', `Keep the reference under ${ORDER_REFERENCE_MAX} characters.`, field);
  if (required && !ref) refuse(400, 'REFERENCE_REQUIRED', 'Enter the mobile money transaction reference.', field);
  return ref || null;
}

export function recordPayment(conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, userId: string): void {
  const rule = checkPaymentChange(o.payment_status, 'PAID');
  if (!rule.ok) refuse(409, 'ALREADY_PAID', 'This order is already paid or refunded.');
  if (o.status === 'CANCELLED') refuse(409, 'ORDER_CANCELLED', 'A cancelled order cannot be paid.');
  if (o.delivery_fee_status === 'TO_CONFIRM') refuse(409, 'FEE_TO_CONFIRM', 'Set the delivery fee first, so the total is known.');
  if (!isShopPaymentMethod(b.method)) refuse(400, 'INVALID_METHOD', 'Choose how the customer paid.', 'method');
  const method = b.method as (typeof SHOP_PAYMENT_METHODS)[number];
  if (!paymentMethodFits(method, o.delivery_method) && method !== 'MTN_MOMO' && method !== 'ORANGE_MONEY') {
    refuse(400, 'INVALID_METHOD', 'This payment method does not fit how the customer receives the order.', 'method');
  }
  if (b.amount !== o.total) refuse(400, 'AMOUNT_MISMATCH', `The amount must be the order total, ${money(o, o.total)}.`, 'amount');
  const reference = readReference(b.reference, method === 'MTN_MOMO' || method === 'ORANGE_MONEY');
  const now = Date.now();
  inTransaction(conn, () => {
    const changed = conn.prepare(`
      UPDATE shop_orders SET payment_status = 'PAID', payment_method = ?, payment_reference = ?, paid_amount = ?, paid_at_ts = ?,
        paid_by = ?, updated_at_ts = ?, updated_by = ? WHERE id = ? AND payment_status = 'UNPAID'
    `).run(method, reference, o.total, now, userId, now, userId, o.id);
    if (Number(changed.changes) !== 1) refuse(409, 'ORDER_CHANGED', 'Someone else changed this order. Reload it and try again.');
    orderEvent(conn, o.id, 'PAYMENT', `Paid ${money(o, o.total)} by ${method.toLowerCase().replace(/_/g, ' ')}${reference ? ` (ref. ${reference})` : ''}.`,
      { from: 'UNPAID', to: 'PAID', userId, at: now });
    audit(req, 'shop.order_paid', 'shop_order', o.id, `Order ${o.order_number} paid`, { paymentStatus: 'UNPAID', paymentMethod: o.payment_method },
      { paymentStatus: 'PAID', paymentMethod: method, amount: o.total, currency: o.currency, ...(reference ? { reference } : {}) }, { conn });
  });
}

/** PAID → UNPAID: a payment recorded by mistake or a mobile money reference that turned out wrong. */
export function markUnpaid(conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, userId: string): void {
  const reason = str(b.reason).slice(0, ORDER_REASON_MAX);
  const rule = checkPaymentChange(o.payment_status, 'UNPAID', reason);
  if (!rule.ok) ruleFail(rule.code);
  const now = Date.now();
  inTransaction(conn, () => {
    conn.prepare(`
      UPDATE shop_orders SET payment_status = 'UNPAID', payment_reference = NULL, paid_amount = NULL, paid_at_ts = NULL, paid_by = NULL,
        updated_at_ts = ?, updated_by = ? WHERE id = ?
    `).run(now, userId, o.id);
    orderEvent(conn, o.id, 'PAYMENT', `Payment removed: ${reason}`, { from: 'PAID', to: 'UNPAID', userId, at: now });
    audit(req, 'shop.order_unpaid', 'shop_order', o.id, `Order ${o.order_number}: payment removed`,
      { paymentStatus: 'PAID', reference: o.payment_reference, amount: o.paid_amount }, { paymentStatus: 'UNPAID', reason }, { conn });
  });
}

export function recordRefund(conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, userId: string): void {
  const reason = str(b.reason).slice(0, ORDER_REASON_MAX);
  const rule = checkPaymentChange(o.payment_status, 'REFUNDED', reason);
  if (!rule.ok) ruleFail(rule.code);
  if (!(REFUND_METHODS as readonly unknown[]).includes(b.method)) refuse(400, 'INVALID_METHOD', 'Choose how the money was paid back.', 'method');
  const method = b.method as string;
  const paid = o.paid_amount ?? o.total;
  const amount = b.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > paid) {
    refuse(400, 'INVALID_AMOUNT', `Enter the amount paid back, up to ${money(o, paid)}.`, 'amount');
  }
  const reference = readReference(b.reference, method !== 'CASH');
  const now = Date.now();
  inTransaction(conn, () => {
    conn.prepare(`
      UPDATE shop_orders SET payment_status = 'REFUNDED', refund_amount = ?, refund_method = ?, refund_reference = ?, refunded_at_ts = ?,
        refunded_by = ?, updated_at_ts = ?, updated_by = ? WHERE id = ? AND payment_status = 'PAID'
    `).run(amount as number, method, reference, now, userId, now, userId, o.id);
    orderEvent(conn, o.id, 'PAYMENT', `Refunded ${money(o, amount as number)} by ${method.toLowerCase().replace(/_/g, ' ')}${reference ? ` (ref. ${reference})` : ''}: ${reason}`,
      { from: 'PAID', to: 'REFUNDED', userId, at: now });
    audit(req, 'shop.order_refund', 'shop_order', o.id, `Order ${o.order_number} refunded`, { paymentStatus: 'PAID' },
      { paymentStatus: 'REFUNDED', amount, currency: o.currency, method, ...(reference ? { reference } : {}), reason }, { conn });
  });
}

// ---- Internal note ----

export function addOrderNote(conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, userId: string): void {
  const note = typeof b.note === 'string' ? b.note.normalize('NFC').replace(/\r\n?/g, '\n').trim() : '';
  if (!note) refuse(400, 'NOTE_REQUIRED', 'Write the note.', 'note');
  if (note.length > ORDER_NOTE_MAX) refuse(400, 'NOTE_TOO_LONG', `Keep the note under ${ORDER_NOTE_MAX} characters.`, 'note');
  inTransaction(conn, () => {
    orderEvent(conn, o.id, 'NOTE', note, { userId });
    audit(req, 'shop.order_note', 'shop_order', o.id, `Note added to order ${o.order_number}`, undefined, { length: note.length }, { conn });
  });
}

// ---- Send to dispatch (SHOP_SPEC §13) ----

interface DispatchPlan {
  ok: boolean;
  /** Why the order cannot be sent yet (shown on the order page). */
  blockers: string[];
  scope: 'LOCAL' | 'INTERCITY' | null;
  sizeClass: string;
  weightKg: number | null;
  price: number | null;
  codAmount: number | null;
}

/** What Send to dispatch would create, and what stops it. */
export function dispatchBlockers(conn: DatabaseSync, o: OrderRow, settings: ShopSettings): DispatchPlan {
  const blockers: string[] = [];
  const items = conn.prepare(`
    SELECT i.quantity, p.size_class, p.weight_kg FROM shop_order_items i LEFT JOIN shop_products p ON p.id = i.product_id WHERE i.order_id = ?
  `).all(o.id) as { quantity: number; size_class: string | null; weight_kg: number | null }[];
  const feeItems = items.map((i) => ({ sizeClass: i.size_class ?? 'SMALL', weightKg: i.weight_kg, qty: i.quantity }));
  const from = settings.shipFrom.cityId;
  const scope = from && o.city_id ? (from === o.city_id ? 'LOCAL' : 'INTERCITY') : null;
  if (!from) blockers.push('Set the ship-from city in Shop settings.');
  else {
    const city = conn.prepare('SELECT is_active FROM delivery_cities WHERE id = ?').get(from) as { is_active: number } | undefined;
    if (!city || city.is_active !== 1) blockers.push('The ship-from city in Shop settings is no longer active.');
    if (!settings.shipFrom.zoneId && !settings.shipFrom.landmark) blockers.push('Set the ship-from area or landmark in Shop settings.');
  }
  if (o.anonymised_at_ts !== null) blockers.push('The customer’s delivery details have been removed.');
  if (!o.city_id) blockers.push('The order has no delivery city.');
  if (o.delivery_fee === null) blockers.push('Set the delivery fee first.');
  const weightKg = cartWeightKg(feeItems);
  return {
    ok: blockers.length === 0,
    blockers,
    scope,
    sizeClass: largestSizeClass(feeItems),
    weightKg,
    price: o.delivery_fee,
    codAmount: o.payment_method === 'CASH_ON_DELIVERY' && o.payment_status === 'UNPAID' ? o.total : null,
  };
}

export function sendToDispatch(
  conn: DatabaseSync, req: Request, o: OrderRow, b: Record<string, unknown>, actor: { userId: string; name: string },
): { trackingId: string; jobId: string } {
  if (o.status !== 'READY' || o.delivery_method !== 'DELIVERY') {
    refuse(409, 'NOT_READY', 'Only an order that is ready, for delivery, can be sent to dispatch.');
  }
  const settings = loadShopSettings(conn);
  const plan = dispatchBlockers(conn, o, settings);
  if (!plan.ok) refuse(409, 'DISPATCH_BLOCKED', plan.blockers.join(' '));
  let sizeClass = plan.sizeClass;
  if (b.sizeClass !== undefined && b.sizeClass !== null && b.sizeClass !== '') {
    if (!isSizeClass(b.sizeClass)) refuse(400, 'INVALID_SIZE', `Choose a size: ${SIZE_CLASSES.join(', ').toLowerCase()}.`, 'sizeClass');
    sizeClass = b.sizeClass as string;
  }
  let weightKg = plan.weightKg;
  if (b.weightKg !== undefined && b.weightKg !== null && b.weightKg !== '') {
    if (typeof b.weightKg !== 'number' || !Number.isFinite(b.weightKg) || b.weightKg <= 0 || b.weightKg > 100_000) {
      refuse(400, 'INVALID_WEIGHT', 'Enter the weight in kg (more than 0).', 'weightKg');
    }
    weightKg = Math.round((b.weightKg as number) * 100) / 100;
  }
  if (plan.scope === 'INTERCITY' && !weightKg) refuse(400, 'WEIGHT_REQUIRED', 'Enter the parcel weight for a delivery to another city.', 'weightKg');

  const pickup: Place = {
    cityId: settings.shipFrom.cityId!, zoneId: settings.shipFrom.zoneId, landmark: settings.shipFrom.landmark,
    directions: null, lat: null, lng: null, contactName: COMPANY, contactPhone: PHONE,
  };
  const dropoff: Place = {
    cityId: o.city_id!, zoneId: o.zone_id, landmark: (o.address_text ?? '').slice(0, TEXT_MAX),
    directions: o.landmark, lat: null, lng: null, contactName: o.customer_name.slice(0, 80), contactPhone: o.customer_phone,
  };
  const items = conn.prepare('SELECT product_code, quantity FROM shop_order_items WHERE order_id = ? ORDER BY rowid').all(o.id) as
    { product_code: string; quantity: number }[];
  let description = `Shop order ${o.order_number}: ${items.map((i) => `${i.quantity} × ${i.product_code}`).join(', ')}`;
  if (description.length > TEXT_MAX) description = `${description.slice(0, TEXT_MAX - 1)}…`;
  const now = Date.now();

  return inTransaction(conn, () => {
    const job = insertConfirmedJob(conn, {
      scope: plan.scope!, pickup, dropoff, sizeClass, weightKg, itemDescription: description, isExpress: false,
      scheduledForTs: null, vehicleRequired: null, price: o.delivery_fee!, currency: o.currency,
      // The price is the delivery fee agreed with the customer, not a fresh rate-sheet price.
      priceOverridden: true, payer: 'SENDER', codAmount: plan.codAmount, collectDeliveryFee: false,
      deliveryCode: null, notifyLocale: o.locale === 'fr' ? 'fr' : 'en',
    }, {
      req, actor, at: now,
      auditSummary: `Delivery job created for shop order ${o.order_number}`,
      auditAfter: { scope: plan.scope, price: o.delivery_fee, currency: o.currency, priceOverridden: true,
        priceReason: `Delivery fee of shop order ${o.order_number}`, codAmount: plan.codAmount, payer: 'SENDER', shopOrder: o.order_number },
    });
    const check = checkOrderTransition('READY', 'OUT_FOR_DELIVERY', {
      actor: 'system', deliveryMethod: o.delivery_method, deliveryFeeStatus: o.delivery_fee_status,
    });
    if (!check.ok) ruleFail(check.code);
    const changed = conn.prepare(`
      UPDATE shop_orders SET status = 'OUT_FOR_DELIVERY', job_id = ?, tracking_id = ?, delivery_problem_at_ts = NULL,
        updated_at_ts = ?, updated_by = ? WHERE id = ? AND status = 'READY'
    `).run(job.id, job.tracking_number, now, actor.userId, o.id);
    if (Number(changed.changes) !== 1) refuse(409, 'ORDER_CHANGED', 'Someone else changed this order. Reload it and try again.');
    const cod = plan.codAmount ? ` Courier collects ${money(o, plan.codAmount)} on delivery.` : '';
    orderEvent(conn, o.id, 'STATUS', `Sent to dispatch: job ${job.tracking_number} (${plan.scope!.toLowerCase()}).${cod}`,
      { from: 'READY', to: 'OUT_FOR_DELIVERY', userId: actor.userId, at: now });
    audit(req, 'shop.order_dispatch', 'shop_order', o.id, `Order ${o.order_number} sent to dispatch: ${job.tracking_number}`,
      { status: 'READY' }, { status: 'OUT_FOR_DELIVERY', jobId: job.id, trackingId: job.tracking_number, codAmount: plan.codAmount }, { conn });
    queueOrderDispatchedEmail(conn, o.id, job.tracking_number, actor.userId, now);
    return { trackingId: job.tracking_number, jobId: job.id };
  });
}

// ---- Shop settings (SHOP_SPEC §7.7) ----

export function settingsView(conn: DatabaseSync) {
  const cities = conn.prepare('SELECT id, name FROM delivery_cities WHERE is_active = 1 ORDER BY name').all() as { id: string; name: string }[];
  const zones = conn.prepare('SELECT id, city_id, name FROM delivery_zones WHERE is_active = 1 ORDER BY name').all() as { id: string; city_id: string; name: string }[];
  return {
    settings: loadShopSettings(conn),
    cities,
    zones: zones.map((z) => ({ id: z.id, cityId: z.city_id, name: z.name })),
    pickupOfficeKeys: PICKUP_OFFICE_KEYS,
    paymentMethods: SHOP_PAYMENT_METHODS,
    limits: { lowStockMax: LOW_STOCK_MAX, maxPerOrderMax: MAX_PER_ORDER_MAX, landmarkMax: LANDMARK_MAX },
    mailEnabled: mailEnabled(),
  };
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export function saveSettings(conn: DatabaseSync, req: Request, b: Record<string, unknown>): ShopSettings {
  const before = loadShopSettings(conn);
  if (typeof b.enabled !== 'boolean') refuse(400, 'INVALID_INPUT', 'Choose whether the shop is on or off.', 'enabled');
  const orderEmail = str(b.orderEmail);
  if (!isValidOrderEmail(orderEmail) || !isDeliverableAddress(orderEmail)) refuse(400, 'INVALID_EMAIL', 'Enter one valid email address for orders.', 'orderEmail');
  const ship = (b.shipFrom && typeof b.shipFrom === 'object' ? b.shipFrom : {}) as Record<string, unknown>;
  const cityId = str(ship.cityId) || null;
  const zoneId = str(ship.zoneId) || null;
  const landmark = str(ship.landmark);
  if (landmark.length > LANDMARK_MAX) refuse(400, 'INVALID_LANDMARK', `Keep the landmark under ${LANDMARK_MAX} characters.`, 'landmark');
  if (cityId) {
    const city = conn.prepare('SELECT is_active FROM delivery_cities WHERE id = ?').get(cityId) as { is_active: number } | undefined;
    if (!city || city.is_active !== 1) refuse(400, 'INVALID_CITY', 'Choose an active delivery city.', 'cityId');
  } else if (zoneId) refuse(400, 'INVALID_AREA', 'Choose the city first.', 'zoneId');
  if (zoneId) {
    const zone = conn.prepare('SELECT city_id, is_active FROM delivery_zones WHERE id = ?').get(zoneId) as { city_id: string; is_active: number } | undefined;
    if (!zone || zone.city_id !== cityId || zone.is_active !== 1) refuse(400, 'INVALID_AREA', 'Choose an area of the ship-from city.', 'zoneId');
  }
  const offices = Array.isArray(b.pickupOffices) ? [...new Set(b.pickupOffices.filter((k): k is string => typeof k === 'string'))] : [];
  if (offices.some((k) => !PICKUP_OFFICE_KEYS.includes(k))) refuse(400, 'INVALID_OFFICE', 'Choose pickup offices from the list.', 'pickupOffices');
  const methods = Array.isArray(b.paymentMethods) ? SHOP_PAYMENT_METHODS.filter((m) => (b.paymentMethods as unknown[]).includes(m)) : [];
  if (methods.length === 0) refuse(400, 'INVALID_METHODS', 'Offer at least one payment method.', 'paymentMethods');
  if (!methods.some((m) => paymentMethodFits(m, 'DELIVERY'))) refuse(400, 'INVALID_METHODS', 'Offer at least one payment method that works for delivery.', 'paymentMethods');
  if (offices.length > 0 && !methods.some((m) => paymentMethodFits(m, 'PICKUP'))) {
    refuse(400, 'INVALID_METHODS', 'Offer at least one payment method that works for pickup, or switch pickup off.', 'paymentMethods');
  }
  if (!isInt(b.lowStockAt, 0, LOW_STOCK_MAX)) refuse(400, 'INVALID_LOW_STOCK', `Enter a low-stock level from 0 to ${LOW_STOCK_MAX}.`, 'lowStockAt');
  if (!isInt(b.maxPerOrder, 1, MAX_PER_ORDER_MAX)) refuse(400, 'INVALID_MAX', `Enter a maximum per order from 1 to ${MAX_PER_ORDER_MAX}.`, 'maxPerOrder');
  // Switching the shop on needs a ship-from point, or no order could ever be priced or sent.
  if (b.enabled === true && (!cityId || (!zoneId && !landmark))) {
    refuse(400, 'SHIP_FROM_REQUIRED', 'Set the ship-from city and an area or landmark before switching the shop on.', 'cityId');
  }
  const next: ShopSettings = {
    enabled: b.enabled as boolean, orderEmail, shipFrom: { cityId, zoneId, landmark },
    pickupOffices: offices, paymentMethods: methods, lowStockAt: b.lowStockAt as number, maxPerOrder: b.maxPerOrder as number,
  };
  inTransaction(conn, () => {
    conn.prepare(`
      INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run(SHOP_SETTINGS_KEY, JSON.stringify(next));
    audit(req, 'shop.settings', 'settings', SHOP_SETTINGS_KEY,
      before.enabled !== next.enabled ? `Shop switched ${next.enabled ? 'on' : 'off'}` : 'Shop settings saved', before, next, { conn });
  });
  return loadShopSettings(conn);
}

/** Settings → "Send a test order email": a test message to the order email (not a fake order). */
export function sendSettingsTestEmail(conn: DatabaseSync, req: Request): string {
  if (!mailEnabled()) refuse(409, 'MAIL_OFF', 'Email is not set up on the server (SMTP), so nothing can be sent.');
  const { orderEmail } = loadShopSettings(conn);
  const id = queueEmail({ to: orderEmail, template: 'mail.test', locale: 'en', vars: {}, related: { type: 'shop_settings', id: SHOP_SETTINGS_KEY } }, conn);
  if (!id) refuse(409, 'MAIL_NOT_QUEUED', 'The test email could not be queued. Check the order email address.');
  audit(req, 'shop.settings_test_email', 'settings', SHOP_SETTINGS_KEY, 'Test email sent to the order email', undefined, { outboxId: id }, { conn });
  return id as string;
}

export { ORDER_STATUSES };
