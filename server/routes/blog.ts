// Blog studio API (docs/BLOG_SPEC.md §2, §5), mounted on /api/admin/blog. Every route checks a
// blog.* permission; on top of that a writer without blog.edit_any only sees and edits their own
// posts, and only while they are drafts or in review. Status changes have their own routes so a
// content save can never publish. Every write is audited (blog.*).
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth, requestHasPermission } from '../auth/permissions.js';
import { audit } from '../audit.js';
import { serverError } from '../errors.js';
import { decodeImageUpload, deleteUpload, writeImageUpload, type ImageType } from '../uploads.js';
import { readImageSize } from '../imageSize.js';
import { EMPTY_DOC, parseDoc, renderDoc, type PMNode } from '../blog/render.js';
import {
  type CategoryRow, type MediaRow, type PostRow, type PostStatus,
  cleanTags, coverOf, formatMedia, getPost, isBlogLocale, isPostStatus, isPublicRow, isValidSlug,
  mediaLookup, postCategories, postPath, publishDuePosts, recordSlugChange, setPostCategories, slugTaken,
  slugify, splitTags, uniqueSlug, userName
} from '../blog/posts.js';

export const blogAdminRouter = Router();

export const TITLE_MAX = 160;
export const EXCERPT_MAX = 300;
export const SEO_TITLE_MAX = 120;
export const SEO_DESCRIPTION_MAX = 300;
export const ALT_MAX = 300;
export const CATEGORY_NAME_MAX = 80;
export const CATEGORY_DESCRIPTION_MAX = 300;
export const ADMIN_PAGE_SIZE = 50;
/** Blog images: up to 3 MB each and 4096 px on the long side (BLOG_SPEC §4). */
export const MAX_BLOG_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_BLOG_IMAGE_SIDE = 4096;
const BLOG_IMAGE_TYPES: readonly ImageType[] = ['webp', 'jpeg', 'png', 'avif'];

const ANY_POST_ACCESS = ['blog.view', 'blog.write', 'blog.edit_any', 'blog.publish'] as const;
const WRITE_ACCESS = ['blog.write', 'blog.edit_any'] as const;
/** A writer without blog.edit_any edits own posts only while they are in one of these states. */
const WRITER_EDITABLE: readonly string[] = ['DRAFT', 'IN_REVIEW'];

type Fail = { status: number; code: string; error: string };
const fail = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error });
const notFound = (res: Response) => fail(res, { status: 404, code: 'NOT_FOUND', error: 'Post not found.' });

function newId(prefix: string): string {
  return prefix + crypto.randomBytes(10).toString('hex');
}

function me(req: Request): string {
  return getRequestAuth(req)!.user.id;
}

/** blog.view, blog.edit_any or blog.publish see every post; a writer only sees their own. */
function seesAllPosts(req: Request): boolean {
  return requestHasPermission(req, 'blog.view', 'blog.edit_any', 'blog.publish');
}

function canViewPost(req: Request, post: PostRow): boolean {
  return seesAllPosts(req) || post.author_user_id === me(req);
}

/** Why the user may not change this post's content, or null when they may. */
function editBlocker(req: Request, post: PostRow): Fail | null {
  if (requestHasPermission(req, 'blog.edit_any')) return null;
  if (!requestHasPermission(req, 'blog.write') || post.author_user_id !== me(req)) {
    return { status: 403, code: 'BLOG_NOT_YOUR_POST', error: 'You can only edit your own posts.' };
  }
  if (!WRITER_EDITABLE.includes(post.status)) {
    return { status: 403, code: 'BLOG_POST_LOCKED', error: 'This post is scheduled or published; ask an editor to change it.' };
  }
  return null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Optional text field: undefined = not sent, null = cleared. */
function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = text(value, max);
  return t ? t : null;
}

function translationsOf(post: PostRow) {
  const rows = db.prepare(`
    SELECT id, locale, slug, title, status, published_at_ts FROM blog_posts
    WHERE translation_group_id = ? AND id <> ? ORDER BY locale
  `).all(post.translation_group_id, post.id) as unknown as Pick<PostRow, 'id' | 'locale' | 'slug' | 'title' | 'status' | 'published_at_ts'>[];
  return rows.map((r) => ({ id: r.id, locale: r.locale, slug: r.slug, title: r.title, status: r.status }));
}

function formatCategory(row: CategoryRow) {
  return {
    id: row.id, locale: row.locale, slug: row.slug, name: row.name, description: row.description ?? '',
    translationGroupId: row.translation_group_id, sortOrder: row.sort_order
  };
}

