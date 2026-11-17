// Cash & Mobile Money and notifications (docs/DISPATCH_SPEC.md §9–§10, docs/NOTIFICATIONS_SPEC.md; tracker G.8):
// balances count only cash the courier holds (a customer's mobile money goes to the company account);
// Finance (cash.confirm) confirms or rejects pending entries and records adjustments with a reason,
// all audited; cash.view reads only; the daily report and its CSV; WhatsApp messages per job step in
// the job's language, each tap logged in notification_log with a masked phone; automatic emails for
// booking.confirmed, local.delivered and quote.ready when an address is known.
// Runs against the real /api mounts on a temp database (`npm test`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanex-cash-test-'));
process.env.DB_PATH = path.join(tmpDir, 'tanex.db');
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');
delete process.env.NODE_ENV;
// Mail on (queued only: the outbox worker is never started in tests).
process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_PORT = '465';
process.env.SMTP_USER = 'info@example.test';
process.env.SMTP_PASS = 'smtp-secret-value';
process.env.MAIL_FROM = 'TanEx <info@example.test>';
delete process.env.APP_URL;

const express = (await import('express')).default;
const { db, initDatabase } = await import('../server/db.ts');
const { SqliteSessionStore, createSessionMiddleware } = await import('../server/auth/sessionStore.ts');
const { requireJsonOrMultipart } = await import('../server/middleware/auth.ts');
const { registerApiRoutes } = await import('../server/apiRoutes.ts');
const { SUPER_ADMIN_ROLE_ID } = await import('../src/shared/permissions.ts');
const { cashTotals, dailyCashReport, dailyReportCsv, csvField, dayRange } = await import('../src/shared/cashReport.ts');
const { handoverDue } = await import('../src/shared/cashHandover.ts');
const { buildJobMessages, jobMessagePlan } = await import('../src/shared/jobMessages.ts');

initDatabase();

const PASSWORD = 'correct horse battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const now0 = Date.now();
const DAY = 86_400_000;

function addUser(id: string, email: string, roleIds: string[], name = id, phone: string | null = null): void {
  db.prepare(`
    INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password, created_at_ts, updated_at_ts)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
  `).run(id, email, phone, name, HASH, now0, now0);
  for (const r of roleIds) db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, r);
}
function addCourier(id: string, email: string, name: string, publicName: string, phone: string): void {
  addUser(id, email, ['role_courier'], name, phone);
  db.prepare(`INSERT INTO couriers (user_id, vehicle_type, public_first_name, is_on_duty, created_at_ts, updated_at_ts)
              VALUES (?, 'BIKE', ?, 1, ?, ?)`).run(id, publicName, now0, now0);
}

addUser('usr_sa', 'sa@example.test', [SUPER_ADMIN_ROLE_ID], 'Owner');
addUser('usr_disp', 'disp@example.test', ['role_dispatch_manager'], 'Dispatcher Dee');
addUser('usr_fin', 'fin@example.test', ['role_finance'], 'Finance Fay');
addUser('usr_sup', 'sup@example.test', ['role_customer_support'], 'Support Sam');
addCourier('usr_c1', 'c1@example.test', 'Ama Rider', 'Ama', '+237 670 00 00 08');
addCourier('usr_c2', 'c2@example.test', 'Bello Rider', 'Bello', '+237 670 00 00 09');

db.prepare(`INSERT INTO delivery_cities (id, name, lat, lng) VALUES ('city_b', 'Buea', 4.15, 9.24)`).run();
db.prepare(`INSERT INTO delivery_zones (id, city_id, name) VALUES ('z_mol', 'city_b', 'Molyko'), ('z_chk', 'city_b', 'Check Point')`).run();
db.prepare(`INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge)
            VALUES ('r1', 'city_b', NULL, NULL, 'SMALL', 1000, 'XAF', 500)`).run();

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
async function signIn(identifier: string): Promise<string> {
  const res = await call('POST', '/api/auth/login', undefined, { identifier, password: PASSWORD });
  assert.equal(res.status, 200, `sign-in as ${identifier}`);
  return res.headers.getSetCookie().find((h) => h.startsWith('tx.sid='))!.split(';')[0];
}
const sa = await signIn('sa@example.test');
const disp = await signIn('disp@example.test');
const fin = await signIn('fin@example.test');
const sup = await signIn('sup@example.test');
const c1 = await signIn('c1@example.test');
const c2 = await signIn('c2@example.test');

