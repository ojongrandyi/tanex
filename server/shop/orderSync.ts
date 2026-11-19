// What other parts of the system do to a shop order (docs/SHOP_SPEC.md §11, §13, task M.7). Each
// function is called by the one writer of the other record, inside its transaction, so the order
// and the job (or the cash row) never disagree:
// - the dispatch job's status (server/dispatch/jobs.ts writeTransition): DELIVERED moves the order
//   to DELIVERED; a failed attempt, a return or a cancellation raises the "Delivery problem" flag;
//   the job going back to a courier clears it;
// - Finance's review of a cash row (server/routes/cash.ts): the confirmed cash or mobile money
//   collected for the job pays the order once it covers the total; a rejected row leaves the
//   order unpaid with a timeline note.
// This file must not import server/dispatch/jobs.ts (jobs.ts imports it).
import crypto from 'node:crypto';
import type { Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { audit } from '../audit.js';
import { formatCurrencyAmount } from '../../src/shared/currency.js';
import { checkOrderTransition, checkPaymentChange, type DeliveryFeeStatus, type DeliveryMethod, type OrderStatus, type PaymentStatus } from '../../src/shared/shopOrderStatus.js';

interface SyncOrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  delivery_method: DeliveryMethod;
  delivery_fee_status: DeliveryFeeStatus;
  total: number;
  currency: string;
  delivery_problem_at_ts: number | null;
}

