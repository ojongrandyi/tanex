// Shop catalogue (docs/SHOP_SPEC.md §4, §7): reading and checking console input for products and
// categories, saving it, proposed changes to published products, picture and category links, and the
// API shape. The routes (server/routes/shopAdmin.ts) decide who may do what; everything here runs
// inside the caller's transaction and throws ShopError for a refused input.
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { generateReference } from '../../src/shared/references.js';
import { slugify } from '../../src/shared/blogSlug.js';
import { SIZE_CLASSES, isSizeClass } from '../../src/shared/localPricing.js';
import {
  MAX_PRODUCT_IMAGES, isValidPrice, isValidSalePrice, isValidShopSlug, isValidStock, SLUG_MAX, type ProductStatus,
} from '../../src/shared/shopProduct.js';
import { LOW_STOCK_MAX, MAX_PER_ORDER_MAX } from '../../src/shared/shopSettings.js';
import { readDescription } from './description.js';
import { formatShopMedia, type ShopMediaRow } from './media.js';

export class ShopError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) { super(message); }
}

// ---- Rows ----

export interface ProductRow {
  id: string; product_code: string; slug_en: string; slug_fr: string;
  name_en: string; name_fr: string | null; short_en: string | null; short_fr: string | null;
  description_en_json: string | null; description_fr_json: string | null;
  description_en_html: string | null; description_fr_html: string | null;
  price: number; sale_price: number | null; currency: string; stock_qty: number;
  low_stock_at: number | null; max_per_order: number | null; size_class: string; weight_kg: number | null;
  status: ProductStatus; is_featured: number; sort_order: number;
  seo_title_en: string | null; seo_title_fr: string | null; seo_description_en: string | null; seo_description_fr: string | null;
  pending_changes_json: string | null; pending_by: string | null; pending_at_ts: number | null; review_note: string | null;
  created_by: string; published_by: string | null; published_at_ts: number | null;
  created_at_ts: number; updated_at_ts: number; updated_by: string | null;
}

export interface CategoryRow {
  id: string; parent_id: string | null; slug_en: string; slug_fr: string; name_en: string; name_fr: string;
  description_en: string | null; description_fr: string | null; image_media_id: string | null;
  sort_order: number; is_visible: number; created_at_ts: number; updated_at_ts: number; updated_by: string | null;
}

// ---- Product input ----

export interface ProductImageInput { mediaId: string; altEn: string | null; altFr: string | null }

/** What the console may send for a product (all optional on update). Descriptions are TipTap JSON. */
export interface ProductInput {
  nameEn?: string; nameFr?: string | null; shortEn?: string | null; shortFr?: string | null;
  slugEn?: string; slugFr?: string;
  descriptionEn?: unknown; descriptionFr?: unknown;
  price?: number; salePrice?: number | null; lowStockAt?: number | null; maxPerOrder?: number | null;
  sizeClass?: string; weightKg?: number | null; isFeatured?: boolean; sortOrder?: number;
  seoTitleEn?: string | null; seoTitleFr?: string | null; seoDescriptionEn?: string | null; seoDescriptionFr?: string | null;
  categoryIds?: string[]; images?: ProductImageInput[];
}

export const PRODUCT_TEXT_LIMITS = {
  name: 150, short: 300, seoTitle: 120, seoDescription: 300, alt: 200,
} as const;

const TEXT_FIELDS: [keyof ProductInput, number, boolean][] = [
  // field, max length, required when present (cannot be emptied)
  ['nameEn', PRODUCT_TEXT_LIMITS.name, true],
  ['nameFr', PRODUCT_TEXT_LIMITS.name, false],
  ['shortEn', PRODUCT_TEXT_LIMITS.short, false],
  ['shortFr', PRODUCT_TEXT_LIMITS.short, false],
  ['seoTitleEn', PRODUCT_TEXT_LIMITS.seoTitle, false],
  ['seoTitleFr', PRODUCT_TEXT_LIMITS.seoTitle, false],
  ['seoDescriptionEn', PRODUCT_TEXT_LIMITS.seoDescription, false],
  ['seoDescriptionFr', PRODUCT_TEXT_LIMITS.seoDescription, false],
];

