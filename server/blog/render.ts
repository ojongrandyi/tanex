// Blog post body: TipTap/ProseMirror JSON → HTML, then sanitize-html with an allow-list of the
// editor's tags and attributes (docs/BLOG_SPEC.md §4–§5). The JSON is the editing source; the
// sanitised HTML is what the public site renders, generated on every save. The renderer escapes
// everything it writes and the sanitiser runs afterwards anyway, so neither alone is trusted.
import sanitizeHtml from 'sanitize-html';
import { DOMAIN } from '../../src/config/brand.js';

/** Public URL prefix of blog images (server/routes/media.ts). */
export const BLOG_MEDIA_PREFIX = '/media/blog/';
/** The only image sources allowed in a post: files this server stored under uploads/blog. */
export const BLOG_MEDIA_SRC = /^\/media\/blog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|avif)$/;

export const MAX_CONTENT_JSON_BYTES = 1_000_000;
const MAX_DEPTH = 40;
const MAX_NODES = 20_000;
export const WORDS_PER_MINUTE = 200;

const CALLOUT_TONES = ['info', 'tip', 'warning'] as const;
const SITE_HOSTS = new Set([DOMAIN, `www.${DOMAIN}`]);

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** Size of a stored blog image, for width/height and srcset in the rendered HTML. */
export interface MediaInfo {
  width: number | null;
  height: number | null;
  smallFileName?: string | null;
  smallWidth?: number | null;
}
export type MediaLookup = (fileName: string) => MediaInfo | null | undefined;

export interface RenderedContent {
  html: string;
  /** Plain text of the body (search, word count). */
  text: string;
  words: number;
  readingMinutes: number;
  /** Stored file names of the images the body uses. */
  mediaFiles: string[];
  /** Images without alt text (publishing refuses these; BLOG_SPEC §4). */
  imagesMissingAlt: number;
}

export type DocCheck = { ok: true; doc: PMNode } | { ok: false; error: string };

/** Checks that the editor document is a reasonable ProseMirror tree (shape, size, depth). */
export function parseDoc(input: unknown): DocCheck {
  let value = input;
  if (typeof value === 'string') {
    if (value.length > MAX_CONTENT_JSON_BYTES) return { ok: false, error: 'The article is too long.' };
    try { value = JSON.parse(value); } catch { return { ok: false, error: 'The article content is not valid.' }; }
  }
  if (!value || typeof value !== 'object' || (value as PMNode).type !== 'doc') {
    return { ok: false, error: 'The article content is not valid.' };
  }
  if (JSON.stringify(value).length > MAX_CONTENT_JSON_BYTES) return { ok: false, error: 'The article is too long.' };
  let nodes = 0;
  const walk = (node: unknown, depth: number): string | null => {
    if (depth > MAX_DEPTH) return 'The article is nested too deeply.';
    if (++nodes > MAX_NODES) return 'The article is too long.';
    if (!node || typeof node !== 'object' || Array.isArray(node)) return 'The article content is not valid.';
    const n = node as PMNode;
    if (typeof n.type !== 'string') return 'The article content is not valid.';
    if (n.text !== undefined && typeof n.text !== 'string') return 'The article content is not valid.';
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) return 'The article content is not valid.';
      for (const child of n.content) {
        const err = walk(child, depth + 1);
        if (err) return err;
      }
    }
    if (n.marks !== undefined && !Array.isArray(n.marks)) return 'The article content is not valid.';
    return null;
  };
  const err = walk(value, 0);
  return err ? { ok: false, error: err } : { ok: true, doc: value as PMNode };
}

