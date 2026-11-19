// Shop orders (docs/SHOP_SPEC.md §4, §10.1, §11): order statuses, who may move an order from one
// status to the next, payment statuses and methods, and the delivery choices. Shared by the server
// (which enforces it) and the console (which only shows the actions it allows). DOM-free.
// Names: CONTENT §17.8 / CONTENT_FR §17 (owner to confirm, #187).

export type ShopLang = 'en' | 'fr';
type Labels<K extends string> = Record<K, Record<ShopLang, string>>;

// ---- Order statuses ----

export const ORDER_STATUSES = [
  'NEW', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COLLECTED', 'CANCELLED', 'RETURNED',
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export const ORDER_STATUS_LABELS: Labels<OrderStatus> = {
  NEW: { en: 'New', fr: 'Nouvelle' },
  CONFIRMED: { en: 'Confirmed', fr: 'Confirmée' },
  READY: { en: 'Ready', fr: 'Prête' },
  OUT_FOR_DELIVERY: { en: 'Out for delivery', fr: 'En cours de livraison' },
  DELIVERED: { en: 'Delivered', fr: 'Livrée' },
  COLLECTED: { en: 'Collected', fr: 'Retirée' },
  CANCELLED: { en: 'Cancelled', fr: 'Annulée' },
  RETURNED: { en: 'Returned', fr: 'Retournée' },
};

/** No further move except a return (DELIVERED, COLLECTED) or none at all. */
export const FINAL_ORDER_STATUSES: readonly OrderStatus[] = ['DELIVERED', 'COLLECTED', 'CANCELLED', 'RETURNED'];

// ---- Delivery ----

export const DELIVERY_METHODS = ['DELIVERY', 'PICKUP'] as const;
export type DeliveryMethod = typeof DELIVERY_METHODS[number];

export function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return typeof value === 'string' && (DELIVERY_METHODS as readonly string[]).includes(value);
}

/** QUOTED: priced from the rate tables · TO_CONFIRM: no rate matched, staff set it · NONE: pickup. */
export const DELIVERY_FEE_STATUSES = ['QUOTED', 'TO_CONFIRM', 'NONE'] as const;
export type DeliveryFeeStatus = typeof DELIVERY_FEE_STATUSES[number];

export function isDeliveryFeeStatus(value: unknown): value is DeliveryFeeStatus {
  return typeof value === 'string' && (DELIVERY_FEE_STATUSES as readonly string[]).includes(value);
}

// ---- Payment (no online payment, SHOP_SPEC §11) ----

export const SHOP_PAYMENT_METHODS = ['CASH_ON_DELIVERY', 'MTN_MOMO', 'ORANGE_MONEY', 'PAY_AT_OFFICE'] as const;
export type ShopPaymentMethod = typeof SHOP_PAYMENT_METHODS[number];

export function isShopPaymentMethod(value: unknown): value is ShopPaymentMethod {
  return typeof value === 'string' && (SHOP_PAYMENT_METHODS as readonly string[]).includes(value);
}

export const SHOP_PAYMENT_METHOD_LABELS: Labels<ShopPaymentMethod> = {
  CASH_ON_DELIVERY: { en: 'Cash on delivery', fr: 'Paiement à la livraison' },
  MTN_MOMO: { en: 'MTN MoMo', fr: 'MTN MoMo' },
  ORANGE_MONEY: { en: 'Orange Money', fr: 'Orange Money' },
  PAY_AT_OFFICE: { en: 'Pay at the office', fr: 'Paiement en agence' },
};

/** Which payment methods make sense for each way of receiving the order. */
export function paymentMethodFits(method: ShopPaymentMethod, delivery: DeliveryMethod): boolean {
  if (method === 'CASH_ON_DELIVERY') return delivery === 'DELIVERY';
  if (method === 'PAY_AT_OFFICE') return delivery === 'PICKUP';
  return true;
}

export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'REFUNDED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export const PAYMENT_STATUS_LABELS: Labels<PaymentStatus> = {
  UNPAID: { en: 'Unpaid', fr: 'Non payée' },
  PAID: { en: 'Paid', fr: 'Payée' },
  REFUNDED: { en: 'Refunded', fr: 'Remboursée' },
};

/**
 * Payment moves. PAID → UNPAID corrects a payment recorded by mistake or a rejected mobile money
 * reference (SHOP_SPEC §11), so it needs a reason, as a refund does.
 */
