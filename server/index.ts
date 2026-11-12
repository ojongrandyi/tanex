import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initDatabase, dataDir, dbPath, db } from './db.js';
import { bootstrapSuperAdmin } from './auth/bootstrap.js';
import { startOutboxWorker } from './mail/outbox.js';
import { startBlogScheduler } from './blog/posts.js';
import { setPreviewSecret } from './blog/preview.js';
import { ensureUploadDirs, uploadsDir } from './uploads.js';
import { seoRouter } from './seo.js';
import { publicPages, sendIndex } from './publicPages.js';
import { createIndexRenderer } from './render/pageMeta.js';
import { registerApiRoutes } from './apiRoutes.js';
import { generalErrorCode } from '../src/shared/apiErrors.js';
import { ADMIN_PATH, COMPANY } from '../src/config/brand.js';
import { isAllowedOrigin } from './cors.js';
import { requirePermission, requireJsonOrMultipart } from './middleware/auth.js';
import { SqliteSessionStore, createSessionMiddleware } from './auth/sessionStore.js';
import { resolveSessionSecret } from './auth/sessionSecret.js';

dotenv.config(); // reload trigger for tsx watch after .env changes

const app = express();
const PORT = process.env.PORT || 5000;

// Set only on the admin-subdomain deployment. That deployment has no database of its own —
// every /api request is silently forwarded to the real app's API instead, so there is always
// exactly one SQLite file and one source of truth, never two copies of the data quietly
// diverging between the public site and the admin console. See the branch below.
const ADMIN_PROXY_TARGET = process.env.ADMIN_PROXY_TARGET;

// Hostinger (like virtually all shared/PaaS hosting) terminates HTTPS at a reverse proxy in
// front of this process, which itself only ever sees plain HTTP. Without this, Express has no
// way to know the original request was secure, so the session cookie's `secure: true` flag
// below never actually reaches the browser correctly — every request after login still looks
// unauthenticated (401), even though login itself appears to succeed. Trusting the first
// proxy hop is what lets Express read the standard X-Forwarded-Proto header instead.
app.set('trust proxy', 1);

if (!ADMIN_PROXY_TARGET) {
  // Initialize Persistent SQLite Database
  initDatabase();
  // First Super Admin on an empty users table (IAM_RBAC_SPEC §8).
  bootstrapSuperAdmin(db);
  ensureUploadDirs();
  // Sends queued emails every 30 s; logs once whether email is on (NOTIFICATIONS_SPEC §3).
  startOutboxWorker(db);
  // Publishes scheduled blog posts when their time comes (checked every minute; BLOG_SPEC §3).
  startBlogScheduler(db);
}

// Middleware
// contentSecurityPolicy and crossOriginEmbedderPolicy are off deliberately, not an
// oversight: this app loads map tiles from ArcGIS, fonts from Google Fonts, and (on the
// flagship demo shipment) photos from Unsplash — none of those send the response headers a
// strict CSP/COEP would require, so turning helmet's defaults on as-is would silently break
// the map and images. Doing CSP properly means cataloguing every external host this app
// actually uses and allow-listing exactly those — worth doing as a deliberate follow-up,
// not as a default flip. Everything else helmet sets (X-Content-Type-Options, X-Frame-
// Options, Strict-Transport-Security, Referrer-Policy, etc.) is safe with no such tradeoff.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Compress responses here rather than leaving it to Hostinger's CDN: the link between the CDN
// and this process is slow, and sending the ~700 KB main bundle uncompressed made first visits
// take 30–70 s. Responses that already carry a Content-Encoding (e.g. proxied ones) are left alone.
app.use(compression());

// robots.txt, sitemap.xml and the admin-path noindex header, before anything else.
app.use(seoRouter);

// credentials:true + a specific origin (not '*', which browsers reject alongside
// credentialed requests) — the admin session cookie has to actually reach the API for
// auth to work at all. In dev the Vite proxy makes this same-origin anyway, but this also
// covers hitting the API directly against its own port.
// Only the site's own origins may read API answers with credentials (server/cors.ts).
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// API answers are per-visitor (session, admin data) and must never be stored by Hostinger's
// CDN or the browser; a replayed/emptied login response broke sign-in on fresh browsers.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, private');
  next();
});

