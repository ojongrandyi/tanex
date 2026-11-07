// Branded email layout (docs/NOTIFICATIONS_SPEC.md §3): table-based HTML with the logo on a
// chocolate header bar and a cream body, plus a plain-text twin. No remote trackers: the only
// remote file is the logo on the site's own domain.
import { COMPANY, DOMAIN, LEGAL_NAME, LOGO_WHITE } from '../../src/config/brand.js';
import { appUrl } from './urls.js';

export type MailLocale = 'en' | 'fr';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** A paragraph is plain text with optional links: strings are text, `{ url }` is a link. */
export type Segment = string | { url: string };
export type Paragraph = Segment[];

// BRAND_GUIDE §3: Chocolate 950 header, Cream 100 body, Chocolate 900 text, Orange 700 links on light.
const CHOC_950 = '#1C120E';
const CHOC_900 = '#2A1B16';
const CHOC_600 = '#5F4034';
const CREAM_100 = '#FBF6EC';
const ORANGE_500 = '#F48800';
const ORANGE_700 = '#9A5200';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One line, no control characters, capped: for names and other values a visitor typed. */
export function cleanVar(value: unknown, max = 80): string {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value);
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function paragraphText(p: Paragraph): string {
  return p.map((s) => (typeof s === 'string' ? s : s.url)).join('');
}

function paragraphHtml(p: Paragraph): string {
  return p
    .map((s) =>
      typeof s === 'string'
        ? escapeHtml(s)
        : `<a href="${escapeHtml(s.url)}" style="color:${ORANGE_700};text-decoration:underline;word-break:break-all;">${escapeHtml(s.url)}</a>`
    )
    .join('');
}

/** Builds the HTML and text bodies from paragraphs; the signature `— TanEx` is added (CONTENT §14). */
export function renderEmail(locale: MailLocale, subject: string, paragraphs: Paragraph[]): RenderedEmail {
  const signature = `— ${COMPANY}`;
  // Same base as the links (APP_URL or the live site), so a staging copy shows its own logo.
  const base = appUrl();
  const text = [...paragraphs.map(paragraphText), signature, `${LEGAL_NAME} · ${DOMAIN}`].join('\n\n') + '\n';

  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;color:${CHOC_900};">${paragraphHtml(p)}</p>`)
    .join('');

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM_100};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM_100};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:8px;overflow:hidden;">
<tr><td style="background:${CHOC_950};padding:20px 24px;border-bottom:3px solid ${ORANGE_500};">
<img src="${base}${LOGO_WHITE}" width="139" height="48" alt="${escapeHtml(COMPANY)}" style="display:block;border:0;height:48px;width:auto;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;">
</td></tr>
<tr><td style="padding:28px 24px 12px 24px;font-family:Arial,Helvetica,sans-serif;">
${body}
<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;color:${CHOC_900};">${escapeHtml(signature)}</p>
</td></tr>
<tr><td style="padding:16px 24px 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${CHOC_600};border-top:1px solid #EDE1DA;">
${escapeHtml(LEGAL_NAME)} · <a href="${base}" style="color:${ORANGE_700};text-decoration:none;">${escapeHtml(DOMAIN)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
