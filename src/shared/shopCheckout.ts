// Shop checkout rules (docs/SHOP_SPEC.md §8–§10): field limits, the customer's phone, the order
// request's shape and the delivery fee. Shared by the server (which decides) and the cart page
// (which checks the form before sending it). The fee uses the same rate functions as the local
// delivery form (src/shared/localPricing.ts); no price lives in code: with no matching rate the
// fee is TO_CONFIRM and staff set it from the order page. DOM-free.
import { normalizePhone } from './identifier.js';
import {
  SIZE_CLASSES, isSizeClass, priceIntercityDelivery, priceLocalDelivery, roundMoney,
  type IntercityRate, type SizeClass, type ZoneRate,
} from './localPricing.js';
import type { DeliveryMethod } from './shopOrderStatus.js';

export { ORDER_MAX_LINES } from './shopPublic.js';

export const CHECKOUT_LIMITS = {
  name: 100,
  phone: 30,
  email: 254,
  address: 300,
  note: 500,
} as const;

/** The form's own key for one submit, so a double tap or a retry makes one order. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/** A Cameroon phone number in E.164 (+237…), or null. */
export function cameroonPhone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > CHECKOUT_LIMITS.phone) return null;
  const phone = normalizePhone(value);
  return phone && phone.startsWith('+237') ? phone : null;
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

export function isCheckoutEmail(value: string): boolean {
  return value.length <= CHECKOUT_LIMITS.email && EMAIL_RE.test(value);
}

/** The first word of a full name, for "Thank you, {firstName}." */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

// ---- Delivery fee (SHOP_SPEC §9) ----

/** One cart line as the fee sees it: the product's size class and weight, and the quantity. */
export interface FeeItem {
  sizeClass: string;
  weightKg: number | null;
  qty: number;
}

/** The largest size class in the cart (SMALL < MEDIUM < LARGE); unknown classes count as SMALL. */
export function largestSizeClass(items: readonly FeeItem[]): SizeClass {
  let best = 0;
  for (const item of items) {
    const i = isSizeClass(item.sizeClass) ? SIZE_CLASSES.indexOf(item.sizeClass) : 0;
    if (i > best) best = i;
  }
  return SIZE_CLASSES[best];
}

/** The cart's total weight in kg, or null when any item has no weight (the fee is then to confirm). */
export function cartWeightKg(items: readonly FeeItem[]): number | null {
  let total = 0;
  for (const item of items) {
    if (typeof item.weightKg !== 'number' || !Number.isFinite(item.weightKg) || item.weightKg <= 0) return null;
    total += item.weightKg * item.qty;
  }
  return Math.round(total * 1000) / 1000;
}

export type ShopFee =
  | { status: 'NONE'; fee: 0 }
  | { status: 'QUOTED'; fee: number }
  | { status: 'TO_CONFIRM'; fee: null };

export interface ShopFeeRequest {
  method: DeliveryMethod;
  /** Where orders leave from (shop settings); no city = every delivery fee is to confirm. */
  shipFrom: { cityId: string | null; zoneId: string | null };
  /** The customer's city and area (DELIVERY only). */
  to: { cityId: string | null; zoneId: string | null };
  items: readonly FeeItem[];
  /** The order's currency: a rate in another currency is not added to it. */
  currency: string;
}

export const TO_CONFIRM: ShopFee = { status: 'TO_CONFIRM', fee: null };

/**
 * The delivery fee of an order:
 * - pickup at an office: none;
 * - customer in the ship-from city: the local rate from the ship-from area to the customer's area,
 *   for the largest size class in the cart, standard (not express);
 * - customer in another city: the intercity band of the city pair for the cart's total weight
 *   (to confirm when any item has no weight);
 * - no matching rate, no ship-from city, or a rate in another currency: to confirm.
 */
export function shopDeliveryFee(
  req: ShopFeeRequest,
  rates: { zone: readonly ZoneRate[]; intercity: readonly IntercityRate[] },
): ShopFee {
  if (req.method === 'PICKUP') return { status: 'NONE', fee: 0 };
  const from = req.shipFrom.cityId;
  const to = req.to.cityId;
  if (!from || !to || req.items.length === 0) return TO_CONFIRM;
  const result = from === to
    ? priceLocalDelivery({
      cityId: from, fromZoneId: req.shipFrom.zoneId, toZoneId: req.to.zoneId, sizeClass: largestSizeClass(req.items), express: false,
    }, rates.zone)
    : (() => {
      const weightKg = cartWeightKg(req.items);
      return weightKg === null ? null : priceIntercityDelivery({ fromCityId: from, toCityId: to, weightKg }, rates.intercity);
    })();
  if (!result || !result.ok) return TO_CONFIRM;
  if (result.currency.toUpperCase() !== req.currency.toUpperCase()) return TO_CONFIRM;
  return { status: 'QUOTED', fee: roundMoney(result.price, req.currency) };
}
