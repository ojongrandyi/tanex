// Public blog pages on the server (BLOG_SPEC §6–§7, task F.3): /blog, /blog/<slug> and
// /blog/category/<slug> in both languages answer with the post's own head (or 404/301), the
// sitemap lists the blog from the database, and the RSS feeds carry the public posts only.
// Uses an in-memory database with rows written directly; nothing is kept. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createBlogTables } from '../server/blog/schema.ts';
import { blogSitemapEntries, resolveBlogPage } from '../server/blog/pageData.ts';
import { blogFeedsRouter, rssXml } from '../server/blog/feeds.ts';
import { publicPages, sendIndex } from '../server/publicPages.ts';
import { createIndexRenderer } from '../server/render/pageMeta.ts';
import { seoRouter, setSitemapExtras } from '../server/seo.ts';
import { matchPath } from '../src/router/routes.ts';
import { SITE_URL } from '../src/config/brand.ts';

const conn = new DatabaseSync(':memory:');
createBlogTables(conn);
conn.exec('CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, job_title TEXT, avatar_file TEXT)');
conn.prepare('INSERT INTO users (id, display_name, job_title) VALUES (?, ?, ?)').run('usr_a', 'Author Name', 'Writer');

const HOUR = 3_600_000;
const now = Date.now();
let n = 0;
function addPost(p: { locale: string; slug: string; group?: string; status?: string; at?: number; title?: string; cover?: string | null }) {
  const id = `post_${++n}`;
  conn.prepare(`
    INSERT INTO blog_posts (id, locale, translation_group_id, slug, title, excerpt, content_json, content_html, cover_media_id, cover_alt,
      author_user_id, status, published_at_ts, seo_title, seo_description, tags, reading_minutes, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, '{}', '<p>Body</p>', ?, ?, 'usr_a', ?, ?, NULL, NULL, 'one,two', 2, ?, ?)
  `).run(id, p.locale, p.group ?? id, p.slug, p.title ?? `Title ${p.slug}`, `Excerpt of ${p.slug} & more`, p.cover ?? null, p.cover ? 'Cover alt' : null,
    p.status ?? 'PUBLISHED', p.at ?? now - HOUR, now - 2 * HOUR, now - HOUR);
  return id;
}
function addCategory(locale: string, slug: string, name: string, group: string) {
  const id = `cat_${locale}_${slug}`;
  conn.prepare('INSERT INTO blog_categories (id, locale, slug, name, description, translation_group_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, locale, slug, name, `${name} description`, group);
  return id;
}
const link = (postId: string, catId: string) => conn.prepare('INSERT INTO blog_post_categories (post_id, category_id) VALUES (?, ?)').run(postId, catId);

const indexPath = path.join(process.cwd(), 'index.html');
const render = createIndexRenderer(indexPath);
const app = express();
setSitemapExtras(() => blogSitemapEntries(conn));
app.use(seoRouter);
app.use(blogFeedsRouter(conn));
app.use(publicPages(render, indexPath, (match, query) => resolveBlogPage(conn, match, query)));
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404);
  sendIndex(res, next, render, { kind: 'not-found', lang: req.path.startsWith('/fr/') ? 'fr' : 'en' }, indexPath);
});
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  conn.close();
});
const get = (p: string) => fetch(BASE + p, { redirect: 'manual' });

test('empty blog: index served but noindex, nothing in the sitemap, empty feeds, unknown article 404', async () => {
  const index = await get('/blog');
  assert.equal(index.status, 200);
  assert.match(await index.text(), /<meta name="robots" content="noindex" \/>/);
  assert.equal((await get('/blog/anything')).status, 404);
  assert.equal((await get('/blog/category/guides')).status, 404);
  assert.deepEqual(blogSitemapEntries(conn), []);
  const feed = await get('/blog/rss.xml');
  assert.equal(feed.status, 200);
  assert.match(feed.headers.get('content-type') ?? '', /application\/rss\+xml/);
  assert.doesNotMatch(await feed.text(), /<item>/);
});

// Written after the empty-blog test (tests run in order; module code runs before all of them).
let futureId = '';
test('seed: an article and its translation, a draft, a scheduled and an archived post, categories, an old slug', () => {
  const enId = addPost({ locale: 'en', slug: 'parcels-to-douala', group: 'grp1', cover: null });
  const frId = addPost({ locale: 'fr', slug: 'colis-vers-douala', group: 'grp1' });
  const draftId = addPost({ locale: 'en', slug: 'secret-draft', status: 'DRAFT' });
  futureId = addPost({ locale: 'en', slug: 'not-yet', status: 'SCHEDULED', at: now + 24 * HOUR });
  addPost({ locale: 'en', slug: 'archived-one', status: 'ARCHIVED' });
  const catEn = addCategory('en', 'guides', 'Guides', 'cgrp');
  const catFr = addCategory('fr', 'guides-pratiques', 'Guides pratiques', 'cgrp');
  addCategory('en', 'empty-cat', 'Empty', 'cgrp2');
  link(enId, catEn);
  link(frId, catFr);
  link(draftId, catEn);
  conn.prepare('INSERT INTO blog_slug_redirects (locale, old_slug, post_id, created_at_ts) VALUES (?, ?, ?, ?)').run('en', 'old-parcels', enId, now);
});