if (ADMIN_PROXY_TARGET) {
  // Admin-subdomain deployment: forward every /api request to the real app untouched, cookies
  // included. Mounted before any body-parser so the raw request stream reaches the upstream
  // intact — express.json() below would otherwise consume it, breaking the proxy for any
  // POST/PUT/PATCH body. No cookieDomainRewrite needed: the session cookie is set with no
  // explicit Domain attribute (see below), so it passes through unchanged and the browser
  // naturally scopes it to whichever host actually answered — this subdomain.
  //
  // pathRewrite re-adds "/api" because Express's app.use('/api', ...) already strips that
  // prefix from req.url before the proxy ever sees it (confirmed live — without this, /api/
  // health arrived upstream as bare /health and 404'd).
  app.use('/api', createProxyMiddleware({
    target: ADMIN_PROXY_TARGET,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
  }));
} else {
  // Raised from Express's 100kb default so a base64-encoded signature/stamp image upload
  // (see Settings > Barcode & Documents) doesn't silently fail with a 413.
  app.use(express.json({ limit: '5mb' }));

  // Sessions live in the SQLite `sessions` table (IAM_RBAC_SPEC §5.7), so a restart or
  // redeploy no longer signs everyone out. Cookie settings are in createSessionMiddleware.
  // SESSION_SECRET, or a random secret generated once and kept next to the database.
  const sessionSecret = resolveSessionSecret(dataDir);
  app.use(createSessionMiddleware(new SqliteSessionStore(db), sessionSecret));
  // Blog preview links are signed with a key derived from it (server/blog/preview.ts).
  setPreviewSecret(sessionSecret);

  // State-changing /api requests must be JSON or multipart (IAM_RBAC_SPEC §5.8).
  app.use('/api', requireJsonOrMultipart);

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: `${COMPANY} API`,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // TEMPORARY diagnostic — answers "does this host wipe files that aren't tracked by git on
  // redeploy?" directly, rather than guessing. On first request ever, writes a marker file
  // (with its own creation time) next to the database. On every later request, reports that
  // same original timestamp back. If a redeploy resets this to a brand-new timestamp, the
  // host is wiping untracked files on every deploy — the same thing that would be silently
  // destroying the database each time. If the timestamp survives a redeploy, it isn't. Safe
  // to remove once that's confirmed one way or the other. Admin-only: it reveals server paths.
  app.get('/api/diag/storage', requirePermission('settings.manage'), (req, res) => {
    try {
      const markerPath = path.join(dataDir, '.persistence-check.json');
      let marker: { firstSeen: string; checkedAt: string };
      if (fs.existsSync(markerPath)) {
        const existing = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
        marker = { firstSeen: existing.firstSeen, checkedAt: new Date().toISOString() };
      } else {
        marker = { firstSeen: new Date().toISOString(), checkedAt: new Date().toISOString() };
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(markerPath, JSON.stringify({ firstSeen: marker.firstSeen }));
      }
      const dbExists = fs.existsSync(dbPath);
      const dbStat = dbExists ? fs.statSync(dbPath) : null;
      res.json({
        success: true,
        dataDir,
        markerFirstSeen: marker.firstSeen,
        markerCheckedAt: marker.checkedAt,
        databaseFileExists: dbExists,
        databaseFileSizeBytes: dbStat?.size ?? null,
        databaseFileModifiedAt: dbStat ? dbStat.mtime.toISOString() : null
      });
    } catch (err: any) {
      serverError(res, err);
    }
  });

  // API routes (server/apiRoutes.ts), ending with a JSON 404 for unknown /api paths.
  registerApiRoutes(app);
}