const bad = (field: string, message: string) => new ShopError(400, 'SHOP_INVALID_INPUT', message, field);
const isIntIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const optionalText = (v: unknown, max: number, field: string): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw bad(field, 'This field must be text.');
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length > max) throw bad(field, `Keep this under ${max} characters.`);
  return t || null;
};

/** Checks only the fields present in the body. Throws ShopError for the first invalid one. */
export function readProductInput(body: unknown): ProductInput {
  if (!body || typeof body !== 'object') throw bad('body', 'Nothing to save.');
  const b = body as Record<string, unknown>;
  const out: ProductInput = {};
  for (const [field, max, required] of TEXT_FIELDS) {
    if (!(field in b)) continue;
    const value = optionalText(b[field], max, field);
    if (required && !value) throw bad(field, 'The English name is required.');
    (out as Record<string, unknown>)[field] = value;
  }
  for (const field of ['slugEn', 'slugFr'] as const) {
    if (!(field in b)) continue;
    const v = typeof b[field] === 'string' ? (b[field] as string).trim().toLowerCase() : b[field];
    if (!isValidShopSlug(v)) throw bad(field, 'Use lower-case letters, numbers and hyphens only (not "category", "cart"…).');
    out[field] = v;
  }
  if ('descriptionEn' in b) out.descriptionEn = b.descriptionEn;
  if ('descriptionFr' in b) out.descriptionFr = b.descriptionFr;
  if ('price' in b) {
    if (!isValidPrice(b.price)) throw bad('price', 'Enter a price in whole FCFA (1 or more).');
    out.price = b.price;
  }
  if ('salePrice' in b) {
    if (b.salePrice !== null && !isValidPrice(b.salePrice)) throw bad('salePrice', 'Enter a sale price in whole FCFA, or leave it empty.');
    out.salePrice = b.salePrice as number | null;
  }
  if ('lowStockAt' in b) {
    if (b.lowStockAt !== null && !isIntIn(b.lowStockAt, 0, LOW_STOCK_MAX)) throw bad('lowStockAt', 'Enter a whole number, or leave it empty.');
    out.lowStockAt = b.lowStockAt as number | null;
  }
  if ('maxPerOrder' in b) {
    if (b.maxPerOrder !== null && !isIntIn(b.maxPerOrder, 1, MAX_PER_ORDER_MAX)) throw bad('maxPerOrder', `Enter 1 to ${MAX_PER_ORDER_MAX}, or leave it empty.`);
    out.maxPerOrder = b.maxPerOrder as number | null;
  }
  if ('sizeClass' in b) {
    if (!isSizeClass(b.sizeClass)) throw bad('sizeClass', `Choose ${SIZE_CLASSES.join(', ')}.`);
    out.sizeClass = b.sizeClass;
  }
  if ('weightKg' in b) {
    const w = b.weightKg;
    if (w !== null && !(typeof w === 'number' && Number.isFinite(w) && w > 0 && w <= 5000)) throw bad('weightKg', 'Enter a weight in kg, or leave it empty.');
    out.weightKg = w === null ? null : Math.round((w as number) * 1000) / 1000;
  }
  if ('isFeatured' in b) {
    if (typeof b.isFeatured !== 'boolean') throw bad('isFeatured', 'Featured must be true or false.');
    out.isFeatured = b.isFeatured;
  }
  if ('sortOrder' in b) {
    if (!isIntIn(b.sortOrder, -100000, 100000)) throw bad('sortOrder', 'Enter a whole number.');
    out.sortOrder = b.sortOrder;
  }
  if ('categoryIds' in b) {
    if (!Array.isArray(b.categoryIds) || b.categoryIds.length > 20 || !b.categoryIds.every((id) => typeof id === 'string' && id.length <= 100)) {
      throw bad('categoryIds', 'The categories are not valid.');
    }
    out.categoryIds = [...new Set(b.categoryIds as string[])];
  }
  if ('images' in b) {
    if (!Array.isArray(b.images) || b.images.length > MAX_PRODUCT_IMAGES) throw bad('images', `Up to ${MAX_PRODUCT_IMAGES} pictures.`);
    const seen = new Set<string>();
    out.images = (b.images as unknown[]).map((raw, i) => {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      if (typeof r.mediaId !== 'string' || !r.mediaId || seen.has(r.mediaId)) throw bad('images', `Picture ${i + 1} is not valid.`);
      seen.add(r.mediaId);
      return {
        mediaId: r.mediaId,
        altEn: optionalText(r.altEn, PRODUCT_TEXT_LIMITS.alt, 'images'),
        altFr: optionalText(r.altFr, PRODUCT_TEXT_LIMITS.alt, 'images'),
      };
    });
  }
  return out;
}

