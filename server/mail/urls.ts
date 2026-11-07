// Links written into emails. They always start from a configured base URL, never from the
// request's Host header, so a forged Host can't point a reset link at another site.
import { ADMIN_PATH, SITE_URL } from '../../src/config/brand.js';

/** APP_URL when set (staging, local testing), else the live site. No trailing slash. */
export function appUrl(): string {
  return ((process.env.APP_URL || '').trim() || SITE_URL).replace(/\/+$/, '');
}

/**
 * Console link that opens the "set a new password" form. The token is in the fragment, so it
 * never reaches the server's access logs or a Referer header; the console removes it from the
 * address bar as soon as it reads it.
 */
export function passwordResetUrl(token: string): string {
  return `${appUrl()}${ADMIN_PATH}#reset=${encodeURIComponent(token)}`;
}

/** Public page of one quote request (hash route, App.tsx `#/quote/:id`). */
export function quoteUrl(id: string): string {
  return `${appUrl()}/#/quote/${encodeURIComponent(id)}`;
}

/** The staff console (links in staff alerts). */
export function consoleUrl(): string {
  return `${appUrl()}${ADMIN_PATH}`;
}