test('article: 200 with its head, hreflang to the translation, BlogPosting; drafts, scheduled and archived 404', async () => {
  const res = await get('/blog/parcels-to-douala');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Title parcels-to-douala \| TanEx<\/title>/);
  assert.ok(html.includes(`hreflang="fr" href="${SITE_URL}/fr/blog/colis-vers-douala"`));
  assert.ok(html.includes('<meta property="og:type" content="article" />'));
  assert.ok(html.includes('"@type":"BlogPosting"'));
  assert.ok(html.includes('<meta property="article:section" content="Guides" />'));
  assert.ok(html.includes('Excerpt of parcels-to-douala &amp; more</p></article></noscript>'));

  const fr = await (await get('/fr/blog/colis-vers-douala')).text();
  assert.match(fr, /<html lang="fr"/);
  assert.ok(fr.includes(`hreflang="en" href="${SITE_URL}/blog/parcels-to-douala"`));

  for (const p of ['/blog/secret-draft', '/blog/not-yet', '/blog/archived-one', '/fr/blog/parcels-to-douala']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    assert.match(await r.text(), /noindex/, p);
  }
});

test('old slug of a public article: 301 to its current address', async () => {
  const res = await get('/blog/old-parcels');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), '/blog/parcels-to-douala');
});

test('category: 200 with its name while it has public posts; empty or unknown 404; past the last page 404', async () => {
  const res = await get('/blog/category/guides');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>Guides \| TanEx Blog<\/title>/);
  assert.ok(html.includes(`hreflang="fr" href="${SITE_URL}/fr/blog/categorie/guides-pratiques"`));
  assert.equal((await get('/fr/blog/categorie/guides-pratiques')).status, 200);
  assert.equal((await get('/blog/category/empty-cat')).status, 404);
  assert.equal((await get('/blog/category/nope')).status, 404);
  assert.equal((await get('/blog/category/guides?page=9')).status, 404);
});

test('index: indexed once its language has a public post; page 2 self-canonical', async () => {
  const html = await (await get('/blog')).text();
  assert.doesNotMatch(html, /name="robots"/);
  assert.ok(html.includes(`<link rel="alternate" type="application/rss+xml" title="TanEx Blog" href="${SITE_URL}/blog/rss.xml" />`));
  const p2 = await (await get('/blog?page=2')).text();
  assert.ok(p2.includes(`<link rel="canonical" href="${SITE_URL}/blog?page=2" />`));
});

test('sitemap: blog index, category and article in both languages with alternates and lastmod; nothing private', async () => {
  const xml = await (await get('/sitemap.xml')).text();
  for (const p of ['/blog', '/fr/blog', '/blog/parcels-to-douala', '/fr/blog/colis-vers-douala', '/blog/category/guides', '/fr/blog/categorie/guides-pratiques']) {
    assert.ok(xml.includes(`<loc>${SITE_URL}${p}</loc>`), p);
  }
  assert.doesNotMatch(xml, /secret-draft|not-yet|archived-one|empty-cat|old-parcels/);
  const block = xml.split('<url>').find((b) => b.includes(`<loc>${SITE_URL}/blog/parcels-to-douala</loc>`))!;
  assert.match(block, /<lastmod>\d{4}-\d{2}-\d{2}T/);
  assert.match(block, /hreflang="fr" href="[^"]+\/fr\/blog\/colis-vers-douala"/);
  assert.match(block, /hreflang="x-default" href="[^"]+\/blog\/parcels-to-douala"/);
  // Every listed blog address is a page the server answers at its canonical spelling.
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const p = m[1].slice(SITE_URL.length);
    assert.equal(matchPath(p)?.canonical, p, p);
  }
});

test('RSS: public posts of the language only, escaped, with channel self link', async () => {
  const en = rssXml(conn, 'en');
  assert.match(en, /<rss version="2.0"/);
  assert.ok(en.includes(`<atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />`));
  assert.ok(en.includes(`<link>${SITE_URL}/blog/parcels-to-douala</link>`));
  assert.ok(en.includes('<description>Excerpt of parcels-to-douala &amp; more</description>'));
  assert.ok(en.includes('<category>Guides</category>'));
  assert.doesNotMatch(en, /secret-draft|not-yet|archived-one|colis-vers-douala/);
  const fr = await (await get('/fr/blog/rss.xml')).text();
  assert.ok(fr.includes('<language>fr</language>'));
  assert.ok(fr.includes(`${SITE_URL}/fr/blog/colis-vers-douala`));
  const slash = await get('/blog/rss.xml/');
  assert.equal(slash.status, 301, 'a trailing slash goes to the feed');
  assert.equal(slash.headers.get('location'), '/blog/rss.xml');
});

test('a scheduled post appears on every blog surface once its time has come', async () => {
  conn.prepare('UPDATE blog_posts SET published_at_ts = ? WHERE id = ?').run(Date.now() - 1000, futureId);
  assert.equal((await get('/blog/not-yet')).status, 200);
  assert.match(rssXml(conn, 'en'), /not-yet/);
  assert.equal(resolveBlogPage(conn, matchPath('/blog/not-yet')!, {}).kind, 'page');
});
