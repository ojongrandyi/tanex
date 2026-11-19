// The shop cart in this browser (SHOP_SPEC §8): localStorage key `tx_cart`, product ids and
// quantities only, never prices or personal data. Prices and stock are always read again from the
// server (the cart page, M.5). Survives a refused or broken storage: the cart then lasts for the
// visit only. Other tabs see changes through the storage event.

import { ORDER_MAX_LINES } from '../shared/shopPublic';

export const CART_KEY = 'tx_cart';
/** Different products one cart may hold: as many as one order (SHOP_SPEC §10.2). */
export const CART_MAX_LINES = ORDER_MAX_LINES;

export interface CartLine {
  id: string;
  qty: number;
}

const listeners = new Set<() => void>();
let memory: CartLine[] = [];

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function clean(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const out: CartLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { id, qty } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(id)) continue;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 1000) continue;
    if (out.some((l) => l.id === id)) continue;
    out.push({ id, qty });
    if (out.length >= CART_MAX_LINES) break;
  }
  return out;
}

export function readCart(): CartLine[] {
  const store = storage();
  if (!store) return memory;
  try {
    const raw = store.getItem(CART_KEY);
    return raw ? clean(JSON.parse(raw)) : [];
  } catch {
    return memory;
  }
}

function writeCart(lines: CartLine[]): void {
  memory = lines;
  const store = storage();
  try {
    if (lines.length === 0) store?.removeItem(CART_KEY);
    else store?.setItem(CART_KEY, JSON.stringify(lines));
  } catch {
    // Storage full or refused: the in-memory cart still works for this visit.
  }
  listeners.forEach((fn) => fn());
}

/** Items in the cart (the header count). */
export function cartCount(lines: CartLine[] = readCart()): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** How many of a product are already in the cart. */
export function cartQuantity(id: string): number {
  return readCart().find((l) => l.id === id)?.qty ?? 0;
}

/**
 * Adds `qty` of a product, never going above `max` for that product (its order limit). Returns the
 * quantity now in the cart, or null when nothing could be added (limit reached, cart full).
 */
export function addToCart(id: string, qty: number, max: number): number | null {
  const lines = readCart();
  const line = lines.find((l) => l.id === id);
  const current = line?.qty ?? 0;
  const next = Math.min(current + Math.max(1, Math.floor(qty)), Math.floor(max));
  if (next <= current) return null;
  if (line) line.qty = next;
  else if (lines.length >= CART_MAX_LINES) return null;
  else lines.push({ id, qty: next });
  writeCart(lines);
  return next;
}

/** Calls `fn` whenever the cart changes, in this tab or another. */
export function subscribeCart(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY || e.key === null) fn();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Sets a product's quantity (0 removes it). */
export function setCartQuantity(id: string, qty: number): void {
  const lines = readCart();
  const n = Math.max(0, Math.floor(qty));
  const next = n === 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, qty: n } : l));
  writeCart(next);
}

/** Replaces the cart, e.g. with the quantities the server allows after a cart check. */
export function replaceCart(lines: CartLine[]): void {
  writeCart(clean(lines));
}

export function clearCart(): void {
  writeCart([]);
}

// Prices the customer has seen in this visit, per product (memory only, never stored): the cart
// page says "The price of … is now …" when a check finds another price, and the order sends them
// so the server can refuse an order whose price changed since (it never uses them as prices).
const seen = new Map<string, number>();

export function seenPrice(id: string): number | undefined {
  return seen.get(id);
}

export function rememberPrice(id: string, price: number): void {
  seen.set(id, price);
}
