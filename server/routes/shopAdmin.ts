// Console shop API (docs/SHOP_SPEC.md §7, §14), mounted at /api/admin/shop. Every route checks a
// Shop permission on the server and every write is audited. M.2: pictures. M.3: products, review
// (submit, publish, send back, proposed changes), stock and categories. M.7: orders and shop settings.
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth, requestHasPermission } from '../auth/permissions.js';
import { inTransaction } from '../auth/schema.js';
import { audit } from '../audit.js';
import { serverError } from '../errors.js';
import { deleteUpload } from '../uploads.js';
import {
  checkShopImageFiles, formatShopMedia, shopMediaFiles, shopMediaUsage, storeShopMedia, type ShopMediaRow,
} from '../shop/media.js';
import {
  ShopError, applyProductInput, clearPending, createCategory, createProduct, formatCategory, formatProduct,
  formatProductSummary, getProduct, proposeChanges, readCategoryInput, readPending, readProductInput, updateCategory,
  type CategoryRow, type ProductRow,
} from '../shop/catalog.js';
import {
  STOCK_ADJUST_REASONS, STOCK_MAX, canEditContent, checkProductTransition, editIsProposal, isProductStatus,
  missingForPublish, type ProductRole,
} from '../../src/shared/shopProduct.js';
import { loadShopSettings } from '../shop/settings.js';
import {
  OrderError, addOrderNote, changeOrderStatus, findOrder, listOrders, loadOrder, markUnpaid, orderDetail, ordersSummary,
  recordPayment, recordRefund, saveSettings, sendSettingsTestEmail, sendToDispatch, setDeliveryFee, settingsView,
} from '../shop/orderAdmin.js';
import type { PermissionKey } from '../../src/shared/permissions.js';

export const shopAdminRouter = Router();

type Fail = { status: number; code: string; error: string; field?: string };
const fail = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error, field: f.field });
const me = (req: Request) => getRequestAuth(req)!.user.id;
const notFound = (res: Response, what = 'Product') => fail(res, { status: 404, code: 'NOT_FOUND', error: `${what} not found.` });

/** Turns a ShopError into its response; anything else is a server error. */
function handle(res: Response, err: unknown) {
  if (err instanceof ShopError) return fail(res, { status: err.status, code: err.code, error: err.message, field: err.field });
  return serverError(res, err);
}

// Who may do what (SHOP_SPEC §3).
const READ: PermissionKey[] = ['shop.view', 'shop.write', 'shop.publish', 'shop.stock', 'shop.categories'];
const WRITE: PermissionKey[] = ['shop.write', 'shop.publish'];
const MEDIA_ACCESS: PermissionKey[] = ['shop.write', 'shop.publish', 'shop.categories'];

/** A publisher can do everything a writer can (the admin's approval step). */
const roleOf = (req: Request): ProductRole => (requestHasPermission(req, 'shop.publish') ? 'publisher' : 'writer');

const shopSettings = () => loadShopSettings(db);

// ---- Pictures (M.2) ----

