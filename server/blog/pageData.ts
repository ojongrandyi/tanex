// Blog pages as the server renders them (BLOG_SPEC §7): what the head of /blog, a category or an
// article says, whether the address is a page at all, and the blog's sitemap entries. The page
// bodies come from the public API on the client; this only reads what <head> needs. Only public
// posts count (PUBLISHED, or SCHEDULED and due), the same rule as the public API.
import type { DatabaseSync } from 'node:sqlite';
import { buildPath, type Lang, type RouteMatch } from '../../src/router/routes.js';
import type { BlogPageData, SitemapEntry } from '../render/pageMeta.js';
import {
  type CategoryRow, type PostRow, PUBLIC_CONDITION, PUBLIC_PAGE_SIZE, coverOf, postCategories, postPath,
  publishDuePosts, resolveSlugRedirect, splitTags,
} from './posts.js';

export type BlogPageResult =
  | { kind: 'page'; blog: BlogPageData }
  | { kind: 'redirect'; location: string }
  | { kind: 'not-found' };

/** ?page=N of a list: a positive integer, else 1. */
export function listPage(value: unknown): number {
  const n = typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : 1;
  return n >= 1 ? n : 1;
}

function publicCount(conn: DatabaseSync, locale: Lang, now: number, categoryId?: string): number {
  const join = categoryId ? 'JOIN blog_post_categories pc ON pc.post_id = p.id AND pc.category_id = ?' : '';
  const params: (string | number)[] = [...(categoryId ? [categoryId] : []), locale, now];
  return (conn.prepare(`SELECT COUNT(*) AS c FROM blog_posts p ${join} WHERE p.locale = ? AND ${PUBLIC_CONDITION}`)
    .get(...params) as { c: number }).c;
}

/** Categories of a translation group that have a public post, by language: path. */
function categoryVersions(conn: DatabaseSync, groupId: string, now: number): Partial<Record<Lang, string>> {
  const rows = conn.prepare(`
    SELECT DISTINCT c.locale, c.slug FROM blog_categories c
    JOIN blog_post_categories pc ON pc.category_id = c.id
    JOIN blog_posts p ON p.id = pc.post_id AND p.locale = c.locale AND ${PUBLIC_CONDITION}
    WHERE c.translation_group_id = ?
  `).all(now, groupId) as { locale: string; slug: string }[];
  const out: Partial<Record<Lang, string>> = {};
  for (const r of rows) {
    if (r.locale === 'en' || r.locale === 'fr') out[r.locale] = buildPath('blog-category', r.slug, r.locale);
  }
  return out;
}

/** Public posts of a translation group, by language: path. */
function postVersions(conn: DatabaseSync, groupId: string, now: number): Partial<Record<Lang, string>> {
  const rows = conn.prepare(`SELECT p.locale, p.slug FROM blog_posts p WHERE p.translation_group_id = ? AND ${PUBLIC_CONDITION}`)
    .all(groupId, now) as { locale: string; slug: string }[];
  const out: Partial<Record<Lang, string>> = {};
  for (const r of rows) {
    if (r.locale === 'en' || r.locale === 'fr') out[r.locale] = postPath(r.locale, r.slug);
  }
  return out;
}

/**
 * The blog page at a matched address. `match.id` is 'blog' (index, or an article with a param)
 * or 'blog-category'. An unknown or unpublished article or an empty category is a 404; an old
 * slug of a public article redirects (301) to its current address.
 */
