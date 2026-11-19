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

/** One line of an order (shop emails): "2 × Name (TX-PRD-123456) · 9,000 FCFA", with an optional picture. */
export interface EmailItem {
  qty: number;
  name: string;
  code: string;
  /** Already formatted with its currency. */
  amount: string;
  /** Absolute https URL of a JPEG on the site's own domain. */
  imageUrl?: string | null;
}

/**
 * A block of the email body. A plain array is a paragraph (every existing template uses only
 * those); the other blocks were added for the shop emails (M.6).
 */
export type Block =
  | Paragraph
  | { heading: string }
  | { items: EmailItem[] }
  /** Label/value pairs, e.g. totals; `strong` makes the row bold (the total). */
  | { rows: { label: string; value: string; strong?: boolean }[] }
  | { button: { label: string; url: string } };

const isHttpUrl = (url: string | null | undefined): url is string => !!url && /^https?:\/\//i.test(url);

export const itemLine = (i: EmailItem): string => `${i.qty} × ${i.name} (${i.code}) · ${i.amount}`;

function blockText(b: Block, locale: MailLocale): string {
  // French puts a space before the colon.
  const sep = locale === 'fr' ? ' : ' : ': ';
  if (Array.isArray(b)) return paragraphText(b);
  if ('heading' in b) return b.heading.toUpperCase();
  if ('items' in b) return b.items.map((i) => `- ${itemLine(i)}`).join('\n');
  if ('rows' in b) return b.rows.map((r) => `${r.label}${sep}${r.value}`).join('\n');
  return `${b.button.label}${sep}${b.button.url}`;
}

const P_STYLE = `margin:0 0 16px 0;font-size:16px;line-height:24px;color:${CHOC_900};`;

function blockHtml(b: Block): string {
  if (Array.isArray(b)) return `<p style="${P_STYLE}">${paragraphHtml(b)}</p>`;
  if ('heading' in b) {
    return `<h2 style="margin:24px 0 8px 0;font-size:17px;line-height:24px;color:${CHOC_950};">${escapeHtml(b.heading)}</h2>`;
  }
  if ('items' in b) {
    // The picture column only when at least one line has a picture.
    const anyPic = b.items.some((i) => isHttpUrl(i.imageUrl));
    const rows = b.items.map((i) => {
      const pic = isHttpUrl(i.imageUrl)
        ? `<img src="${escapeHtml(i.imageUrl)}" width="56" height="56" alt="" style="display:block;border:0;width:56px;height:56px;border-radius:4px;background:${CREAM_100};">`
        : '';
      return `<tr>
${anyPic ? `<td width="64" valign="top" style="padding:8px 8px 8px 0;border-bottom:1px solid #EDE1DA;">${pic}</td>` : ''}
<td valign="top" style="padding:8px 0;border-bottom:1px solid #EDE1DA;font-size:15px;line-height:22px;color:${CHOC_900};word-break:break-word;overflow-wrap:anywhere;">${i.qty} × ${escapeHtml(i.name)}<br><span style="font-size:13px;color:${CHOC_600};">${escapeHtml(i.code)}</span></td>
<td valign="top" align="right" style="padding:8px 0 8px 8px;border-bottom:1px solid #EDE1DA;font-size:15px;line-height:22px;color:${CHOC_900};white-space:nowrap;">${escapeHtml(i.amount)}</td>
</tr>`;
    }).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">${rows}</table>`;
  }
  if ('rows' in b) {
    const rows = b.rows.map((r) => {
      const weight = r.strong ? 'font-weight:bold;' : '';
      return `<tr>
<td valign="top" style="padding:4px 12px 4px 0;font-size:15px;line-height:22px;color:${CHOC_600};${weight}">${escapeHtml(r.label)}</td>
<td valign="top" align="right" style="padding:4px 0;font-size:15px;line-height:22px;color:${CHOC_900};word-break:break-word;overflow-wrap:anywhere;${weight}">${escapeHtml(r.value)}</td>
</tr>`;
    }).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">${rows}</table>`;
  }
  if (!isHttpUrl(b.button.url)) return `<p style="${P_STYLE}">${escapeHtml(b.button.label)}</p>`;
  return `<p style="margin:8px 0 20px 0;"><a href="${escapeHtml(b.button.url)}" style="display:inline-block;background:${CHOC_950};color:#FFFFFF;font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:6px;">${escapeHtml(b.button.label)}</a></p>`;
}

/** Builds the HTML and text bodies from blocks; the signature `— TanEx` is added (CONTENT §14). */
export function renderEmail(locale: MailLocale, subject: string, blocks: Block[]): RenderedEmail {
  const signature = `— ${COMPANY}`;
  // Same base as the links (APP_URL or the live site), so a staging copy shows its own logo.
  const base = appUrl();
  const text = [...blocks.map((b) => blockText(b, locale)), signature, `${LEGAL_NAME} · ${DOMAIN}`].join('\n\n') + '\n';

  const body = blocks.map(blockHtml).join('');

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
