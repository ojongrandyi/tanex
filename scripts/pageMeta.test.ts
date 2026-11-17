// Server-side page meta and the bilingual sitemap (task D.2, I18N_SPEC §4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  escapeHtml, jsonForScript, pageHead, renderHead, renderIndexHtml, sitemapPaths, sitemapXml,
} from '../server/render/pageMeta.ts';
import type { BlogPageData } from '../server/render/pageMeta.ts';
import { matchPath } from '../src/router/routes.ts';
import { ADMIN_PATH, SITE_URL } from '../src/config/brand.ts';
import { FRENCH_PAGES_INDEXABLE } from '../src/shared/pageMeta.ts';

const TEMPLATE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function render(path: string): string {
  const match = matchPath(path);
  assert.ok(match, `${path} should be a page`);
  return renderIndexHtml(TEMPLATE, { kind: 'page', match });
}

const count = (html: string, needle: string) => html.split(needle).length - 1;
/** The injected block only (the template's comments mention "canonical" and "hreflang" too). */
const headBlock = (html: string) => html.slice(html.indexOf('<!-- tx:head -->'), html.indexOf('<!-- /tx:head -->'));
const ldJson = (html: string) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);

test('index.html carries the tx:head markers the server replaces', () => {
  assert.equal(count(TEMPLATE, '<!-- tx:head -->'), 1);
  assert.equal(count(TEMPLATE, '<!-- /tx:head -->'), 1);
});

test('home (en): default title, canonical, hreflang trio, OG and Organization JSON-LD', () => {
  const html = render('/');
  assert.match(html, /<html lang="en"/);
  assert.equal(count(html, '<title>'), 1, 'exactly one title');
  assert.equal(count(html, 'rel="canonical"'), 1, 'exactly one canonical');
  assert.match(html, /<title>TanEx \| Door-to-Door Delivery in Cameroon &amp; Worldwide Shipping<\/title>/);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/" />`));
  assert.ok(html.includes(`hreflang="en" href="${SITE_URL}/"`));
  assert.ok(html.includes(`hreflang="fr" href="${SITE_URL}/fr/"`));
  assert.ok(html.includes(`hreflang="x-default" href="${SITE_URL}/"`));
  assert.ok(html.includes('<meta property="og:title" content="TanEx: From Your Door to the World" />'));
  assert.ok(html.includes(`<meta property="og:url" content="${SITE_URL}/" />`));
  assert.doesNotMatch(html, /name="robots"/);
  const ld = ldJson(html);
  assert.equal(ld['@type'], 'Organization');
  assert.equal(ld.legalName, 'Tanex SARL');
  assert.equal(count(html, 'application/ld+json'), 1, 'the template Organization block is replaced, not duplicated');
  // Icons stay outside the replaced block.
  assert.match(html, /rel="manifest"/);
});

test('French pages: lang="fr", French title and description, French Organization slogan', () => {
  const home = render('/fr/');
  assert.match(home, /<html lang="fr"/);
  assert.match(home, /<title>TanEx \| Livraison à domicile au Cameroun/);
  assert.ok(home.includes(`<link rel="canonical" href="${SITE_URL}/fr/" />`));
  assert.ok(home.includes('<meta property="og:locale" content="fr_FR" />'));
  assert.equal(ldJson(home).slogan, 'De votre porte au monde entier');

  const track = render('/fr/suivi');
  assert.match(track, /<title>Suivre un envoi \| TanEx<\/title>/);
  assert.ok(track.includes(`hreflang="en" href="${SITE_URL}/track"`));
  assert.ok(track.includes(`hreflang="fr" href="${SITE_URL}/fr/suivi"`));
  // Until D.3 French pages show English content and stay out of the index.
  assert.equal(/name="robots" content="noindex"/.test(track), !FRENCH_PAGES_INDEXABLE);
});