function formatPost(post: PostRow, full: boolean) {
  const base = {
    id: post.id,
    locale: post.locale,
    translationGroupId: post.translation_group_id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    status: post.status,
    isPublic: isPublicRow(post),
    publicPath: postPath(post.locale, post.slug),
    publishedAt: post.published_at_ts,
    cover: coverOf(db, post.cover_media_id, post.cover_alt),
    coverMediaId: post.cover_media_id,
    coverAlt: post.cover_alt ?? '',
    author: { id: post.author_user_id, name: userName(db, post.author_user_id) },
    categories: postCategories(db, post.id).map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
    tags: splitTags(post.tags),
    readingMinutes: post.reading_minutes,
    translations: translationsOf(post),
    createdAt: post.created_at_ts,
    updatedAt: post.updated_at_ts,
    updatedBy: userName(db, post.updated_by)
  };
  if (!full) return base;
  let content: unknown = EMPTY_DOC;
  try { content = JSON.parse(post.content_json); } catch { /* stored by this module, always JSON */ }
  return {
    ...base,
    content,
    contentHtml: post.content_html,
    seoTitle: post.seo_title ?? '',
    seoDescription: post.seo_description ?? ''
  };
}

interface PostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  doc?: PMNode;
  coverMediaId?: string | null;
  coverAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string[];
  categoryIds?: string[];
  authorUserId?: string;
}

/** Validates the editable fields that were sent. Locale is fixed when the post is created. */
function readPostInput(req: Request, body: Record<string, unknown>, locale: string): { ok: true; input: PostInput } | { ok: false; fail: Fail } {
  const bad = (error: string, code = 'VALIDATION_FAILED'): { ok: false; fail: Fail } => ({ ok: false, fail: { status: 400, code, error } });
  const input: PostInput = {};

  if (body.title !== undefined) {
    const t = text(body.title, TITLE_MAX + 1);
    if (!t) return bad('A title is required.');
    if (t.length > TITLE_MAX) return bad(`The title can be up to ${TITLE_MAX} characters.`);
    input.title = t;
  }
  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    if (!isValidSlug(body.slug)) {
      return bad('The slug may only use lower-case letters, digits and single hyphens (up to 80 characters).', 'BLOG_INVALID_SLUG');
    }
    input.slug = body.slug;
  }
  if (body.excerpt !== undefined) {
    const t = body.excerpt === null ? '' : text(body.excerpt, EXCERPT_MAX + 1);
    if (t === null) return bad('The excerpt is not valid.');
    if (t.length > EXCERPT_MAX) return bad(`The excerpt can be up to ${EXCERPT_MAX} characters.`);
    input.excerpt = t;
  }
  if (body.content !== undefined) {
    const parsed = parseDoc(body.content);
    if (!parsed.ok) return bad(parsed.error, 'BLOG_INVALID_CONTENT');
    input.doc = parsed.doc;
  }
  if (body.coverMediaId !== undefined) {
    if (body.coverMediaId === null || body.coverMediaId === '') {
      input.coverMediaId = null;
    } else {
      if (typeof body.coverMediaId !== 'string' || !db.prepare('SELECT 1 FROM blog_media WHERE id = ?').get(body.coverMediaId)) {
        return bad('The cover image was not found in the media library.');
      }
      input.coverMediaId = body.coverMediaId;
    }
  }
  if (body.coverAlt !== undefined) input.coverAlt = optionalText(body.coverAlt, ALT_MAX);
  if (body.seoTitle !== undefined) input.seoTitle = optionalText(body.seoTitle, SEO_TITLE_MAX);
  if (body.seoDescription !== undefined) input.seoDescription = optionalText(body.seoDescription, SEO_DESCRIPTION_MAX);
  if (body.tags !== undefined) input.tags = cleanTags(body.tags);
  if (body.categoryIds !== undefined) {
    if (!Array.isArray(body.categoryIds) || body.categoryIds.length > 20 || body.categoryIds.some((c) => typeof c !== 'string')) {
      return bad('Categories are not valid.');
    }
    const ids = [...new Set(body.categoryIds as string[])];
    for (const id of ids) {
      const cat = db.prepare('SELECT locale FROM blog_categories WHERE id = ?').get(id) as { locale: string } | undefined;
      if (!cat) return bad('A category was not found.');
      if (cat.locale !== locale) return bad('Categories must be in the same language as the post.');
    }
    input.categoryIds = ids;
  }
  if (body.authorUserId !== undefined) {
    if (typeof body.authorUserId !== 'string') return bad('The author is not valid.');
    if (body.authorUserId !== me(req) && !requestHasPermission(req, 'blog.edit_any')) {
      return { ok: false, fail: { status: 403, code: 'FORBIDDEN', error: 'Only editors can change the author.' } };
    }
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'ACTIVE'").get(body.authorUserId)) {
      return bad('The author was not found.');
    }
    input.authorUserId = body.authorUserId;
  }
  return { ok: true, input };
}

