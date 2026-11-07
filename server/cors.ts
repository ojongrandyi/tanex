// Which origins may call the API from a browser with credentials. Only the site's own origins
// (and localhost for development): reflecting any origin with credentials would let another
// website read API answers with a staff member's session wherever the browser sends the cookie.
// Extra origins: CORS_ORIGINS (comma-separated), read on each call.
import { DOMAIN, SITE_URL } from '../src/config/brand.js';
import { appUrl } from './mail/urls.js';

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  // No Origin header: same-origin requests and non-browser clients.
  if (!origin) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;
  const allowed = [
    SITE_URL,
    `https://www.${DOMAIN}`,
    appUrl(),
    ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
  ];
  return allowed.includes(origin);
}