test('inner page: BreadcrumbList Home > page, in the page language', () => {
  const en = ldJson(render('/about'));
  assert.equal(en['@type'], 'BreadcrumbList');
  assert.deepEqual(en.itemListElement.map((i: any) => i.name), ['Home', 'About TanEx']);
  assert.equal(en.itemListElement[1].item, `${SITE_URL}/about`);
  const fr = ldJson(render('/fr/aide'));
  assert.deepEqual(fr.itemListElement.map((i: any) => i.name), ['Accueil', "Centre d'aide"]);
  assert.equal(fr.itemListElement[0].item, `${SITE_URL}/fr/`);
});

test('service tiers and /legal/privacy point their canonical at the base page; other legal tabs at themselves', () => {
  assert.equal(pageHead({ kind: 'page', match: matchPath('/services/air')! }).canonical, `${SITE_URL}/services`);
  assert.equal(pageHead({ kind: 'page', match: matchPath('/legal/privacy')! }).canonical, `${SITE_URL}/legal`);
  assert.equal(pageHead({ kind: 'page', match: matchPath('/legal/unknown-tab')! }).canonical, `${SITE_URL}/legal`);
  const terms = pageHead({ kind: 'page', match: matchPath('/legal/shipping-terms')! });
  assert.equal(terms.canonical, `${SITE_URL}/legal/shipping-terms`);
  assert.equal(terms.alternates?.fr, `${SITE_URL}/fr/mentions-legales/shipping-terms`);
});

test('shipment and quote results are noindex, without alternates, and never show the shipment', () => {
  for (const path of ['/track/TX7K2M9P', '/fr/suivi/TX7K2M9P', '/quote/QR-2026-00001']) {
    const head = pageHead({ kind: 'page', match: matchPath(path)! });
    assert.equal(head.robots, 'noindex', path);
    assert.equal(head.alternates, undefined, path);
  }
  const html = render('/track/TX7K2M9P');
  assert.match(html, /<title>Track a Shipment \| TanEx<\/title>/);
  assert.doesNotMatch(headBlock(html), /hreflang/);
});

const POST_META = {
  headline: 'Sending a parcel </script> to Douala',
  title: 'Parcels to Douala',
  description: 'How to send a parcel from Buea to Douala.',
  excerpt: 'How to send a parcel from Buea to Douala, step by step.',
  image: { url: '/media/blog/11111111-1111-4111-8111-111111111111.webp', width: 1600, height: 900, alt: 'A rider at the door' },
  publishedAt: Date.UTC(2026, 10, 10, 8, 0),
  modifiedAt: Date.UTC(2026, 10, 11, 9, 30),
  author: { name: 'Staff Writer', jobTitle: 'Marketing' },
  section: 'Guides',
  tags: ['douala', 'parcels'],
  versions: { en: '/blog/parcels-to-douala', fr: '/fr/blog/colis-vers-douala' },
};

const blogRender = (path: string, blog: BlogPageData) =>
  renderIndexHtml(TEMPLATE, { kind: 'page', match: matchPath(path)!, blog });
const ldBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('blog index: noindex while its language has no public post, indexed once it has; RSS link', () => {
  for (const path of ['/blog', '/fr/blog']) {
    const empty = pageHead({ kind: 'page', match: matchPath(path)!, blog: { type: 'index', hasPosts: false, page: 1 } });
    assert.equal(empty.robots, 'noindex', path);
    const full = pageHead({ kind: 'page', match: matchPath(path)!, blog: { type: 'index', hasPosts: true, page: 1 } });
    assert.equal(full.robots, undefined, path);
  }
  const html = blogRender('/fr/blog', { type: 'index', hasPosts: true, page: 1 });
  assert.ok(html.includes(`<link rel="alternate" type="application/rss+xml" title="Blog TanEx" href="${SITE_URL}/fr/blog/rss.xml" />`));
  assert.ok(html.includes(`hreflang="en" href="${SITE_URL}/blog"`));
  // Page 2: self-canonical with ?page=2, own title, no alternates.
  const p2 = pageHead({ kind: 'page', match: matchPath('/blog')!, blog: { type: 'index', hasPosts: true, page: 2 } });
  assert.equal(p2.canonical, `${SITE_URL}/blog?page=2`);
  assert.equal(p2.title, 'Blog, page 2 | TanEx');
  assert.equal(p2.alternates, undefined);
});

