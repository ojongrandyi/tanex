// Shop settings (docs/SHOP_SPEC.md §4, §7.7), kept by Console → Shop settings and stored in the
// settings table under the key 'shop'. The shop starts switched OFF: public pages, the
// Marketplace button and the public shop API appear only once the owner turns it on (M.9).
// Orders are emailed to info@tanexsarl.com by default (owner 2026-11-17). DOM-free.
import { EMAIL, OFFICES } from '../config/brand.js';
import { SHOP_PAYMENT_METHODS, isShopPaymentMethod, type ShopPaymentMethod } from './shopOrderStatus.js';

export const SHOP_SETTINGS_KEY = 'shop';

/** Pickup offices are the brand offices (Buea head office, Douala), keyed by city. */
export const PICKUP_OFFICE_KEYS: readonly string[] = OFFICES.map((o) => o.city.toLowerCase());

export interface ShopSettings {
  enabled: boolean;
  orderEmail: string;
  /** Where orders ship from (SHOP_SPEC §9): a delivery city and area from Tariffs, plus a landmark. */
  shipFrom: { cityId: string | null; zoneId: string | null; landmark: string };
  pickupOffices: string[];
  paymentMethods: ShopPaymentMethod[];
  lowStockAt: number;
  maxPerOrder: number;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  enabled: false,
  orderEmail: EMAIL,
  shipFrom: { cityId: null, zoneId: null, landmark: '' },
  pickupOffices: [...PICKUP_OFFICE_KEYS],
  paymentMethods: [...SHOP_PAYMENT_METHODS],
  lowStockAt: 3,
  maxPerOrder: 10,
};

export const LOW_STOCK_MAX = 1000;
export const MAX_PER_ORDER_MAX = 100;
export const LANDMARK_MAX = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidOrderEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

const isIntIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const idOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() && v.length <= 100 ? v.trim() : null;

/** Stored JSON → settings, falling back to the default for anything missing or invalid. */
export function readShopSettings(stored: unknown): ShopSettings {
  const s = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const d = DEFAULT_SHOP_SETTINGS;
  const ship = s.shipFrom && typeof s.shipFrom === 'object' ? (s.shipFrom as Record<string, unknown>) : {};
  const offices = Array.isArray(s.pickupOffices)
    ? [...new Set(s.pickupOffices.filter((k): k is string => typeof k === 'string' && PICKUP_OFFICE_KEYS.includes(k)))]
    : d.pickupOffices;
  const methods = Array.isArray(s.paymentMethods)
    ? SHOP_PAYMENT_METHODS.filter((m) => (s.paymentMethods as unknown[]).includes(m))
    : d.paymentMethods;
  return {
    enabled: s.enabled === true,
    orderEmail: isValidOrderEmail(s.orderEmail) ? s.orderEmail.trim() : d.orderEmail,
    shipFrom: {
      cityId: idOrNull(ship.cityId),
      zoneId: idOrNull(ship.zoneId),
      landmark: typeof ship.landmark === 'string' ? ship.landmark.trim().slice(0, LANDMARK_MAX) : '',
    },
    pickupOffices: [...offices],
    paymentMethods: methods.length > 0 && methods.every(isShopPaymentMethod) ? [...methods] : [...d.paymentMethods],
    lowStockAt: isIntIn(s.lowStockAt, 0, LOW_STOCK_MAX) ? s.lowStockAt : d.lowStockAt,
    maxPerOrder: isIntIn(s.maxPerOrder, 1, MAX_PER_ORDER_MAX) ? s.maxPerOrder : d.maxPerOrder,
  };
}
