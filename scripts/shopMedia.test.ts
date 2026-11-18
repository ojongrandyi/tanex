// Shop pictures (docs/SHOP_SPEC.md §6, task M.2): the crop geometry shared with the console, and
// POST/DELETE /api/admin/shop/media + GET /media/shop/<file> against the real /api mounts on a file
// database in a temp folder. The server must refuse any file that isn't exactly the right square.
// Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {
  SHOP_IMAGE_SLOTS, initialCrop, clampCrop, drawPlan, panCrop, sourceQuality, rotatedSize, MAX_ZOOM, type CropState,
} from '../src/shared/shopImages.ts';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-shopmedia-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now0 = Date.now();
function addUser(id: string, roleId: string) {
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, `${id}@example.test`, id, HASH, now0, now0);
  db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, roleId);
}
addUser('usr_marketing', 'role_marketing');   // shop.write + shop.categories
addUser('usr_finance', 'role_finance');       // no picture permission

const app = express();
app.use(express.json({ limit: '5mb' }));
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

async function call(method: string, p: string, cookie?: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const cookies = new Map<string, string>();
async function as(userId: string): Promise<string> {
  if (!cookies.has(userId)) {
    const res = await call('POST', '/api/auth/login', undefined, { identifier: `${userId}@example.test`, password: PASSWORD });
    assert.equal(res.status, 200, `sign-in as ${userId}`);
    cookies.set(userId, res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0]);
  }
  return cookies.get(userId)!;
}

// A real image of the given size and format, as base64.
const img = async (size: number, format: 'webp' | 'jpeg' | 'png', h = size) => {
  const s = sharp({ create: { width: size, height: h, channels: 3, background: '#5a3a22' } });
  return (await (format === 'webp' ? s.webp() : format === 'jpeg' ? s.jpeg() : s.png()).toBuffer()).toString('base64');
};
async function goodFiles(webp = true) {
  const f = webp ? 'webp' : 'jpeg';
  return { w1200: await img(1200, f), w600: await img(600, f), w300: await img(300, f), j1200: await img(1200, 'jpeg'), j600: await img(600, 'jpeg') };
}
const shopFiles = () => {
  const dir = path.join(tmpDir, 'uploads', 'shop');
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};
const MEDIA = '/api/admin/shop/media';

// ---- Crop geometry (shared with the console) ----

test('crop starts by shape: near-square photos fill, others fit whole', () => {
  assert.equal(initialCrop(1000, 1050).mode, 'fill');
  assert.equal(initialCrop(1000, 920).mode, 'fill');
  assert.equal(initialCrop(1000, 900).mode, 'fit', '1.11 is outside 0.9–1.1');
  assert.equal(initialCrop(1600, 900).mode, 'fit');
  assert.equal(initialCrop(800, 1400).mode, 'fit');
  assert.equal(initialCrop(1600, 900).background, 'white');
});

test('fill takes the largest centred square; zoom and pan stay inside the photo', () => {
  const c = { ...initialCrop(1000, 1000), mode: 'fill' as const };
  assert.deepEqual(drawPlan({ ...c }, 1600, 1000, 1200), { sx: 300, sy: 0, sw: 1000, sh: 1000, dx: 0, dy: 0, dw: 1200, dh: 1200 });
  const zoomed = drawPlan({ ...c, zoom: 2 }, 1600, 1000, 1200);
  assert.equal(zoomed.sw, 500);
  assert.equal(zoomed.sx, 550);
  // Zoom is limited, and a drag far past the edge stops at the edge.
  assert.equal(clampCrop({ ...c, zoom: 99 }, 1600, 1000).zoom, MAX_ZOOM);
  assert.equal(clampCrop({ ...c, zoom: 0.2 }, 1600, 1000).zoom, 1);
  const dragged = panCrop(c, 1600, 1000, 5000, 0, 300); // drag right a lot: show the left edge
  const plan = drawPlan(dragged, 1600, 1000, 1200);
  assert.equal(plan.sx, 0);
  const draggedLeft = drawPlan(panCrop(c, 1600, 1000, -5000, 0, 300), 1600, 1000, 1200);
  assert.equal(draggedLeft.sx + draggedLeft.sw, 1600);
});

test('fit draws the whole photo centred on the background; rotation swaps the sides', () => {
  const c: CropState = { ...initialCrop(1600, 900) };
  const plan = drawPlan(c, 1600, 900, 1200);
  assert.deepEqual(plan, { sx: 0, sy: 0, sw: 1600, sh: 900, dx: 0, dy: 262.5, dw: 1200, dh: 675 });
  assert.deepEqual(rotatedSize(1600, 900, 1), { w: 900, h: 1600 });
  const turned = drawPlan({ ...c, rotation: 1 }, 1600, 900, 1200);
  assert.equal(turned.dh, 1200);
  assert.equal(turned.dx, (1200 - 675) / 2);
});