// POST /api/admin/shop/media: { files: { w1200, w600, w300, j1200, j600 } }, each base64 or a data
// URL, made by the console's crop step (SHOP_SPEC §6). Refused unless every file is exactly right.
shopAdminRouter.post('/media', requirePermission(...MEDIA_ACCESS), (req: Request, res: Response) => {
  try {
    const checked = checkShopImageFiles(req.body?.files);
    if (!checked.ok) return fail(res, { status: 400, code: 'SHOP_INVALID_IMAGE', error: checked.error });
    const row = storeShopMedia(db, checked.files, me(req));
    audit(req, 'shop.media_upload', 'shop_media', row.id, 'Shop picture uploaded', undefined,
      { bytesTotal: row.bytes_total, webp: checked.files.w1200.type === 'webp' });
    res.status(201).json({ success: true, data: formatShopMedia(row) });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/admin/shop/media/:id: removes a picture no product or category uses (e.g. one
// uploaded and then removed before the product was saved).
shopAdminRouter.delete('/media/:id', requirePermission(...MEDIA_ACCESS), (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM shop_media WHERE id = ?').get(req.params.id as string) as ShopMediaRow | undefined;
    if (!row) return fail(res, { status: 404, code: 'NOT_FOUND', error: 'Picture not found.' });
    if (shopMediaUsage(db, row.id) > 0) {
      return fail(res, { status: 409, code: 'SHOP_MEDIA_IN_USE', error: 'A product or category still uses this picture.' });
    }
    db.prepare('DELETE FROM shop_media WHERE id = ?').run(row.id);
    for (const f of shopMediaFiles(row)) deleteUpload('shop', f);
    audit(req, 'shop.media_delete', 'shop_media', row.id, 'Shop picture deleted', { bytesTotal: row.bytes_total }, undefined);
    res.json({ success: true });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Products ----

// GET /api/admin/shop/products?status=&category=&stock=low|out&q=
// status: one product status, or NEEDS_REVIEW (in review, or a live product with proposed changes).
// Archived products are listed only when asked for.
shopAdminRouter.get('/products', requirePermission(...READ), (req: Request, res: Response) => {
  try {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status === 'NEEDS_REVIEW') where.push("(p.status = 'IN_REVIEW' OR p.pending_changes_json IS NOT NULL)");
    else if (isProductStatus(status)) { where.push('p.status = ?'); params.push(status); }
    else where.push("p.status <> 'ARCHIVED'");

    const category = typeof req.query.category === 'string' ? req.query.category : '';
    if (category === 'NONE') where.push('NOT EXISTS (SELECT 1 FROM shop_product_categories pc WHERE pc.product_id = p.id)');
    else if (category) { where.push('EXISTS (SELECT 1 FROM shop_product_categories pc WHERE pc.product_id = p.id AND pc.category_id = ?)'); params.push(category); }

    const { lowStockAt } = shopSettings();
    if (req.query.stock === 'out') where.push('p.stock_qty = 0');
    else if (req.query.stock === 'low') { where.push('p.stock_qty > 0 AND p.stock_qty <= COALESCE(p.low_stock_at, ?)'); params.push(lowStockAt); }

    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      where.push("(p.name_en LIKE ? ESCAPE '\\' OR p.name_fr LIKE ? ESCAPE '\\' OR p.product_code LIKE ? ESCAPE '\\')");
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like, like);
    }
    const rows = db.prepare(`SELECT p.* FROM shop_products p WHERE ${where.join(' AND ')} ORDER BY p.updated_at_ts DESC LIMIT 500`)
      .all(...params) as unknown as ProductRow[];
    res.json({ success: true, data: rows.map((r) => formatProductSummary(db, r)), lowStockAt });
  } catch (err) {
    serverError(res, err);
  }
});

shopAdminRouter.get('/products/:id', requirePermission(...READ), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    res.json({ success: true, data: formatProduct(db, p) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/shop/products: { nameEn, price, stockQty, ...other fields } → a DRAFT with its
// product ID (TX-PRD-######) and its starting stock recorded.
shopAdminRouter.post('/products', requirePermission(...WRITE), (req: Request, res: Response) => {
  try {
    const input = readProductInput(req.body);
    const stock = req.body?.stockQty ?? 0;
    const row = inTransaction(db, () => createProduct(db, input, stock, me(req)));
    audit(req, 'shop.product_create', 'shop_product', row.id, `Product ${row.product_code} created`, undefined,
      { productCode: row.product_code, nameEn: row.name_en, price: row.price, stockQty: row.stock_qty });
    res.status(201).json({ success: true, data: formatProduct(db, row) });
  } catch (err) {
    handle(res, err);
  }
});

// PUT /api/admin/shop/products/:id: edits. A writer's edits to a published or hidden product are
// held as proposed changes for a publisher to approve (SHOP_SPEC §7.3); everything else is saved.
shopAdminRouter.put('/products/:id', requirePermission(...WRITE), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    const role = roleOf(req);
    if (!canEditContent(p.status, role)) {
      return fail(res, { status: 403, code: 'SHOP_PRODUCT_LOCKED', error: 'Archived products cannot be edited. Restore it first.' });
    }
    const input = readProductInput(req.body);
    if (editIsProposal(p.status, role)) {
      inTransaction(db, () => proposeChanges(db, p, input, me(req)));
      audit(req, 'shop.product_propose', 'shop_product', p.id, `Changes proposed for ${p.product_code}`, undefined, { fields: Object.keys(input) });
      return res.json({ success: true, mode: 'proposed', data: formatProduct(db, getProduct(db, p.id)!) });
    }
    inTransaction(db, () => applyProductInput(db, p, input, me(req)));
    const after = getProduct(db, p.id)!;
    audit(req, 'shop.product_update', 'shop_product', p.id, `Product ${p.product_code} updated`,
      { price: p.price, salePrice: p.sale_price, nameEn: p.name_en },
      { fields: Object.keys(input), price: after.price, salePrice: after.sale_price, nameEn: after.name_en });
    res.json({ success: true, mode: 'saved', data: formatProduct(db, after) });
  } catch (err) {
    handle(res, err);
  }
});

// POST /api/admin/shop/products/:id/status: { status, note? }. Writers submit for review;
// publishers publish, send back (note required), hide, archive and restore.
shopAdminRouter.post('/products/:id/status', requirePermission(...WRITE), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    const to = req.body?.status;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
    if (!isProductStatus(to)) return fail(res, { status: 400, code: 'SHOP_INVALID_INPUT', error: 'Unknown status.' });
    const check = checkProductTransition(p.status, to, roleOf(req), note);
    if (!check.ok) {
      return check.code === 'REASON_REQUIRED'
        ? fail(res, { status: 400, code: 'SHOP_NOTE_REQUIRED', error: 'Say what needs to change.' })
        : fail(res, { status: 403, code: 'SHOP_STATUS_NOT_ALLOWED', error: 'You cannot make this change.' });
    }
    if (to === 'PUBLISHED') {
      const missing = missingForPublish(p);
      if (missing.length) {
        return res.status(400).json({ success: false, code: 'SHOP_NOT_READY', error: 'Add the missing fields before publishing.', missing });
      }
    }
    const now = Date.now();
    inTransaction(db, () => {
      db.prepare('UPDATE shop_products SET status = ?, updated_at_ts = ?, updated_by = ? WHERE id = ?').run(to, now, me(req), p.id);
      if (to === 'PUBLISHED') db.prepare('UPDATE shop_products SET published_by = ?, published_at_ts = ?, review_note = NULL WHERE id = ?').run(me(req), now, p.id);
      if (to === 'IN_REVIEW') db.prepare('UPDATE shop_products SET review_note = NULL WHERE id = ?').run(p.id);
      if (p.status === 'IN_REVIEW' && to === 'DRAFT') db.prepare('UPDATE shop_products SET review_note = ? WHERE id = ?').run(note, p.id);
    });
    audit(req, 'shop.product_status', 'shop_product', p.id, `${p.product_code}: ${p.status} → ${to}`, { status: p.status }, { status: to, note: note || undefined });
    res.json({ success: true, data: formatProduct(db, getProduct(db, p.id)!) });
  } catch (err) {
    handle(res, err);
  }
});

// POST /api/admin/shop/products/:id/pending/approve | /reject { note }: the publisher's decision
// on a writer's proposed changes to a live product.
shopAdminRouter.post('/products/:id/pending/:decision', requirePermission('shop.publish'), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    const decision = req.params.decision;
    if (decision !== 'approve' && decision !== 'reject') return notFound(res, 'Action');
    if (!p.pending_changes_json) return fail(res, { status: 409, code: 'SHOP_NO_PENDING', error: 'There are no changes waiting for approval.' });
    if (decision === 'approve') {
      const pending = readPending(p);
      if (!pending) return fail(res, { status: 409, code: 'SHOP_PENDING_INVALID', error: 'The proposed changes are no longer valid. Reject them.' });
      inTransaction(db, () => {
        applyProductInput(db, p, pending, me(req));
        clearPending(db, p.id);
        db.prepare('UPDATE shop_products SET review_note = NULL WHERE id = ?').run(p.id);
      });
      audit(req, 'shop.product_approve', 'shop_product', p.id, `Changes approved for ${p.product_code}`, undefined, { fields: Object.keys(pending) });
    } else {
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
      if (!note) return fail(res, { status: 400, code: 'SHOP_NOTE_REQUIRED', error: 'Say why the changes are rejected.' });
      inTransaction(db, () => {
        clearPending(db, p.id);
        db.prepare('UPDATE shop_products SET review_note = ? WHERE id = ?').run(note, p.id);
      });
      audit(req, 'shop.product_reject', 'shop_product', p.id, `Changes rejected for ${p.product_code}`, undefined, { note });
    }
    res.json({ success: true, data: formatProduct(db, getProduct(db, p.id)!) });
  } catch (err) {
    handle(res, err);
  }
});

