// Server-side page meta (I18N_SPEC §4). index.html is read once and kept in memory; for every
// public page the block between <!-- tx:head --> and <!-- /tx:head --> is replaced with that
// page's <title>, description, canonical, hreflang alternates (en, fr, x-default = English),
// Open Graph/Twitter tags and JSON-LD (Organization on the home page, BreadcrumbList elsewhere),
// and <html lang> is set to the page's language. Crawlers and link previews that don't run
// JavaScript see the right page. Every value is escaped; nothing from the request is echoed
// except the route parameter, which matchPath() has already limited to [A-Za-z0-9._~-].
//
// Also builds sitemap.xml from the same route table, so the two can't disagree.
import { readFileSync } from 'node:fs';
import {
  ADMIN_CONSOLE_NAME, COMPANY, EMAIL, HQ_ADDRESS, LEGAL_NAME, SITE_URL, TAGLINE, TAGLINE_FR,
} from '../../src/config/brand.js';
import { ROUTES, buildPath, type Lang, type RouteMatch } from '../../src/router/routes.js';
import {
  FRENCH_PAGES_INDEXABLE, LEGAL_TABS, NOT_FOUND_TITLE, OG_TITLE, pageMetaText, pageName,
} from '../../src/shared/pageMeta.js';

export type PageContext =
  | { kind: 'page'; match: RouteMatch }
  | { kind: 'not-found'; lang: Lang }
  | { kind: 'admin' };

const HEAD_START = '<!-- tx:head -->';
const HEAD_END = '<!-- /tx:head -->';
const OG_IMAGE = `${SITE_URL}/brand/og-image.jpg`;
const OG_LOCALE: Record<Lang, string> = { en: 'en_GB', fr: 'fr_FR' };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/** JSON for a <script> block: no "</script>", "<!--" or line separators can break out of it. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\' + 'u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\' + 'u2029');
}

const absolute = (path: string) => `${SITE_URL}${path}`;

/** True for shipment and quote result pages: personal, never indexed, no alternates. */
function isResultPage(match: RouteMatch): boolean {
  return (match.id === 'track' || match.id === 'quote') && match.param !== undefined;
}

/**
 * The sub-path segment that gives a page content of its own. Service tiers only preselect a
 * tab on /services and /legal already shows the privacy policy, so those point at the base page.
 */
function canonicalParam(match: RouteMatch): string | undefined {
  if (match.param === undefined) return undefined;
  if (isResultPage(match)) return match.param;
  if (match.id === 'legal' && (LEGAL_TABS as readonly string[]).includes(match.param)) return match.param;
  return undefined;
}

export interface PageHead {
  lang: Lang;
  title: string;
  description: string;
  canonical?: string;
  /** hreflang → absolute URL. */
  alternates?: Record<'en' | 'fr' | 'x-default', string>;
  robots?: string;
  jsonLd?: unknown;
  ogTitle?: string;
}