const auditCount = (action: string) => (db.prepare('SELECT COUNT(*) AS c FROM audit_log WHERE action = ?').get(action) as { c: number }).c;
const outbox = (template: string) => db.prepare('SELECT * FROM email_outbox WHERE template_key = ? ORDER BY created_at_ts').all(template) as any[];
let keySeq = 0;
const act = (cookie: string, id: string, action: string, extra: Record<string, unknown> = {}) =>
  call('POST', `/api/courier/jobs/${id}/action`, cookie, { action, idempotencyKey: `cash-test-${++keySeq}-${Date.now()}`, ...extra });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
async function uploadPod(cookie: string, id: string, recipientName: string) {
  const form = new FormData();
  form.append('photo', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), 'photo.png');
  form.append('recipientName', recipientName);
  return fetch(`${BASE}/api/courier/pod/${id}`, { method: 'POST', headers: { Cookie: c1 }, body: form });
}

// ---- Pure rules ----

test('balance: only cash in hand counts; mobile money paid to the company is shown apart', () => {
  const t = cashTotals([
    { type: 'COLLECTED', method: 'CASH', status: 'PENDING', amount: 5000 },
    { type: 'COLLECTED', method: 'MTN_MOMO', status: 'PENDING', amount: 3000 },
    { type: 'COLLECTED', method: 'CASH', status: 'REJECTED', amount: 999 },
    { type: 'HANDOVER', method: 'CASH', status: 'CONFIRMED', amount: 2000 },
    { type: 'HANDOVER', method: 'MTN_MOMO', status: 'PENDING', amount: 1000 },
    { type: 'ADJUSTMENT', method: 'CASH', status: 'CONFIRMED', amount: -500 },
  ]);
  assert.deepEqual(t, { collected: 5000, mobileMoney: 3000, handedOver: 2000, pendingHandover: 1000, adjustments: -500, balance: 2500 });
  // The 7-day deadline ignores mobile money collections too.
  assert.deepEqual(handoverDue([{ type: 'COLLECTED', method: 'ORANGE_MONEY', status: 'PENDING', amount: 4000, createdAt: now0 }], now0),
    { outstanding: 0, dueBy: null, overdue: false });
});

test('daily report: activity of the day, confirmations on their day, end-of-day balance; CSV is safe', () => {
  const day = dayRange('2026-11-16', 'Africa/Douala')!;
  // Douala is UTC+1: the day starts at 23:00 UTC the evening before.
  assert.equal(day.start, Date.UTC(2026, 10, 15, 23));
  assert.equal(day.end - day.start, DAY);
  assert.equal(dayRange('2026-02-30'), null);
  const at = (h: number) => day.start + h * 3_600_000;
  const line = (o: Record<string, unknown>) => ({ courierUserId: 'u1', method: 'CASH', currency: 'XAF', confirmedAt: null, ...o }) as any;
  const rows = dailyCashReport([
    line({ type: 'COLLECTED', status: 'PENDING', amount: 1000, createdAt: at(-30) }),            // earlier day
    line({ type: 'COLLECTED', status: 'PENDING', amount: 4000, createdAt: at(9) }),
    line({ type: 'COLLECTED', method: 'MTN_MOMO', status: 'CONFIRMED', amount: 2500, createdAt: at(10), confirmedAt: at(11) }),
    line({ type: 'HANDOVER', status: 'CONFIRMED', amount: 3000, createdAt: at(12), confirmedAt: at(30) }), // confirmed next day
    line({ type: 'COLLECTED', status: 'PENDING', amount: 7000, createdAt: at(30) }),              // next day: ignored
    line({ courierUserId: 'u2', type: 'ADJUSTMENT', status: 'CONFIRMED', amount: -200, createdAt: at(15), confirmedAt: at(15) }),
  ], { u1: 'Ama, "the fast" Rider', u2: '=cmd' }, day.start, day.end);
  assert.equal(rows.length, 2);
  const ama = rows.find((r) => r.courierUserId === 'u1')!;
  assert.deepEqual({ ...ama }, {
    courierUserId: 'u1', courierName: 'Ama, "the fast" Rider', currency: 'XAF', collected: 4000, mobileMoney: 2500,
    handoversDeclared: 3000, handoversConfirmed: 0, adjustments: 0, pendingCount: 3, balanceEnd: 5000,
  });
  const csv = dailyReportCsv('2026-11-16', rows);
  assert.ok(csv.startsWith('\uFEFFDate,Courier,'));
  assert.ok(csv.includes('"Ama, ""the fast"" Rider"'));
  assert.ok(csv.includes(",'=cmd,"), 'formula-like names are neutralised');
  assert.equal(csvField(-200), '-200', 'negative numbers stay numbers');
});

