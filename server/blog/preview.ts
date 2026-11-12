// Signed, short-lived preview links for blog posts (docs/BLOG_SPEC.md §4). The studio asks for a
// token for one post; anyone holding it can read that post's current version, whatever its status,
// until the token expires. The token is `<post id>.<expiry ms>.<HMAC>`; nothing is stored, so a
// token can't be revoked early, which is why it lives only PREVIEW_TTL_MS. The key is derived from
// the session secret (setPreviewSecret, called on start), or random per process when none is set
// (tests), so tokens then stop working after a restart.
import crypto from 'crypto';

export const PREVIEW_TTL_MS = 30 * 60 * 1000;
const TOKEN_SHAPE = /^(post_[0-9a-f]{20})\.(\d{13})\.([A-Za-z0-9_-]{43})$/;

let key: Buffer = crypto.randomBytes(32);

/** Derives the signing key from the server's session secret (its own key, never the secret itself). */
export function setPreviewSecret(secret: string): void {
  key = crypto.createHmac('sha256', secret).update('tanex-blog-preview-v1').digest();
}

function sign(postId: string, expiresAt: number): string {
  return crypto.createHmac('sha256', key).update(`${postId}.${expiresAt}`).digest('base64url');
}

export function createPreviewToken(postId: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + PREVIEW_TTL_MS;
  return { token: `${postId}.${expiresAt}.${sign(postId, expiresAt)}`, expiresAt };
}

/** The post id a valid, unexpired token names, or null. */
export function readPreviewToken(token: unknown, now = Date.now()): string | null {
  if (typeof token !== 'string' || token.length > 120) return null;
  const m = TOKEN_SHAPE.exec(token);
  if (!m) return null;
  const [, postId, exp, mac] = m;
  const expiresAt = Number(exp);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + PREVIEW_TTL_MS) return null;
  const expected = Buffer.from(sign(postId, expiresAt));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return postId;
}
