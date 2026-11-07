// Public page paths (I18N_SPEC §2): every path in the route table (src/router/routes.ts),
// including /track/:id, /quote/:id, /services/:tier and /legal/:tab, answers 200 with the app's
// index.html; App.tsx picks the page from the path. A non-canonical spelling of a known path
// (/services/, /fr, /track/TX7K2M9P/) gets a 301 to the canonical one. Anything else falls
// through to the 404 handler in index.ts. Routes marked `live: false` (blog, local delivery
// booking) stay 404 until their pages exist.
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { matchPath } from '../src/router/routes.js';

export function publicPages(indexHtmlPath: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const match = matchPath(req.path);
    if (!match) return next();
    if (req.path !== match.canonical) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      res.redirect(301, match.canonical + query);
      return;
    }
    // Always re-checked, like index.html itself, so a new deploy shows up at once.
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtmlPath, (err) => {
      if (err) next(err);
    });
  };
}
