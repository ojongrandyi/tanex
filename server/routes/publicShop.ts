// Public shop API (docs/SHOP_SPEC.md §14), mounted on /api/shop. Read-only in M.4: categories,
// product lists and one product. While the shop is switched off (Console → Shop settings) every
// route answers 404, as if the shop did not exist. Only PUBLISHED products in visible categories
// leave here (server/shop/publicCatalog.ts). Rate-limited per address.
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { serverError } from '../errors.js';
import { shopBrowseLimiter } from '../middleware/rateLimit.js';
import { loadShopSettings } from '../shop/settings.js';
import {
  findPublicCategory, findPublicProduct, formatPublicProduct, listPublicProducts, publicCategories,
} from '../shop/publicCatalog.js';
import { DEFAULT_SHOP_SORT, isShopSort, shopListPage } from '../../src/shared/shopPublic.js';
import { buildPath, type Lang } from '../../src/router/routes.js';

export const publicShopRouter = Router();

const notFound = (res: Response, error = 'Not found.') => res.status(404).json({ success: false, code: 'NOT_FOUND', error });

/** locale query: en (default) or fr; anything else is refused. */
function localeOf(value: unknown): Lang | null {
  if (value === undefined || value === '') return 'en';
  return value === 'en' || value === 'fr' ? value : null;
}

publicShopRouter.use(shopBrowseLimiter);

// The shop is off: nothing here exists.
publicShopRouter.use((req: Request, res: Response, next: NextFunction) => {
  try {
    if (!loadShopSettings(db).enabled) return notFound(res);
    next();
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/shop/categories?locale=en: visible categories with at least one published product.
publicShopRouter.get('/categories', (req: Request, res: Response) => {
  try {
    const lang = localeOf(req.query.locale);
    if (!lang) return res.status(400).json({ success: false, code: 'BAD_REQUEST', error: 'Unknown language.' });
    res.json({ success: true, data: publicCategories(db, lang) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/shop/products?locale=&category=&q=&sort=&inStock=1&page=: 24 per page.
publicShopRouter.get('/products', (req: Request, res: Response) => {
  try {
    const lang = localeOf(req.query.locale);
    if (!lang) return res.status(400).json({ success: false, code: 'BAD_REQUEST', error: 'Unknown language.' });
    const settings = loadShopSettings(db);
    let category = null;
    let categoryIds: string[] | undefined;
    if (typeof req.query.category === 'string' && req.query.category) {
      const found = findPublicCategory(db, lang, req.query.category);
      if (!found) return notFound(res, 'Category not found.');
      categoryIds = [found.row.id, ...found.all.filter((c) => c.parent_id === found.row.id).map((c) => c.id)];
      const c = found.row;
      category = {
        slug: lang === 'fr' ? c.slug_fr : c.slug_en,
        name: lang === 'fr' ? c.name_fr : c.name_en,
        description: (lang === 'fr' ? c.description_fr : c.description_en) ?? '',
        paths: { en: buildPath('shop-category', c.slug_en, 'en'), fr: buildPath('shop-category', c.slug_fr, 'fr') },
      };
    }
    const list = listPublicProducts(db, {
      lang,
      categoryIds,
      q: typeof req.query.q === 'string' ? req.query.q : '',
      sort: isShopSort(req.query.sort) ? req.query.sort : DEFAULT_SHOP_SORT,
      inStock: req.query.inStock === '1' || req.query.inStock === 'true',
      page: shopListPage(req.query.page),
    }, settings);
    res.json({ success: true, ...list, category });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/shop/products/:slug?locale=en: one published product, with related products.
publicShopRouter.get('/products/:slug', (req: Request, res: Response) => {
  try {
    const lang = localeOf(req.query.locale);
    if (!lang) return res.status(400).json({ success: false, code: 'BAD_REQUEST', error: 'Unknown language.' });
    const product = findPublicProduct(db, lang, req.params.slug as string);
    if (!product) return notFound(res, 'Product not found.');
    res.json({ success: true, data: formatPublicProduct(db, product, lang, loadShopSettings(db)) });
  } catch (err) {
    serverError(res, err);
  }
});
