// Shop products (docs/SHOP_SPEC.md §4, §6, §7.3, §8): statuses and who may move a product between
// them, what a product needs before it can be published, price and slug rules. Shared by the
// server (which enforces it) and the console (which only shows the actions it allows). DOM-free.
// Names: CONTENT §17.8 (owner to confirm, #187).
import type { ShopLang, ShopRuleResult } from './shopOrderStatus.js';

export const PRODUCT_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'] as const;
export type ProductStatus = typeof PRODUCT_STATUSES[number];

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === 'string' && (PRODUCT_STATUSES as readonly string[]).includes(value);
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, Record<ShopLang, string>> = {
  DRAFT: { en: 'Draft', fr: 'Brouillon' },
  IN_REVIEW: { en: 'In review', fr: 'En relecture' },
  PUBLISHED: { en: 'Published', fr: 'Publié' },
  HIDDEN: { en: 'Hidden', fr: 'Masqué' },
  ARCHIVED: { en: 'Archived', fr: 'Archivé' },
};

/** The two product permissions that matter for a status move (SHOP_SPEC §3). */
export type ProductRole = 'writer' | 'publisher';

// writer = shop.write only; publisher = shop.publish (the admin's approval step).
const PRODUCT_MOVES: Record<ProductStatus, Partial<Record<ProductStatus, ProductRole>>> = {
  DRAFT: { IN_REVIEW: 'writer', PUBLISHED: 'publisher' },
  IN_REVIEW: { DRAFT: 'publisher', PUBLISHED: 'publisher' },   // DRAFT here = "Send back" with a note
  PUBLISHED: { HIDDEN: 'publisher', ARCHIVED: 'publisher' },
  HIDDEN: { PUBLISHED: 'publisher', ARCHIVED: 'publisher' },
  ARCHIVED: { HIDDEN: 'publisher' },
};

export function checkProductTransition(
  from: ProductStatus,
  to: ProductStatus,
  role: ProductRole,
  note?: string | null,
): ShopRuleResult {
  const needs = PRODUCT_MOVES[from][to];
  if (!needs) return { ok: false, code: 'ILLEGAL_TRANSITION' };
  // A publisher can do everything a writer can.
  if (needs === 'publisher' && role !== 'publisher') return { ok: false, code: 'ILLEGAL_TRANSITION' };
  if (from === 'IN_REVIEW' && to === 'DRAFT' && !(typeof note === 'string' && note.trim())) {
    return { ok: false, code: 'REASON_REQUIRED' };
  }
  return { ok: true };
}

/** Customers see a product only while it is PUBLISHED. */
export function isPublicProductStatus(status: unknown): boolean {
  return status === 'PUBLISHED';
}

/**
 * Edits by a writer to a PUBLISHED or HIDDEN product are held as proposed changes until a
 * publisher approves them (SHOP_SPEC §7.3); everything else is saved directly.
 */
export function editIsProposal(status: ProductStatus, role: ProductRole): boolean {
  return role === 'writer' && (status === 'PUBLISHED' || status === 'HIDDEN');
}

/** A writer edits drafts and products in review; ARCHIVED products are read-only until restored. */
export function canEditContent(status: ProductStatus, role: ProductRole): boolean {
  if (status === 'ARCHIVED') return false;
  return role === 'publisher' || status === 'DRAFT' || status === 'IN_REVIEW' || editIsProposal(status, role);
}

// ---- Publish requirements (both languages, SHOP_SPEC §4) ----

export interface PublishableFields {
  name_en?: string | null;
  name_fr?: string | null;
  short_en?: string | null;
  short_fr?: string | null;
  slug_en?: string | null;
  slug_fr?: string | null;
  price?: number | null;
}

export const PUBLISH_REQUIRED_FIELDS = ['name_en', 'name_fr', 'short_en', 'short_fr', 'slug_en', 'slug_fr'] as const;

/** Fields still missing before the product can be published; empty = ready. */
export function missingForPublish(p: PublishableFields): string[] {
  const missing: string[] = PUBLISH_REQUIRED_FIELDS.filter((k) => !(typeof p[k] === 'string' && p[k]!.trim()));
  if (!isValidPrice(p.price)) missing.push('price');
  return missing;
}

// ---- Prices, stock, pictures ----

/** Prices are whole currency units (XAF has no decimals), from 1 to 100 million. */
export const PRICE_MAX = 100_000_000;

export function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PRICE_MAX;
}

/** A sale price is optional; when set it must be a valid price lower than the normal price. */
export function isValidSalePrice(sale: unknown, price: unknown): boolean {
  if (sale === null || sale === undefined) return true;
  return isValidPrice(sale) && isValidPrice(price) && sale < price;
}

/** What the customer pays for one item. */
export function effectivePrice(price: number, salePrice: number | null | undefined): number {
  return typeof salePrice === 'number' && salePrice > 0 && salePrice < price ? salePrice : price;
}

export const STOCK_MAX = 1_000_000;

export function isValidStock(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= STOCK_MAX;
}

/** At most 8 pictures per product; position 0 is the main picture (SHOP_SPEC §6). */
export const MAX_PRODUCT_IMAGES = 8;

/** Stock reasons for a console adjustment (shop_stock_moves.reason for staff changes). */
export const STOCK_ADJUST_REASONS = ['RECEIVED', 'COUNTED', 'DAMAGED', 'OTHER'] as const;
export const STOCK_MOVE_REASONS = ['INITIAL', 'ORDER', 'CANCEL', 'RETURN', 'ADJUST'] as const;
export type StockMoveReason = typeof STOCK_MOVE_REASONS[number];

// ---- Slugs ----

/**
 * Product slugs live at /shop/<slug> and /fr/boutique/<slug>, beside the category route
 * (/shop/category/…, /fr/boutique/categorie/…), so these words can't be product slugs.
 */
export const RESERVED_SHOP_SLUGS: readonly string[] = ['category', 'categorie', 'cart', 'panier', 'checkout', 'order'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;

export function isValidShopSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= SLUG_MAX && SLUG_RE.test(value) && !RESERVED_SHOP_SLUGS.includes(value);
}
