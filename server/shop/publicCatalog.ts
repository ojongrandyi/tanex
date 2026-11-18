// The public side of the shop catalogue (docs/SHOP_SPEC.md §8, §14): what the shop, category and
// product pages may read. Only PUBLISHED products; only visible categories (a sub-category of a
// hidden category is hidden too). Stock leaves here only as "in stock", "only n left" or "out of
// stock" (src/shared/shopPublic.ts). No drafts, proposed changes, review notes or staff names.
// The routes (server/routes/publicShop.ts) answer 404 for all of it while the shop is switched off.
import type { DatabaseSync } from 'node:sqlite';
import { buildPath, type Lang } from '../../src/router/routes.js';
import {
  SHOP_PAGE_SIZE, SHOP_RELATED_MAX, SHOP_SEARCH_MAX, effectivePrice, orderLimit, publicStock, type ShopSort,
} from '../../src/shared/shopPublic.js';
import type { ShopSettings } from '../../src/shared/shopSettings.js';
import type { CategoryRow, ProductRow } from './catalog.js';
import { formatShopMedia, type ShopMediaRow } from './media.js';

export const PUBLIC_PRODUCT = "p.status = 'PUBLISHED'";

/** The price a customer pays, in SQL (the same rule as effectivePrice). */
const PAID_PRICE = 'CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 AND p.sale_price < p.price THEN p.sale_price ELSE p.price END';

const ORDER_BY: Record<ShopSort, string> = {
  featured: 'p.is_featured DESC, p.sort_order ASC, p.published_at_ts DESC, p.id',
  newest: 'p.published_at_ts DESC, p.id',
  'price-asc': `${PAID_PRICE} ASC, p.id`,
  'price-desc': `${PAID_PRICE} DESC, p.id`,
};

type Limits = Pick<ShopSettings, 'lowStockAt' | 'maxPerOrder'>;

const productName = (p: ProductRow, lang: Lang) => (lang === 'fr' ? p.name_fr || p.name_en : p.name_en);
const productSlug = (p: ProductRow, lang: Lang) => (lang === 'fr' ? p.slug_fr : p.slug_en);
export const productPath = (p: ProductRow, lang: Lang) => buildPath('shop', productSlug(p, lang), lang);

// ---- Categories ----

/** Visible categories: shown themselves, and their parent (if any) shown too. */
export function visibleCategories(conn: DatabaseSync): CategoryRow[] {
  return conn.prepare(`
    SELECT c.* FROM shop_categories c
    LEFT JOIN shop_categories parent ON parent.id = c.parent_id
    WHERE c.is_visible = 1 AND (c.parent_id IS NULL OR parent.is_visible = 1)
    ORDER BY c.sort_order, c.name_en
  `).all() as unknown as CategoryRow[];
}

/** A category and its visible sub-categories: the ids a category page lists products from. */
function categoryScope(all: CategoryRow[], category: CategoryRow): string[] {
  return [category.id, ...all.filter((c) => c.parent_id === category.id).map((c) => c.id)];
}

function publishedCount(conn: DatabaseSync, categoryIds: string[]): number {
  if (categoryIds.length === 0) return 0;
  return (conn.prepare(`
    SELECT COUNT(DISTINCT p.id) AS n FROM shop_products p
    JOIN shop_product_categories pc ON pc.product_id = p.id
    WHERE ${PUBLIC_PRODUCT} AND pc.category_id IN (${categoryIds.map(() => '?').join(', ')})
  `).get(...categoryIds) as { n: number }).n;
}

function categoryImage(conn: DatabaseSync, mediaId: string | null) {
  if (!mediaId) return null;
  const row = conn.prepare('SELECT * FROM shop_media WHERE id = ?').get(mediaId) as ShopMediaRow | undefined;
  return row ? formatShopMedia(row).urls : null;
}