export function orderEvent(
  conn: DatabaseSync, orderId: string, kind: string, note: string | null,
  opts: { from?: string | null; to?: string | null; userId?: string | null; at?: number } = {},
): void {
  conn.prepare(`
    INSERT INTO shop_order_events (id, order_id, kind, from_value, to_value, note, user_id, at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), orderId, kind, opts.from ?? null, opts.to ?? null, note, opts.userId ?? null, opts.at ?? Date.now());
}

const orderOfJob = (conn: DatabaseSync, jobId: string) =>
  conn.prepare('SELECT * FROM shop_orders WHERE job_id = ?').get(jobId) as SyncOrderRow | undefined;

const PROBLEM_TEXT: Record<string, string> = {
  FAILED_ATTEMPT: 'Delivery problem: the courier could not deliver',
  RETURNED: 'Delivery problem: the parcel was returned to the shop',
  CANCELLED: 'Delivery problem: the dispatch job was cancelled',
};

/**
 * Applies a dispatch job's new status to the shop order sent with it, if any. `to` is the job's
 * new status. Called by writeTransition for every job move.
 */
export function syncShopOrderFromJob(
  conn: DatabaseSync,
  job: { id: string; tracking_number: string; failure_reason: string | null },
  to: string,
  ctx: { req: Request; actorUserId: string | null; at: number },
): void {
  const order = orderOfJob(conn, job.id);
  if (!order) return;
  const now = ctx.at;

  if (to === 'DELIVERED') {
    if (order.status !== 'OUT_FOR_DELIVERY') return;
    const check = checkOrderTransition('OUT_FOR_DELIVERY', 'DELIVERED', {
      actor: 'system', deliveryMethod: order.delivery_method, deliveryFeeStatus: order.delivery_fee_status,
    });
    if (!check.ok) return;
    conn.prepare(`UPDATE shop_orders SET status = 'DELIVERED', delivery_problem_at_ts = NULL, updated_at_ts = ? WHERE id = ?`).run(now, order.id);
    orderEvent(conn, order.id, 'STATUS', `Delivered (dispatch job ${job.tracking_number})`, { from: 'OUT_FOR_DELIVERY', to: 'DELIVERED', userId: ctx.actorUserId, at: now });
    audit(ctx.req, 'shop.order_status', 'shop_order', order.id, `Order ${order.order_number} delivered by dispatch`,
      { status: 'OUT_FOR_DELIVERY' }, { status: 'DELIVERED', trackingId: job.tracking_number, by: 'dispatch job' }, { conn });
    return;
  }

  if (to in PROBLEM_TEXT) {
    if (order.status !== 'OUT_FOR_DELIVERY') return;
    conn.prepare('UPDATE shop_orders SET delivery_problem_at_ts = ?, updated_at_ts = ? WHERE id = ?').run(now, now, order.id);
    const reason = to === 'FAILED_ATTEMPT' && job.failure_reason ? ` (${job.failure_reason.toLowerCase().replace(/_/g, ' ')})` : '';
    orderEvent(conn, order.id, 'DISPATCH', `${PROBLEM_TEXT[to]}${reason}. Job ${job.tracking_number}.`, { to, userId: ctx.actorUserId, at: now });
    audit(ctx.req, 'shop.order_delivery_problem', 'shop_order', order.id, `Delivery problem on order ${order.order_number}`,
      undefined, { jobStatus: to, trackingId: job.tracking_number }, { conn });
    return;
  }

  // The job is with a courier again after a failed attempt: the problem is being dealt with.
  if ((to === 'ASSIGNED' || to === 'ACCEPTED' || to === 'PICKED_UP' || to === 'ON_THE_WAY') && order.delivery_problem_at_ts !== null) {
    conn.prepare('UPDATE shop_orders SET delivery_problem_at_ts = NULL, updated_at_ts = ? WHERE id = ?').run(now, order.id);
    orderEvent(conn, order.id, 'DISPATCH', `Delivery is being tried again (job ${job.tracking_number}).`, { to, userId: ctx.actorUserId, at: now });
  }
}

/**
 * Finance confirmed or rejected a cash row (SHOP_SPEC §11). Only rows collected for a job that
 * carries a shop order count. Returns true when the order became PAID.
 */
export function applyCashReviewToShopOrder(
  conn: DatabaseSync,
  entry: { id: string; ref: string; job_id: string | null; entry_type: string; amount: number; currency: string; method: string },
  to: 'CONFIRMED' | 'REJECTED',
  ctx: { req: Request; userId: string; reason: string | null; at: number },
): boolean {
  if (!entry.job_id || entry.entry_type !== 'COLLECTED') return false;
  const order = orderOfJob(conn, entry.job_id);
  if (!order || order.payment_status !== 'UNPAID') return false;
  const money = (n: number) => formatCurrencyAmount(n, order.currency, 'en-CM');

  if (to === 'REJECTED') {
    orderEvent(conn, order.id, 'PAYMENT', `Cash entry ${entry.ref} (${money(entry.amount)}) rejected by Finance${ctx.reason ? `: ${ctx.reason}` : ''}. The order stays unpaid.`,
      { userId: ctx.userId, at: ctx.at });
    return false;
  }

  const confirmed = conn.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total, GROUP_CONCAT(ref, ', ') AS refs FROM cash_ledger
    WHERE job_id = ? AND entry_type = 'COLLECTED' AND status = 'CONFIRMED' AND currency = ?
  `).get(entry.job_id, order.currency) as { total: number; refs: string | null };
  if (confirmed.total < order.total) {
    orderEvent(conn, order.id, 'PAYMENT', `Part of the payment confirmed by Finance: ${money(confirmed.total)} of ${money(order.total)} (${entry.ref}).`,
      { userId: ctx.userId, at: ctx.at });
    return false;
  }
  if (!checkPaymentChange('UNPAID', 'PAID').ok) return false;
  const reference = (confirmed.refs ?? entry.ref).slice(0, 200);
  conn.prepare(`
    UPDATE shop_orders SET payment_status = 'PAID', payment_reference = ?, paid_amount = ?, paid_at_ts = ?, paid_by = ?, updated_at_ts = ?
    WHERE id = ? AND payment_status = 'UNPAID'
  `).run(reference, order.total, ctx.at, ctx.userId, ctx.at, order.id);
  orderEvent(conn, order.id, 'PAYMENT', `Paid: ${money(order.total)} collected on delivery and confirmed by Finance (${reference}).`,
    { from: 'UNPAID', to: 'PAID', userId: ctx.userId, at: ctx.at });
  audit(ctx.req, 'shop.order_paid', 'shop_order', order.id, `Order ${order.order_number} paid (cash confirmed by Finance)`,
    { paymentStatus: 'UNPAID' }, { paymentStatus: 'PAID', amount: order.total, currency: order.currency, reference, source: 'cash_ledger' }, { conn });
  return true;
}