/** An empty editor document. */
export const EMPTY_DOC: PMNode = { type: 'doc', content: [{ type: 'paragraph' }] };

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function str(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function int(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * A link target the site accepts: http(s), mailto, tel, a site path ("/services") or an anchor
 * ("#rates"). Anything else (javascript:, data:, protocol-relative "//host") gives null.
 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (!href || href.length > 2000 || /[\u0000-\u001f\u007f\s\\]/.test(href)) return null;
  if (href.startsWith('#')) return /^#[\w-]+$/.test(href) ? href : null;
  if (href.startsWith('/')) return href.startsWith('//') ? null : href;
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return href;
  return null;
}

/** True for absolute http(s) links to another site. */
export function isExternalHref(href: string): boolean {
  if (!/^https?:/i.test(href)) return false;
  try { return !SITE_HOSTS.has(new URL(href).hostname.toLowerCase()); } catch { return true; }
}

function linkTag(attrs: Record<string, unknown> | undefined): { open: string; close: string } | null {
  const href = safeHref(attrs?.href);
  if (!href) return null;
  if (isExternalHref(href)) {
    // External links open in a new tab; "nofollow ugc" only when the author asked for it.
    const rel = ['noopener', 'noreferrer', ...(attrs?.nofollow === true ? ['nofollow', 'ugc'] : [])].join(' ');
    return { open: `<a href="${esc(href)}" target="_blank" rel="${rel}">`, close: '</a>' };
  }
  return { open: `<a href="${esc(href)}" rel="noopener">`, close: '</a>' };
}

const SIMPLE_MARKS: Record<string, string> = { bold: 'strong', italic: 'em', strike: 's', underline: 'u', code: 'code' };

class Renderer {
  text: string[] = [];
  mediaFiles: string[] = [];
  imagesMissingAlt = 0;
  constructor(private media?: MediaLookup) {}

  children(node: PMNode): string {
    return (node.content ?? []).map((c) => this.node(c)).join('');
  }

  textNode(node: PMNode): string {
    const raw = node.text ?? '';
    if (!raw) return '';
    this.text.push(raw);
    let out = esc(raw);
    for (const mark of node.marks ?? []) {
      if (!mark || typeof mark.type !== 'string') continue;
      const tag = SIMPLE_MARKS[mark.type];
      if (tag) { out = `<${tag}>${out}</${tag}>`; continue; }
      if (mark.type === 'link') {
        const link = linkTag(mark.attrs);
        if (link) out = link.open + out + link.close;
      }
      // Other marks (highlight, colour, …) are not part of the article style: text only.
    }
    return out;
  }

  image(node: PMNode): string {
    const attrs = node.attrs ?? {};
    const src = typeof attrs.src === 'string' ? attrs.src.trim() : '';
    if (!BLOG_MEDIA_SRC.test(src)) return ''; // only images uploaded to the blog library
    const fileName = src.slice(BLOG_MEDIA_PREFIX.length);
    this.mediaFiles.push(fileName);
    const alt = str(attrs.alt, 300);
    if (!alt) this.imagesMissingAlt += 1;
    const caption = str(attrs.caption, 500);
    if (caption) this.text.push(caption);
    const info = this.media?.(fileName);
    let img = `<img src="${esc(src)}" alt="${esc(alt)}"`;
    if (info?.width && info?.height) img += ` width="${info.width}" height="${info.height}"`;
    if (info?.smallFileName && info.smallWidth && info.width && info.smallWidth < info.width) {
      img += ` srcset="${esc(BLOG_MEDIA_PREFIX + info.smallFileName)} ${info.smallWidth}w, ${esc(src)} ${info.width}w"`
        + ` sizes="(max-width: 760px) 100vw, 760px"`;
    }
    img += ' loading="lazy" decoding="async">';
    return `<figure class="tx-blog-figure">${img}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
  }

  node(node: PMNode): string {
    switch (node.type) {
      case 'doc': return this.children(node);
      case 'text': return this.textNode(node);
      case 'paragraph': {
        const inner = this.children(node);
        this.text.push('\n');
        return inner.trim() ? `<p>${inner}</p>` : '';
      }
      case 'heading': {
        // H1 is the post title; the body uses H2–H4.
        const level = Math.min(4, Math.max(2, int(node.attrs?.level, 1, 6) ?? 2));
        const inner = this.children(node);
        this.text.push('\n');
        return inner.trim() ? `<h${level}>${inner}</h${level}>` : '';
      }
      case 'bulletList': return `<ul>${this.children(node)}</ul>`;
      case 'orderedList': {
        const start = int(node.attrs?.start, 2, 100000);
        return `<ol${start ? ` start="${start}"` : ''}>${this.children(node)}</ol>`;
      }
      case 'listItem': return `<li>${this.children(node)}</li>`;
      case 'blockquote': return `<blockquote>${this.children(node)}</blockquote>`;
      case 'horizontalRule': return '<hr>';
      case 'hardBreak': return '<br>';
      case 'codeBlock': {
        const code = (node.content ?? []).map((c) => c.text ?? '').join('');
        this.text.push(code, '\n');
        return code ? `<pre><code>${esc(code)}</code></pre>` : '';
      }
      case 'image':
      case 'figure':
        return this.image(node);
      case 'table': return `<div class="tx-blog-table"><table><tbody>${this.children(node)}</tbody></table></div>`;
      case 'tableRow': return `<tr>${this.children(node)}</tr>`;
      case 'tableHeader':
      case 'tableCell': {
        const tag = node.type === 'tableHeader' ? 'th' : 'td';
        const colspan = int(node.attrs?.colspan, 2, 20);
        const rowspan = int(node.attrs?.rowspan, 2, 100);
        const span = (colspan ? ` colspan="${colspan}"` : '') + (rowspan ? ` rowspan="${rowspan}"` : '');
        return `<${tag}${span}>${this.children(node)}</${tag}>`;
      }
      case 'callout': {
        const raw = node.attrs?.tone;
        const tone = (CALLOUT_TONES as readonly unknown[]).includes(raw) ? raw as string : 'info';
        return `<aside class="tx-callout tx-callout--${tone}">${this.children(node)}</aside>`;
      }
      default:
        // Unknown block: keep its text, drop the wrapper.
        return this.children(node);
    }
  }
}

function filterRel(rel: string | undefined, external: boolean): string {
  const allowed = new Set(['noopener', 'noreferrer', 'nofollow', 'ugc']);
  const tokens = new Set((rel ?? '').toLowerCase().split(/\s+/).filter((t) => allowed.has(t)));
  tokens.add('noopener');
  if (external) tokens.add('noreferrer');
  return [...tokens].join(' ');
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h2', 'h3', 'h4', 'strong', 'em', 's', 'u', 'code', 'pre', 'br', 'hr', 'a',
    'ul', 'ol', 'li', 'blockquote', 'figure', 'figcaption', 'img',
    'div', 'table', 'tbody', 'tr', 'th', 'td', 'aside'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes', 'loading', 'decoding'],
    ol: ['start'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    aside: ['class'],
    div: ['class'],
    figure: ['class']
  },
  allowedClasses: {
    aside: ['tx-callout', ...CALLOUT_TONES.map((t) => `tx-callout--${t}`)],
    div: ['tx-blog-table'],
    figure: ['tx-blog-figure']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  allowedStyles: {},
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => {
      const href = safeHref(attribs.href);
      if (!href) return { tagName: 'span', attribs: {} }; // the span is then dropped, its text kept
      const external = isExternalHref(href);
      const out: Record<string, string> = { href, rel: filterRel(attribs.rel, external) };
      if (external) out.target = '_blank';
      return { tagName: 'a', attribs: out };
    },
    img: (tagName, attribs) => {
      const out: Record<string, string> = { ...attribs };
      if (out.srcset) {
        const ok = out.srcset.split(',').every((part) => {
          const [url, size, ...rest] = part.trim().split(/\s+/);
          return rest.length === 0 && BLOG_MEDIA_SRC.test(url ?? '') && /^\d{1,5}w$/.test(size ?? '');
        });
        if (!ok) { delete out.srcset; delete out.sizes; }
      }
      if (out.sizes && !/^[\w\s(),:.%-]{1,120}$/.test(out.sizes)) delete out.sizes;
      for (const k of ['width', 'height']) if (out[k] && !/^\d{1,5}$/.test(out[k])) delete out[k];
      if (out.loading && out.loading !== 'lazy') delete out.loading;
      if (out.decoding && out.decoding !== 'async') delete out.decoding;
      return { tagName, attribs: out };
    }
  },
  // Images from anywhere but the blog library are removed.
  exclusiveFilter: (frame) => frame.tag === 'img' && !BLOG_MEDIA_SRC.test(frame.attribs.src ?? '')
};

/** Allow-list sanitiser for post HTML. Also used on its own (tests, any HTML from elsewhere). */
export function sanitizeBlogHtml(html: string): string {
  // span is not allowed, so the placeholder from a refused link disappears and keeps its text.
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Words ÷ 200, rounded, at least 1 (BLOG_SPEC §5). */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

/** Renders and sanitises a checked editor document. */
export function renderDoc(doc: PMNode, media?: MediaLookup): RenderedContent {
  const r = new Renderer(media);
  const html = sanitizeBlogHtml(r.node(doc));
  const text = r.text.join(' ').replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const words = countWords(text);
  return {
    html,
    text,
    words,
    readingMinutes: readingMinutes(words),
    mediaFiles: [...new Set(r.mediaFiles)],
    imagesMissingAlt: r.imagesMissingAlt
  };
}
