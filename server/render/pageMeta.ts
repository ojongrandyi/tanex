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

/** A blog post's head data, read from the database by server/blog/pageData.ts. */
export interface BlogPostMeta {
  /** The article's own title (headline, breadcrumb). */
  headline: string;
  /** SEO title, or the headline (<title>, og:title). */
  title: string;
  description: string;
  excerpt: string;
  /** Root-relative cover URL with its size, or null (the brand image is used instead). */
  image: { url: string; width: number | null; height: number | null; alt: string } | null;
  publishedAt: number;
  modifiedAt: number;
  author: { name: string; jobTitle: string };
  section: string | null;
  tags: string[];
  /** Root-relative path of every public language version, this one included. */
  versions: Partial<Record<Lang, string>>;
}

/** What the database knows about a blog page (BLOG_SPEC §7). */
export type BlogPageData =
  | { type: 'index'; hasPosts: boolean; page: number }
  | { type: 'category'; name: string; description: string; versions: Partial<Record<Lang, string>>; page: number }
  | { type: 'post'; post: BlogPostMeta };

export type PageContext =
  | { kind: 'page'; match: RouteMatch; blog?: BlogPageData }
  | { kind: 'not-found'; lang: Lang }
  | { kind: 'admin' };

const HEAD_START = '<!-- tx:head -->';
const HEAD_END = '<!-- /tx:head -->';
const ROOT_ELEMENT = '<div id="root"></div>';
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
  alternates?: Partial<Record<'en' | 'fr' | 'x-default', string>>;
  robots?: string;
  /** One JSON-LD object, or several (each gets its own script block). */
  jsonLd?: unknown;
  ogTitle?: string;
  /** Default 'website'. */
  ogType?: 'website' | 'article';
  /** Default: the brand image (1200 × 630). Absolute URL. */
  ogImage?: { url: string; width: number | null; height: number | null; alt: string };
  /** Open Graph article:* tags. */
  article?: { publishedTime: string; modifiedTime: string; section: string | null; tags: string[] };
  /** RSS feed of the page's language (blog pages). Absolute URL. */
  feed?: { title: string; href: string };
  /** Shown to visitors and crawlers without JavaScript, after the app's root element. */
  noscript?: { title: string; text: string };
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