test('blog article: title, canonical, hreflang of its translations, OG article, BlogPosting + breadcrumbs, noscript', () => {
  const html = blogRender('/blog/parcels-to-douala', { type: 'post', post: POST_META });
  const head = headBlock(html);
  assert.match(head, /<title>Parcels to Douala \| TanEx<\/title>/);
  assert.ok(head.includes(`<link rel="canonical" href="${SITE_URL}/blog/parcels-to-douala" />`));
  assert.ok(head.includes(`hreflang="fr" href="${SITE_URL}/fr/blog/colis-vers-douala"`));
  assert.ok(head.includes(`hreflang="x-default" href="${SITE_URL}/blog/parcels-to-douala"`));
  assert.ok(head.includes('<meta property="og:type" content="article" />'));
  assert.ok(head.includes(`<meta property="og:image" content="${SITE_URL}/media/blog/11111111-1111-4111-8111-111111111111.webp" />`));
  assert.ok(head.includes('<meta property="og:image:width" content="1600" />'));
  assert.ok(head.includes('<meta property="og:image:alt" content="A rider at the door" />'));
  assert.ok(head.includes('<meta property="article:published_time" content="2026-11-10T08:00:00.000Z" />'));
  assert.ok(head.includes('<meta property="article:tag" content="douala" />'));
  assert.ok(head.includes('<meta name="twitter:card" content="summary_large_image" />'));
  assert.doesNotMatch(head, /name="robots"/);

  const [posting, crumbs] = ldBlocks(html);
  assert.equal(posting['@type'], 'BlogPosting');
  assert.equal(posting.headline, POST_META.headline);
  assert.equal(posting.datePublished, '2026-11-10T08:00:00.000Z');
  assert.equal(posting.dateModified, '2026-11-11T09:30:00.000Z');
  assert.equal(posting.author.name, 'Staff Writer');
  assert.equal(posting.publisher.name, 'Tanex SARL');
  assert.equal(posting.publisher.logo.url, `${SITE_URL}/brand/mark.png`);
  assert.deepEqual(posting.image, [`${SITE_URL}${POST_META.image.url}`]);
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.deepEqual(crumbs.itemListElement.map((i: { name: string }) => i.name), ['Home', 'Blog', POST_META.headline]);

  // The headline's "</script>" can't break out of the JSON-LD or the noscript block.
  assert.equal(count(html, '</script> to Douala'), 0);
  assert.match(html, /<div id="root"><\/div>\s*<noscript><article><h1>Sending a parcel &lt;\/script&gt; to Douala<\/h1><p>How to send a parcel from Buea to Douala, step by step\.<\/p><\/article><\/noscript>/);
});

test('blog article without a translation or cover: only its own hreflang, the brand image', () => {
  const post = { ...POST_META, image: null, versions: { fr: '/fr/blog/colis-vers-douala' } };
  const head = pageHead({ kind: 'page', match: matchPath('/fr/blog/colis-vers-douala')!, blog: { type: 'post', post } });
  assert.deepEqual(head.alternates, { fr: `${SITE_URL}/fr/blog/colis-vers-douala`, 'x-default': `${SITE_URL}/fr/blog/colis-vers-douala` });
  const html = renderHead(head);
  assert.ok(html.includes(`<meta property="og:image" content="${SITE_URL}/brand/og-image.jpg" />`));
});

test('blog category: own name in the title, breadcrumbs to it, alternates of its translations', () => {
  const head = pageHead({
    kind: 'page',
    match: matchPath('/blog/category/guides')!,
    blog: { type: 'category', name: 'Guides', description: 'Shipping guides.', versions: { en: '/blog/category/guides' }, page: 1 },
  });
  assert.equal(head.title, 'Guides | TanEx Blog');
  assert.equal(head.description, 'Shipping guides.');
  assert.equal(head.canonical, `${SITE_URL}/blog/category/guides`);
  assert.deepEqual(Object.keys(head.alternates ?? {}), ['en', 'x-default']);
  const crumbs = head.jsonLd as { itemListElement: { name: string }[] };
  assert.deepEqual(crumbs.itemListElement.map((i) => i.name), ['Home', 'Blog', 'Guides']);
});

