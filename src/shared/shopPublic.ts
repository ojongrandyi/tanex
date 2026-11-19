// What the public shop shows (docs/SHOP_SPEC.md §8, §14): page size, sort orders, the stock line
// and how many of a product one order may hold. Shared by the server (public API) and the shop
// pages. Public answers never carry a stock count above the low-stock level, only "in stock",
// "only n left" or "out of stock". DOM-free.

/** Products per shop or category page (SHOP_SPEC §8). */
export const SHOP_PAGE_SIZE = 24;
/** Related products on a product page: same category, in stock first. */
export const SHOP_RELATED_MAX = 4;
/** Different products one order (and so one cart) may hold (SHOP_SPEC §10.2). */
export const ORDER_MAX_LINES = 20;
/** Longest search text the API reads; anything longer is cut. */
export const SHOP_SEARCH_MAX = 100;

export const SHOP_SORTS = ['featured', 'newest', 'price-asc', 'price-desc'] as const;
export type ShopSort = typeof SHOP_SORTS[number];
export const DEFAULT_SHOP_SORT: ShopSort = 'featured';

export function isShopSort(value: unknown): value is ShopSort {
  return typeof value === 'string' && (SHOP_SORTS as readonly string[]).includes(value);
}

export type PublicStock =
  | { state: 'in' }
  | { state: 'low'; left: number }
  | { state: 'out' };

/** The stock line customers see: the count only at or below the low-stock level. */
export function publicStock(stockQty: number, lowStockAt: number): PublicStock {
  if (!(stockQty > 0)) return { state: 'out' };
  if (stockQty <= lowStockAt) return { state: 'low', left: stockQty };
  return { state: 'in' };
}

/**
 * The most a customer may put in the cart for one product: 0 when out of stock, otherwise the
 * product's limit, lowered to the stock left when that is shown. (When more is ordered than is
 * on the shelf, the cart check reduces it, SHOP_SPEC §8.)
 */
export function orderLimit(stock: PublicStock, maxPerOrder: number): number {
  if (stock.state === 'out') return 0;
  const max = Math.max(1, Math.floor(maxPerOrder));
  return stock.state === 'low' ? Math.min(stock.left, max) : max;
}

/** The price a customer pays: the sale price when there is a valid one. */
export function effectivePrice(price: number, salePrice: number | null | undefined): number {
  return typeof salePrice === 'number' && salePrice > 0 && salePrice < price ? salePrice : price;
}

/** ?page=N of a shop list: a positive integer, else 1. */
export function shopListPage(value: unknown): number {
  const n = typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : typeof value === 'number' ? value : 1;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
