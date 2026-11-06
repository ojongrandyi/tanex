import { Router, Request, Response, NextFunction } from 'express';
import { ADMIN_PATH, SITE_URL } from '../src/config/brand.js';

// robots.txt, sitemap.xml and crawler headers (tracker 6.4). The public site and the admin
// console are the same Node app on the same host; the admin is the ADMIN_PATH (/private-user/).
// That path is never listed anywhere a crawler can read it, robots.txt included (listing it
// there would advertise it); the X-Robots-Tag header below keeps it out of the index instead.

const ADMIN_PREFIX = ADMIN_PATH.replace(/\/+$/, '').toLowerCase();

// ADMIN_PROXY_TARGET marks a deployment that serves only the admin (see index.ts).
function isAdminRequest(req: Request): boolean {
  if (process.env.ADMIN_PROXY_TARGET) return true;
  const p = req.path.toLowerCase();
  return p === ADMIN_PREFIX || p.startsWith(`${ADMIN_PREFIX}/`);
}

// The site uses hash routing (#/services, #/track/…). Search engines drop everything after "#",
// so the home URL is the only page they can index on its own; hash URLs don't belong in a sitemap.
const SITEMAP_PATHS = ['/'];

export const seoRouter = Router();

// Belt and braces for the admin path: a header works before any HTML or JS runs (App.tsx adds
// the matching robots meta tag at runtime).
seoRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (isAdminRequest(req)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

seoRouter.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  res.send(`User-agent: *\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

seoRouter.get('/sitemap.xml', (req: Request, res: Response) => {
  const urls = SITEMAP_PATHS
    .map((p) => `  <url>\n    <loc>${SITE_URL}${p}</loc>\n  </url>`)
    .join('\n');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
});
