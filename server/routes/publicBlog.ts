// Public blog API (docs/BLOG_SPEC.md §5), mounted on /api/blog. Only public posts ever leave
// here: PUBLISHED, or SCHEDULED whose time has come. Anything else answers 404, the same as a
// post that doesn't exist. An old slug of a public post answers 301 to its current one.
import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { serverError } from '../errors.js';
import {
  type BlogLocale, type CategoryRow, type PostRow,
  PUBLIC_CONDITION, PUBLIC_PAGE_SIZE, coverOf, getPost, isBlogLocale, isPublicRow, postCategories, postPath,
  publishDuePosts, resolveSlugRedirect, splitTags
} from '../blog/posts.js';
import { readPreviewToken } from '../blog/preview.js';
import { avatarUrl } from '../blog/authorProfile.js';

export const publicBlogRouter = Router();

const MAX_LATEST = 6;
const RELATED = 3;

function badLocale(res: Response) {
  return res.status(400).json({ success: false, code: 'BAD_REQUEST', error: 'Unknown language.' });
}

function notFound(res: Response) {
  return res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Post not found.' });
}

/** locale query: en (default) or fr; anything else is refused. */
function localeOf(value: unknown): BlogLocale | null {
  if (value === undefined || value === '') return 'en';
  return isBlogLocale(value) ? value : null;
}

interface AuthorRow { display_name: string; job_title: string | null; avatar_file: string | null }

function author(userId: string) {
  const row = db.prepare('SELECT display_name, job_title, avatar_file FROM users WHERE id = ?').get(userId) as AuthorRow | undefined;
  return { name: row?.display_name ?? '', jobTitle: row?.job_title ?? '', avatarUrl: avatarUrl(row?.avatar_file ?? null) };
}

/** A card on the index, the homepage or a related list: excerpt and cover only. */
function card(post: PostRow) {
  return {
    locale: post.locale,
    slug: post.slug,
    path: postPath(post.locale, post.slug),
    title: post.title,
    excerpt: post.excerpt,
    cover: coverOf(db, post.cover_media_id, post.cover_alt),
    publishedAt: post.published_at_ts,
    readingMinutes: post.reading_minutes,
    categories: postCategories(db, post.id).map((c) => ({ slug: c.slug, name: c.name })),
    author: { name: author(post.author_user_id).name }
  };
}

function neighbour(post: PostRow | undefined) {
  return post ? { slug: post.slug, path: postPath(post.locale, post.slug), title: post.title } : null;
}

