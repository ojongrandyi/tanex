// Shop pages as the server sees them (SHOP_SPEC §8, §15): whether /shop, a category or a product is
// a page at all, and what its <head> says. Everything is a 404 while the shop is switched off; a
// category is a page while it is visible and lists a published product; a product while it is
// PUBLISHED; the cart while the shop is on. A shop list past its last page is a 404, as for the
// blog. The sitemap lists the same pages, in both languages, only while the shop is on.
import type { DatabaseSync } from 'node:sqlite';
import { buildPath, type Lang, type RouteMatch } from '../../src/router/routes.js';
import { SHOP_PAGE_SIZE, effectivePrice, shopListPage } from '../../src/shared/shopPublic.js';
import type { ShopPageData, SitemapEntry } from '../render/pageMeta.js';
import type { CategoryRow, ProductRow } from './catalog.js';
import { shopMediaUrl } from './media.js';
import { loadShopSettings } from './settings.js';
import { PUBLIC_PRODUCT, findPublicCategory, findPublicProduct, publicCategories } from './publicCatalog.js';

export type ShopPageResult = { kind: 'page'; shop?: ShopPageData } | { kind: 'not-found' };

const NOT_FOUND: ShopPageResult = { kind: 'not-found' };
const DESCRIPTION_MAX = 160;

const pick = (lang: Lang, en: string | null, fr: string | null) => ((lang === 'fr' ? fr : en) ?? '').trim();

/** Plain text of a sanitised description, cut at a word near DESCRIPTION_MAX characters. */
export function metaDescription(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 80 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

function productData(conn: DatabaseSync, p: ProductRow, lang: Lang): ShopPageData {
  const name = pick(lang, p.name_en, p.name_fr) || p.name_en;
  const description = pick(lang, p.seo_description_en, p.seo_description_fr)
    || pick(lang, p.short_en, p.short_fr)
    || metaDescription(pick(lang, p.description_en_html, p.description_fr_html) || p.description_en_html || '');
  const main = conn.prepare(`
    SELECT pi.alt_en, pi.alt_fr, m.jpg_1200 FROM shop_product_images pi JOIN shop_media m ON m.id = pi.media_id
    WHERE pi.product_id = ? ORDER BY pi.position LIMIT 1
  `).get(p.id) as { alt_en: string | null; alt_fr: string | null; jpg_1200: string } | undefined;
  return {
    type: 'product',
    product: {
      name,
      title: pick(lang, p.seo_title_en, p.seo_title_fr) || name,
      description,
      sku: p.product_code,
      // Pictures are always square (SHOP_SPEC §6): the share image is the 1200 px JPEG.
      image: main ? { url: shopMediaUrl(main.jpg_1200), width: 1200, height: 1200, alt: pick(lang, main.alt_en, main.alt_fr) || name } : null,
      price: effectivePrice(p.price, p.sale_price),
      currency: p.currency,
      inStock: p.stock_qty > 0,
      versions: { en: buildPath('shop', p.slug_en, 'en'), fr: buildPath('shop', p.slug_fr, 'fr') },
    },
  };
}

function categoryData(row: CategoryRow, lang: Lang, page: number): ShopPageData {
  return {
    type: 'category',
    name: pick(lang, row.name_en, row.name_fr),
    description: pick(lang, row.description_en, row.description_fr),
    versions: { en: buildPath('shop-category', row.slug_en, 'en'), fr: buildPath('shop-category', row.slug_fr, 'fr') },
    page,
  };
}

const publishedTotal = (conn: DatabaseSync) =>
  (conn.prepare(`SELECT COUNT(*) AS n FROM shop_products p WHERE ${PUBLIC_PRODUCT}`).get() as { n: number }).n;

export function resolveShopPage(conn: DatabaseSync, match: RouteMatch, query: Record<string, unknown>): ShopPageResult {
  if (!loadShopSettings(conn).enabled) return NOT_FOUND;
  if (match.id === 'cart') return { kind: 'page' };
  const page = shopListPage(query.page);

  if (match.id === 'shop' && match.param === undefined) {
    const total = publishedTotal(conn);
    if (page > 1 && page > Math.ceil(total / SHOP_PAGE_SIZE)) return NOT_FOUND;
    return { kind: 'page', shop: { type: 'index', hasProducts: total > 0, page } };
  }
  if (match.id === 'shop-category' && match.param !== undefined) {
    const found = findPublicCategory(conn, match.lang, match.param);
    if (!found || page > Math.ceil(found.count / SHOP_PAGE_SIZE)) return NOT_FOUND;
    return { kind: 'page', shop: categoryData(found.row, match.lang, page) };
  }
  if (match.id === 'shop' && match.param !== undefined) {
    const product = findPublicProduct(conn, match.lang, match.param);
    return product ? { kind: 'page', shop: productData(conn, product, match.lang) } : NOT_FOUND;
  }
  return NOT_FOUND;
}

/**
 * The shop's sitemap entries while the shop is on: the shop index (once a product is published),
 * every category with a published product and every published product, each in both languages.
 */
export function shopSitemapEntries(conn: DatabaseSync): SitemapEntry[] {
  if (!loadShopSettings(conn).enabled) return [];
  const products = conn.prepare(`SELECT p.* FROM shop_products p WHERE ${PUBLIC_PRODUCT} ORDER BY p.published_at_ts DESC, p.id`)
    .all() as unknown as ProductRow[];
  if (products.length === 0) return [];
  const lastmod = Math.max(...products.map((p) => p.updated_at_ts));
  const entries: SitemapEntry[] = [
    { paths: { en: buildPath('shop', undefined, 'en'), fr: buildPath('shop', undefined, 'fr') }, lastmod },
  ];
  for (const c of publicCategories(conn, 'en')) entries.push({ paths: c.paths });
  for (const p of products) {
    entries.push({ paths: { en: buildPath('shop', p.slug_en, 'en'), fr: buildPath('shop', p.slug_fr, 'fr') }, lastmod: p.updated_at_ts });
  }
  return entries;
}
