// Shop pages as the server sees them (SHOP_SPEC §8): whether /shop, a category or a product is a
// page at all. Everything is a 404 while the shop is switched off; a category is a page while it is
// visible and lists a published product; a product while it is PUBLISHED. A shop list past its
// last page is a 404, as for the blog. Titles, descriptions and Product JSON-LD come with M.8.
import type { DatabaseSync } from 'node:sqlite';
import type { RouteMatch } from '../../src/router/routes.js';
import { SHOP_PAGE_SIZE, shopListPage } from '../../src/shared/shopPublic.js';
import { loadShopSettings } from './settings.js';
import { PUBLIC_PRODUCT, findPublicCategory, findPublicProduct } from './publicCatalog.js';

export type ShopPageResult = { kind: 'page' } | { kind: 'not-found' };

const PAGE: ShopPageResult = { kind: 'page' };
const NOT_FOUND: ShopPageResult = { kind: 'not-found' };

export function resolveShopPage(conn: DatabaseSync, match: RouteMatch, query: Record<string, unknown>): ShopPageResult {
  if (!loadShopSettings(conn).enabled) return NOT_FOUND;
  const page = shopListPage(query.page);

  if (match.id === 'shop' && match.param === undefined) {
    if (page === 1) return PAGE;
    const total = (conn.prepare(`SELECT COUNT(*) AS n FROM shop_products p WHERE ${PUBLIC_PRODUCT}`).get() as { n: number }).n;
    return page <= Math.ceil(total / SHOP_PAGE_SIZE) ? PAGE : NOT_FOUND;
  }
  if (match.id === 'shop-category' && match.param !== undefined) {
    const found = findPublicCategory(conn, match.lang, match.param);
    if (!found) return NOT_FOUND;
    return page <= Math.ceil(found.count / SHOP_PAGE_SIZE) ? PAGE : NOT_FOUND;
  }
  if (match.id === 'shop' && match.param !== undefined) {
    return findPublicProduct(conn, match.lang, match.param) ? PAGE : NOT_FOUND;
  }
  return NOT_FOUND;
}