const PAYMENT_MOVES: Record<PaymentStatus, readonly PaymentStatus[]> = {
  UNPAID: ['PAID'],
  PAID: ['REFUNDED', 'UNPAID'],
  REFUNDED: [],
};

export type ShopRuleFail =
  | 'ILLEGAL_TRANSITION'   // not a move the order or payment can make
  | 'SYSTEM_ONLY'          // made by the server itself (send to dispatch, dispatch job sync), not the status button
  | 'FEE_TO_CONFIRM'       // set the delivery fee before confirming
  | 'WRONG_DELIVERY_METHOD'
  | 'REASON_REQUIRED';

export type ShopRuleResult = { ok: true } | { ok: false; code: ShopRuleFail };

const ok: ShopRuleResult = { ok: true };
const no = (code: ShopRuleFail): ShopRuleResult => ({ ok: false, code });
const hasText = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

export function checkPaymentChange(from: PaymentStatus, to: PaymentStatus, reason?: string | null): ShopRuleResult {
  if (!PAYMENT_MOVES[from].includes(to)) return no('ILLEGAL_TRANSITION');
  if (from === 'PAID' && !hasText(reason)) return no('REASON_REQUIRED');
  return ok;
}

// ---- Order moves ----

/**
 * staff  = a console user pressing a status button (orders.manage);
 * system = the server itself: "Send to dispatch" sets OUT_FOR_DELIVERY in the same transaction
 *          that creates the job, and the dispatch job's DELIVERED moves the order (SHOP_SPEC §13).
 */
export type OrderActor = 'staff' | 'system';

export interface OrderMoveContext {
  actor: OrderActor;
  deliveryMethod: DeliveryMethod;
  deliveryFeeStatus: DeliveryFeeStatus;
  reason?: string | null;
  /**
   * The order's dispatch job ended without a delivery (returned or cancelled, SHOP_SPEC §13). Only
   * then can staff take an order out for delivery back to Ready (to send it again) or cancel it.
   */
  jobClosed?: boolean;
}

const ORDER_MOVES: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'COLLECTED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'READY', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  COLLECTED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

/** Moves only the server makes; the console's status buttons never offer them. */
const SYSTEM_ONLY: readonly OrderStatus[] = ['OUT_FOR_DELIVERY', 'DELIVERED'];

export function checkOrderTransition(from: OrderStatus, to: OrderStatus, ctx: OrderMoveContext): ShopRuleResult {
  if (!ORDER_MOVES[from].includes(to)) return no('ILLEGAL_TRANSITION');
  // While the courier still has the parcel, only the dispatch job moves the order.
  if (from === 'OUT_FOR_DELIVERY' && to !== 'DELIVERED' && !ctx.jobClosed) return no('ILLEGAL_TRANSITION');
  if (SYSTEM_ONLY.includes(to) && ctx.actor !== 'system') return no('SYSTEM_ONLY');
  if (to === 'CONFIRMED' && ctx.deliveryFeeStatus === 'TO_CONFIRM') return no('FEE_TO_CONFIRM');
  if (to === 'OUT_FOR_DELIVERY' && ctx.deliveryMethod !== 'DELIVERY') return no('WRONG_DELIVERY_METHOD');
  if (to === 'COLLECTED' && ctx.deliveryMethod !== 'PICKUP') return no('WRONG_DELIVERY_METHOD');
  if ((to === 'CANCELLED' || to === 'RETURNED') && !hasText(ctx.reason)) return no('REASON_REQUIRED');
  return ok;
}

/** The statuses a console user can choose next (for the order page's buttons). */
export function staffNextStatuses(
  from: OrderStatus,
  ctx: Omit<OrderMoveContext, 'actor' | 'reason'>,
): OrderStatus[] {
  // DELIVERED and OUT_FOR_DELIVERY are made by the server (dispatch), never by a status button.
  return ORDER_MOVES[from].filter((to) => {
    const r = checkOrderTransition(from, to, { ...ctx, actor: 'staff', reason: 'x' });
    return r.ok || r.code === 'FEE_TO_CONFIRM';
  });
}

/** A cancelled order always puts its stock back; a return only when staff tick "Put back in stock". */
export function restocksOn(to: OrderStatus, putBackInStock = false): boolean {
  if (to === 'CANCELLED') return true;
  if (to === 'RETURNED') return putBackInStock;
  return false;
}

/** Order total: the fee counts once known; pickup has none. */
export function orderTotal(subtotal: number, deliveryFee: number | null): number {
  return subtotal + (deliveryFee ?? 0);
}