// ---- Saving ----

const COLUMN: Partial<Record<keyof ProductInput, keyof ProductRow>> = {
  nameEn: 'name_en', nameFr: 'name_fr', shortEn: 'short_en', shortFr: 'short_fr', slugEn: 'slug_en', slugFr: 'slug_fr',
  price: 'price', salePrice: 'sale_price', lowStockAt: 'low_stock_at', maxPerOrder: 'max_per_order',
  sizeClass: 'size_class', weightKg: 'weight_kg', sortOrder: 'sort_order',
  seoTitleEn: 'seo_title_en', seoTitleFr: 'seo_title_fr', seoDescriptionEn: 'seo_description_en', seoDescriptionFr: 'seo_description_fr',
};

function slugTaken(conn: DatabaseSync, column: 'slug_en' | 'slug_fr', slug: string, exceptId: string | null): boolean {
  return !!conn.prepare(`SELECT 1 FROM shop_products WHERE ${column} = ? AND id IS NOT ?`).get(slug, exceptId);
}

/** A free slug made from a name: "gift-box", then "gift-box-2", "gift-box-3"… */
export function freeSlug(conn: DatabaseSync, column: 'slug_en' | 'slug_fr', name: string, exceptId: string | null = null): string {
  let base = slugify(name).slice(0, SLUG_MAX - 4).replace(/-+$/, '') || 'product';
  if (!isValidShopSlug(base)) base = `${base}-item`;
  let slug = base;
  for (let n = 2; slugTaken(conn, column, slug, exceptId); n++) slug = `${base}-${n}`;
  return slug;
}

/** Applies checked input to a product row (inside the caller's transaction). */
export function applyProductInput(conn: DatabaseSync, product: ProductRow, input: ProductInput, userId: string, now = Date.now()): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  const set = (col: string, v: string | number | null) => { sets.push(`${col} = ?`); values.push(v); };

  for (const [field, col] of Object.entries(COLUMN) as [keyof ProductInput, keyof ProductRow][]) {
    if (input[field] !== undefined) set(col, input[field] as string | number | null);
  }
  if (input.isFeatured !== undefined) set('is_featured', input.isFeatured ? 1 : 0);
  for (const [field, lang] of [['descriptionEn', 'en'], ['descriptionFr', 'fr']] as const) {
    if (input[field] === undefined) continue;
    const d = readDescription(input[field]);
    if (!d.ok) throw bad(field, d.error);
    set(`description_${lang}_json`, d.json);
    set(`description_${lang}_html`, d.html);
  }
  for (const [field, col] of [['slugEn', 'slug_en'], ['slugFr', 'slug_fr']] as const) {
    const slug = input[field];
    if (slug !== undefined && slugTaken(conn, col, slug, product.id)) {
      throw new ShopError(409, 'SHOP_SLUG_TAKEN', 'Another product already uses this web address.', field);
    }
  }
  const price = input.price ?? product.price;
  const sale = input.salePrice !== undefined ? input.salePrice : product.sale_price;
  if (!isValidSalePrice(sale, price)) throw bad('salePrice', 'The sale price must be lower than the price.');

  if (sets.length) {
    set('updated_at_ts', now);
    set('updated_by', userId);
    conn.prepare(`UPDATE shop_products SET ${sets.join(', ')} WHERE id = ?`).run(...values, product.id);
  }

  if (input.categoryIds !== undefined) {
    const exists = conn.prepare('SELECT 1 FROM shop_categories WHERE id = ?');
    for (const id of input.categoryIds) if (!exists.get(id)) throw bad('categoryIds', 'A chosen category no longer exists.');
    conn.prepare('DELETE FROM shop_product_categories WHERE product_id = ?').run(product.id);
    const add = conn.prepare('INSERT INTO shop_product_categories (product_id, category_id) VALUES (?, ?)');
    for (const id of input.categoryIds) add.run(product.id, id);
  }
  if (input.images !== undefined) {
    const exists = conn.prepare('SELECT 1 FROM shop_media WHERE id = ?');
    for (const img of input.images) if (!exists.get(img.mediaId)) throw bad('images', 'A picture was not found. Upload it again.');
    conn.prepare('DELETE FROM shop_product_images WHERE product_id = ?').run(product.id);
    const add = conn.prepare('INSERT INTO shop_product_images (product_id, media_id, position, alt_en, alt_fr) VALUES (?, ?, ?, ?, ?)');
    input.images.forEach((img, i) => add.run(product.id, img.mediaId, i, img.altEn, img.altFr));
  }
  if (!sets.length && (input.categoryIds !== undefined || input.images !== undefined)) {
    conn.prepare('UPDATE shop_products SET updated_at_ts = ?, updated_by = ? WHERE id = ?').run(now, userId, product.id);
  }
}