test('WhatsApp plan: the right message per step, in the job language, with masked names', () => {
  assert.deepEqual(jobMessagePlan('CONFIRMED', 'dispatch').map((m) => `${m.template}>${m.to}`), ['booking.confirmed>sender', 'local.share_recipient>recipient']);
  assert.deepEqual(jobMessagePlan('CONFIRMED', 'courier'), []);
  assert.deepEqual(jobMessagePlan('ON_THE_WAY', 'courier').map((m) => m.template), ['local.on_the_way']);
  assert.deepEqual(jobMessagePlan('CANCELLED', 'dispatch'), []);
  const base = {
    trackingNumber: 'TX7K2M9P', trackLink: 'https://tanexsarl.com/fr/suivi/TX7K2M9P', senderName: 'Sue Sender', senderPhone: '651 11 22 33',
    recipientName: 'Rita Mbah', recipientPhone: 'not a phone', riderFirstName: 'Ama', podRecipientName: 'Rita Mbah',
    deliveredAt: Date.UTC(2026, 10, 16, 13, 5), failureReason: 'RECIPIENT_ABSENT',
  };
  const [delivered] = buildJobMessages({ ...base, status: 'DELIVERED', locale: 'fr' }, 'dispatch');
  const text = decodeURIComponent(delivered.link!.split('?text=')[1]);
  assert.ok(delivered.link!.startsWith('https://wa.me/237651112233?text='));
  assert.equal(text, "Livré : TX7K2M9P a été reçu par R*** M*** à 14:05. Merci d'avoir choisi TanEx.\n— TanEx");
  const [failed] = buildJobMessages({ ...base, status: 'FAILED_ATTEMPT', locale: 'en' }, 'courier');
  assert.match(decodeURIComponent(failed.link!), /We couldn't deliver TX7K2M9P: recipient not available\./);
  // Invalid recipient phone: no link (the button is disabled).
  assert.equal(buildJobMessages({ ...base, status: 'ON_THE_WAY', locale: 'en' }, 'dispatch')[0].link, null);
});

// ---- API ----

let jobId = '';
let tracking = '';

test('booking.confirmed email when dispatch confirms; WhatsApp taps logged with a masked phone', async () => {
  const booked = await call('POST', '/api/local-delivery', undefined, {
    cityId: 'city_b', sizeClass: 'SMALL', email: 'sue@example.test', locale: 'fr',
    pickup: { zoneId: 'z_mol', landmark: 'Blue gate', contactName: 'Sue Sender', contactPhone: '+237 651 11 22 33' },
    dropoff: { zoneId: 'z_chk', landmark: 'Green door', contactName: 'Rita Mbah', contactPhone: '691 44 55 66' },
  });
  assert.equal(booked.status, 201);
  tracking = (await booked.json()).data.trackingNumber;
  jobId = (db.prepare('SELECT id FROM dispatch_jobs WHERE tracking_number = ?').get(tracking) as any).id;
  assert.equal(outbox('booking.confirmed').length, 0, 'no confirmation before dispatch confirms');

  // Public share tap from the success page: logged, answer says nothing.
  assert.equal((await call('POST', '/api/local-delivery/whatsapp-opened', undefined, { trackingNumber: tracking })).status, 204);
  assert.equal((await call('POST', '/api/local-delivery/whatsapp-opened', undefined, { trackingNumber: 'TX000000' })).status, 204);
  let log = db.prepare("SELECT * FROM notification_log WHERE related_id = ?").all(jobId) as any[];
  assert.equal(log.length, 1);
  assert.equal(log[0].template_key, 'local.share_recipient');
  assert.equal(log[0].to_masked, '+•••••••••566');
  assert.equal(log[0].user_id, null);

  assert.equal((await call('POST', `/api/dispatch/jobs/${jobId}/confirm`, disp, {})).status, 200);
  const mails = outbox('booking.confirmed');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to_addr, 'sue@example.test');
  assert.equal(mails[0].locale, 'fr');
  assert.match(mails[0].subject, new RegExp(`Votre réservation TanEx ${tracking} est confirmée`));
  assert.ok(mails[0].text.includes(`/fr/suivi/${tracking}`));

  // Staff tap: dispatch.view is enough; the phone comes from the job, never from the request.
  const tap = await call('POST', '/api/notifications/whatsapp', sup, { jobId, template: 'booking.confirmed', to: 'sender', phone: '+1 555 0100' });
  assert.equal(tap.status, 200);
  log = db.prepare("SELECT * FROM notification_log WHERE related_id = ? ORDER BY at_ts").all(jobId) as any[];
  assert.equal(log.at(-1).to_masked, '+•••••••••233');
  assert.equal(log.at(-1).user_id, 'usr_sup');
  assert.equal(log.at(-1).locale, 'fr');
  // Not this courier's job; unknown template; signed out.
  assert.equal((await call('POST', '/api/notifications/whatsapp', c1, { jobId, template: 'local.on_the_way', to: 'recipient' })).status, 403);
  assert.equal((await call('POST', '/api/notifications/whatsapp', disp, { jobId, template: 'auth.temp_password', to: 'sender' })).status, 400);
  assert.equal((await call('POST', '/api/notifications/whatsapp', undefined, { jobId, template: 'booking.confirmed', to: 'sender' })).status, 401);

  // The drawer history lists the opened links next to the emails.
  const history = (await (await call('GET', `/api/dispatch/jobs/${jobId}/history`, disp)).json()).data;
  const channels = history.notifications.map((n: any) => n.channel);
  assert.ok(channels.includes('EMAIL') && channels.includes('WHATSAPP_LINK'));
  assert.ok(history.notifications.some((n: any) => n.byName === 'Support Sam'));
});