// ---------------------------------------------------------------- Posts

// GET /api/admin/blog/posts?status=&locale=&q=&mine=1&page=
blogAdminRouter.get('/posts', requirePermission(...ANY_POST_ACCESS), (req: Request, res: Response) => {
  try {
    publishDuePosts(db);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (!seesAllPosts(req) || req.query.mine === '1') { where.push('author_user_id = ?'); params.push(me(req)); }
    if (isPostStatus(req.query.status)) { where.push('status = ?'); params.push(req.query.status); }
    if (isBlogLocale(req.query.locale)) { where.push('locale = ?'); params.push(req.query.locale); }
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push("(title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\')");
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) AS c FROM blog_posts ${whereSql}`).get(...params) as { c: number }).c;
    const page = Math.max(1, Math.min(10000, Number.parseInt(String(req.query.page ?? '1'), 10) || 1));
    const rows = db.prepare(`
      SELECT * FROM blog_posts ${whereSql} ORDER BY updated_at_ts DESC, id LIMIT ? OFFSET ?
    `).all(...params, ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE) as unknown as PostRow[];
    res.json({
      success: true,
      data: rows.map((r) => formatPost(r, false)),
      page, pageSize: ADMIN_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/admin/blog/posts/:id
blogAdminRouter.get('/posts/:id', requirePermission(...ANY_POST_ACCESS), (req: Request, res: Response) => {
  try {
    publishDuePosts(db);
    const post = getPost(db, req.params.id as string);
    if (!post || !canViewPost(req, post)) return notFound(res);
    res.json({ success: true, data: formatPost(post, true) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/blog/posts: { locale, title, slug?, excerpt?, content?, … } or
// { translationOf: <post id>, title, … } for the other language of an existing post.
blogAdminRouter.post('/posts', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    let locale: unknown = body.locale;
    let groupId = newId('btg_');
    let source: PostRow | undefined;

    if (body.translationOf !== undefined) {
      source = typeof body.translationOf === 'string' ? getPost(db, body.translationOf) : undefined;
      if (!source || !canViewPost(req, source)) return notFound(res);
      if (locale === undefined) locale = source.locale === 'en' ? 'fr' : 'en';
      if (locale === source.locale) {
        return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'A translation must be in the other language.' });
      }
      groupId = source.translation_group_id;
    }
    if (!isBlogLocale(locale)) return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'Choose English or French.' });
    if (source && db.prepare('SELECT 1 FROM blog_posts WHERE translation_group_id = ? AND locale = ?').get(groupId, locale)) {
      return fail(res, { status: 409, code: 'BLOG_TRANSLATION_EXISTS', error: 'This post already has a version in that language.' });
    }

    const read = readPostInput(req, body, locale);
    if (!read.ok) return fail(res, read.fail);
    const input = read.input;
    if (!input.title) return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'A title is required.' });

    let slug: string;
    if (input.slug) {
      if (slugTaken(db, locale, input.slug)) {
        return fail(res, { status: 409, code: 'BLOG_SLUG_TAKEN', error: 'Another post in this language already uses this slug.' });
      }
      slug = input.slug;
    } else {
      slug = uniqueSlug(db, locale, slugify(input.title));
    }

    // A translation starts from the source's structure unless content is sent (BLOG_SPEC §4).
    let doc: PMNode = input.doc ?? EMPTY_DOC;
    if (!input.doc && source) {
      const parsed = parseDoc(source.content_json);
      if (parsed.ok) doc = parsed.doc;
    }
    const rendered = renderDoc(doc, mediaLookup(db));
    const now = Date.now();
    const id = newId('post_');
    const userId = me(req);

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM blog_slug_redirects WHERE locale = ? AND old_slug = ?').run(locale, slug);
      db.prepare(`
        INSERT INTO blog_posts (id, locale, translation_group_id, slug, title, excerpt, content_json, content_html,
          cover_media_id, cover_alt, author_user_id, status, published_at_ts, seo_title, seo_description, tags,
          reading_minutes, created_at_ts, updated_at_ts, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, locale, groupId, slug, input.title, input.excerpt ?? '', JSON.stringify(doc), rendered.html,
        input.coverMediaId ?? null, input.coverAlt ?? null, input.authorUserId ?? userId,
        input.seoTitle ?? null, input.seoDescription ?? null, (input.tags ?? []).join(', ') || null,
        rendered.readingMinutes, now, now, userId
      );
      if (input.categoryIds) setPostCategories(db, id, input.categoryIds);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    audit(req, 'blog.post_create', 'blog_post', id, `Blog post created: ${input.title}`, undefined,
      { locale, slug, translationOf: source?.id ?? null });
    res.status(201).json({ success: true, data: formatPost(getPost(db, id)!, true) });
  } catch (err) {
    serverError(res, err);
  }
});