test('photos too small are refused; smaller than 1200 px only warns', () => {
  assert.equal(sourceQuality(initialCrop(2000, 2000), 2000, 2000), 'ok');
  assert.equal(sourceQuality(initialCrop(800, 800), 800, 800), 'soft');
  assert.equal(sourceQuality(initialCrop(350, 350), 350, 350), 'too_small');
  // Zooming in on a 1000 px photo leaves 500 px across: still allowed, but soft.
  assert.equal(sourceQuality({ ...initialCrop(1000, 1000), zoom: 2 }, 1000, 1000), 'soft');
  assert.equal(sourceQuality({ ...initialCrop(1000, 1000), zoom: 3 }, 1000, 1000), 'too_small');
});

// ---- Upload API ----

test('upload: exact files are stored, served publicly and cached; WebP or JPEG fallback', async () => {
  const cookie = await as('usr_marketing');
  const res = await call('POST', MEDIA, cookie, { files: await goodFiles() });
  const body = await res.json() as any;
  assert.equal(res.status, 201, JSON.stringify(body));
  assert.match(body.data.urls.w1200, /^\/media\/shop\/[0-9a-f-]{36}\.webp$/);
  assert.match(body.data.urls.j600, /^\/media\/shop\/[0-9a-f-]{36}\.jpg$/);
  assert.equal(shopFiles().length, 5);

  const file = await fetch(`${BASE}${body.data.urls.w300}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/webp');
  assert.match(file.headers.get('cache-control') ?? '', /immutable/);
  assert.equal((await sharp(Buffer.from(await file.arrayBuffer())).metadata()).width, 300);

  // A browser without WebP encoding sends JPEG in the WebP slots.
  const jpegOnly = await call('POST', MEDIA, cookie, { files: await goodFiles(false) });
  assert.equal(jpegOnly.status, 201);
  assert.match(((await jpegOnly.json()) as any).data.urls.w1200, /\.jpg$/);

  const audit = db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action = 'shop.media_upload'").get() as { c: number };
  assert.equal(audit.c, 2);
});

test('upload: refused unless every file is exactly right, and nothing is left on disk', async () => {
  const cookie = await as('usr_marketing');
  const before = shopFiles().length;
  const rows = (db.prepare('SELECT COUNT(*) AS c FROM shop_media').get() as { c: number }).c;
  const good = await goodFiles();
  const cases: [string, Record<string, unknown>][] = [
    ['wrong size', { ...good, w600: await img(640, 'webp') }],
    ['not square', { ...good, w1200: await img(1200, 'webp', 900) }],
    ['PNG not allowed', { ...good, w300: await img(300, 'png') }],
    ['JPEG slot given WebP', { ...good, j600: await img(600, 'webp') }],
    ['missing file', { ...good, j1200: undefined }],
    ['not an image', { ...good, w300: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') }],
    ['too large', { ...good, w300: Buffer.concat([Buffer.from(good.w300, 'base64'), Buffer.alloc(SHOP_IMAGE_SLOTS.w300.maxBytes)]).toString('base64') }],
  ];
  for (const [name, files] of cases) {
    const res = await call('POST', MEDIA, cookie, { files });
    assert.equal(res.status, 400, name);
    assert.equal(((await res.json()) as any).code, 'SHOP_INVALID_IMAGE', name);
  }
  assert.equal((await call('POST', MEDIA, cookie, {})).status, 400);
  assert.equal(shopFiles().length, before, 'no files written for a refused upload');
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM shop_media').get() as { c: number }).c, rows);
});

test('permissions: no picture permission → 403; signed out → 401; files of unknown pictures → 404', async () => {
  const files = await goodFiles();
  assert.equal((await call('POST', MEDIA, undefined, { files })).status, 401);
  assert.equal((await call('POST', MEDIA, await as('usr_finance'), { files })).status, 403);
  assert.equal((await fetch(`${BASE}/media/shop/00000000-0000-4000-8000-000000000000.webp`)).status, 404);
  assert.equal((await fetch(`${BASE}/media/shop/..%2F..%2Ftanex.db`)).status, 404);
});

test('delete: refused while a product uses the picture, then removes the row and all five files', async () => {
  const cookie = await as('usr_marketing');
  const created = ((await (await call('POST', MEDIA, cookie, { files: await goodFiles() })).json()) as any).data;
  const filesBefore = shopFiles().length;
  db.prepare('INSERT INTO shop_product_images (product_id, media_id, position) VALUES (?, ?, 0)').run('prod_x', created.id);
  const inUse = await call('DELETE', `${MEDIA}/${created.id}`, cookie);
  assert.equal(inUse.status, 409);
  assert.equal(((await inUse.json()) as any).code, 'SHOP_MEDIA_IN_USE');

  db.prepare('DELETE FROM shop_product_images WHERE media_id = ?').run(created.id);
  assert.equal((await call('DELETE', `${MEDIA}/${created.id}`, cookie)).status, 200);
  assert.equal(shopFiles().length, filesBefore - 5);
  assert.equal((await fetch(`${BASE}${created.urls.w1200}`)).status, 404);
  assert.equal((await call('DELETE', `${MEDIA}/${created.id}`, cookie)).status, 404);
});