test('local.delivered email after delivery; the courier logs taps on their own job; mobile money stays out of the balance', async () => {
  assert.equal((await call('POST', `/api/dispatch/jobs/${jobId}/assign`, disp, { courierUserId: 'usr_c1' })).status, 200);
  assert.equal((await act(c1, jobId, 'accept')).status, 200);
  assert.equal((await act(c1, jobId, 'pick_up', { cash: [{ amount: 1000, method: 'CASH' }] })).status, 200);
  assert.equal((await act(c1, jobId, 'start_delivery')).status, 200);
  assert.equal((await call('POST', '/api/notifications/whatsapp', c1, { jobId, template: 'local.on_the_way', to: 'recipient' })).status, 200);
  assert.equal((await uploadPod(c1, jobId, 'Rita Mbah')).status, 200);
  const delivered = await act(c1, jobId, 'deliver', { recipientName: 'Rita Mbah', cash: [{ amount: 5000, method: 'MTN_MOMO', momoReference: 'MP241116.1' }] });
  assert.equal(delivered.status, 200);
  const mails = outbox('local.delivered');
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, new RegExp(`Livré : ${tracking} a été reçu par R\\*\\*\\* M\\*\\*\\* à \\d\\d:\\d\\d`));

  const mine = (await (await call('GET', '/api/courier/cash', c1)).json()).data.balances[0];
  assert.equal(mine.collected, 1000, 'the MoMo payment went to the company, not the courier');
  assert.equal(mine.balance, 1000);
});

