// Public shop API (docs/SHOP_SPEC.md §14), mounted on /api/shop: categories, product lists and one
// product (M.4); the cart check, the delivery fee and placing an order (M.5). While the shop is switched off (Console → Shop settings) every
// route answers 404, as if the shop did not exist. Only PUBLISHED products in visible categories
// leave here (server/shop/publicCatalog.ts). Rate-limited per address.
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { serverError } from '../errors.js';
import { shopBrowseLimiter, shopOrderLimiter } from '../middleware/rateLimit.js';
import { loadShopSettings } from '../shop/settings.js';
import {
  findPublicCategory, findPublicProduct, formatPublicProduct, listPublicProducts, publicCategories,
} from '../shop/publicCatalog.js';
import { DEFAULT_SHOP_SORT, isShopSort, shopListPage } from '../../src/shared/shopPublic.js';
import { buildPath, type Lang } from '../../src/router/routes.js';
import { isDeliveryMethod } from '../../src/shared/shopOrderStatus.js';
import {
  checkCart, checkoutOptions, feeItemsOf, isFail, orderDeliveryFee, placeOrder, readCartLines, readDestination, readOrderInput,
  type Fail,
} from '../shop/orders.js';

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

const send = (res: Response, f: Fail) =>
  res.status(f.status).json({ success: false, code: f.code, error: f.error, ...(f.details ? { details: f.details } : {}) });
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

// POST /api/shop/cart/check { lines: [{ id, qty }], locale } (SHOP_SPEC §8): every product read
// again, the quantity each may have now, what is gone, and the checkout's payment methods and
// pickup offices. Prices sent by the browser are not read.
publicShopRouter.post('/cart/check', (req: Request, res: Response) => {
  try {
    const b = body(req);
    const lang = localeOf(b.locale);
    if (!lang) return res.status(400).json({ success: false, code: 'BAD_REQUEST', error: 'Unknown language.' });
    const settings = loadShopSettings(db);
    const lines = Array.isArray(b.lines) && b.lines.length === 0 ? [] : readCartLines(b.lines);
    if (isFail(lines)) return send(res, lines);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { ...checkCart(db, lines, lang, settings), options: checkoutOptions(settings) } });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/shop/delivery-fee { lines, deliveryMethod, cityId?, zoneId? } (SHOP_SPEC §9)
//   → { status: 'NONE' | 'QUOTED' | 'TO_CONFIRM', fee, currency }: the fee the order would store.
publicShopRouter.post('/delivery-fee', (req: Request, res: Response) => {
  try {
    const b = body(req);
    const lines = readCartLines(b.lines);
    if (isFail(lines)) return send(res, lines);
    if (!isDeliveryMethod(b.deliveryMethod)) return res.status(400).json({ success: false, code: 'INVALID_DELIVERY_METHOD', error: 'Choose delivery or pickup.' });
    const settings = loadShopSettings(db);
    let to: { cityId: string | null; zoneId: string | null } = { cityId: null, zoneId: null };
    if (b.deliveryMethod === 'DELIVERY') {
      const dest = readDestination(db, b.cityId, b.zoneId);
      if (isFail(dest)) return send(res, dest);
      to = dest;
    }
    const checked = checkCart(db, lines, 'en', settings);
    const sold = checked.lines.map((l) => ({ id: l.id, qty: l.qty }));
    const fee = sold.length === 0
      ? { status: 'TO_CONFIRM' as const, fee: null }
      : orderDeliveryFee(db, settings, b.deliveryMethod, to, feeItemsOf(db, sold), checked.currency);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { ...fee, currency: checked.currency } });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/shop/orders (SHOP_SPEC §10.2): the checkout form → 201 with the order summary (200 for
// a repeat of the same idempotency key). 5 per 10 minutes per address.
publicShopRouter.post('/orders', shopOrderLimiter, (req: Request, res: Response) => {
  try {
    const settings = loadShopSettings(db);
    const input = readOrderInput(db, body(req), settings);
    if (isFail(input)) return send(res, input);
    const result = placeOrder(db, req, input, settings);
    if (isFail(result)) return send(res, result);
    res.set('Cache-Control', 'no-store');
    res.status(result.created ? 201 : 200).json({ success: true, data: result.order });
  } catch (err) {
    serverError(res, err);
  }
});