export function resolveBlogPage(conn: DatabaseSync, match: RouteMatch, query: Record<string, unknown>, now = Date.now()): BlogPageResult {
  const locale = match.lang;
  publishDuePosts(conn, now);
  const page = listPage(query.page);

  if (match.id === 'blog' && match.param === undefined) {
    return { kind: 'page', blog: { type: 'index', hasPosts: publicCount(conn, locale, now) > 0, page } };
  }

  if (match.id === 'blog-category' && match.param !== undefined) {
    const category = conn.prepare('SELECT * FROM blog_categories WHERE locale = ? AND slug = ?')
      .get(locale, match.param) as CategoryRow | undefined;
    if (!category) return { kind: 'not-found' };
    const total = publicCount(conn, locale, now, category.id);
    if (total === 0) return { kind: 'not-found' };
    if (page > Math.ceil(total / PUBLIC_PAGE_SIZE)) return { kind: 'not-found' };
    return {
      kind: 'page',
      blog: {
        type: 'category',
        name: category.name,
        description: category.description ?? '',
        versions: categoryVersions(conn, category.translation_group_id, now),
        page,
      },
    };
  }

  if (match.id === 'blog' && match.param !== undefined) {
    const post = conn.prepare(`SELECT p.* FROM blog_posts p WHERE p.locale = ? AND p.slug = ? AND ${PUBLIC_CONDITION}`)
      .get(locale, match.param, now) as PostRow | undefined;
    if (!post) {
      const current = resolveSlugRedirect(conn, locale, match.param, now);
      return current ? { kind: 'redirect', location: postPath(locale, current) } : { kind: 'not-found' };
    }
    const author = conn.prepare('SELECT display_name, job_title FROM users WHERE id = ?')
      .get(post.author_user_id) as { display_name: string; job_title: string | null } | undefined;
    const cover = coverOf(conn, post.cover_media_id, post.cover_alt);
    const categories = postCategories(conn, post.id);
    return {
      kind: 'page',
      blog: {
        type: 'post',
        post: {
          headline: post.title,
          title: post.seo_title || post.title,
          description: post.seo_description || post.excerpt,
          excerpt: post.excerpt,
          image: cover ? { url: cover.url, width: cover.width, height: cover.height, alt: cover.alt } : null,
          publishedAt: post.published_at_ts ?? post.created_at_ts,
          modifiedAt: post.updated_at_ts,
          author: { name: author?.display_name ?? '', jobTitle: author?.job_title ?? '' },
          section: categories[0]?.name ?? null,
          tags: splitTags(post.tags),
          versions: postVersions(conn, post.translation_group_id, now),
        },
      },
    };
  }
  return { kind: 'not-found' };
}

/**
 * The blog's sitemap entries: each language's index while it has a public post, every category
 * with a public post, every public post, with their language versions and last change.
 */
export function blogSitemapEntries(conn: DatabaseSync, now = Date.now()): SitemapEntry[] {
  publishDuePosts(conn, now);
  const posts = conn.prepare(`SELECT p.* FROM blog_posts p WHERE ${PUBLIC_CONDITION} ORDER BY p.published_at_ts DESC`)
    .all(now) as unknown as PostRow[];
  if (posts.length === 0) return [];

  const entries: SitemapEntry[] = [];
  const index: Partial<Record<Lang, string>> = {};
  let indexLastmod = 0;
  for (const p of posts) {
    if (p.locale !== 'en' && p.locale !== 'fr') continue;
    index[p.locale] = buildPath('blog', undefined, p.locale);
    indexLastmod = Math.max(indexLastmod, p.published_at_ts ?? 0, p.updated_at_ts);
  }
  entries.push({ paths: index, lastmod: indexLastmod });

  const categories = conn.prepare(`
    SELECT c.translation_group_id AS grp, MAX(MAX(p.updated_at_ts), MAX(p.published_at_ts)) AS lastmod
    FROM blog_categories c
    JOIN blog_post_categories pc ON pc.category_id = c.id
    JOIN blog_posts p ON p.id = pc.post_id AND p.locale = c.locale AND ${PUBLIC_CONDITION}
    GROUP BY c.translation_group_id
  `).all(now) as { grp: string; lastmod: number }[];
  for (const c of categories) {
    entries.push({ paths: categoryVersions(conn, c.grp, now), lastmod: c.lastmod });
  }

  const groups = new Set<string>();
  for (const p of posts) {
    if (groups.has(p.translation_group_id)) continue;
    groups.add(p.translation_group_id);
    const versions = postVersions(conn, p.translation_group_id, now);
    const lastmod = Math.max(...posts.filter((q) => q.translation_group_id === p.translation_group_id).map((q) => q.updated_at_ts));
    entries.push({ paths: versions, lastmod });
  }
  return entries;
}