function formatPublicCategory(conn: DatabaseSync, c: CategoryRow, all: CategoryRow[], lang: Lang, count: number) {
  const parent = c.parent_id ? all.find((x) => x.id === c.parent_id) : undefined;
  return {
    slug: lang === 'fr' ? c.slug_fr : c.slug_en,
    name: lang === 'fr' ? c.name_fr : c.name_en,
    description: (lang === 'fr' ? c.description_fr : c.description_en) ?? '',
    path: buildPath('shop-category', lang === 'fr' ? c.slug_fr : c.slug_en, lang),
    parentSlug: parent ? (lang === 'fr' ? parent.slug_fr : parent.slug_en) : null,
    image: categoryImage(conn, c.image_media_id),
    productCount: count,
    /** The same category in each language, for the language switch. */
    paths: { en: buildPath('shop-category', c.slug_en, 'en'), fr: buildPath('shop-category', c.slug_fr, 'fr') },
  };
}
export type PublicCategory = ReturnType<typeof formatPublicCategory>;

/** Visible categories that list at least one published product (their own or a sub-category's). */
export function publicCategories(conn: DatabaseSync, lang: Lang): PublicCategory[] {
  const all = visibleCategories(conn);
  const out: PublicCategory[] = [];
  for (const c of all) {
    const count = publishedCount(conn, categoryScope(all, c));
    if (count > 0) out.push(formatPublicCategory(conn, c, all, lang, count));
  }
  return out;
}

/** A visible category with at least one published product, by its slug in `lang`. */
export function findPublicCategory(conn: DatabaseSync, lang: Lang, slug: string): { row: CategoryRow; all: CategoryRow[]; count: number } | null {
  const all = visibleCategories(conn);
  const row = all.find((c) => (lang === 'fr' ? c.slug_fr : c.slug_en) === slug);
  if (!row) return null;
  const count = publishedCount(conn, categoryScope(all, row));
  return count > 0 ? { row, all, count } : null;
}

// ---- Products ----

function mainImage(conn: DatabaseSync, productId: string) {
  return conn.prepare(`
    SELECT pi.alt_en, pi.alt_fr, m.* FROM shop_product_images pi JOIN shop_media m ON m.id = pi.media_id
    WHERE pi.product_id = ? ORDER BY pi.position LIMIT 1
  `).get(productId) as (ShopMediaRow & { alt_en: string | null; alt_fr: string | null }) | undefined;
}

const altOf = (row: { alt_en: string | null; alt_fr: string | null }, p: ProductRow, lang: Lang) =>
  ((lang === 'fr' ? row.alt_fr : row.alt_en) || '').trim() || productName(p, lang);

/** A product card: picture, name, price, stock line, how many may be ordered. */
export function formatPublicCard(conn: DatabaseSync, p: ProductRow, lang: Lang, limits: Limits) {
  const stock = publicStock(p.stock_qty, p.low_stock_at ?? limits.lowStockAt);
  const main = mainImage(conn, p.id);
  const paid = effectivePrice(p.price, p.sale_price);
  return {
    id: p.id,
    code: p.product_code,
    slug: productSlug(p, lang),
    path: productPath(p, lang),
    name: productName(p, lang),
    short: (lang === 'fr' ? p.short_fr : p.short_en) ?? '',
    price: p.price,
    /** The sale price when the product is on sale, else null. */
    salePrice: paid < p.price ? paid : null,
    currency: p.currency,
    stock,
    maxQty: orderLimit(stock, p.max_per_order ?? limits.maxPerOrder),
    image: main ? { urls: formatShopMedia(main).urls, alt: altOf(main, p, lang) } : null,
  };
}
export type PublicProductCard = ReturnType<typeof formatPublicCard>;

export interface ProductListQuery {
  lang: Lang;
  /** Category slug in `lang`; the category's visible sub-categories are included. */
  categoryIds?: string[];
  q?: string;
  sort: ShopSort;
  inStock: boolean;
  page: number;
}

