// Route permission matrix (docs/IAM_RBAC_SPEC.md §7): signs in as one user per seeded role and
// checks one console route per permission against the real /api mounts (server/apiRoutes.ts),
// on a file database in a temp folder. Also checks the anonymous settings view and that staff
// writes record the user. Run with `npm test`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-perm-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { PUBLIC_SETTINGS_FIELDS } = await import('../server/routes/settings.ts');
const { SEEDED_ROLES, hasPermission } = await import('../src/shared/permissions.ts');
type PermissionKey = Parameters<typeof hasPermission>[1];

initDatabase();

// Settings with public, staff-only and settings.view-only fields.
db.prepare('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)').run('general', JSON.stringify({
  companyName: 'Test Co', supportPhone: '+237670000009', quoteValidityDays: 14,
  signatureStampUrl: 'data:image/png;base64,AAAA', defaultFuelSurchargeRate: 0.1,
  mapVisibility: 'CITY', cloakInternalNotes: true
}));

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now = Date.now();
for (const role of SEEDED_ROLES) {
  const id = `usr_${role.id}`;
  db.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, `${role.id}@example.test`, `${role.name} Tester`, HASH, now, now);
  db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, role.id);
}

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
async function cookieFor(roleId: string): Promise<string> {
  if (!cookies.has(roleId)) {
    const res = await call('POST', '/api/auth/login', undefined, { identifier: `${roleId}@example.test`, password: PASSWORD });
    assert.equal(res.status, 200, `sign-in as ${roleId}`);
    const c = res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!;
    cookies.set(roleId, c.split(';')[0]);
  }
  return cookies.get(roleId)!;
}

// One probe per permission that has a route today. Write probes use ids that don't exist, so
// an allowed call ends in 404/400 (or a harmless 200) and nothing real changes.
interface Probe { key: string; needs: PermissionKey[]; method: string; path: string; body?: unknown }
const NO_SHIP = 'TXNOPE00';
const PROBES: Probe[] = [
  { key: 'dashboard.view', needs: ['dashboard.view'], method: 'GET', path: '/api/stats' },
  { key: 'shipments.view', needs: ['shipments.view'], method: 'GET', path: '/api/shipments' },
  { key: 'shipments.create', needs: ['quotes.manage', 'shipments.create'], method: 'POST', path: '/api/quotes/QR-NOPE/convert', body: {} },
  { key: 'shipments.edit', needs: ['shipments.edit'], method: 'PUT', path: `/api/shipments/${NO_SHIP}`, body: {} },
  { key: 'shipments.delete', needs: ['shipments.delete'], method: 'DELETE', path: `/api/shipments/${NO_SHIP}` },
  { key: 'tracking.update', needs: ['tracking.update'], method: 'PATCH', path: `/api/shipments/${NO_SHIP}/status`, body: { status: 'IN_TRANSIT' } },
  { key: 'documents.view', needs: ['documents.view'], method: 'GET', path: '/api/documents' },
  { key: 'documents.manage', needs: ['documents.manage'], method: 'POST', path: '/api/documents/DOC-NOPE/regenerate', body: {} },
  { key: 'quotes.view', needs: ['quotes.view'], method: 'GET', path: '/api/quotes' },
  { key: 'quotes.manage', needs: ['quotes.manage'], method: 'PUT', path: '/api/quotes/QR-NOPE/publish', body: { pricing: {} } },
  { key: 'messages.view', needs: ['messages.view'], method: 'GET', path: '/api/messages' },
  { key: 'messages.manage', needs: ['messages.manage'], method: 'PATCH', path: '/api/messages/MSG-NOPE/status', body: { status: 'READ' } },
  { key: 'payments.view', needs: ['payments.view'], method: 'GET', path: '/api/payments/proofs' },
  { key: 'payments.manage', needs: ['payments.manage'], method: 'POST', path: '/api/payments/proofs/PRF-NOPE/approve', body: {} },
  { key: 'settings.manage', needs: ['settings.manage'], method: 'PUT', path: '/api/settings', body: {} },
];

const allowedFor = (granted: readonly string[], needs: PermissionKey[]) => needs.every((k) => hasPermission(granted, k));

test('anonymous: every console probe answers 401', async () => {
  for (const p of PROBES) {
    const res = await call(p.method, p.path, undefined, p.body);
    assert.equal(res.status, 401, `${p.method} ${p.path}`);
  }
});

