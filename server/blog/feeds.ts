// RSS 2.0 feeds of the public blog (BLOG_SPEC §7): /blog/rss.xml (English) and /fr/blog/rss.xml
// (French), the latest public posts with title, link, excerpt, date, categories and cover.
// Registered before the public pages, so these paths are never read as article slugs.
import { Router, type Request, type Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { COMPANY, EMAIL, SITE_URL } from '../../src/config/brand.js';
import { buildPath, type Lang } from '../../src/router/routes.js';
import { pageMetaText } from '../../src/shared/pageMeta.js';
import { blogFeedPath, blogName, escapeHtml } from '../render/pageMeta.js';
import { type PostRow, PUBLIC_CONDITION, coverOf, postCategories, postPath, publishDuePosts } from './posts.js';

export const FEED_SIZE = 20;

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

export function rssXml(conn: DatabaseSync, lang: Lang, now = Date.now()): string {
  const e = escapeHtml;
  publishDuePosts(conn, now);
  const posts = conn.prepare(`
    SELECT p.* FROM blog_posts p WHERE p.locale = ? AND ${PUBLIC_CONDITION}
    ORDER BY p.published_at_ts DESC, p.id LIMIT ?
  `).all(lang, now, FEED_SIZE) as unknown as PostRow[];

  const blogUrl = `${SITE_URL}${buildPath('blog', undefined, lang)}`;
  const selfUrl = `${SITE_URL}${blogFeedPath(lang)}`;
  const items = posts.map((p) => {
    const url = `${SITE_URL}${postPath(p.locale, p.slug)}`;
    const date = new Date(p.published_at_ts ?? p.created_at_ts).toUTCString();
    const cover = coverOf(conn, p.cover_media_id, p.cover_alt);
    const lines = [
      `      <title>${e(p.title)}</title>`,
      `      <link>${e(url)}</link>`,
      // The post id: stays the same when the slug changes, so readers don't see it twice.
      `      <guid isPermaLink="false">${e(p.id)}</guid>`,
      `      <pubDate>${date}</pubDate>`,
      `      <description>${e(p.excerpt)}</description>`,
      ...postCategories(conn, p.id).map((c) => `      <category>${e(c.name)}</category>`),
    ];
    if (cover) {
      const ext = cover.url.split('.').pop()?.toLowerCase() ?? '';
      lines.push(`      <enclosure url="${e(SITE_URL + cover.url)}" type="${MIME[ext] ?? 'image/jpeg'}" length="0" />`);
    }
    return `    <item>\n${lines.join('\n')}\n    </item>`;
  });
  const lastBuild = posts.length ? new Date(Math.max(...posts.map((p) => p.published_at_ts ?? 0))).toUTCString() : new Date(now).toUTCString();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${e(blogName(lang))}</title>\n` +
    `    <link>${e(blogUrl)}</link>\n` +
    `    <description>${e(pageMetaText('blog', lang).description)}</description>\n` +
    `    <language>${lang}</language>\n` +
    `    <copyright>${e(COMPANY)}</copyright>\n` +
    `    <managingEditor>${e(`${EMAIL} (${COMPANY})`)}</managingEditor>\n` +
    `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` +
    `    <atom:link href="${e(selfUrl)}" rel="self" type="application/rss+xml" />\n` +
    (items.length ? `${items.join('\n')}\n` : '') +
    `  </channel>\n</rss>\n`
  );
}

export function blogFeedsRouter(conn: DatabaseSync): Router {
  const router = Router();
  for (const lang of ['en', 'fr'] as const) {
    router.get(blogFeedPath(lang), (req: Request, res: Response, next) => {
      // Express ignores case and a trailing slash by default; only the exact path is the feed.
      if (req.path !== blogFeedPath(lang)) return next();
      try {
        res.type('application/rss+xml').setHeader('Cache-Control', 'public, max-age=900');
        res.send(rssXml(conn, lang));
      } catch (err) {
        next(err);
      }
    });
  }
  return router;
}
