// Phase B security review (tracker B.6): every route in server/routes/*.ts is found in the source
// and called signed out; anything not on the public list must answer 401, and with a session
// whose temporary password hasn't been changed, every console route must answer 403. A new
// route that forgets its guard fails here. Also: CORS origins, what a public booking may set,
// the public quote look-up limit.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-guards-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
delete process.env.SMTP_HOST;
delete process.env.CORS_ORIGINS;
delete process.env.APP_URL;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { isAllowedOrigin } = await import('../server/cors.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now = Date.now();
db.prepare(`
  INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
  VALUES ('usr_temp', 'temp@example.test', 'Temp', ?, 'ACTIVE', 1, ?, ?)
`).run(HASH, now, now);
db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run('usr_temp', SUPER_ADMIN_ROLE_ID);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(createSessionMiddleware(new SqliteSessionStore(db, { purgeIntervalMs: false }), 'test-secret'));
app.use('/api', requireJsonOrMultipart);
registerApiRoutes(app);
const server = app.listen(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let ipSeq = 0;
async function call(method: string, p: string, cookie?: string, body?: unknown, ip?: string): Promise<Response> {
  const headers: Record<string, string> = { 'X-Forwarded-For': ip ?? `198.51.100.${(ipSeq++ % 250) + 1}` };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

// Router variable → where server/apiRoutes.ts mounts it.
const MOUNTS: Record<string, string> = {
  router: '/api/auth', // createAuthRouter()
  usersRouter: '/api/users',
  rolesRouter: '/api/roles',
  permissionsRouter: '/api/permissions',
  auditRouter: '/api/audit',
  mailRouter: '/api/mail',
  shipmentImagesRouter: '/api/shipments',
  shipmentPaymentsRouter: '/api/shipments',
  shipmentsRouter: '/api/shipments',
  quotesRouter: '/api/quotes',
  documentsRouter: '/api/documents',
  settingsRouter: '/api/settings',
  trackProofRouter: '/api/track',
  trackRouter: '/api/track',
  messagesRouter: '/api/messages',
  mediaRouter: '',
  statsRouter: '/api/stats',
  paymentsRouter: '/api/payments',
  blogAdminRouter: '/api/admin/blog',
  publicBlogRouter: '/api/blog'
};

// Open to visitors on purpose (IAM_RBAC_SPEC §6–§7).
const PUBLIC = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'GET /api/auth/session',
  'POST /api/auth/forgot',
  'POST /api/auth/reset',
  'POST /api/shipments/',
  'GET /api/quotes/:id',
  'POST /api/quotes/',
  'POST /api/documents/generate',
  'GET /api/settings/',
  'GET /api/track/:trackingNumber',
  'POST /api/track/:trackingNumber/payment-proof',
  'POST /api/messages/',
  'GET /media/:file',
  // Blog (BLOG_SPEC §5): published posts and their images only.
  'GET /api/blog/',
  'GET /api/blog/latest',
  'GET /api/blog/categories',
  'GET /api/blog/:locale/:slug',
  'GET /media/blog/:file'
]);
// Signed-in only (no permission key): the user's own account.
const SESSION_ONLY = new Set([
  'PATCH /api/auth/me',
  'GET /api/auth/sessions',
  'DELETE /api/auth/sessions',
  'POST /api/auth/change-password'
]);

interface RouteDef { method: string; path: string; file: string }

function collectRoutes(): RouteDef[] {
  const dir = path.join(process.cwd(), 'server', 'routes');
  const routes: RouteDef[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/\b(\w*[Rr]outer)\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      const mount = MOUNTS[m[1]];
      assert.ok(mount !== undefined, `${file}: router "${m[1]}" has no mount in this test; add it to MOUNTS`);
      routes.push({ method: m[2].toUpperCase(), path: mount + m[3], file });
    }
  }
  // The admin diagnostics route lives in server/index.ts (settings.manage).
  return routes;
}

const ROUTES = collectRoutes();
const concrete = (p: string) => p.replace(/:trackingNumber/g, 'TX0000AA').replace(/:(\w+)/g, 'x1');
const key = (r: RouteDef) => `${r.method} ${r.path}`;