// DELETE /api/admin/shop/products/:id: only a draft or a product in review that was never ordered.
// Its picture links go with it; the pictures stay in the library.
shopAdminRouter.delete('/products/:id', requirePermission(...WRITE), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    if (p.status !== 'DRAFT' && p.status !== 'IN_REVIEW') {
      return fail(res, { status: 409, code: 'SHOP_PRODUCT_NOT_DRAFT', error: 'Only drafts can be deleted. Archive this product instead.' });
    }
    if (db.prepare('SELECT 1 FROM shop_order_items WHERE product_id = ?').get(p.id)) {
      return fail(res, { status: 409, code: 'SHOP_PRODUCT_ORDERED', error: 'This product has orders. Archive it instead.' });
    }
    inTransaction(db, () => {
      db.prepare('DELETE FROM shop_product_images WHERE product_id = ?').run(p.id);
      db.prepare('DELETE FROM shop_product_categories WHERE product_id = ?').run(p.id);
      db.prepare('DELETE FROM shop_stock_moves WHERE product_id = ?').run(p.id);
      db.prepare('DELETE FROM shop_products WHERE id = ?').run(p.id);
    });
    audit(req, 'shop.product_delete', 'shop_product', p.id, `Draft ${p.product_code} deleted`, { productCode: p.product_code, nameEn: p.name_en }, undefined);
    res.json({ success: true });
  } catch (err) {
    handle(res, err);
  }
});