export function listPublicProducts(conn: DatabaseSync, query: ProductListQuery, limits: Limits) {
  const where = [PUBLIC_PRODUCT];
  const params: (string | number)[] = [];
  if (query.categoryIds) {
    where.push(`EXISTS (SELECT 1 FROM shop_product_categories pc WHERE pc.product_id = p.id AND pc.category_id IN (${query.categoryIds.map(() => '?').join(', ')}))`);
    params.push(...query.categoryIds);
  }
  if (query.inStock) where.push('p.stock_qty > 0');
  const q = (query.q ?? '').trim().slice(0, SHOP_SEARCH_MAX);
  if (q) {
    const name = query.lang === 'fr' ? 'COALESCE(p.name_fr, p.name_en)' : 'p.name_en';
    const short = query.lang === 'fr' ? 'p.short_fr' : 'p.short_en';
    where.push(`(${name} LIKE ? ESCAPE '\\' OR ${short} LIKE ? ESCAPE '\\' OR p.product_code LIKE ? ESCAPE '\\')`);
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like);
  }
  const whereSql = where.join(' AND ');
  const total = (conn.prepare(`SELECT COUNT(*) AS n FROM shop_products p WHERE ${whereSql}`).get(...params) as { n: number }).n;
  const totalPages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), 10000);
  const rows = conn.prepare(`SELECT p.* FROM shop_products p WHERE ${whereSql} ORDER BY ${ORDER_BY[query.sort]} LIMIT ? OFFSET ?`)
    .all(...params, SHOP_PAGE_SIZE, (page - 1) * SHOP_PAGE_SIZE) as unknown as ProductRow[];
  return {
    data: rows.map((r) => formatPublicCard(conn, r, query.lang, limits)),
    page, pageSize: SHOP_PAGE_SIZE, total, totalPages,
  };
}

/** A published product by its slug in `lang`. */
export function findPublicProduct(conn: DatabaseSync, lang: Lang, slug: string): ProductRow | undefined {
  const col = lang === 'fr' ? 'slug_fr' : 'slug_en';
  return conn.prepare(`SELECT p.* FROM shop_products p WHERE p.${col} = ? AND ${PUBLIC_PRODUCT}`).get(slug) as ProductRow | undefined;
}

/**
 * The full product page: every picture, description, visible categories, the address in each
 * language and up to four related products (same category, in stock first).
 */
export function formatPublicProduct(conn: DatabaseSync, p: ProductRow, lang: Lang, limits: Limits, includeRelated = true) {
  const images = (conn.prepare(`
    SELECT pi.alt_en, pi.alt_fr, m.* FROM shop_product_images pi JOIN shop_media m ON m.id = pi.media_id
    WHERE pi.product_id = ? ORDER BY pi.position
  `).all(p.id) as unknown as (ShopMediaRow & { alt_en: string | null; alt_fr: string | null })[])
    .map((row) => ({ urls: formatShopMedia(row).urls, alt: altOf(row, p, lang) }));

  const all = visibleCategories(conn);
  const own = new Set((conn.prepare('SELECT category_id AS id FROM shop_product_categories WHERE product_id = ?')
    .all(p.id) as { id: string }[]).map((r) => r.id));
  const categories = all.filter((c) => own.has(c.id)).map((c) => ({
    slug: lang === 'fr' ? c.slug_fr : c.slug_en,
    name: lang === 'fr' ? c.name_fr : c.name_en,
    path: buildPath('shop-category', lang === 'fr' ? c.slug_fr : c.slug_en, lang),
  }));

  let related: PublicProductCard[] = [];
  const ids = all.filter((c) => own.has(c.id)).map((c) => c.id);
  if (includeRelated && ids.length > 0) {
    const rows = conn.prepare(`
      SELECT p.*, COUNT(*) AS shared FROM shop_products p
      JOIN shop_product_categories pc ON pc.product_id = p.id
      WHERE pc.category_id IN (${ids.map(() => '?').join(', ')}) AND p.id <> ? AND ${PUBLIC_PRODUCT}
      GROUP BY p.id
      ORDER BY (p.stock_qty > 0) DESC, shared DESC, p.is_featured DESC, p.published_at_ts DESC, p.id
      LIMIT ?
    `).all(...ids, p.id, SHOP_RELATED_MAX) as unknown as ProductRow[];
    related = rows.map((r) => formatPublicCard(conn, r, lang, limits));
  }

  const card = formatPublicCard(conn, p, lang, limits);
  return {
    ...card,
    descriptionHtml: (lang === 'fr' ? p.description_fr_html : p.description_en_html) ?? '',
    images,
    categories,
    seoTitle: ((lang === 'fr' ? p.seo_title_fr : p.seo_title_en) || '').trim() || card.name,
    seoDescription: ((lang === 'fr' ? p.seo_description_fr : p.seo_description_en) || '').trim() || card.short,
    /** The same product in each language, for the language switch and hreflang. */
    paths: { en: productPath(p, 'en'), fr: productPath(p, 'fr') },
    related,
  };
}
export type PublicProduct = ReturnType<typeof formatPublicProduct>;
