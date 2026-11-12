// Blog data helpers shared by the console routes (server/routes/blog.ts) and the public API
// (server/routes/publicBlog.ts): slugs, who may see what, scheduled publishing, row formatting.
// Functions take the connection so tests can use their own database (docs/BLOG_SPEC.md §3, §5).
import type { DatabaseSync } from 'node:sqlite';
import { buildPath } from '../../src/router/routes.js';
import { BLOG_MEDIA_PREFIX, type MediaLookup } from './render.js';

export const BLOG_LOCALES = ['en', 'fr'] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];
export const POST_STATUSES = ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const PUBLIC_PAGE_SIZE = 12;
export const MAX_SLUG_LENGTH = 80;
export const SCHEDULER_INTERVAL_MS = 60_000;

export function isBlogLocale(value: unknown): value is BlogLocale {
  return value === 'en' || value === 'fr';
}

export function isPostStatus(value: unknown): value is PostStatus {
  return (POST_STATUSES as readonly unknown[]).includes(value);
}

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

/** True when the slug is used by another post in the locale. */
export function slugTaken(conn: DatabaseSync, locale: string, slug: string, exceptPostId?: string): boolean {
  const row = conn.prepare('SELECT id FROM blog_posts WHERE locale = ? AND slug = ?').get(locale, slug) as { id: string } | undefined;
  return !!row && row.id !== exceptPostId;
}

/** The slug itself, or the slug with -2, -3, … when another post in the locale has it. */
export function uniqueSlug(conn: DatabaseSync, locale: string, base: string, exceptPostId?: string): string {
  const root = base || 'post';
  if (!slugTaken(conn, locale, root, exceptPostId)) return root;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = root.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, '') + suffix;
    if (!slugTaken(conn, locale, candidate, exceptPostId)) return candidate;
  }
}

/**
 * SQL condition for a post visitors may see: PUBLISHED, or SCHEDULED whose time has come
 * (BLOG_SPEC §3). Takes one parameter: now (epoch ms).
 */
export const PUBLIC_CONDITION = `(p.status = 'PUBLISHED' OR (p.status = 'SCHEDULED' AND p.published_at_ts <= ?))`;

export function isPublicRow(row: { status: string; published_at_ts: number | null }, now = Date.now()): boolean {
  return row.status === 'PUBLISHED' || (row.status === 'SCHEDULED' && row.published_at_ts !== null && row.published_at_ts <= now);
}

/** Flips scheduled posts whose time has come to PUBLISHED. Returns how many changed. */
export function publishDuePosts(conn: DatabaseSync, now = Date.now()): number {
  const result = conn.prepare(`
    UPDATE blog_posts SET status = 'PUBLISHED', updated_at_ts = ?
    WHERE status = 'SCHEDULED' AND published_at_ts IS NOT NULL AND published_at_ts <= ?
  `).run(now, now);
  return Number(result.changes);
}

/** Runs publishDuePosts every minute (BLOG_SPEC §3); reads also check the time themselves. */
export function startBlogScheduler(conn: DatabaseSync): NodeJS.Timeout {
  const tick = () => {
    try {
      const n = publishDuePosts(conn);
      if (n > 0) console.log(`[blog] ${n} scheduled post(s) published`);
    } catch (err) {
      console.error('[blog] scheduled publishing failed:', err);
    }
  };
  tick();
  const timer = setInterval(tick, SCHEDULER_INTERVAL_MS);
  timer.unref();
  return timer;
}

/**
 * Public page of a post: /blog/<slug> or /fr/blog/<slug>. Built from the blog route's base path;
 * the route table only starts matching post paths when the pages exist (task F.3).
 */