test('the route inventory found every router file and the public list matches real routes', () => {
  assert.ok(ROUTES.length >= 60, `found ${ROUTES.length} routes`);
  const keys = new Set(ROUTES.map(key));
  for (const p of [...PUBLIC, ...SESSION_ONLY]) assert.ok(keys.has(p), `listed route ${p} exists`);
});

test('every non-public route answers 401 signed out', async () => {
  const open: string[] = [];
  for (const r of ROUTES) {
    if (PUBLIC.has(key(r))) continue;
    // Quote status: visitors may only accept/decline, so a staff-only status must be refused.
    const body = r.method === 'GET' || r.method === 'DELETE' ? undefined : { status: 'UNDER_REVIEW' };
    const res = await call(r.method, concrete(r.path), undefined, body);
    if (res.status !== 401) open.push(`${key(r)} (${r.file}) → ${res.status}`);
  }
  // The visitor-reachable quote status route decides inside the handler; covered above by body.
  assert.deepEqual(open, []);
});

test('a temporary-password session gets 403 PASSWORD_CHANGE_REQUIRED on every console route', async () => {
  const login = await call('POST', '/api/auth/login', undefined, { identifier: 'temp@example.test', password: PASSWORD });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
  const wrong: string[] = [];
  for (const r of ROUTES) {
    if (PUBLIC.has(key(r)) || SESSION_ONLY.has(key(r))) continue;
    const body = r.method === 'GET' || r.method === 'DELETE' ? undefined : { status: 'UNDER_REVIEW' };
    const res = await call(r.method, concrete(r.path), cookie, body);
    if (res.status !== 403) wrong.push(`${key(r)} → ${res.status}`);
  }
  assert.deepEqual(wrong, []);
  assert.equal((await call('GET', '/api/diag/storage', cookie)).status, 404, 'diag is only mounted in server/index.ts');
});

test('CORS: only the site, www, APP_URL, CORS_ORIGINS and localhost', () => {
  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin('https://tanexsarl.com'), true);
  assert.equal(isAllowedOrigin('https://www.tanexsarl.com'), true);
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5000'), true);
  for (const o of ['https://evil.example', 'https://tanexsarl.com.evil.example', 'http://tanexsarl.com', 'https://localhost.evil.example', 'null']) {
    assert.equal(isAllowedOrigin(o), false, o);
  }
  process.env.CORS_ORIGINS = 'https://staging.example.test/, https://other.example.test';
  assert.equal(isAllowedOrigin('https://staging.example.test'), true);
  delete process.env.CORS_ORIGINS;
  assert.equal(isAllowedOrigin('https://staging.example.test'), false);
});

test('a public booking cannot set a later status, progress, piece status or internal pricing note', async () => {
  const res = await call('POST', '/api/shipments', undefined, {
    status: 'DELIVERED', progressPercent: 100, internalPricingNote: 'cost 5000',
    pieces: [{ pieceNumber: 1, totalPieces: 1, status: 'DELIVERED' }],
    origin: { city: 'Buea' }, destination: { city: 'Douala' }
  });
  assert.equal(res.status, 201);
  const tracking = (await res.json()).data.trackingNumber;
  const row = db.prepare('SELECT status, progress_percent, internal_pricing_note FROM shipments WHERE tracking_number = ?').get(tracking) as any;
  assert.equal(row.status, 'RECEIVED');
  assert.ok(row.progress_percent <= 15);
  assert.equal(row.internal_pricing_note, null);
  const piece = db.prepare('SELECT status FROM shipment_pieces WHERE parent_tracking = ?').get(tracking) as any;
  assert.equal(piece.status, 'RECEIVED');

  // The public Ship page's own booking status is kept.
  const ok = await call('POST', '/api/shipments', undefined, { status: 'AWAITING_PICKUP', progressPercent: 10, origin: { city: 'Buea' }, destination: { city: 'Limbe' } });
  const t2 = (await ok.json()).data.trackingNumber;
  assert.equal((db.prepare('SELECT status FROM shipments WHERE tracking_number = ?').get(t2) as any).status, 'AWAITING_PICKUP');
});

test('public quote look-up: 60 per 15 minutes per address', async () => {
  const ip = '192.0.2.77';
  for (let i = 0; i < 60; i++) assert.equal((await call('GET', '/api/quotes/QR-2026-00000', undefined, undefined, ip)).status, 404);
  assert.equal((await call('GET', '/api/quotes/QR-2026-00000', undefined, undefined, ip)).status, 429);
});