test('Finance: overview, confirm and reject pending entries, adjustments; cash.view reads only', async () => {
  // Courier declares a cash handover of what they hold.
  assert.equal((await call('POST', '/api/courier/cash/handover', c1, { amount: 1000, idempotencyKey: 'cash-handover-0001' })).status, 200);

  const overview = (await (await call('GET', '/api/cash/overview', disp)).json()).data;
  const ama = overview.couriers.find((c: any) => c.userId === 'usr_c1');
  assert.equal(ama.balances[0].mobileMoney, 5000);
  assert.equal(ama.pendingCount, 3);
  assert.equal(overview.pending.length, 3);
  const handover = overview.pending.find((e: any) => e.type === 'HANDOVER');
  const momo = overview.pending.find((e: any) => e.method === 'MTN_MOMO');
  assert.equal(momo.momoReference, 'MP241116.1');
  assert.equal(momo.trackingNumber, tracking);

  // Dispatch managers hold cash.view only; couriers have no access to /api/cash.
  assert.equal((await call('POST', `/api/cash/entries/${handover.id}/confirm`, disp, {})).status, 403);
  assert.equal((await call('GET', '/api/cash/overview', c1)).status, 403);
  assert.equal((await call('GET', '/api/cash/overview', sup)).status, 403);

  const confirmed = await call('POST', `/api/cash/entries/${handover.id}/confirm`, fin, {});
  assert.equal(confirmed.status, 200);
  const e = (await confirmed.json()).data;
  assert.equal(e.status, 'CONFIRMED');
  assert.equal(e.confirmedByName, 'Finance Fay');
  assert.equal((await call('POST', `/api/cash/entries/${handover.id}/confirm`, fin, {})).status, 409, 'already reviewed');
  assert.equal(auditCount('cash.confirm'), 1);

  assert.equal((await (await call('POST', `/api/cash/entries/${momo.id}/reject`, fin, {})).json()).code, 'REASON_REQUIRED');
  const rejected = await call('POST', `/api/cash/entries/${momo.id}/reject`, fin, { reason: 'Not on the MoMo statement' });
  assert.equal(rejected.status, 200);
  assert.equal(auditCount('cash.reject'), 1);
  const rejectAudit = db.prepare("SELECT after_json FROM audit_log WHERE action = 'cash.reject'").get() as any;
  assert.match(rejectAudit.after_json, /Not on the MoMo statement/);

  // Adjustments: signed, reason required, confirmed at once, counted in the balance.
  assert.equal((await (await call('POST', '/api/cash/adjustments', fin, { courierUserId: 'usr_c1', amount: 300 })).json()).code, 'REASON_REQUIRED');
  assert.equal((await call('POST', '/api/cash/adjustments', fin, { courierUserId: 'usr_c1', amount: 0, reason: 'x' })).status, 400);
  assert.equal((await call('POST', '/api/cash/adjustments', fin, { courierUserId: 'usr_fin', amount: 10, reason: 'x' })).status, 404, 'couriers only');
  const adj = await call('POST', '/api/cash/adjustments', fin, { courierUserId: 'usr_c1', amount: -250, reason: 'Fuel advance agreed with the office' });
  assert.equal(adj.status, 201);
  assert.equal((await adj.json()).data.status, 'CONFIRMED');
  assert.equal(auditCount('cash.adjust'), 1);
  assert.equal((await call('POST', '/api/cash/adjustments', disp, { courierUserId: 'usr_c1', amount: 5, reason: 'x' })).status, 403);

  const bal = (await (await call('GET', '/api/courier/cash', c1)).json()).data.balances[0];
  assert.equal(bal.balance, 1000 - 1000 - 250);

  const entries = (await (await call('GET', '/api/cash/entries?courier=usr_c1', disp)).json()).data;
  assert.equal(entries.length, 4);
});

test('daily report as JSON and CSV (cash.view)', async () => {
  const json = (await (await call('GET', '/api/cash/report', disp)).json()).data;
  const row = json.rows.find((r: any) => r.courierUserId === 'usr_c1');
  assert.equal(row.collected, 1000);
  assert.equal(row.handoversConfirmed, 1000);
  assert.equal(row.adjustments, -250);
  const csv = await call('GET', `/api/cash/report?date=${json.date}&format=csv`, fin);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') ?? '', /text\/csv/);
  assert.match(csv.headers.get('content-disposition') ?? '', new RegExp(`cash-report-${json.date}\\.csv`));
  assert.ok((await csv.text()).includes('Ama Rider,XAF,1000'));
  assert.equal((await call('GET', '/api/cash/report?date=2026-13-01', fin)).status, 400);
  assert.equal((await call('GET', '/api/cash/report', c2)).status, 403);
});

