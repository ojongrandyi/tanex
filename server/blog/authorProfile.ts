// Staff author profile (tracker F.2; IAM_RBAC_SPEC §9 "My account"): job title, short bio and a
// profile photo, shown with a blog author's name on the public site. Each user edits only their
// own (PATCH /api/auth/me, POST/DELETE /api/auth/me/avatar). Photos are compressed in the browser
// and checked again here: JPEG/PNG/WebP by content, ≤ 1 MB, ≤ 1024 px a side; stored under
// UPLOADS_DIR/avatars with a random name and served at /media/avatars/<file> only while a user
// has that file as their photo.
import { decodeImageUpload, type ImageType } from '../uploads.js';
import { readImageSize } from '../imageSize.js';

export const JOB_TITLE_MAX = 80;
export const BIO_MAX = 500;
export const MAX_AVATAR_BYTES = 1024 * 1024;
export const MAX_AVATAR_SIDE = 1024;
const AVATAR_TYPES: readonly ImageType[] = ['webp', 'jpeg', 'png'];
export const AVATAR_PREFIX = '/media/avatars/';

export function avatarUrl(fileName: string | null | undefined): string | null {
  return fileName ? AVATAR_PREFIX + fileName : null;
}

/** One line of text: spaces collapsed, trimmed; empty = cleared (null). undefined when not a string. */
export function profileLine(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const t = value.replace(/\s+/g, ' ').trim();
  if (t.length > max) return undefined;
  return t || null;
}

/** The bio keeps single line breaks (paragraphs), nothing else. */
export function profileBio(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const t = value
    .replace(/\r\n?/g, '\n')
    .split('\n').map((line) => line.replace(/[^\S\n]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (t.length > BIO_MAX) return undefined;
  return t || null;
}

export type CheckedAvatar = { ok: true; buffer: Buffer; type: ImageType } | { ok: false; error: string };

export function checkAvatar(input: unknown): CheckedAvatar {
  const decoded = decodeImageUpload(input, MAX_AVATAR_BYTES, AVATAR_TYPES);
  if (!decoded.ok) return { ok: false, error: decoded.error };
  const size = readImageSize(decoded.buffer, decoded.type);
  if (!size) return { ok: false, error: 'The image could not be read.' };
  if (size.width > MAX_AVATAR_SIDE || size.height > MAX_AVATAR_SIDE) {
    return { ok: false, error: `Photos can be up to ${MAX_AVATAR_SIDE} px on each side.` };
  }
  return { ok: true, buffer: decoded.buffer, type: decoded.type };
}
