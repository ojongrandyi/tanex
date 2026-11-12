import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Uploaded files (package images, payment-proof screenshots) live on disk, not in SQLite
// (docs/update.md §3). UPLOADS_DIR must be a persistent folder OUTSIDE the deploy directory,
// for the same reason as DB_PATH (see server/db.ts): a git-based redeploy wipes untracked
// files. When unset it sits next to the database: data/uploads in dev, or beside DB_PATH.
// Computed here rather than imported from db.ts so this module has no side effects on import.
export const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR
    || path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(process.cwd(), 'data'), 'uploads')
);

export type UploadFolder = 'images' | 'proofs' | 'blog' | 'avatars';

// images/: package photos, served publicly via /media when marked visible.
// proofs/: payment screenshots, private, only ever served through an admin-only route.
// blog/: blog images (BLOG_SPEC §4), served publicly via /media/blog/.
// avatars/: staff profile photos (blog authors, IAM_RBAC_SPEC §9), served publicly via /media/avatars/.
export const uploadFolders: Record<UploadFolder, string> = {
  images: path.join(uploadsDir, 'images'),
  proofs: path.join(uploadsDir, 'proofs'),
  blog: path.join(uploadsDir, 'blog'),
  avatars: path.join(uploadsDir, 'avatars'),
};

export function ensureUploadDirs() {
  for (const dir of Object.values(uploadFolders)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---- Upload validation (base64-in-JSON, like the signature/stamp uploads in Settings) ----

export type ImageType = 'webp' | 'jpeg' | 'png' | 'avif';

const EXTENSIONS: Record<ImageType, string> = { webp: 'webp', jpeg: 'jpg', png: 'png', avif: 'avif' };

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', avif: 'image/avif',
};

/** Types accepted unless a caller allows more (package photos, payment proofs). */
export const DEFAULT_IMAGE_TYPES: readonly ImageType[] = ['webp', 'jpeg', 'png'];

// Images are compressed in the browser first (src/services/imageCompress.ts), so a real upload
// is well under this; the cap only stops oversized or hand-crafted requests.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Stored names are always `<uuid>.<ext>` generated here, never anything the client sent.
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|avif)$/;

/** Identifies an image by its content (magic bytes), ignoring any declared type or file name. */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (buf.length >= 12
    && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 // "RIFF"
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) { // "WEBP"
    return 'webp';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8
    && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return 'png';
  }
  // ISO BMFF: an "ftyp" box whose major brand is avif (still image) or avis (sequence).
  if (buf.length >= 12
    && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) { // "ftyp"
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  return null;
}

export type DecodedImage = { ok: true; buffer: Buffer; type: ImageType } | { ok: false; error: string };

/**
 * Accepts plain base64 or a `data:` URL; returns the bytes only if they really are one of the
 * allowed types (WebP/JPEG/PNG unless the caller also allows AVIF).
 */
export function decodeImageUpload(
  input: unknown,
  maxBytes = MAX_UPLOAD_BYTES,
  allowed: readonly ImageType[] = DEFAULT_IMAGE_TYPES
): DecodedImage {
  if (typeof input !== 'string' || !input) return { ok: false, error: 'An image is required.' };
  const comma = input.startsWith('data:') ? input.indexOf(',') : -1;
  const b64 = (comma >= 0 ? input.slice(comma + 1) : input).replace(/\s/g, '');
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: 'The image data is not valid.' };
  // Checked before decoding, so an oversized body is never expanded in memory.
  if (Math.floor((b64.length * 3) / 4) > maxBytes + 2) return { ok: false, error: 'The image is too large.' };
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0) return { ok: false, error: 'The image data is not valid.' };
  if (buffer.length > maxBytes) return { ok: false, error: 'The image is too large.' };
  const type = detectImageType(buffer);
  if (!type || !allowed.includes(type)) {
    return {
      ok: false,
      error: allowed.includes('avif') ? 'Only JPG, PNG, WebP or AVIF images are accepted.' : 'Only JPG, PNG or WebP images are accepted.'
    };
  }
  return { ok: true, buffer, type };
}

/** Full path of a stored file, or null if the name isn't one this module generated. */
export function resolveUploadPath(folder: UploadFolder, fileName: string): string | null {
  if (typeof fileName !== 'string' || !STORED_NAME.test(fileName)) return null;
  return path.join(uploadFolders[folder], fileName);
}

/** Writes already-validated bytes under a new random name. `id` is the name without extension. */
export function writeImageUpload(folder: UploadFolder, buffer: Buffer, type: ImageType):
  { id: string; fileName: string; sizeBytes: number; type: ImageType } {
  const id = crypto.randomUUID();
  const fileName = `${id}.${EXTENSIONS[type]}`;
  fs.mkdirSync(uploadFolders[folder], { recursive: true });
  // 'wx' never overwrites an existing file.
  fs.writeFileSync(path.join(uploadFolders[folder], fileName), buffer, { flag: 'wx' });
  return { id, fileName, sizeBytes: buffer.length, type };
}

/** Validates and writes an upload under a new random name. `id` is the name without extension. */
export function saveImageUpload(folder: UploadFolder, input: unknown):
  { ok: true; id: string; fileName: string; sizeBytes: number; type: ImageType } | { ok: false; error: string } {
  const decoded = decodeImageUpload(input);
  if (!decoded.ok) return decoded;
  return { ok: true, ...writeImageUpload(folder, decoded.buffer, decoded.type) };
}

/** Removes a stored file; ignores names this module didn't generate and files already gone. */
export function deleteUpload(folder: UploadFolder, fileName: string) {
  const filePath = resolveUploadPath(folder, fileName);
  if (!filePath) return;
  try { fs.unlinkSync(filePath); } catch (e: any) { if (e?.code !== 'ENOENT') throw e; }
}