// PUT /api/admin/blog/posts/:id: any of the editable fields. `expectedUpdatedAt` (optional)
// refuses the save when someone else saved in between (409), for autosave.
blogAdminRouter.put('/posts/:id', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const post = getPost(db, req.params.id as string);
    if (!post || !canViewPost(req, post)) return notFound(res);
    const blocked = editBlocker(req, post);
    if (blocked) return fail(res, blocked);

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.expectedUpdatedAt === 'number' && body.expectedUpdatedAt !== post.updated_at_ts) {
      return fail(res, { status: 409, code: 'BLOG_POST_CHANGED', error: 'This post was changed by someone else. Reload it first.' });
    }
    if (body.locale !== undefined && body.locale !== post.locale) {
      return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'The language of a post cannot be changed.' });
    }
    if (body.status !== undefined && body.status !== post.status) {
      return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'Use submit, publish, unpublish or archive to change the status.' });
    }
    const read = readPostInput(req, body, post.locale);
    if (!read.ok) return fail(res, read.fail);
    const input = read.input;

    const slug = input.slug ?? post.slug;
    if (slug !== post.slug && slugTaken(db, post.locale, slug, post.id)) {
      return fail(res, { status: 409, code: 'BLOG_SLUG_TAKEN', error: 'Another post in this language already uses this slug.' });
    }

    let doc: PMNode = EMPTY_DOC;
    if (input.doc) {
      doc = input.doc;
    } else {
      const parsed = parseDoc(post.content_json);
      if (parsed.ok) doc = parsed.doc;
    }
    // Re-rendered on every save, so image sizes and srcset follow the media library.
    const rendered = renderDoc(doc, mediaLookup(db));
    const now = Date.now();

    const next = {
      title: input.title ?? post.title,
      slug,
      excerpt: input.excerpt ?? post.excerpt,
      cover_media_id: input.coverMediaId !== undefined ? input.coverMediaId : post.cover_media_id,
      cover_alt: input.coverAlt !== undefined ? input.coverAlt : post.cover_alt,
      seo_title: input.seoTitle !== undefined ? input.seoTitle : post.seo_title,
      seo_description: input.seoDescription !== undefined ? input.seoDescription : post.seo_description,
      tags: input.tags !== undefined ? (input.tags.join(', ') || null) : post.tags,
      author_user_id: input.authorUserId ?? post.author_user_id
    };

    db.exec('BEGIN');
    try {
      if (slug !== post.slug) recordSlugChange(db, post, slug, now);
      db.prepare(`
        UPDATE blog_posts SET title = ?, slug = ?, excerpt = ?, content_json = ?, content_html = ?, cover_media_id = ?,
          cover_alt = ?, seo_title = ?, seo_description = ?, tags = ?, author_user_id = ?, reading_minutes = ?,
          updated_at_ts = ?, updated_by = ?
        WHERE id = ?
      `).run(
        next.title, next.slug, next.excerpt, JSON.stringify(doc), rendered.html, next.cover_media_id,
        next.cover_alt, next.seo_title, next.seo_description, next.tags, next.author_user_id, rendered.readingMinutes,
        now, me(req), post.id
      );
      if (input.categoryIds) setPostCategories(db, post.id, input.categoryIds);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Only the changed fields go in the audit entry; the body is noted, not copied.
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next)) {
      const old = (post as unknown as Record<string, unknown>)[k];
      if (old !== v) { before[k] = old; after[k] = v; }
    }
    if (input.doc && JSON.stringify(doc) !== post.content_json) { before.content = 'changed'; after.content = 'changed'; }
    if (input.categoryIds) after.categoryIds = input.categoryIds;
    audit(req, 'blog.post_update', 'blog_post', post.id, `Blog post edited: ${next.title}`, before, after);
    res.json({ success: true, data: formatPost(getPost(db, post.id)!, true) });
  } catch (err) {
    serverError(res, err);
  }
});

function setStatus(req: Request, post: PostRow, status: PostStatus, publishedAt: number | null, action: string, summary: string) {
  const now = Date.now();
  db.prepare('UPDATE blog_posts SET status = ?, published_at_ts = ?, updated_at_ts = ?, updated_by = ? WHERE id = ?')
    .run(status, publishedAt, now, me(req), post.id);
  audit(req, action, 'blog_post', post.id, `${summary}: ${post.title}`,
    { status: post.status, publishedAt: post.published_at_ts }, { status, publishedAt });
}

