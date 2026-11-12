// Blog slug rules, shared by the server (server/blog/posts.ts) and the Blog studio, so the slug the
// studio suggests is the one the server would make. DOM-free.
export const MAX_SLUG_LENGTH = 80;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lower-case ASCII with hyphens, from any title ("Expédier à Douala" → "expedier-a-douala"). */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
}

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && SLUG_RE.test(value);
}