export function postPath(locale: string, slug: string): string {
  const base = buildPath('blog', undefined, locale === 'fr' ? 'fr' : 'en').replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(slug)}`;
}

/** Tags from a comma list or an array: trimmed, no duplicates, up to 10 of up to 40 characters. */
export function cleanTags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const tag = item.replace(/[,\s]+/g, ' ').trim().slice(0, 40);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length === 10) break;
  }
  return out;
}

export function splitTags(value: string | null): string[] {
  return value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

// ---- Media ----

export interface MediaRow {
  id: string; file_name: string; width: number | null; height: number | null; size_bytes: number | null;
  alt: string | null; uploaded_by: string; created_at_ts: number;
  small_file_name: string | null; small_width: number | null; small_height: number | null;
}

export function mediaUrl(fileName: string): string {
  return BLOG_MEDIA_PREFIX + fileName;
}

/** width/height/srcset data for images in a post body, from blog_media. */
export function mediaLookup(conn: DatabaseSync): MediaLookup {
  const stmt = conn.prepare('SELECT width, height, small_file_name, small_width FROM blog_media WHERE file_name = ?');
  return (fileName) => {
    const row = stmt.get(fileName) as Pick<MediaRow, 'width' | 'height' | 'small_file_name' | 'small_width'> | undefined;
    return row ? { width: row.width, height: row.height, smallFileName: row.small_file_name, smallWidth: row.small_width } : null;
  };
}

export function formatMedia(row: MediaRow) {
  return {
    id: row.id,
    url: mediaUrl(row.file_name),
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    alt: row.alt ?? '',
    small: row.small_file_name ? { url: mediaUrl(row.small_file_name), width: row.small_width, height: row.small_height } : null,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at_ts
  };
}

/** Cover image as the public pages need it, or null. */
export function coverOf(conn: DatabaseSync, mediaId: string | null, alt: string | null) {
  if (!mediaId) return null;
  const row = conn.prepare('SELECT * FROM blog_media WHERE id = ?').get(mediaId) as MediaRow | undefined;
  if (!row) return null;
  return {
    url: mediaUrl(row.file_name),
    smallUrl: row.small_file_name ? mediaUrl(row.small_file_name) : null,
    smallWidth: row.small_width,
    width: row.width,
    height: row.height,
    alt: alt ?? ''
  };
}

// ---- Posts ----

export interface PostRow {
  id: string; locale: string; translation_group_id: string; slug: string; title: string; excerpt: string;
  content_json: string; content_html: string; cover_media_id: string | null; cover_alt: string | null;
  author_user_id: string; status: string; published_at_ts: number | null;
  seo_title: string | null; seo_description: string | null; tags: string | null; reading_minutes: number;
  created_at_ts: number; updated_at_ts: number; updated_by: string | null;
}

export function getPost(conn: DatabaseSync, id: string): PostRow | undefined {
  return conn.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as PostRow | undefined;
}

export interface CategoryRow {
  id: string; locale: string; slug: string; name: string; description: string | null;
  translation_group_id: string; sort_order: number;
}

export function postCategories(conn: DatabaseSync, postId: string): CategoryRow[] {
  return conn.prepare(`
    SELECT c.* FROM blog_post_categories pc JOIN blog_categories c ON c.id = pc.category_id
    WHERE pc.post_id = ? ORDER BY c.sort_order, c.name
  `).all(postId) as unknown as CategoryRow[];
}

export function setPostCategories(conn: DatabaseSync, postId: string, categoryIds: string[]): void {
  conn.prepare('DELETE FROM blog_post_categories WHERE post_id = ?').run(postId);
  const insert = conn.prepare('INSERT OR IGNORE INTO blog_post_categories (post_id, category_id) VALUES (?, ?)');
  for (const id of categoryIds) insert.run(postId, id);
}

export function userName(conn: DatabaseSync, userId: string | null): string | null {
  if (!userId) return null;
  const row = conn.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string } | undefined;
  return row?.display_name ?? null;
}

/**
 * Remembers the old slug of a post that has been live, so links to it keep working (301), and
 * frees the new slug from any redirect that pointed elsewhere (a live post always wins).
 */
export function recordSlugChange(conn: DatabaseSync, post: PostRow, newSlug: string, now = Date.now()): void {
  conn.prepare('DELETE FROM blog_slug_redirects WHERE locale = ? AND old_slug = ?').run(post.locale, newSlug);
  // published_at_ts in the past = the post has been public (it is kept on unpublish/archive).
  const hasBeenLive = post.published_at_ts !== null && post.published_at_ts <= now;
  if (post.slug !== newSlug && hasBeenLive) {
    conn.prepare(`
      INSERT OR REPLACE INTO blog_slug_redirects (locale, old_slug, post_id, created_at_ts) VALUES (?, ?, ?, ?)
    `).run(post.locale, post.slug, post.id, now);
  }
}

/** The current slug for an old one, when the post it points to is public; else null. */
export function resolveSlugRedirect(conn: DatabaseSync, locale: string, oldSlug: string, now = Date.now()): string | null {
  const row = conn.prepare(`
    SELECT p.slug AS slug FROM blog_slug_redirects r JOIN blog_posts p ON p.id = r.post_id
    WHERE r.locale = ? AND r.old_slug = ? AND p.locale = r.locale AND ${PUBLIC_CONDITION}
  `).get(locale, oldSlug, now) as { slug: string } | undefined;
  return row && row.slug !== oldSlug ? row.slug : null;
}