// GET /api/blog?locale=en&category=<slug>&page=1 (12 per page, newest first)
publicBlogRouter.get('/', (req: Request, res: Response) => {
  try {
    const locale = localeOf(req.query.locale);
    if (!locale) return badLocale(res);
    const now = Date.now();
    publishDuePosts(db, now);

    let category: CategoryRow | null = null;
    if (typeof req.query.category === 'string' && req.query.category) {
      category = (db.prepare('SELECT * FROM blog_categories WHERE locale = ? AND slug = ?')
        .get(locale, req.query.category) as CategoryRow | undefined) ?? null;
      if (!category) return res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Category not found.' });
    }
    const join = category ? 'JOIN blog_post_categories pc ON pc.post_id = p.id AND pc.category_id = ?' : '';
    const params: (string | number)[] = [...(category ? [category.id] : []), locale, now];
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM blog_posts p ${join} WHERE p.locale = ? AND ${PUBLIC_CONDITION}`)
      .get(...params) as { c: number }).c;
    const totalPages = Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE));
    const page = Math.max(1, Math.min(10000, Number.parseInt(String(req.query.page ?? '1'), 10) || 1));
    const rows = db.prepare(`
      SELECT p.* FROM blog_posts p ${join} WHERE p.locale = ? AND ${PUBLIC_CONDITION}
      ORDER BY p.published_at_ts DESC, p.id LIMIT ? OFFSET ?
    `).all(...params, PUBLIC_PAGE_SIZE, (page - 1) * PUBLIC_PAGE_SIZE) as unknown as PostRow[];
    res.json({
      success: true,
      data: rows.map(card),
      category: category ? { slug: category.slug, name: category.name, description: category.description ?? '' } : null,
      page, pageSize: PUBLIC_PAGE_SIZE, total, totalPages
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/blog/latest?locale=en&limit=3 (homepage "From the blog"; empty list when none)
publicBlogRouter.get('/latest', (req: Request, res: Response) => {
  try {
    const locale = localeOf(req.query.locale);
    if (!locale) return badLocale(res);
    const limit = Math.max(1, Math.min(MAX_LATEST, Number.parseInt(String(req.query.limit ?? '3'), 10) || 3));
    const now = Date.now();
    publishDuePosts(db, now);
    const rows = db.prepare(`
      SELECT p.* FROM blog_posts p WHERE p.locale = ? AND ${PUBLIC_CONDITION}
      ORDER BY p.published_at_ts DESC, p.id LIMIT ?
    `).all(locale, now, limit) as unknown as PostRow[];
    res.json({ success: true, data: rows.map(card) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/blog/categories?locale=en (categories with at least one public post, for the chips)
publicBlogRouter.get('/categories', (req: Request, res: Response) => {
  try {
    const locale = localeOf(req.query.locale);
    if (!locale) return badLocale(res);
    const now = Date.now();
    const rows = db.prepare(`
      SELECT c.slug, c.name, c.description, COUNT(p.id) AS post_count
      FROM blog_categories c
      JOIN blog_post_categories pc ON pc.category_id = c.id
      JOIN blog_posts p ON p.id = pc.post_id AND ${PUBLIC_CONDITION}
      WHERE c.locale = ?
      GROUP BY c.id ORDER BY c.sort_order, c.name
    `).all(now, locale) as { slug: string; name: string; description: string | null; post_count: number }[];
    res.json({
      success: true,
      data: rows.map((r) => ({ slug: r.slug, name: r.name, description: r.description ?? '', postCount: r.post_count }))
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/blog/preview/:token: the current version of one post, whatever its status, for a
// signed preview link from the studio (server/blog/preview.ts). Never cached or indexed; an
// invalid or expired token is a plain 404. Registered before /:locale/:slug.
publicBlogRouter.get('/preview/:token', (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const postId = readPreviewToken(req.params.token);
    const post = postId ? getPost(db, postId) : undefined;
    if (!post) return notFound(res);
    const a = author(post.author_user_id);
    res.json({
      success: true,
      data: {
        ...card(post),
        status: post.status,
        isPublic: isPublicRow(post),
        contentHtml: post.content_html,
        updatedAt: post.updated_at_ts,
        author: { name: a.name, jobTitle: a.jobTitle, avatarUrl: a.avatarUrl },
        tags: splitTags(post.tags),
        seoTitle: post.seo_title || post.title,
        seoDescription: post.seo_description || post.excerpt
      }
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/blog/:locale/:slug: the full post, previous/next, up to 3 related by category and
// the public translations (for the language switch and hreflang).
publicBlogRouter.get('/:locale/:slug', (req: Request, res: Response) => {
  try {
    const locale = req.params.locale as string;
    const slug = req.params.slug as string;
    if (!isBlogLocale(locale)) return notFound(res);
    const now = Date.now();
    publishDuePosts(db, now);

    const post = db.prepare(`SELECT p.* FROM blog_posts p WHERE p.locale = ? AND p.slug = ? AND ${PUBLIC_CONDITION}`)
      .get(locale, slug, now) as PostRow | undefined;
    if (!post) {
      const current = resolveSlugRedirect(db, locale, slug, now);
      if (current) {
        res.setHeader('Location', `/api/blog/${locale}/${encodeURIComponent(current)}`);
        return res.status(301).json({ success: false, code: 'MOVED', slug: current, path: postPath(locale, current) });
      }
      return notFound(res);
    }

    const ts = post.published_at_ts ?? 0;
    const previous = db.prepare(`
      SELECT p.* FROM blog_posts p WHERE p.locale = ? AND ${PUBLIC_CONDITION} AND p.id <> ?
        AND (p.published_at_ts < ? OR (p.published_at_ts = ? AND p.id < ?))
      ORDER BY p.published_at_ts DESC, p.id DESC LIMIT 1
    `).get(locale, now, post.id, ts, ts, post.id) as PostRow | undefined;
    const next = db.prepare(`
      SELECT p.* FROM blog_posts p WHERE p.locale = ? AND ${PUBLIC_CONDITION} AND p.id <> ?
        AND (p.published_at_ts > ? OR (p.published_at_ts = ? AND p.id > ?))
      ORDER BY p.published_at_ts ASC, p.id ASC LIMIT 1
    `).get(locale, now, post.id, ts, ts, post.id) as PostRow | undefined;
    const related = db.prepare(`
      SELECT p.*, COUNT(*) AS shared FROM blog_posts p
      JOIN blog_post_categories pc ON pc.post_id = p.id
      WHERE pc.category_id IN (SELECT category_id FROM blog_post_categories WHERE post_id = ?)
        AND p.id <> ? AND p.locale = ? AND ${PUBLIC_CONDITION}
      GROUP BY p.id ORDER BY shared DESC, p.published_at_ts DESC LIMIT ?
    `).all(post.id, post.id, locale, now, RELATED) as unknown as PostRow[];
    const translations = db.prepare(`
      SELECT p.locale, p.slug FROM blog_posts p
      WHERE p.translation_group_id = ? AND p.id <> ? AND ${PUBLIC_CONDITION} ORDER BY p.locale
    `).all(post.translation_group_id, post.id, now) as { locale: string; slug: string }[];

    const a = author(post.author_user_id);
    res.json({
      success: true,
      data: {
        ...card(post),
        contentHtml: post.content_html,
        updatedAt: post.updated_at_ts,
        author: { name: a.name, jobTitle: a.jobTitle, avatarUrl: a.avatarUrl },
        tags: splitTags(post.tags),
        seoTitle: post.seo_title || post.title,
        seoDescription: post.seo_description || post.excerpt,
        translations: translations.map((t) => ({ locale: t.locale, slug: t.slug, path: postPath(t.locale, t.slug) })),
        previous: neighbour(previous),
        next: neighbour(next),
        related: related.map(card)
      }
    });
  } catch (err) {
    serverError(res, err);
  }
});