test('permission matrix: each seeded role is allowed exactly the routes its permissions grant', async () => {
  const rows: string[] = [];
  for (const role of SEEDED_ROLES) {
    const cookie = await cookieFor(role.id);
    const marks: string[] = [];
    for (const p of PROBES) {
      const res = await call(p.method, p.path, cookie, p.body);
      const expected = allowedFor(role.permissions, p.needs);
      if (expected) assert.ok(res.status !== 401 && res.status !== 403, `${role.name}: ${p.key} should be allowed, got ${res.status}`);
      else assert.equal(res.status, 403, `${role.name}: ${p.key} should be denied`);
      marks.push(expected ? 'Y' : '-');
    }

    // settings.view: the full settings object; otherwise staff fields but not the rest.
    const settings = (await (await call('GET', '/api/settings', cookie)).json() as any).data;
    const fullView = allowedFor(role.permissions, ['settings.view']) || allowedFor(role.permissions, ['settings.manage']);
    assert.equal('mapVisibility' in settings, fullView, `${role.name}: settings.view`);
    const courierOnly = role.permissions.length === 1 && role.permissions[0] === 'courier.app';
    assert.equal('signatureStampUrl' in settings, !courierOnly, `${role.name}: staff fields`);
    marks.push(fullView ? 'Y' : '-');

    rows.push(`${role.name.padEnd(18)} ${marks.join(' ')}`);
  }
  const header = [...PROBES.map((p) => p.key), 'settings.view'];
  console.log(['', 'Permission matrix (Y allowed, - denied):', ...header.map((h, i) => `  ${String(i + 1).padStart(2)} ${h}`), `${''.padEnd(18)} ${header.map((_, i) => String(i + 1).slice(-1)).join(' ')}`, ...rows].join('\n'));
});

test('anonymous GET /api/settings returns only the public fields', async () => {
  const json = await (await call('GET', '/api/settings')).json() as any;
  const keys = Object.keys(json.data);
  for (const k of keys) assert.ok((PUBLIC_SETTINGS_FIELDS as readonly string[]).includes(k), `leaked ${k}`);
  assert.equal(json.data.companyName, 'Test Co');
  assert.equal(json.data.quoteValidityDays, 14);
});

test('staff writes record the user: created_by on a console booking, recorded_by on events, audit rows', async () => {
  const admin = await cookieFor('role_super_admin');
  const booked = await call('POST', '/api/shipments', admin, { origin: { city: 'Buea', lat: 4.15, lng: 9.24 }, destination: { city: 'Douala', lat: 4.05, lng: 9.7 } });
  assert.equal(booked.status, 201);
  const tracking = ((await booked.json()) as any).data.trackingNumber as string;
  const row = db.prepare('SELECT created_by FROM shipments WHERE tracking_number = ?').get(tracking) as { created_by: string };
  assert.equal(row.created_by, 'usr_role_super_admin');

  const publicBooking = await call('POST', '/api/shipments', undefined, { origin: { city: 'Buea' }, destination: { city: 'Limbe' } });
  const publicTracking = ((await publicBooking.json()) as any).data.trackingNumber as string;
  const publicRow = db.prepare('SELECT created_by FROM shipments WHERE tracking_number = ?').get(publicTracking) as { created_by: string | null };
  assert.equal(publicRow.created_by, null);
  assert.equal((db.prepare(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'shipment.create' AND entity_id = ?`).get(publicTracking) as { c: number }).c, 0);

  // Customer Support may update tracking; the event carries their name, the audit their id.
  const support = await cookieFor('role_customer_support');
  const status = await call('PATCH', `/api/shipments/${tracking}/status`, support, { status: 'IN_TRANSIT', location: 'Douala' });
  assert.equal(status.status, 200);
  const ev = db.prepare('SELECT recorded_by FROM tracking_events WHERE shipment_tracking = ? AND current_flag = 1').get(tracking) as { recorded_by: string };
  assert.equal(ev.recorded_by, 'Customer Support Tester');
  const auditRow = db.prepare(`SELECT actor_user_id, entity_id, after_json FROM audit_log WHERE action = 'shipment.status' ORDER BY at_ts DESC LIMIT 1`).get() as any;
  assert.equal(auditRow.actor_user_id, 'usr_role_customer_support');
  assert.equal(auditRow.entity_id, tracking);
  assert.deepEqual(JSON.parse(auditRow.after_json), { status: 'IN_TRANSIT' });

  const created = db.prepare(`SELECT actor_user_id FROM audit_log WHERE action = 'shipment.create' AND entity_id = ?`).get(tracking) as any;
  assert.equal(created.actor_user_id, 'usr_role_super_admin');

  // Denied writes leave no audit row.
  const finance = await cookieFor('role_finance');
  assert.equal((await call('DELETE', `/api/shipments/${tracking}`, finance)).status, 403);
  assert.equal((db.prepare(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'shipment.delete'`).get() as { c: number }).c, 0);
});

test('quote status: customers may only accept/decline; staff without quotes.manage get 403', async () => {
  const marketing = await cookieFor('role_marketing');
  assert.equal((await call('PATCH', '/api/quotes/QR-NOPE/status', undefined, { status: 'UNDER_REVIEW' })).status, 401);
  assert.equal((await call('PATCH', '/api/quotes/QR-NOPE/status', marketing, { status: 'UNDER_REVIEW' })).status, 403);
  assert.equal((await call('PATCH', '/api/quotes/QR-NOPE/status', undefined, { status: 'ACCEPTED' })).status, 404);
});
