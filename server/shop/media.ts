// Shop picture files (docs/SHOP_SPEC.md §6). The browser makes the five square files (crop step);
// this module checks each one by its bytes and pixel size, so only the exact sizes in
// src/shared/shopImages.ts are ever stored. Nothing is resized here (no image library on the server).
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { decodeImageUpload, deleteUpload, writeImageUpload, type ImageType } from '../uploads.js';
import { readImageSize } from '../imageSize.js';
import { SHOP_IMAGE_SLOTS, SHOP_IMAGE_SLOT_KEYS, type ShopImageSlotKey } from '../../src/shared/shopImages.js';

export interface ShopMediaRow {
  id: string;
  file_1200: string;
  file_600: string;
  file_300: string;
  jpg_1200: string;
  jpg_600: string;
  bytes_total: number;
  uploaded_by: string;
  created_at_ts: number;
}

/** slot → shop_media column. */
const COLUMNS: Record<ShopImageSlotKey, keyof ShopMediaRow> = {
  w1200: 'file_1200', w600: 'file_600', w300: 'file_300', j1200: 'jpg_1200', j600: 'jpg_600',
};

export type CheckedFiles =
  | { ok: true; files: Record<ShopImageSlotKey, { buffer: Buffer; type: ImageType }> }
  | { ok: false; slot: ShopImageSlotKey | null; error: string };

/** Checks all five files: present, real WebP/JPEG as the slot allows, exact square size, under the cap. */
export function checkShopImageFiles(input: unknown): CheckedFiles {
  if (!input || typeof input !== 'object') return { ok: false, slot: null, error: 'The picture files are missing.' };
  const body = input as Record<string, unknown>;
  const files = {} as Record<ShopImageSlotKey, { buffer: Buffer; type: ImageType }>;
  for (const key of SHOP_IMAGE_SLOT_KEYS) {
    const slot = SHOP_IMAGE_SLOTS[key];
    const decoded = decodeImageUpload(body[key], slot.maxBytes, slot.formats as readonly ImageType[]);
    if (!decoded.ok) {
      const error = decoded.error === 'The image is too large.'
        ? `The ${slot.size} px file is too large.`
        : decoded.error.startsWith('Only') ? `The ${slot.size} px file must be ${slot.formats.length > 1 ? 'WebP or JPG' : 'JPG'}.` : decoded.error;
      return { ok: false, slot: key, error };
    }
    const size = readImageSize(decoded.buffer, decoded.type);
    if (!size || size.width !== slot.size || size.height !== slot.size) {
      return { ok: false, slot: key, error: `The ${slot.size} px file must be exactly ${slot.size} × ${slot.size} pixels.` };
    }
    files[key] = { buffer: decoded.buffer, type: decoded.type };
  }
  return { ok: true, files };
}

/**
 * Writes checked files and their shop_media row. If anything fails after a file was written, the
 * files written so far are removed, so no orphan files are left behind.
 */
export function storeShopMedia(
  conn: DatabaseSync,
  files: Record<ShopImageSlotKey, { buffer: Buffer; type: ImageType }>,
  userId: string,
  now: number = Date.now(),
): ShopMediaRow {
  const written: string[] = [];
  try {
    const names = {} as Record<ShopImageSlotKey, string>;
    let bytes = 0;
    for (const key of SHOP_IMAGE_SLOT_KEYS) {
      const saved = writeImageUpload('shop', files[key].buffer, files[key].type);
      written.push(saved.fileName);
      names[key] = saved.fileName;
      bytes += saved.sizeBytes;
    }
    const id = crypto.randomUUID();
    conn.prepare(`
      INSERT INTO shop_media (id, file_1200, file_600, file_300, jpg_1200, jpg_600, bytes_total, uploaded_by, created_at_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, names.w1200, names.w600, names.w300, names.j1200, names.j600, bytes, userId, now);
    return conn.prepare('SELECT * FROM shop_media WHERE id = ?').get(id) as unknown as ShopMediaRow;
  } catch (err) {
    for (const f of written) deleteUpload('shop', f);
    throw err;
  }
}

/** Every file name of a picture. */
export function shopMediaFiles(row: ShopMediaRow): string[] {
  return SHOP_IMAGE_SLOT_KEYS.map((k) => row[COLUMNS[k]] as string);
}

export const shopMediaUrl = (fileName: string) => `/media/shop/${fileName}`;

/** The API shape: one URL per slot, ready for <picture> srcset. */
export function formatShopMedia(row: ShopMediaRow) {
  const urls = {} as Record<ShopImageSlotKey, string>;
  for (const k of SHOP_IMAGE_SLOT_KEYS) urls[k] = shopMediaUrl(row[COLUMNS[k]] as string);
  return { id: row.id, urls, bytesTotal: row.bytes_total, createdAt: row.created_at_ts };
}

/** Products and categories that use this picture. */
export function shopMediaUsage(conn: DatabaseSync, mediaId: string): number {
  const a = conn.prepare('SELECT COUNT(*) AS c FROM shop_product_images WHERE media_id = ?').get(mediaId) as { c: number };
  const b = conn.prepare('SELECT COUNT(*) AS c FROM shop_categories WHERE image_media_id = ?').get(mediaId) as { c: number };
  return a.c + b.c;
}

/** True when the file belongs to a stored shop picture (the public /media/shop route serves only these). */
export function isShopMediaFile(conn: DatabaseSync, fileName: string): boolean {
  return !!conn.prepare(`
    SELECT 1 FROM shop_media WHERE file_1200 = ? OR file_600 = ? OR file_300 = ? OR jpg_1200 = ? OR jpg_600 = ?
  `).get(fileName, fileName, fileName, fileName, fileName);
}