/** A new product ID, retried on the rare collision. */
function newProductCode(conn: DatabaseSync): string {
  for (let i = 0; i < 20; i++) {
    const code = generateReference('product');
    if (!conn.prepare('SELECT 1 FROM shop_products WHERE product_code = ?').get(code)) return code;
  }
  throw new Error('Could not allocate a product ID');
}

export function getProduct(conn: DatabaseSync, id: string): ProductRow | undefined {
  return conn.prepare('SELECT * FROM shop_products WHERE id = ?').get(id) as ProductRow | undefined;
}

/** Creates a DRAFT with a new product ID and its starting stock (inside the caller's transaction). */
export function createProduct(conn: DatabaseSync, input: ProductInput, startingStock: number, userId: string, now = Date.now()): ProductRow {
  if (!input.nameEn) throw bad('nameEn', 'The English name is required.');
  if (input.price === undefined) throw bad('price', 'Enter a price in whole FCFA (1 or more).');
  if (!isValidStock(startingStock)) throw bad('stockQty', 'Enter the starting stock as a whole number (0 or more).');
  const id = crypto.randomUUID();
  const slugEn = input.slugEn ?? freeSlug(conn, 'slug_en', input.nameEn);
  const slugFr = input.slugFr ?? freeSlug(conn, 'slug_fr', input.nameFr || input.nameEn);
  if (slugTaken(conn, 'slug_en', slugEn, null)) throw new ShopError(409, 'SHOP_SLUG_TAKEN', 'Another product already uses this web address.', 'slugEn');
  if (slugTaken(conn, 'slug_fr', slugFr, null)) throw new ShopError(409, 'SHOP_SLUG_TAKEN', 'Another product already uses this web address.', 'slugFr');
  conn.prepare(`
    INSERT INTO shop_products (id, product_code, slug_en, slug_fr, name_en, price, stock_qty, status, created_by, created_at_ts, updated_at_ts, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)
  `).run(id, newProductCode(conn), slugEn, slugFr, input.nameEn, input.price, startingStock, userId, now, now, userId);
  const row = getProduct(conn, id)!;
  const { slugEn: _a, slugFr: _b, nameEn: _c, price: _d, ...rest } = input;
  applyProductInput(conn, row, rest, userId, now);
  conn.prepare(`
    INSERT INTO shop_stock_moves (id, product_id, delta, reason, order_id, note, user_id, stock_after, at_ts)
    VALUES (?, ?, ?, 'INITIAL', NULL, NULL, ?, ?, ?)
  `).run(crypto.randomUUID(), id, startingStock, userId, startingStock, now);
  return getProduct(conn, id)!;
}

// ---- Proposed changes (SHOP_SPEC §7.3) ----

/** Adds a writer's edits to the product's held changes (later edits win field by field). */
export function proposeChanges(conn: DatabaseSync, product: ProductRow, input: ProductInput, userId: string, now = Date.now()): void {
  // Check now what can be checked now; slugs and links are checked again on approval.
  for (const [field, col] of [['slugEn', 'slug_en'], ['slugFr', 'slug_fr']] as const) {
    const slug = input[field];
    if (slug !== undefined && slugTaken(conn, col, slug, product.id)) {
      throw new ShopError(409, 'SHOP_SLUG_TAKEN', 'Another product already uses this web address.', field);
    }
  }
  for (const field of ['descriptionEn', 'descriptionFr'] as const) {
    if (input[field] !== undefined && !readDescription(input[field]).ok) throw bad(field, 'The description is not valid.');
  }
  const current = product.pending_changes_json ? JSON.parse(product.pending_changes_json) as ProductInput : {};
  const merged = { ...current, ...input };
  const price = merged.price ?? product.price;
  const sale = merged.salePrice !== undefined ? merged.salePrice : product.sale_price;
  if (!isValidSalePrice(sale, price)) throw bad('salePrice', 'The sale price must be lower than the price.');
  conn.prepare('UPDATE shop_products SET pending_changes_json = ?, pending_by = ?, pending_at_ts = ?, updated_at_ts = ? WHERE id = ?')
    .run(JSON.stringify(merged), userId, now, now, product.id);
}