// ---- Stock ----

// POST /api/admin/shop/products/:id/stock: { mode: 'set' | 'add', quantity, reason, note? }.
// Applies at once on any product (stock must match the shelf) and records a stock move.
shopAdminRouter.post('/products/:id/stock', requirePermission('shop.stock'), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    const { mode, quantity, reason } = req.body ?? {};
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
    if (mode !== 'set' && mode !== 'add') return fail(res, { status: 400, code: 'SHOP_INVALID_INPUT', error: 'Choose a new quantity or an amount to add or remove.' });
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || Math.abs(quantity) > STOCK_MAX) {
      return fail(res, { status: 400, code: 'SHOP_INVALID_INPUT', error: 'Enter a whole number.', field: 'quantity' });
    }
    if (!(STOCK_ADJUST_REASONS as readonly string[]).includes(reason)) return fail(res, { status: 400, code: 'SHOP_INVALID_INPUT', error: 'Choose a reason.', field: 'reason' });
    if (reason === 'OTHER' && !note) return fail(res, { status: 400, code: 'SHOP_NOTE_REQUIRED', error: 'Add a note for "Other".', field: 'note' });

    const now = Date.now();
    const result = inTransaction(db, () => {
      const current = getProduct(db, p.id)!.stock_qty;
      const next = mode === 'set' ? quantity : current + quantity;
      if (next < 0 || next > STOCK_MAX) throw new ShopError(400, 'SHOP_STOCK_NEGATIVE', `Stock cannot go below 0 (there are ${current}).`, 'quantity');
      const delta = next - current;
      if (delta === 0) throw new ShopError(400, 'SHOP_STOCK_UNCHANGED', 'The stock is already at this quantity.', 'quantity');
      db.prepare('UPDATE shop_products SET stock_qty = ?, updated_at_ts = ?, updated_by = ? WHERE id = ?').run(next, now, me(req), p.id);
      db.prepare(`
        INSERT INTO shop_stock_moves (id, product_id, delta, reason, order_id, note, user_id, stock_after, at_ts)
        VALUES (?, ?, ?, 'ADJUST', NULL, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), p.id, delta, `${reason}${note ? `: ${note}` : ''}`, me(req), next, now);
      return { before: current, after: next };
    });
    audit(req, 'shop.stock_adjust', 'shop_product', p.id, `${p.product_code} stock ${result.before} → ${result.after} (${reason})`,
      { stockQty: result.before }, { stockQty: result.after, reason, note: note || undefined });
    res.json({ success: true, data: formatProduct(db, getProduct(db, p.id)!) });
  } catch (err) {
    handle(res, err);
  }
});

// GET /api/admin/shop/products/:id/stock-moves: the product's stock history, newest first.
shopAdminRouter.get('/products/:id/stock-moves', requirePermission(...READ), (req: Request, res: Response) => {
  try {
    const p = getProduct(db, req.params.id as string);
    if (!p) return notFound(res);
    const rows = db.prepare(`
      SELECT m.*, u.display_name AS user_name, o.order_number FROM shop_stock_moves m
      LEFT JOIN users u ON u.id = m.user_id LEFT JOIN shop_orders o ON o.id = m.order_id
      WHERE m.product_id = ? ORDER BY m.at_ts DESC, m.rowid DESC LIMIT 200
    `).all(p.id) as { id: string; delta: number; reason: string; note: string | null; user_name: string | null; order_number: string | null; stock_after: number; at_ts: number }[];
    res.json({
      success: true,
      data: rows.map((r) => ({ id: r.id, delta: r.delta, reason: r.reason, note: r.note, by: r.user_name, orderNumber: r.order_number, stockAfter: r.stock_after, at: r.at_ts })),
    });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Categories ----

const getCategory = (id: string) => db.prepare('SELECT * FROM shop_categories WHERE id = ?').get(id) as CategoryRow | undefined;

shopAdminRouter.get('/categories', requirePermission(...READ), (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM shop_categories ORDER BY sort_order, name_en').all() as unknown as CategoryRow[];
    res.json({ success: true, data: rows.map((c) => formatCategory(db, c)) });
  } catch (err) {
    serverError(res, err);
  }
});

shopAdminRouter.post('/categories', requirePermission('shop.categories'), (req: Request, res: Response) => {
  try {
    const input = readCategoryInput(req.body, true);
    const row = inTransaction(db, () => createCategory(db, input, me(req)));
    audit(req, 'shop.category_create', 'shop_category', row.id, `Category "${row.name_en}" created`, undefined, { nameEn: row.name_en, nameFr: row.name_fr });
    res.status(201).json({ success: true, data: formatCategory(db, row) });
  } catch (err) {
    handle(res, err);
  }
});

shopAdminRouter.put('/categories/:id', requirePermission('shop.categories'), (req: Request, res: Response) => {
  try {
    const row = getCategory(req.params.id as string);
    if (!row) return notFound(res, 'Category');
    const input = readCategoryInput(req.body, false);
    const after = inTransaction(db, () => updateCategory(db, row, input, me(req)));
    audit(req, 'shop.category_update', 'shop_category', row.id, `Category "${after.name_en}" updated`,
      { nameEn: row.name_en, isVisible: row.is_visible === 1 }, { fields: Object.keys(input), nameEn: after.name_en, isVisible: after.is_visible === 1 });
    res.json({ success: true, data: formatCategory(db, after) });
  } catch (err) {
    handle(res, err);
  }
});

// PUT /api/admin/shop/categories-order: { ids: [...] } → sort order 1, 2, 3… in that order.
shopAdminRouter.put('/categories-order', requirePermission('shop.categories'), (req: Request, res: Response) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length > 500 || !ids.every((id) => typeof id === 'string')) {
      return fail(res, { status: 400, code: 'SHOP_INVALID_INPUT', error: 'The order is not valid.' });
    }
    inTransaction(db, () => {
      const set = db.prepare('UPDATE shop_categories SET sort_order = ? WHERE id = ?');
      ids.forEach((id: string, i: number) => set.run(i + 1, id));
    });
    audit(req, 'shop.category_order', 'shop_category', null, 'Shop categories reordered', undefined, { count: ids.length });
    res.json({ success: true });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/admin/shop/categories/:id: refused while products or sub-categories use it.
shopAdminRouter.delete('/categories/:id', requirePermission('shop.categories'), (req: Request, res: Response) => {
  try {
    const row = getCategory(req.params.id as string);
    if (!row) return notFound(res, 'Category');
    const products = (db.prepare('SELECT COUNT(*) AS n FROM shop_product_categories WHERE category_id = ?').get(row.id) as { n: number }).n;
    if (products > 0) {
      return res.status(409).json({ success: false, code: 'SHOP_CATEGORY_IN_USE', error: `This category has ${products} products. Move them to another category before deleting it.`, products });
    }
    if (db.prepare('SELECT 1 FROM shop_categories WHERE parent_id = ?').get(row.id)) {
      return fail(res, { status: 409, code: 'SHOP_CATEGORY_HAS_CHILDREN', error: 'Move or delete its sub-categories first.' });
    }
    db.prepare('DELETE FROM shop_categories WHERE id = ?').run(row.id);
    audit(req, 'shop.category_delete', 'shop_category', row.id, `Category "${row.name_en}" deleted`, { nameEn: row.name_en }, undefined);
    res.json({ success: true });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Orders (M.7, SHOP_SPEC §7.6, §10, §11, §13) ----
// Customer details are only ever sent to orders.view. Status, fee and dispatch need orders.manage
// (Send to dispatch also dispatch.manage); payments and refunds need orders.payment.

/** Turns an OrderError into its response; anything else is a server error. */
function handleOrder(res: Response, err: unknown) {
  if (err instanceof OrderError) return fail(res, { status: err.status, code: err.code, error: err.message, field: err.field });
  return serverError(res, err);
}
const orderBody = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
const noStore = (res: Response) => res.set('Cache-Control', 'no-store');
const orderOut = (res: Response, id: string) => {
  noStore(res);
  res.json({ success: true, data: orderDetail(db, loadOrder(db, id)!) });
};

// GET /api/admin/shop/orders?tab=NEW|CONFIRMED|READY|OUT_FOR_DELIVERY|COMPLETED|CLOSED|ALL&q=
shopAdminRouter.get('/orders', requirePermission('orders.view'), (req: Request, res: Response) => {
  try {
    const { data, counts } = listOrders(db, { tab: req.query.tab, q: req.query.q });
    noStore(res);
    res.json({ success: true, data, counts });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/admin/shop/orders-summary: badge, bell and dashboard numbers (no customer data).
shopAdminRouter.get('/orders-summary', requirePermission('orders.view'), (_req: Request, res: Response) => {
  try {
    noStore(res);
    res.json({ success: true, data: ordersSummary(db) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/admin/shop/orders/:id (an id, or an order number from the staff alert email)
shopAdminRouter.get('/orders/:id', requirePermission('orders.view'), (req: Request, res: Response) => {
  try {
    const o = findOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    orderOut(res, o.id);
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/shop/orders/:id/status { status, reason?, putBackInStock? }
shopAdminRouter.post('/orders/:id/status', requirePermission('orders.manage'), (req: Request, res: Response) => {
  try {
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    changeOrderStatus(db, req, o, orderBody(req), me(req));
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// POST /api/admin/shop/orders/:id/fee { fee }
shopAdminRouter.post('/orders/:id/fee', requirePermission('orders.manage'), (req: Request, res: Response) => {
  try {
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    setDeliveryFee(db, req, o, orderBody(req), me(req));
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// POST /api/admin/shop/orders/:id/payment { method, amount, reference? }
shopAdminRouter.post('/orders/:id/payment', requirePermission('orders.payment'), (req: Request, res: Response) => {
  try {
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    recordPayment(db, req, o, orderBody(req), me(req));
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// POST /api/admin/shop/orders/:id/unpaid { reason }
shopAdminRouter.post('/orders/:id/unpaid', requirePermission('orders.payment'), (req: Request, res: Response) => {
  try {
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    markUnpaid(db, req, o, orderBody(req), me(req));
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// POST /api/admin/shop/orders/:id/refund { method, amount, reference?, reason }
shopAdminRouter.post('/orders/:id/refund', requirePermission('orders.payment'), (req: Request, res: Response) => {
  try {
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    recordRefund(db, req, o, orderBody(req), me(req));
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// POST /api/admin/shop/orders/:id/notes { note }: internal, never shown to the customer.
shopAdminRouter.post('/orders/:id/notes', requirePermission('orders.manage', 'orders.payment'), (req: Request, res: Response) => {
  try {
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    addOrderNote(db, req, o, orderBody(req), me(req));
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// POST /api/admin/shop/orders/:id/dispatch { sizeClass?, weightKg? }: creates the delivery job.
shopAdminRouter.post('/orders/:id/dispatch', requirePermission('orders.manage'), (req: Request, res: Response) => {
  try {
    if (!requestHasPermission(req, 'dispatch.manage')) {
      return fail(res, { status: 403, code: 'FORBIDDEN', error: 'Sending to dispatch also needs the dispatch permission (dispatch.manage).' });
    }
    const o = loadOrder(db, req.params.id as string);
    if (!o) return notFound(res, 'Order');
    const auth = getRequestAuth(req)!;
    sendToDispatch(db, req, o, orderBody(req), { userId: auth.user.id, name: auth.user.displayName });
    orderOut(res, o.id);
  } catch (err) {
    handleOrder(res, err);
  }
});

// ---- Shop settings (M.7, SHOP_SPEC §7.7) ----

shopAdminRouter.get('/settings', requirePermission('shop.settings'), (_req: Request, res: Response) => {
  try {
    noStore(res);
    res.json({ success: true, data: settingsView(db) });
  } catch (err) {
    serverError(res, err);
  }
});

shopAdminRouter.put('/settings', requirePermission('shop.settings'), (req: Request, res: Response) => {
  try {
    saveSettings(db, req, orderBody(req));
    noStore(res);
    res.json({ success: true, data: settingsView(db) });
  } catch (err) {
    handleOrder(res, err);
  }
});

shopAdminRouter.post('/settings/test-email', requirePermission('shop.settings'), (req: Request, res: Response) => {
  try {
    sendSettingsTestEmail(db, req);
    res.json({ success: true });
  } catch (err) {
    handleOrder(res, err);
  }
});