test('404 and console heads are noindex with no canonical, hreflang or OG', () => {
  const nf = renderIndexHtml(TEMPLATE, { kind: 'not-found', lang: 'fr' });
  assert.match(nf, /<html lang="fr"/);
  assert.match(nf, /<title>Page introuvable \| TanEx<\/title>/);
  assert.match(nf, /<meta name="robots" content="noindex" \/>/);
  assert.doesNotMatch(headBlock(nf), /rel="canonical"|hreflang|og:url/);

  const admin = renderIndexHtml(TEMPLATE, { kind: 'admin' });
  assert.match(admin, /<title>TanEx Operations Console<\/title>/);
  assert.match(admin, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.doesNotMatch(headBlock(admin), /rel="canonical"|hreflang|application\/ld\+json/);
});

test('escaping: attribute and script contexts cannot be broken out of', () => {
  assert.equal(escapeHtml(`"><script>alert('x')</script>&`), '&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;');
  const tricky = `</script><!--${String.fromCharCode(0x2028)}&`;
  const json = jsonForScript({ a: tricky });
  assert.ok(!/[<>&]/.test(json) && !json.includes(String.fromCharCode(0x2028)), json);
  assert.deepEqual(JSON.parse(json), { a: tricky });
  // Every title in the output has its ampersand escaped (the home title contains "&").
  assert.doesNotMatch(render('/'), /<title>[^<]*& [^<]*<\/title>/);
});

test('renderIndexHtml leaves a template without markers alone apart from the language', () => {
  const bare = '<!doctype html><html lang="en"><head><title>x</title></head></html>';
  const out = renderIndexHtml(bare, { kind: 'page', match: matchPath('/fr/contact')! });
  assert.equal(out, bare.replace('lang="en"', 'lang="fr"'));
});

test('sitemap: every live page in both languages with xhtml:link alternates; no console, results or tiers', () => {
  const xml = sitemapXml();
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, sitemapPaths().length * 2);
  assert.equal(new Set(locs).size, locs.length, 'no duplicates');
  for (const path of ['/', '/fr/', '/track', '/fr/suivi', '/services', '/fr/services', '/legal', '/legal/terms', '/fr/mentions-legales/cookies']) {
    assert.ok(locs.includes(`${SITE_URL}${path}`), `${path} listed`);
  }
  // Each <url> carries the en/fr/x-default trio.
  const blocks = xml.split('<url>').slice(1);
  for (const block of blocks) {
    assert.equal(count(block, 'xhtml:link'), 3);
    assert.match(block, /hreflang="x-default"/);
  }
  assert.ok(!xml.includes(ADMIN_PATH.replace(/\/+$/, '')), 'console never listed');
  assert.doesNotMatch(xml, /\/blog/, 'the blog comes from the database (extras)');
  assert.ok(locs.includes(`${SITE_URL}/local-delivery`) && xml.includes('/fr/livraison-locale'), 'the local-delivery booking page is listed (G.6)');
  assert.doesNotMatch(xml, /\/track\/|\/quote\/|\/services\//, 'no results or tiers');
  // Every listed path is a page the server answers with 200 at its canonical spelling.
  for (const loc of locs) {
    const path = loc.slice(SITE_URL.length);
    assert.equal(matchPath(path)?.canonical, path, path);
  }
});

test('robots.txt points to the sitemap and never names the console; sitemap served as XML', async () => {
  const { default: express } = await import('express');
  const { seoRouter } = await import('../server/seo.ts');
  const app = express();
  app.use(seoRouter);
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const robots = await fetch(`http://127.0.0.1:${port}/robots.txt`);
    const text = await robots.text();
    assert.match(text, new RegExp(`Sitemap: ${SITE_URL}/sitemap\.xml`));
    assert.ok(!text.toLowerCase().includes(ADMIN_PATH.replace(/\/+$/, '')), 'console not listed');
    const sitemap = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
    assert.match(sitemap.headers.get('content-type') || '', /application\/xml/);
    assert.equal(await sitemap.text(), sitemapXml());
  } finally {
    server.close();
  }
});