// Serve the built React frontend (dist/, produced by `vite build`) so this one process is
// the whole deployed app — API above, static site here. Pages are real paths (/services,
// /track/TX7K2M9P, /fr/suivi; src/router/routes.ts): publicPages() below answers each known
// path with index.html and every other path gets the 404 handler, so a deep link or a reload
// works on any page and a mistyped address is still a real 404.
//
// Cache rules, so Hostinger's CDN and browsers can keep the files (with Express's default
// max-age=0 every visitor pulled the full bundle from this process): Vite's /assets/ files have
// a content hash in their names, so they never change and are cached for a year; index.html is
// always re-checked so a new deploy shows up at once; logos and photos (/brand, /images) for 30
// days (give a replaced file a new name or a ?v= query); anything else for an hour.
const distDir = path.join(process.cwd(), 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');
// index.html read once, then rendered per page with its meta (server/render/pageMeta.ts).
const renderIndex = createIndexRenderer(indexHtmlPath);

// Admin console at ADMIN_PATH (/private-user/): the same index.html as the public site, and
// App.tsx opens the console from the path. Express routes ignore case and the trailing slash,
// so this one route also sees /private-user and /Private-User/; those get a 301 to the exact
// path. Anything deeper (/private-user/x) isn't matched and falls through to the normal 404.
// index.html uses root-absolute URLs (/assets/…, /brand/…), so they load from here too.
const ADMIN_ROUTE = ADMIN_PATH.replace(/\/+$/, '');
app.get(ADMIN_ROUTE, (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== ADMIN_PATH) {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(301, `${ADMIN_PATH}${query}`);
    return;
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  sendIndex(res, next, renderIndex, { kind: 'admin' }, indexHtmlPath);
});

// index.html is never served as a plain file: `/` and `/index.html` go through publicPages()
// below, so they get their meta (and /index.html its 301 to /).
const serveStatic = express.static(distDir, {
  index: false,
  setHeaders: (res, filePath) => {
    const rel = path.relative(distDir, filePath).split(path.sep).join('/');
    if (rel.startsWith('assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else if (rel.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (rel.startsWith('images/') || rel.startsWith('brand/')) res.setHeader('Cache-Control', 'public, max-age=2592000');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
});
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/index.html') return next();
  serveStatic(req, res, next);
});

// Public pages by path, after the static files so a real file always wins.
app.use(publicPages(renderIndex, indexHtmlPath));

// Anything not matched above is a 404. Browsers get the app with status 404, which shows the
// "Page not found" page (NotFoundPage, chosen from the path in App.tsx); other requests
// (scripts, images, crawlers' file probes) get a short plain-text 404 instead of Express's
// default "Cannot GET" page.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).setHeader('Cache-Control', 'no-cache');
  if ((req.method === 'GET' || req.method === 'HEAD') && (req.get('Accept') || '').includes('text/html')) {
    const lang = req.path === '/fr' || req.path.startsWith('/fr/') ? 'fr' : 'en';
    sendIndex(res, next, renderIndex, { kind: 'not-found', lang }, indexHtmlPath);
    return;
  }
  res.type('text/plain').send('Not found');
});

// Last-resort error handler — catches anything that bypassed every route's own try/catch
// (a malformed JSON body from express.json(), a thrown error in middleware, etc.). Express's
// own default handler, with no NODE_ENV set (the case in this dev setup), responds with the
// FULL raw error — stack trace, absolute local filesystem paths, all of it — to whoever sent
// the request; confirmed live by POSTing truncated JSON and getting back a stack trace with
// this machine's real folder path in the response body. This always returns a flat, generic
// message instead and logs the real error server-side only, regardless of NODE_ENV.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[server] Unhandled error:', err);
  if (res.headersSent) return next(err);
  const isMalformedBody = err?.type === 'entity.parse.failed' || err instanceof SyntaxError;
  const status = isMalformedBody ? 400 : (typeof err?.status === 'number' ? err.status : 500);
  res.status(status).json({
    success: false,
    code: isMalformedBody ? 'MALFORMED_BODY' : generalErrorCode(status),
    error: isMalformedBody ? 'Malformed request body.' : 'Internal server error.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ${COMPANY} API running on port ${PORT}`);
  if (ADMIN_PROXY_TARGET) {
    console.log(`🔀 Admin-proxy mode — /api forwards to ${ADMIN_PROXY_TARGET}`);
  } else {
    console.log(`📦 Database: ${dbPath} (Persistent SQLite)`);
    console.log(`🖼️  Uploads: ${uploadsDir}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  }
  console.log(`====================================================`);
});

import { serverError } from './errors.js';