export function readPending(product: ProductRow): ProductInput | null {
  if (!product.pending_changes_json) return null;
  try { return readProductInput(JSON.parse(product.pending_changes_json)); } catch { return null; }
}

export function clearPending(conn: DatabaseSync, productId: string): void {
  conn.prepare('UPDATE shop_products SET pending_changes_json = NULL, pending_by = NULL, pending_at_ts = NULL WHERE id = ?').run(productId);
}

// ---- API shape ----

export function productImages(conn: DatabaseSync, productId: string) {
  const rows = conn.prepare(`
    SELECT pi.position, pi.alt_en, pi.alt_fr, m.* FROM shop_product_images pi
    JOIN shop_media m ON m.id = pi.media_id WHERE pi.product_id = ? ORDER BY pi.position
  `).all(productId) as unknown as (ShopMediaRow & { position: number; alt_en: string | null; alt_fr: string | null })[];
  return rows.map((r) => ({ ...formatShopMedia(r), mediaId: r.id, altEn: r.alt_en, altFr: r.alt_fr }));
}

export function productCategoryIds(conn: DatabaseSync, productId: string): string[] {
  return (conn.prepare('SELECT category_id AS id FROM shop_product_categories WHERE product_id = ?').all(productId) as { id: string }[]).map((r) => r.id);
}

/** Pictures by id, for showing proposed images before approval. */
export function mediaById(conn: DatabaseSync, ids: string[]) {
  const get = conn.prepare('SELECT * FROM shop_media WHERE id = ?');
  return ids.map((id) => get.get(id) as ShopMediaRow | undefined).filter((r): r is ShopMediaRow => !!r).map(formatShopMedia);
}

/** List row: what the products table needs. */
export function formatProductSummary(conn: DatabaseSync, p: ProductRow) {
  const main = conn.prepare(`
    SELECT m.* FROM shop_product_images pi JOIN shop_media m ON m.id = pi.media_id
    WHERE pi.product_id = ? ORDER BY pi.position LIMIT 1
  `).get(p.id) as ShopMediaRow | undefined;
  return {
    id: p.id, productCode: p.product_code, nameEn: p.name_en, nameFr: p.name_fr,
    price: p.price, salePrice: p.sale_price, currency: p.currency, stockQty: p.stock_qty, lowStockAt: p.low_stock_at,
    status: p.status, isFeatured: p.is_featured === 1, hasPending: !!p.pending_changes_json,
    categoryIds: productCategoryIds(conn, p.id),
    thumbnail: main ? formatShopMedia(main).urls.w300 : null,
    updatedAt: p.updated_at_ts,
  };
}

const userName = (conn: DatabaseSync, id: string | null) =>
  id ? ((conn.prepare('SELECT display_name AS n FROM users WHERE id = ?').get(id) as { n: string } | undefined)?.n ?? null) : null;

/** Full product for the editor. Descriptions are returned as TipTap JSON. */
export function formatProduct(conn: DatabaseSync, p: ProductRow) {
  const parse = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
  const pending = readPending(p);
  return {
    ...formatProductSummary(conn, p),
    slugEn: p.slug_en, slugFr: p.slug_fr, shortEn: p.short_en, shortFr: p.short_fr,
    descriptionEn: parse(p.description_en_json), descriptionFr: parse(p.description_fr_json),
    maxPerOrder: p.max_per_order, sizeClass: p.size_class, weightKg: p.weight_kg, sortOrder: p.sort_order,
    seoTitleEn: p.seo_title_en, seoTitleFr: p.seo_title_fr, seoDescriptionEn: p.seo_description_en, seoDescriptionFr: p.seo_description_fr,
    images: productImages(conn, p.id),
    pending: pending ? {
      changes: pending,
      images: pending.images ? mediaById(conn, pending.images.map((i) => i.mediaId)) : undefined,
      by: userName(conn, p.pending_by), at: p.pending_at_ts,
    } : null,
    reviewNote: p.review_note,
    createdAt: p.created_at_ts, createdBy: userName(conn, p.created_by),
    publishedAt: p.published_at_ts, publishedBy: userName(conn, p.published_by),
    updatedBy: userName(conn, p.updated_by),
  };
}

