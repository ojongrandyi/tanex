// Public page paths (I18N_SPEC §2, §4): every path in the route table (src/router/routes.ts),
// including /track/:id, /quote/:id, /services/:tier and /legal/:tab, answers 200 with the app's
// index.html, with that page's title, description, canonical, hreflang, Open Graph and JSON-LD
// injected server-side (server/render/pageMeta.ts); App.tsx picks the page from the path. A
// non-canonical spelling of a known path (/services/, /fr, /track/TX7K2M9P/) gets a 301 to the
// canonical one. Anything else falls through to the 404 handler in index.ts. Routes marked
// `live: false` (local delivery booking) stay 404 until their pages exist.
//
// Blog pages (/blog, /blog/<slug>, /blog/category/<slug>) also ask the database (BLOG_SPEC §7):
// an article's head comes from the post, an unknown or unpublished article or an empty category
// is a real 404, and an old slug of a public article gets a 301 to its current address.
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { matchPath, type RouteMatch } from '../src/router/routes.js';
import type { PageContext } from './render/pageMeta.js';
import type { BlogPageResult } from './blog/pageData.js';

export type IndexRenderer = (ctx: PageContext) => string | null;
export type BlogResolver = (match: RouteMatch, query: Record<string, unknown>) => BlogPageResult;

/** Sends index.html rendered for `ctx` (no-cache, so a new deploy shows up at once). */
export function sendIndex(res: Response, next: NextFunction, render: IndexRenderer, ctx: PageContext, fallbackPath: string): void {
  res.setHeader('Cache-Control', 'no-cache');
  const html = render(ctx);
  if (html === null) {
    res.sendFile(fallbackPath, (err) => {
      if (err) next(err);
    });
    return;
  }
  res.type('html').send(html);
}

export function publicPages(render: IndexRenderer, indexHtmlPath: string, resolveBlog?: BlogResolver): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const match = matchPath(req.path);
    if (!match) return next();
    if (req.path !== match.canonical) {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      res.redirect(301, match.canonical + query);
      return;
    }
    if (resolveBlog && (match.id === 'blog' || match.id === 'blog-category')) {
      let result: BlogPageResult;
      try {
        result = resolveBlog(match, req.query as Record<string, unknown>);
      } catch (err) {
        return next(err);
      }
      if (result.kind === 'not-found') return next();
      if (result.kind === 'redirect') {
        res.redirect(301, result.location);
        return;
      }
      sendIndex(res, next, render, { kind: 'page', match, blog: result.blog }, indexHtmlPath);
      return;
    }
    sendIndex(res, next, render, { kind: 'page', match }, indexHtmlPath);
  };
}
