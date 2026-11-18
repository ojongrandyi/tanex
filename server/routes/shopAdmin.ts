// Console shop API (docs/SHOP_SPEC.md §7, §14), mounted at /api/admin/shop. Every route checks a
// Shop permission on the server. M.2: picture upload and delete; products, categories and orders
// join in M.3 and M.7.
import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth } from '../auth/permissions.js';
import { audit } from '../audit.js';
import { serverError } from '../errors.js';
import { deleteUpload } from '../uploads.js';
import {
  checkShopImageFiles, formatShopMedia, shopMediaFiles, shopMediaUsage, storeShopMedia, type ShopMediaRow,
} from '../shop/media.js';

export const shopAdminRouter = Router();

type Fail = { status: number; code: string; error: string };
const fail = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error });
const me = (req: Request) => getRequestAuth(req)!.user.id;

// Product pictures are added by product writers; category pictures by category managers.
const MEDIA_ACCESS = ['shop.write', 'shop.categories'] as const;

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