// ---- Categories ----

export interface CategoryInput {
  nameEn?: string; nameFr?: string; slugEn?: string; slugFr?: string;
  descriptionEn?: string | null; descriptionFr?: string | null;
  parentId?: string | null; imageMediaId?: string | null; isVisible?: boolean; sortOrder?: number;
}

export function readCategoryInput(body: unknown, creating: boolean): CategoryInput {
  if (!body || typeof body !== 'object') throw bad('body', 'Nothing to save.');
  const b = body as Record<string, unknown>;
  const out: CategoryInput = {};
  for (const field of ['nameEn', 'nameFr'] as const) {
    if (!(field in b) && !creating) continue;
    const v = optionalText(b[field], 80, field);
    if (!v) throw bad(field, field === 'nameEn' ? 'The English name is required.' : 'The French name is required.');
    out[field] = v;
  }
  for (const field of ['descriptionEn', 'descriptionFr'] as const) {
    if (field in b) out[field] = optionalText(b[field], 400, field);
  }
  for (const field of ['slugEn', 'slugFr'] as const) {
    if (!(field in b) || b[field] === null || b[field] === '') continue;
    const v = typeof b[field] === 'string' ? (b[field] as string).trim().toLowerCase() : b[field];
    if (!isValidShopSlug(v)) throw bad(field, 'Use lower-case letters, numbers and hyphens only.');
    out[field] = v;
  }
  if ('parentId' in b) {
    if (b.parentId !== null && typeof b.parentId !== 'string') throw bad('parentId', 'The parent category is not valid.');
    out.parentId = (b.parentId as string | null) || null;
  }
  if ('imageMediaId' in b) {
    if (b.imageMediaId !== null && typeof b.imageMediaId !== 'string') throw bad('imageMediaId', 'The picture is not valid.');
    out.imageMediaId = (b.imageMediaId as string | null) || null;
  }
  if ('isVisible' in b) {
    if (typeof b.isVisible !== 'boolean') throw bad('isVisible', 'Visible must be true or false.');
    out.isVisible = b.isVisible;
  }
  if ('sortOrder' in b) {
    if (!isIntIn(b.sortOrder, -100000, 100000)) throw bad('sortOrder', 'Enter a whole number.');
    out.sortOrder = b.sortOrder;
  }
  return out;
}

function categorySlugTaken(conn: DatabaseSync, col: 'slug_en' | 'slug_fr', slug: string, exceptId: string | null) {
  return !!conn.prepare(`SELECT 1 FROM shop_categories WHERE ${col} = ? AND id IS NOT ?`).get(slug, exceptId);
}

function freeCategorySlug(conn: DatabaseSync, col: 'slug_en' | 'slug_fr', name: string, exceptId: string | null): string {
  let base = slugify(name).slice(0, SLUG_MAX - 4).replace(/-+$/, '') || 'category';
  if (!isValidShopSlug(base)) base = `${base}-items`;
  let slug = base;
  for (let n = 2; categorySlugTaken(conn, col, slug, exceptId); n++) slug = `${base}-${n}`;
  return slug;
}

/** One level only: a parent must exist, be top level, and not be the category itself. */
function checkParent(conn: DatabaseSync, parentId: string | null | undefined, selfId: string | null) {
  if (!parentId) return;
  if (parentId === selfId) throw bad('parentId', 'A category cannot be its own parent.');
  const parent = conn.prepare('SELECT parent_id FROM shop_categories WHERE id = ?').get(parentId) as { parent_id: string | null } | undefined;
  if (!parent) throw bad('parentId', 'The parent category no longer exists.');
  if (parent.parent_id) throw bad('parentId', 'Categories have one level only: choose a top-level parent.');
  if (selfId && conn.prepare('SELECT 1 FROM shop_categories WHERE parent_id = ?').get(selfId)) {
    throw bad('parentId', 'This category has sub-categories, so it must stay at the top level.');
  }
}

