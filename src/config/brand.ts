// Single source of truth for brand facts (CLAUDE.md §2, BRAND_GUIDE.md). Import from here
// instead of hard-coding names, emails or domains in components.
//
// Contact values left as '' are not known yet. UI that would show them must hide itself
// (see useCompanyContact). Never fill these with made-up numbers or addresses.

// Typed as string (not literals) so code that compares them, e.g. legalDocs.ts, stays generic.
export const COMPANY: string = 'TanEx';
export const COMPANY_SHORT: string = 'TanEx';
export const LEGAL_NAME: string = 'Tanex SARL';
export const TAGLINE = 'From Your Door to the World';
// French tagline (CONTENT_FR). Used once the i18n layer lands (task D.3).
export const TAGLINE_FR = 'De votre porte au monde entier';

export const EMAIL = 'info@tanexsarl.com';
// Apex domain; www. redirects here (DEPLOYMENT.md).
export const DOMAIN = 'tanexsarl.com';
export const SITE_URL = `https://${DOMAIN}`;

// Logo files in Public/brand (BRAND_GUIDE §6). Full colour on light surfaces, white on Ink.
export const LOGO = '/brand/logo.png';
export const LOGO_WHITE = '/brand/logo-white.png';
export const LOGO_ALT = COMPANY;
// Small WebP copies (104 px tall, 2x the header's tallest size) for the site header and footer.
// The full-size PNGs above stay for the PDFs and the admin console.
export const LOGO_WEB = '/brand/logo-web.webp';
export const LOGO_WHITE_WEB = '/brand/logo-white-web.webp';
export const LOGO_WEB_WIDTH = 346;
export const LOGO_WEB_HEIGHT = 104;

// The admin console lives at this path on the main domain, served by the same app and API
// (plus #/admin on localhost for development). Never listed in robots.txt or the sitemap.
export const ADMIN_PATH = '/private-user/';
export const ADMIN_URL = `${SITE_URL}${ADMIN_PATH}`;

// True only for the admin path itself, with or without the trailing slash, any case.
// '/private-user-x', '/private-users' and '/private-user/anything' don't match.
export function isAdminPathname(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');
  return normalized === ADMIN_PATH.replace(/\/+$/, '');
}
export const ADMIN_CONSOLE_NAME = `${COMPANY_SHORT} Operations Console`;

// Role label shown in the admin UI (CONTENT §10), also written as the operator on new records.
export const ADMIN_ROLE_LABEL = 'Administrator';
// Older records may store the operator as "Super Admin". They're left as
// stored (audit history is not rewritten); the UI shows the current label instead.
export function displayOperator(operator?: string | null): string {
  return !operator || operator === 'Super Admin' ? ADMIN_ROLE_LABEL : operator;
}
// Public-facing desk names (CONTENT §10).
export const OPERATIONS_CENTRE = `${COMPANY_SHORT} Operations Centre`;
export const INTAKE_DESK = `${COMPANY_SHORT} Intake Desk`;

// Tracking ID = prefix + 6 characters, 8 total (BRAND_GUIDE §7).
export const TRACKING_PREFIX = 'TX';
// Example ID for placeholders and help text.
export const TRACKING_ID_EXAMPLE = `${TRACKING_PREFIX}7K2M9P`;

// Non-tracking references (tickets, invoices, seals, cash ledger) start with this, e.g. TX-TKT-123456.
export const REFERENCE_PREFIX = 'TX';

// Phone numbers in E.164. Always display them through formatPhone().
export const PHONE = '+237651059345';
export const PHONE_2 = '+237691194663';
// TBD: which number is on WhatsApp (tracker #100). Stays '' until the owner confirms.
export const WHATSAPP = '';

export const HQ_ADDRESS = 'Check Point, opposite Molyko Omnisport Stadium, Buea, Cameroon';

export interface Office {
  city: string;
  label: string;
  address: string;
}

export const OFFICES: readonly Office[] = [
  { city: 'Buea', label: 'Head office', address: HQ_ADDRESS },
  { city: 'Douala', label: 'Douala office', address: 'Kotto, La Canadienne, Douala, Cameroon' },
];

// Opening hours, 24-hour local time (Africa/Douala). The days of the week are TBD: while `days`
// is empty, UI shows the hours only.
export const OPENING_HOURS: { opens: string; closes: string; days: readonly string[] } = {
  opens: '09:00',
  closes: '16:00',
  days: [],
};

// "09:00" -> "9:00 AM". English only; the i18n layer (task D.3) moves this to Intl.
function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Opening hours for display, e.g. "9:00 AM – 4:00 PM". */
export function formatOpeningHours(hours: { opens: string; closes: string } = OPENING_HOURS): string {
  return `${formatClock(hours.opens)} – ${formatClock(hours.closes)}`;
}

/**
 * Display form of a phone number. Cameroon numbers (+237 / 00237 and 9 digits) are grouped as
 * "+237 651 05 93 45"; anything else is returned trimmed, as entered.
 */
export function formatPhone(phone: string): string {
  const trimmed = (phone || '').trim();
  const compact = trimmed.replace(/[\s().-]/g, '');
  const cm = /^(?:\+|00)237(\d{9})$/.exec(compact);
  if (!cm) return trimmed;
  const n = cm[1];
  return `+237 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

export const SOCIAL = {
  facebook: '',
  x: '',
  instagram: '',
  linkedin: '',
  youtube: '',
};

// Smartsupp live chat widget key (public: it ships in the page). Loaded on the public site only by
// src/services/liveChat.ts. '' keeps the chat off: TanEx has no key of its own yet (tracker #109).
export const SMARTSUPP_KEY = '';

export type SocialNetwork = keyof typeof SOCIAL;
