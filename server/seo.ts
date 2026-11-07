import { Router, Request, Response, NextFunction } from 'express';
import { ADMIN_PATH, SITE_URL } from '../src/config/brand.js';
import { sitemapXml } from './render/pageMeta.js';

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

// Every public page in English and French with xhtml:link alternates, built from the route table
// (server/render/pageMeta.ts). The console path is never in it.
seoRouter.get('/sitemap.xml', (req: Request, res: Response) => {
  res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(sitemapXml());
});