function checkCategoryImage(conn: DatabaseSync, mediaId: string | null | undefined) {
  if (mediaId && !conn.prepare('SELECT 1 FROM shop_media WHERE id = ?').get(mediaId)) throw bad('imageMediaId', 'The picture was not found. Upload it again.');
}

export function createCategory(conn: DatabaseSync, input: CategoryInput, userId: string, now = Date.now()): CategoryRow {
  checkParent(conn, input.parentId, null);
  checkCategoryImage(conn, input.imageMediaId);
  const slugEn = input.slugEn ?? freeCategorySlug(conn, 'slug_en', input.nameEn!, null);
  const slugFr = input.slugFr ?? freeCategorySlug(conn, 'slug_fr', input.nameFr!, null);
  if (categorySlugTaken(conn, 'slug_en', slugEn, null) || categorySlugTaken(conn, 'slug_fr', slugFr, null)) {
    throw new ShopError(409, 'SHOP_SLUG_TAKEN', 'Another category already uses this web address.');
  }
  const id = crypto.randomUUID();
  const order = input.sortOrder ?? ((conn.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM shop_categories').get() as { n: number }).n);
  conn.prepare(`
    INSERT INTO shop_categories (id, parent_id, slug_en, slug_fr, name_en, name_fr, description_en, description_fr, image_media_id,
      sort_order, is_visible, created_at_ts, updated_at_ts, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.parentId ?? null, slugEn, slugFr, input.nameEn!, input.nameFr!, input.descriptionEn ?? null, input.descriptionFr ?? null,
    input.imageMediaId ?? null, order, input.isVisible === false ? 0 : 1, now, now, userId);
  return conn.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id) as unknown as CategoryRow;
}

export function updateCategory(conn: DatabaseSync, row: CategoryRow, input: CategoryInput, userId: string, now = Date.now()): CategoryRow {
  if (input.parentId !== undefined) checkParent(conn, input.parentId, row.id);
  if (input.imageMediaId !== undefined) checkCategoryImage(conn, input.imageMediaId);
  for (const [field, col] of [['slugEn', 'slug_en'], ['slugFr', 'slug_fr']] as const) {
    const s = input[field];
    if (s !== undefined && categorySlugTaken(conn, col, s, row.id)) throw new ShopError(409, 'SHOP_SLUG_TAKEN', 'Another category already uses this web address.', field);
  }
  const map: [keyof CategoryInput, string][] = [
    ['nameEn', 'name_en'], ['nameFr', 'name_fr'], ['slugEn', 'slug_en'], ['slugFr', 'slug_fr'],
    ['descriptionEn', 'description_en'], ['descriptionFr', 'description_fr'], ['parentId', 'parent_id'],
    ['imageMediaId', 'image_media_id'], ['sortOrder', 'sort_order'],
  ];
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [field, col] of map) {
    if (input[field] !== undefined) { sets.push(`${col} = ?`); values.push(input[field] as string | number | null); }
  }
  if (input.isVisible !== undefined) { sets.push('is_visible = ?'); values.push(input.isVisible ? 1 : 0); }
  if (sets.length) {
    sets.push('updated_at_ts = ?', 'updated_by = ?');
    values.push(now, userId);
    conn.prepare(`UPDATE shop_categories SET ${sets.join(', ')} WHERE id = ?`).run(...values, row.id);
  }
  return conn.prepare('SELECT * FROM shop_categories WHERE id = ?').get(row.id) as unknown as CategoryRow;
}

export function formatCategory(conn: DatabaseSync, c: CategoryRow) {
  const media = c.image_media_id ? conn.prepare('SELECT * FROM shop_media WHERE id = ?').get(c.image_media_id) as ShopMediaRow | undefined : undefined;
  const products = (conn.prepare('SELECT COUNT(*) AS n FROM shop_product_categories WHERE category_id = ?').get(c.id) as { n: number }).n;
  return {
    id: c.id, parentId: c.parent_id, nameEn: c.name_en, nameFr: c.name_fr, slugEn: c.slug_en, slugFr: c.slug_fr,
    descriptionEn: c.description_en, descriptionFr: c.description_fr,
    image: media ? formatShopMedia(media) : null, isVisible: c.is_visible === 1, sortOrder: c.sort_order, productCount: products,
  };
}