function organization(lang: Lang, description: string) {
  // Street part of the head office address (brand.ts keeps it as one line ending in city, country).
  const street = HQ_ADDRESS.split(', ').slice(0, -2).join(', ');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: COMPANY,
    legalName: LEGAL_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/brand/mark.png`,
    image: OG_IMAGE,
    email: EMAIL,
    slogan: lang === 'fr' ? TAGLINE_FR : TAGLINE,
    description,
    address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: 'Buea', addressCountry: 'CM' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: EMAIL,
      availableLanguage: ['English', 'French'],
    },
  };
}

function breadcrumbs(match: RouteMatch, canonical: string) {
  const lang = match.lang;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: pageName('home', lang), item: absolute(buildPath('home', undefined, lang)) },
      { '@type': 'ListItem', position: 2, name: pageName(match.id, lang), item: canonical },
    ],
  };
}

/** Everything that goes into <head> for one request. */
export function pageHead(ctx: PageContext): PageHead {
  if (ctx.kind === 'admin') {
    return { lang: 'en', title: ADMIN_CONSOLE_NAME, description: pageMetaText('home', 'en').description, robots: 'noindex, nofollow' };
  }
  if (ctx.kind === 'not-found') {
    return { lang: ctx.lang, title: NOT_FOUND_TITLE[ctx.lang], description: pageMetaText('home', ctx.lang).description, robots: 'noindex' };
  }
  const { match } = ctx;
  const { title, description } = pageMetaText(match.id, match.lang);
  const param = canonicalParam(match);
  const canonical = absolute(buildPath(match.id, param, match.lang));
  const result = isResultPage(match);
  const indexable = !result && (match.lang === 'en' || FRENCH_PAGES_INDEXABLE);
  const head: PageHead = {
    lang: match.lang,
    title,
    description,
    canonical,
    robots: indexable ? undefined : 'noindex',
    jsonLd: match.id === 'home' ? organization(match.lang, description) : breadcrumbs(match, canonical),
    ogTitle: match.id === 'home' ? OG_TITLE[match.lang] : title,
  };
  if (!result) {
    const en = absolute(buildPath(match.id, param, 'en'));
    head.alternates = { en, fr: absolute(buildPath(match.id, param, 'fr')), 'x-default': en };
  }
  return head;
}

/** The HTML that replaces the marked block in index.html. */
export function renderHead(head: PageHead): string {
  const e = escapeHtml;
  const lines = [
    `<title>${e(head.title)}</title>`,
    `<meta name="description" content="${e(head.description)}" />`,
  ];
  if (head.robots) lines.push(`<meta name="robots" content="${e(head.robots)}" />`);
  if (head.canonical) lines.push(`<link rel="canonical" href="${e(head.canonical)}" />`);
  if (head.alternates) {
    for (const [hreflang, href] of Object.entries(head.alternates)) {
      lines.push(`<link rel="alternate" hreflang="${e(hreflang)}" href="${e(href)}" />`);
    }
  }
  if (head.canonical) {
    const ogTitle = head.ogTitle ?? head.title;
    const other: Lang = head.lang === 'en' ? 'fr' : 'en';
    lines.push(
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${e(COMPANY)}" />`,
      `<meta property="og:locale" content="${OG_LOCALE[head.lang]}" />`,
      `<meta property="og:locale:alternate" content="${OG_LOCALE[other]}" />`,
      `<meta property="og:url" content="${e(head.canonical)}" />`,
      `<meta property="og:title" content="${e(ogTitle)}" />`,
      `<meta property="og:description" content="${e(head.description)}" />`,
      `<meta property="og:image" content="${e(OG_IMAGE)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${e(COMPANY)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${e(ogTitle)}" />`,
      `<meta name="twitter:description" content="${e(head.description)}" />`,
      `<meta name="twitter:image" content="${e(OG_IMAGE)}" />`,
      `<meta name="twitter:image:alt" content="${e(COMPANY)}" />`,
    );
  }
  if (head.jsonLd) lines.push(`<script type="application/ld+json">${jsonForScript(head.jsonLd)}</script>`);
  return lines.join('\n    ');
}

/** index.html with the page's head block and language. Unmarked templates only get the language. */
export function renderIndexHtml(template: string, ctx: PageContext): string {
  const head = pageHead(ctx);
  let html = template.replace(/<html lang="[^"]*"/, `<html lang="${head.lang}"`);
  const start = html.indexOf(HEAD_START);
  const end = html.indexOf(HEAD_END);
  if (start !== -1 && end > start) {
    html = html.slice(0, start) + HEAD_START + '\n    ' + renderHead(head) + '\n    ' + html.slice(end);
  }
  return html;
}

/**
 * Reads index.html on first use and keeps it in memory (a deploy restarts the process, which
 * picks up the new file). Returns null when the file is missing, so the caller can fall back.
 */
export function createIndexRenderer(indexHtmlPath: string): (ctx: PageContext) => string | null {
  let template: string | null = null;
  return (ctx) => {
    if (template === null) {
      try {
        template = readFileSync(indexHtmlPath, 'utf8');
      } catch {
        return null;
      }
    }
    return renderIndexHtml(template, ctx);
  };
}

/**
 * Every public page in both languages, each with its alternates. Blog posts join with F.3
 * (the blog route is not live yet). Result pages, service tiers and the console never appear.
 */
export function sitemapPaths(): { en: string; fr: string }[] {
  const out: { en: string; fr: string }[] = [];
  for (const route of ROUTES) {
    if (route.live === false) continue;
    out.push({ en: buildPath(route.id, undefined, 'en'), fr: buildPath(route.id, undefined, 'fr') });
    if (route.id === 'legal') {
      for (const tab of LEGAL_TABS) {
        out.push({ en: buildPath('legal', tab, 'en'), fr: buildPath('legal', tab, 'fr') });
      }
    }
  }
  return out;
}

export function sitemapXml(): string {
  const e = escapeHtml;
  const urls: string[] = [];
  for (const pair of sitemapPaths()) {
    const links = [
      `    <xhtml:link rel="alternate" hreflang="en" href="${e(absolute(pair.en))}" />`,
      `    <xhtml:link rel="alternate" hreflang="fr" href="${e(absolute(pair.fr))}" />`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${e(absolute(pair.en))}" />`,
    ].join('\n');
    for (const lang of ['en', 'fr'] as const) {
      urls.push(`  <url>\n    <loc>${e(absolute(pair[lang]))}</loc>\n${links}\n  </url>`);
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls.join('\n')}\n</urlset>\n`
  );
}