/** What a post still needs before it can go live, or null. */
function publishBlocker(post: PostRow): Fail | null {
  const missing = (error: string): Fail => ({ status: 400, code: 'BLOG_NOT_READY', error });
  if (!post.title.trim()) return missing('Add a title before publishing.');
  if (!post.excerpt.trim()) return missing('Add an excerpt before publishing.');
  const parsed = parseDoc(post.content_json);
  if (!parsed.ok) return missing(parsed.error);
  const rendered = renderDoc(parsed.doc);
  if (rendered.words === 0) return missing('The article is empty.');
  if (rendered.imagesMissingAlt > 0) return missing('Every image in the article needs alt text.');
  if (post.cover_media_id && !(post.cover_alt ?? '').trim()) return missing('The cover image needs alt text.');
  return null;
}

// POST /api/admin/blog/posts/:id/submit: a draft goes to review (own post, or blog.edit_any).
blogAdminRouter.post('/posts/:id/submit', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const post = getPost(db, req.params.id as string);
    if (!post || !canViewPost(req, post)) return notFound(res);
    const blocked = editBlocker(req, post);
    if (blocked) return fail(res, blocked);
    if (post.status !== 'DRAFT') return fail(res, { status: 409, code: 'BLOG_BAD_STATUS', error: 'Only drafts can be submitted for review.' });
    setStatus(req, post, 'IN_REVIEW', post.published_at_ts, 'blog.post_submit', 'Blog post submitted for review');
    res.json({ success: true, data: formatPost(getPost(db, post.id)!, true) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/blog/posts/:id/publish: { publishAt?: epoch ms }. A time in the future
// schedules the post; none (or a past time) publishes it now.
blogAdminRouter.post('/posts/:id/publish', requirePermission('blog.publish'), (req: Request, res: Response) => {
  try {
    const post = getPost(db, req.params.id as string);
    if (!post) return notFound(res);
    if (post.status === 'PUBLISHED') return fail(res, { status: 409, code: 'BLOG_BAD_STATUS', error: 'This post is already published.' });
    const notReady = publishBlocker(post);
    if (notReady) return fail(res, notReady);

    const now = Date.now();
    const at = req.body?.publishAt;
    if (at !== undefined && at !== null && (typeof at !== 'number' || !Number.isFinite(at) || at < 0)) {
      return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'The publishing time is not valid.' });
    }
    if (typeof at === 'number' && at > now) {
      setStatus(req, post, 'SCHEDULED', Math.round(at), 'blog.post_schedule', 'Blog post scheduled');
    } else {
      // Publishing again after an unpublish keeps the original date.
      const publishedAt = post.published_at_ts !== null && post.published_at_ts <= now ? post.published_at_ts : now;
      setStatus(req, post, 'PUBLISHED', publishedAt, 'blog.post_publish', 'Blog post published');
    }
    res.json({ success: true, data: formatPost(getPost(db, post.id)!, true) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/blog/posts/:id/unpublish: back to draft (also cancels a schedule).
blogAdminRouter.post('/posts/:id/unpublish', requirePermission('blog.publish'), (req: Request, res: Response) => {
  try {
    const post = getPost(db, req.params.id as string);
    if (!post) return notFound(res);
    if (post.status !== 'PUBLISHED' && post.status !== 'SCHEDULED') {
      return fail(res, { status: 409, code: 'BLOG_BAD_STATUS', error: 'Only published or scheduled posts can be unpublished.' });
    }
    // A cancelled schedule forgets its future time; a real publication date is kept.
    const keep = post.published_at_ts !== null && post.published_at_ts <= Date.now() ? post.published_at_ts : null;
    setStatus(req, post, 'DRAFT', keep, 'blog.post_unpublish', 'Blog post unpublished');
    res.json({ success: true, data: formatPost(getPost(db, post.id)!, true) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/blog/posts/:id/archive
blogAdminRouter.post('/posts/:id/archive', requirePermission('blog.publish'), (req: Request, res: Response) => {
  try {
    const post = getPost(db, req.params.id as string);
    if (!post) return notFound(res);
    if (post.status === 'ARCHIVED') return fail(res, { status: 409, code: 'BLOG_BAD_STATUS', error: 'This post is already archived.' });
    const keep = post.published_at_ts !== null && post.published_at_ts <= Date.now() ? post.published_at_ts : null;
    setStatus(req, post, 'ARCHIVED', keep, 'blog.post_archive', 'Blog post archived');
    res.json({ success: true, data: formatPost(getPost(db, post.id)!, true) });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/admin/blog/posts/:id: never a live post (unpublish or archive first). A writer
// may delete their own drafts; blog.edit_any any post that isn't live.
blogAdminRouter.delete('/posts/:id', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const post = getPost(db, req.params.id as string);
    if (!post || !canViewPost(req, post)) return notFound(res);
    const blocked = editBlocker(req, post);
    if (blocked) return fail(res, blocked);
    if (post.status === 'PUBLISHED' || post.status === 'SCHEDULED') {
      return fail(res, { status: 409, code: 'BLOG_BAD_STATUS', error: 'Unpublish or archive this post before deleting it.' });
    }
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM blog_post_categories WHERE post_id = ?').run(post.id);
      db.prepare('DELETE FROM blog_slug_redirects WHERE post_id = ?').run(post.id);
      db.prepare('DELETE FROM blog_posts WHERE id = ?').run(post.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    audit(req, 'blog.post_delete', 'blog_post', post.id, `Blog post deleted: ${post.title}`,
      { locale: post.locale, slug: post.slug, status: post.status }, undefined);
    res.json({ success: true });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/admin/blog/authors: active staff an editor can name as a post's author.
blogAdminRouter.get('/authors', requirePermission('blog.edit_any'), (req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT id, display_name, job_title FROM users WHERE status = 'ACTIVE' ORDER BY display_name
    `).all() as { id: string; display_name: string; job_title: string | null }[];
    res.json({ success: true, data: rows.map((r) => ({ id: r.id, name: r.display_name, jobTitle: r.job_title ?? '' })) });
  } catch (err) {
    serverError(res, err);
  }
});

// ---------------------------------------------------------------- Categories

function readCategoryInput(body: Record<string, unknown>, creating: boolean):
  { ok: true; name?: string; slug?: string; description?: string | null; sortOrder?: number } | { ok: false; fail: Fail } {
  const bad = (error: string, code = 'VALIDATION_FAILED') => ({ ok: false as const, fail: { status: 400, code, error } });
  const out: { ok: true; name?: string; slug?: string; description?: string | null; sortOrder?: number } = { ok: true };
  if (body.name !== undefined || creating) {
    const name = text(body.name, CATEGORY_NAME_MAX + 1);
    if (!name) return bad('A category name is required.');
    if (name.length > CATEGORY_NAME_MAX) return bad(`The name can be up to ${CATEGORY_NAME_MAX} characters.`);
    out.name = name;
  }
  if (body.slug !== undefined && body.slug !== '' && body.slug !== null) {
    if (!isValidSlug(body.slug)) return bad('The slug may only use lower-case letters, digits and single hyphens.', 'BLOG_INVALID_SLUG');
    out.slug = body.slug;
  }
  if (body.description !== undefined) out.description = optionalText(body.description, CATEGORY_DESCRIPTION_MAX) ?? null;
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n) || Math.abs(n) > 100000) return bad('The order is not valid.');
    out.sortOrder = n;
  }
  return out;
}

function categorySlugTaken(locale: string, slug: string, exceptId?: string): boolean {
  const row = db.prepare('SELECT id FROM blog_categories WHERE locale = ? AND slug = ?').get(locale, slug) as { id: string } | undefined;
  return !!row && row.id !== exceptId;
}

// GET /api/admin/blog/categories?locale=
blogAdminRouter.get('/categories', requirePermission(...ANY_POST_ACCESS, 'blog.categories'), (req: Request, res: Response) => {
  try {
    const locale = isBlogLocale(req.query.locale) ? req.query.locale : null;
    const rows = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM blog_post_categories pc WHERE pc.category_id = c.id) AS post_count
      FROM blog_categories c ${locale ? 'WHERE c.locale = ?' : ''} ORDER BY c.locale, c.sort_order, c.name
    `).all(...(locale ? [locale] : [])) as unknown as (CategoryRow & { post_count: number })[];
    res.json({ success: true, data: rows.map((r) => ({ ...formatCategory(r), postCount: r.post_count })) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/blog/categories: { locale, name, slug?, description?, sortOrder?, translationOf? }
blogAdminRouter.post('/categories', requirePermission('blog.categories'), (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isBlogLocale(body.locale)) return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'Choose English or French.' });
    const locale = body.locale;
    let groupId = newId('bcg_');
    if (body.translationOf !== undefined) {
      const src = typeof body.translationOf === 'string'
        ? db.prepare('SELECT * FROM blog_categories WHERE id = ?').get(body.translationOf) as CategoryRow | undefined
        : undefined;
      if (!src) return fail(res, { status: 404, code: 'NOT_FOUND', error: 'Category not found.' });
      if (src.locale === locale) return fail(res, { status: 400, code: 'VALIDATION_FAILED', error: 'A translation must be in the other language.' });
      if (db.prepare('SELECT 1 FROM blog_categories WHERE translation_group_id = ? AND locale = ?').get(src.translation_group_id, locale)) {
        return fail(res, { status: 409, code: 'BLOG_TRANSLATION_EXISTS', error: 'This category already has a version in that language.' });
      }
      groupId = src.translation_group_id;
    }
    const input = readCategoryInput(body, true);
    if (!input.ok) return fail(res, input.fail);
    const slug = input.slug ?? (slugify(input.name!) || 'category');
    if (categorySlugTaken(locale, slug)) {
      return fail(res, { status: 409, code: 'BLOG_SLUG_TAKEN', error: 'Another category in this language already uses this slug.' });
    }
    const id = newId('bcat_');
    db.prepare(`
      INSERT INTO blog_categories (id, locale, slug, name, description, translation_group_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, locale, slug, input.name!, input.description ?? null, groupId, input.sortOrder ?? 0);
    audit(req, 'blog.category_create', 'blog_category', id, `Blog category created: ${input.name}`, undefined, { locale, slug });
    const row = db.prepare('SELECT * FROM blog_categories WHERE id = ?').get(id) as unknown as CategoryRow;
    res.status(201).json({ success: true, data: formatCategory(row) });
  } catch (err) {
    serverError(res, err);
  }
});

// PUT /api/admin/blog/categories/:id: { name?, slug?, description?, sortOrder? }
blogAdminRouter.put('/categories/:id', requirePermission('blog.categories'), (req: Request, res: Response) => {
  try {
    const cat = db.prepare('SELECT * FROM blog_categories WHERE id = ?').get(req.params.id as string) as CategoryRow | undefined;
    if (!cat) return fail(res, { status: 404, code: 'NOT_FOUND', error: 'Category not found.' });
    const input = readCategoryInput((req.body ?? {}) as Record<string, unknown>, false);
    if (!input.ok) return fail(res, input.fail);
    const next = {
      name: input.name ?? cat.name,
      slug: input.slug ?? cat.slug,
      description: input.description !== undefined ? input.description : cat.description,
      sort_order: input.sortOrder ?? cat.sort_order
    };
    if (next.slug !== cat.slug && categorySlugTaken(cat.locale, next.slug, cat.id)) {
      return fail(res, { status: 409, code: 'BLOG_SLUG_TAKEN', error: 'Another category in this language already uses this slug.' });
    }
    db.prepare('UPDATE blog_categories SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?')
      .run(next.name, next.slug, next.description, next.sort_order, cat.id);
    audit(req, 'blog.category_update', 'blog_category', cat.id, `Blog category edited: ${next.name}`,
      { name: cat.name, slug: cat.slug, description: cat.description, sortOrder: cat.sort_order },
      { name: next.name, slug: next.slug, description: next.description, sortOrder: next.sort_order });
    const row = db.prepare('SELECT * FROM blog_categories WHERE id = ?').get(cat.id) as unknown as CategoryRow;
    res.json({ success: true, data: formatCategory(row) });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/admin/blog/categories/:id: posts keep existing, they just lose this category.
blogAdminRouter.delete('/categories/:id', requirePermission('blog.categories'), (req: Request, res: Response) => {
  try {
    const cat = db.prepare('SELECT * FROM blog_categories WHERE id = ?').get(req.params.id as string) as CategoryRow | undefined;
    if (!cat) return fail(res, { status: 404, code: 'NOT_FOUND', error: 'Category not found.' });
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM blog_post_categories WHERE category_id = ?').run(cat.id);
      db.prepare('DELETE FROM blog_categories WHERE id = ?').run(cat.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    audit(req, 'blog.category_delete', 'blog_category', cat.id, `Blog category deleted: ${cat.name}`,
      { locale: cat.locale, slug: cat.slug, name: cat.name }, undefined);
    res.json({ success: true });
  } catch (err) {
    serverError(res, err);
  }
});

// ---------------------------------------------------------------- Media

type CheckedImage = { ok: true; buffer: Buffer; type: ImageType; width: number; height: number } | { ok: false; fail: Fail };

/** Type by content (JPEG/PNG/WebP/AVIF), size ≤ 3 MB, readable dimensions ≤ 4096 px. */
export function checkBlogImage(input: unknown): CheckedImage {
  const decoded = decodeImageUpload(input, MAX_BLOG_IMAGE_BYTES, BLOG_IMAGE_TYPES);
  if (!decoded.ok) return { ok: false, fail: { status: 400, code: 'BLOG_INVALID_IMAGE', error: decoded.error } };
  const size = readImageSize(decoded.buffer, decoded.type);
  if (!size) return { ok: false, fail: { status: 400, code: 'BLOG_INVALID_IMAGE', error: 'The image could not be read.' } };
  if (size.width > MAX_BLOG_IMAGE_SIDE || size.height > MAX_BLOG_IMAGE_SIDE) {
    return { ok: false, fail: { status: 400, code: 'BLOG_INVALID_IMAGE', error: `Images can be up to ${MAX_BLOG_IMAGE_SIDE} px on each side.` } };
  }
  return { ok: true, buffer: decoded.buffer, type: decoded.type, ...size };
}

function canManageMedia(req: Request, row: MediaRow): boolean {
  return requestHasPermission(req, 'blog.edit_any') || row.uploaded_by === me(req);
}

/** Posts that use a media item (as cover or in the body). */
function mediaUsage(row: MediaRow): number {
  const files = [row.file_name, row.small_file_name].filter(Boolean) as string[];
  let sql = 'SELECT COUNT(*) AS c FROM blog_posts WHERE cover_media_id = ?';
  const params: string[] = [row.id];
  for (const f of files) { sql += ' OR content_json LIKE ?'; params.push(`%${f}%`); }
  return (db.prepare(sql).get(...params) as { c: number }).c;
}

// GET /api/admin/blog/media
blogAdminRouter.get('/media', requirePermission(...ANY_POST_ACCESS), (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM blog_media ORDER BY created_at_ts DESC LIMIT 500').all() as unknown as MediaRow[];
    res.json({ success: true, data: rows.map(formatMedia) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/admin/blog/media: { image: base64 or data URL (the 1600 px copy), alt? }
blogAdminRouter.post('/media', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const checked = checkBlogImage(req.body?.image);
    if (!checked.ok) return fail(res, checked.fail);
    const saved = writeImageUpload('blog', checked.buffer, checked.type);
    const alt = optionalText(req.body?.alt, ALT_MAX) ?? null;
    db.prepare(`
      INSERT INTO blog_media (id, file_name, width, height, size_bytes, alt, uploaded_by, created_at_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(saved.id, saved.fileName, checked.width, checked.height, saved.sizeBytes, alt, me(req), Date.now());
    audit(req, 'blog.media_upload', 'blog_media', saved.id, 'Blog image uploaded', undefined,
      { width: checked.width, height: checked.height, sizeBytes: saved.sizeBytes, type: saved.type });
    const row = db.prepare('SELECT * FROM blog_media WHERE id = ?').get(saved.id) as unknown as MediaRow;
    res.status(201).json({ success: true, data: formatMedia(row) });
  } catch (err) {
    serverError(res, err);
  }
});

// PUT /api/admin/blog/media/:id/small: { image } the 800 px copy, used in srcset. Sent on its
// own request so neither upload comes near the JSON body limit.
blogAdminRouter.put('/media/:id/small', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM blog_media WHERE id = ?').get(req.params.id as string) as MediaRow | undefined;
    if (!row) return fail(res, { status: 404, code: 'NOT_FOUND', error: 'Image not found.' });
    if (!canManageMedia(req, row)) return fail(res, { status: 403, code: 'FORBIDDEN', error: 'You can only change images you uploaded.' });
    const checked = checkBlogImage(req.body?.image);
    if (!checked.ok) return fail(res, checked.fail);
    if (!row.width || checked.width >= row.width) {
      return fail(res, { status: 400, code: 'BLOG_INVALID_IMAGE', error: 'The small copy must be narrower than the image.' });
    }
    const saved = writeImageUpload('blog', checked.buffer, checked.type);
    db.prepare('UPDATE blog_media SET small_file_name = ?, small_width = ?, small_height = ? WHERE id = ?')
      .run(saved.fileName, checked.width, checked.height, row.id);
    if (row.small_file_name) deleteUpload('blog', row.small_file_name);
    audit(req, 'blog.media_small', 'blog_media', row.id, 'Blog image small copy uploaded', undefined,
      { width: checked.width, height: checked.height, sizeBytes: saved.sizeBytes });
    const updated = db.prepare('SELECT * FROM blog_media WHERE id = ?').get(row.id) as unknown as MediaRow;
    res.json({ success: true, data: formatMedia(updated) });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/admin/blog/media/:id: refused while a post uses the image.
blogAdminRouter.delete('/media/:id', requirePermission(...WRITE_ACCESS), (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM blog_media WHERE id = ?').get(req.params.id as string) as MediaRow | undefined;
    if (!row) return fail(res, { status: 404, code: 'NOT_FOUND', error: 'Image not found.' });
    if (!canManageMedia(req, row)) return fail(res, { status: 403, code: 'FORBIDDEN', error: 'You can only delete images you uploaded.' });
    if (mediaUsage(row) > 0) return fail(res, { status: 409, code: 'BLOG_MEDIA_IN_USE', error: 'A post still uses this image.' });
    db.prepare('DELETE FROM blog_media WHERE id = ?').run(row.id);
    deleteUpload('blog', row.file_name);
    if (row.small_file_name) deleteUpload('blog', row.small_file_name);
    audit(req, 'blog.media_delete', 'blog_media', row.id, 'Blog image deleted', { fileName: row.file_name }, undefined);
    res.json({ success: true });
  } catch (err) {
    serverError(res, err);
  }
});