function breadcrumbs(match: RouteMatch, canonical: string, last?: string) {
  const lang = match.lang;
  const items = [{ name: pageName('home', lang), item: absolute(buildPath('home', undefined, lang)) }];
  if (match.id === 'blog-category' || (match.id === 'blog' && match.param !== undefined)) {
    // Home → Blog → category or article.
    items.push({ name: pageName('blog', lang), item: absolute(buildPath('blog', undefined, lang)) });
    items.push({ name: last ?? pageName(match.id, lang), item: canonical });
  } else {
    items.push({ name: pageName(match.id, lang), item: canonical });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}

/** hreflang alternates for the language versions that exist; x-default is the English one when there is one. */
function versionAlternates(versions: Partial<Record<Lang, string>>): PageHead['alternates'] {
  const out: NonNullable<PageHead['alternates']> = {};
  if (versions.en) out.en = absolute(versions.en);
  if (versions.fr) out.fr = absolute(versions.fr);
  const def = versions.en ?? versions.fr;
  if (def) out['x-default'] = absolute(def);
  return out;
}

/** "Blog | TanEx" → "Blog, page 2 | TanEx" for page 2 and later of a list. */
function pagedTitle(title: string, page: number): string {
  if (page <= 1) return title;
  return title.replace(/(\s*\|[^|]*)$/, `, page ${page}$1`);
}
const pageQuery = (page: number) => (page > 1 ? `?page=${page}` : '');

/** Blog RSS feed of a language (served by server/blog/feeds.ts). */
export function blogFeedPath(lang: Lang): string {
  return `${buildPath('blog', undefined, lang)}/rss.xml`;
}

const BLOG_NAME: Record<Lang, string> = { en: `${COMPANY} Blog`, fr: `Blog ${COMPANY}` };

export function blogName(lang: Lang): string {
  return BLOG_NAME[lang];
}

function feedOf(lang: Lang): PageHead['feed'] {
  return { title: BLOG_NAME[lang], href: absolute(blogFeedPath(lang)) };
}

/** Head for the blog index, a category or an article, from the database's data (BLOG_SPEC §7). */
function blogHead(match: RouteMatch, data: BlogPageData): PageHead {
  const lang = match.lang;
  const indexable = lang === 'en' || FRENCH_PAGES_INDEXABLE;
  if (data.type === 'index') {
    const base = pageMetaText('blog', lang);
    const canonical = absolute(buildPath('blog', undefined, lang)) + pageQuery(data.page);
    const en = absolute(buildPath('blog', undefined, 'en'));
    return {
      lang,
      title: pagedTitle(base.title, data.page),
      description: base.description,
      canonical,
      // An index without articles is an empty page: kept out of search until the first post.
      robots: indexable && data.hasPosts ? undefined : 'noindex',
      alternates: data.page > 1 ? undefined : { en, fr: absolute(buildPath('blog', undefined, 'fr')), 'x-default': en },
      jsonLd: breadcrumbs(match, canonical),
      feed: feedOf(lang),
    };
  }
  if (data.type === 'category') {
    const canonical = absolute(buildPath('blog-category', match.param, lang)) + pageQuery(data.page);
    return {
      lang,
      title: pagedTitle(`${data.name} | ${BLOG_NAME[lang]}`, data.page),
      description: data.description || pageMetaText('blog', lang).description,
      canonical,
      robots: indexable ? undefined : 'noindex',
      alternates: data.page > 1 ? undefined : versionAlternates(data.versions),
      jsonLd: breadcrumbs(match, canonical, data.name),
      feed: feedOf(lang),
    };
  }
  const post = data.post;
  const canonical = absolute(buildPath('blog', match.param, lang));
  const image = post.image
    ? { url: absolute(post.image.url), width: post.image.width, height: post.image.height, alt: post.image.alt }
    : undefined;
  const published = new Date(post.publishedAt).toISOString();
  const modified = new Date(Math.max(post.modifiedAt, post.publishedAt)).toISOString();
  const posting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
    headline: post.headline.slice(0, 110),
    description: post.description,
    inLanguage: lang,
    image: [image ? image.url : OG_IMAGE],
    datePublished: published,
    dateModified: modified,
    author: { '@type': 'Person', name: post.author.name, ...(post.author.jobTitle ? { jobTitle: post.author.jobTitle } : {}) },
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: LEGAL_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/mark.png` },
    },
    ...(post.section ? { articleSection: post.section } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(', ') } : {}),
  };
  return {
    lang,
    title: `${post.title} | ${COMPANY}`,
    description: post.description,
    canonical,
    robots: indexable ? undefined : 'noindex',
    alternates: versionAlternates(post.versions),
    jsonLd: [posting, breadcrumbs(match, canonical, post.headline)],
    ogTitle: post.title,
    ogType: 'article',
    ogImage: image,
    article: { publishedTime: published, modifiedTime: modified, section: post.section, tags: post.tags },
    feed: feedOf(lang),
    noscript: { title: post.headline, text: post.excerpt },
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
  if (ctx.blog) return blogHead(match, ctx.blog);
  const { title, description } = pageMetaText(match.id, match.lang);
  const param = canonicalParam(match);
  const canonical = absolute(buildPath(match.id, param, match.lang));
  const result = isResultPage(match);
  const hidden = ROUTES.find((r) => r.id === match.id)?.noindex === true;
  const indexable = !result && !hidden && (match.lang === 'en' || FRENCH_PAGES_INDEXABLE);
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
  if (head.feed) {
    lines.push(`<link rel="alternate" type="application/rss+xml" title="${e(head.feed.title)}" href="${e(head.feed.href)}" />`);
  }
  if (head.canonical) {
    const ogTitle = head.ogTitle ?? head.title;
    const other: Lang = head.lang === 'en' ? 'fr' : 'en';
    const image = head.ogImage ?? { url: OG_IMAGE, width: 1200, height: 630, alt: COMPANY };
    const imageAlt = image.alt || ogTitle;
    lines.push(
      `<meta property="og:type" content="${head.ogType ?? 'website'}" />`,
      `<meta property="og:site_name" content="${e(COMPANY)}" />`,
      `<meta property="og:locale" content="${OG_LOCALE[head.lang]}" />`,
      `<meta property="og:locale:alternate" content="${OG_LOCALE[other]}" />`,
      `<meta property="og:url" content="${e(head.canonical)}" />`,
      `<meta property="og:title" content="${e(ogTitle)}" />`,
      `<meta property="og:description" content="${e(head.description)}" />`,
      `<meta property="og:image" content="${e(image.url)}" />`,
      ...(image.width ? [`<meta property="og:image:width" content="${image.width}" />`] : []),
      ...(image.height ? [`<meta property="og:image:height" content="${image.height}" />`] : []),
      `<meta property="og:image:alt" content="${e(imageAlt)}" />`,
    );
    if (head.article) {
      lines.push(
        `<meta property="article:published_time" content="${e(head.article.publishedTime)}" />`,
        `<meta property="article:modified_time" content="${e(head.article.modifiedTime)}" />`,
      );
      if (head.article.section) lines.push(`<meta property="article:section" content="${e(head.article.section)}" />`);
      for (const tag of head.article.tags) lines.push(`<meta property="article:tag" content="${e(tag)}" />`);
    }
    lines.push(
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${e(ogTitle)}" />`,
      `<meta name="twitter:description" content="${e(head.description)}" />`,
      `<meta name="twitter:image" content="${e(image.url)}" />`,
      `<meta name="twitter:image:alt" content="${e(imageAlt)}" />`,
    );
  }
  if (head.jsonLd) {
    for (const block of Array.isArray(head.jsonLd) ? head.jsonLd : [head.jsonLd]) {
      lines.push(`<script type="application/ld+json">${jsonForScript(block)}</script>`);
    }
  }
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
  if (head.noscript) {
    // An article's title and excerpt for readers and crawlers without JavaScript (BLOG_SPEC §7).
    const block = `<noscript><article><h1>${escapeHtml(head.noscript.title)}</h1><p>${escapeHtml(head.noscript.text)}</p></article></noscript>`;
    html = html.replace(ROOT_ELEMENT, () => `${ROOT_ELEMENT}\n    ${block}`);
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
 * Every public page in both languages, each with its alternates. The blog is listed from the
 * database instead (server/blog/pageData.ts `blogSitemapEntries`): its index only for a language
 * with a public post, then each category and post. The shop's pages join with M.8, from the
 * database and only while the shop is on. Result pages, service tiers and the console never appear.
 */
export function sitemapPaths(): { en: string; fr: string }[] {
  const out: { en: string; fr: string }[] = [];
  for (const route of ROUTES) {
    if (route.live === false || route.noindex || route.id === 'blog' || route.id === 'blog-category') continue;
    if (route.id === 'shop' || route.id === 'shop-category') continue;
    out.push({ en: buildPath(route.id, undefined, 'en'), fr: buildPath(route.id, undefined, 'fr') });
    if (route.id === 'legal') {
      for (const tab of LEGAL_TABS) {
        out.push({ en: buildPath('legal', tab, 'en'), fr: buildPath('legal', tab, 'fr') });
      }
    }
  }
  return out;
}

/** One sitemap page in the languages it exists in (root-relative paths), with its last change. */
export interface SitemapEntry {
  paths: Partial<Record<Lang, string>>;
  lastmod?: number;
}

export function sitemapXml(extra: readonly SitemapEntry[] = []): string {
  const e = escapeHtml;
  const urls: string[] = [];
  const entries: SitemapEntry[] = [...sitemapPaths().map((paths) => ({ paths })), ...extra];
  for (const entry of entries) {
    const alternates = versionAlternates(entry.paths) ?? {};
    const links = Object.entries(alternates)
      .map(([hreflang, href]) => `    <xhtml:link rel="alternate" hreflang="${e(hreflang)}" href="${e(href)}" />`)
      .join('\n');
    const lastmod = entry.lastmod ? `\n    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>` : '';
    for (const lang of ['en', 'fr'] as const) {
      const path = entry.paths[lang];
      if (!path) continue;
      urls.push(`  <url>\n    <loc>${e(absolute(path))}</loc>${lastmod}\n${links}\n  </url>`);
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls.join('\n')}\n</urlset>\n`
  );
}