test('quote.ready email once, on the first publish only, in the form language', async () => {
  const created = await call('POST', '/api/quotes', undefined, { customerName: 'Ada Obi', customerEmail: 'ada@example.test', locale: 'fr', originCity: 'Buea', destCity: 'Paris' });
  assert.equal(created.status, 201);
  const id = (await created.json()).data.id;
  assert.equal((await call('PUT', `/api/quotes/${id}/publish`, sa, { pricing: { total: 100 } })).status, 200);
  assert.equal((await call('PUT', `/api/quotes/${id}/publish`, sa, { pricing: { total: 120 } })).status, 200);
  const mails = outbox('quote.ready');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].locale, 'fr');
  assert.match(mails[0].subject, new RegExp(`Votre devis TanEx ${id} est prêt`));
});

test('temporary password WhatsApp tap: needs users.manage or couriers.manage', async () => {
  assert.equal((await call('POST', '/api/notifications/whatsapp', disp, { userId: 'usr_c2', template: 'auth.temp_password' })).status, 403);
  const ok = await call('POST', '/api/notifications/whatsapp', sa, { userId: 'usr_c2', template: 'auth.temp_password' });
  assert.equal(ok.status, 200);
  const row = db.prepare("SELECT * FROM notification_log WHERE related_type = 'user' AND related_id = 'usr_c2'").get() as any;
  assert.equal(row.template_key, 'auth.temp_password');
  assert.equal(row.to_masked, '+••• ••• •• •0 09');
  assert.equal(row.channel, 'WHATSAPP_LINK');
  assert.equal(row.status, 'OPENED');
});

test('#175: rejecting a mobile money reference can charge the courier in the same step, never by default', async () => {
  const ins = db.prepare(`
    INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, momo_reference, status, recorded_by, created_at_ts)
    VALUES (?, ?, 'usr_c2', NULL, ?, ?, ?, 'XAF', ?, 'PENDING', 'usr_c2', ?)
  `);
  ins.run('m175', 'TX-CSH-917501', 'COLLECTED', 'ORANGE_MONEY', 3000, 'OM-FAKE-1', Date.now());
  ins.run('h175', 'TX-CSH-917502', 'HANDOVER', 'CASH', 500, null, Date.now());
  const before = (await (await call('GET', '/api/courier/cash', c2)).json()).data.balances.find((b: any) => b.currency === 'XAF')?.balance ?? 0;

  // Only a mobile money payment can be charged.
  const wrong = await call('POST', '/api/cash/entries/h175/reject', fin, { reason: 'Never received', chargeCourier: true });
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).code, 'CHARGE_NOT_ALLOWED');

  const res = await call('POST', '/api/cash/entries/m175/reject', fin, { reason: 'Not on the Orange Money statement', chargeCourier: true });
  assert.equal(res.status, 200);
  const adj = db.prepare("SELECT * FROM cash_ledger WHERE entry_type = 'ADJUSTMENT' AND note LIKE 'Rejected mobile money TX-CSH-917501%'").get() as any;
  assert.equal(adj.amount, 3000);
  assert.equal(adj.status, 'CONFIRMED');
  assert.equal(adj.courier_user_id, 'usr_c2');
  const after = (await (await call('GET', '/api/courier/cash', c2)).json()).data.balances.find((b: any) => b.currency === 'XAF').balance;
  assert.equal(after, before + 3000);
});

test('#177: a console booking stores the customer language; booking.confirmed goes out in it', async () => {
  const res = await call('POST', '/api/shipments', sa, {
    notifyLocale: 'fr', service: 'Standard',
    origin: { city: 'Buea', lat: 4.15, lng: 9.24 }, destination: { city: 'Paris', lat: 48.85, lng: 2.35 },
    sender: { name: 'Ada Obi', email: 'ada.ship@example.test', phone: '' }, recipient: { name: 'Bob' },
  });
  assert.equal(res.status, 201);
  const id = (await res.json()).data.trackingNumber;
  assert.equal((db.prepare('SELECT notify_locale FROM shipments WHERE tracking_number = ?').get(id) as any).notify_locale, 'fr');
  const mail = outbox('booking.confirmed').find((m) => m.related_id === id);
  assert.equal(mail.locale, 'fr');
  assert.ok(mail.text.includes(`/fr/suivi/${id}`));
});
