// Server-side page meta and the bilingual sitemap (task D.2, I18N_SPEC §4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  escapeHtml, jsonForScript, pageHead, renderIndexHtml, sitemapPaths, sitemapXml,
} from '../server/render/pageMeta.ts';
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
  assert.doesNotMatch(xml, /\/blog|\/local-delivery|livraison-locale/, 'pages not live yet are not listed');
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
