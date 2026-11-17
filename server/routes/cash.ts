// Cash & Mobile Money (docs/DISPATCH_SPEC.md §9, §11): Finance's view of the courier cash ledger.
// Reading needs cash.view or cash.confirm; confirming or rejecting an entry and recording an
// adjustment need cash.confirm. Every write is audited. Couriers see and record their own money
// through /api/courier/cash (server/routes/courier.ts).
//
// GET  /api/cash/overview                         couriers with balances, and every entry waiting for Finance
// GET  /api/cash/entries?courier=&days=           one courier's entries (last N days, default 30, max 366) + all pending
// POST /api/cash/entries/:id/confirm { note? }    a pending handover, or a pending collection / mobile money reference
// POST /api/cash/entries/:id/reject  { reason, chargeCourier? }   reason required; chargeCourier only for a
//      mobile money reference: also records a confirmed adjustment of that amount against the courier (#175)
// POST /api/cash/adjustments { courierUserId, amount, currency?, reason }   signed amount, recorded as confirmed
// GET  /api/cash/report?date=YYYY-MM-DD[&format=csv]   daily per-courier report (Africa/Douala day)
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth } from '../auth/permissions.js';
import { inTransaction } from '../auth/schema.js';
import { serverError } from '../errors.js';
import { allocateCashRef } from '../dispatch/cashRef.js';
import { balancesFromLines, readCashLines } from '../dispatch/cash.js';
import { readMoney, isFail, NOTE_MAX } from '../dispatch/jobs.js';
import { dailyCashReport, dailyReportCsv, dayRange, todayIn } from '../../src/shared/cashReport.js';
import { BOARD_TIME_ZONE } from '../../src/shared/dispatchBoard.js';

export const cashRouter = Router();

const canView = requirePermission('cash.view', 'cash.confirm');
const canConfirm = requirePermission('cash.confirm');
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
const noStore = (res: Response) => res.set('Cache-Control', 'no-store');
const fail = (res: Response, status: number, code: string, error: string) => res.status(status).json({ success: false, code, error });
const text = (value: unknown, max = NOTE_MAX): string | null => {
  if (typeof value !== 'string') return null;
  const v = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : null;
};
const DAY_MS = 86_400_000;

interface EntryRow {
  id: string; ref: string; courier_user_id: string; job_id: string | null; entry_type: string; method: string; amount: number;
  currency: string; momo_reference: string | null; status: string; recorded_by: string; confirmed_by: string | null;
  note: string | null; created_at_ts: number; confirmed_at_ts: number | null;
  tracking_number: string | null; courier_name: string | null; recorded_by_name: string | null; confirmed_by_name: string | null;
}

const ENTRY_SELECT = `
  SELECT l.*, j.tracking_number, cu.display_name AS courier_name, ru.display_name AS recorded_by_name, fu.display_name AS confirmed_by_name
  FROM cash_ledger l
  LEFT JOIN dispatch_jobs j ON j.id = l.job_id
  LEFT JOIN users cu ON cu.id = l.courier_user_id
  LEFT JOIN users ru ON ru.id = l.recorded_by
  LEFT JOIN users fu ON fu.id = l.confirmed_by`;

const entryOut = (r: EntryRow) => ({
  id: r.id, ref: r.ref, courierUserId: r.courier_user_id, courierName: r.courier_name, jobId: r.job_id, trackingNumber: r.tracking_number,
  type: r.entry_type, method: r.method, amount: r.amount, currency: r.currency, momoReference: r.momo_reference, status: r.status,
  note: r.note, recordedByName: r.recorded_by_name, confirmedByName: r.confirmed_by_name,
  createdAt: r.created_at_ts, confirmedAt: r.confirmed_at_ts,
});

const loadEntry = (id: string) => db.prepare(`${ENTRY_SELECT} WHERE l.id = ?`).get(id) as unknown as EntryRow | undefined;

/** Couriers with a ledger or a courier profile, with their names. */
function courierNames(): Record<string, string> {
  const rows = db.prepare(`
    SELECT u.id, u.display_name FROM users u
    WHERE u.id IN (SELECT user_id FROM couriers) OR u.id IN (SELECT courier_user_id FROM cash_ledger)
  `).all() as { id: string; display_name: string }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.display_name]));
}

cashRouter.get('/overview', canView, (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const lines = readCashLines(db);
    const couriers = db.prepare(`
      SELECT u.id, u.display_name, u.phone, u.status, c.vehicle_type, c.user_id IS NOT NULL AS has_profile
      FROM users u LEFT JOIN couriers c ON c.user_id = u.id
      WHERE c.user_id IS NOT NULL OR u.id IN (SELECT courier_user_id FROM cash_ledger)
      ORDER BY u.display_name COLLATE NOCASE
    `).all() as { id: string; display_name: string; phone: string | null; status: string; vehicle_type: string | null }[];
    const pending = db.prepare(`${ENTRY_SELECT} WHERE l.status = 'PENDING' ORDER BY l.created_at_ts`).all() as unknown as EntryRow[];
    noStore(res);
    res.json({
      success: true,
      data: {
        serverTime: now,
        today: todayIn(BOARD_TIME_ZONE, now),
        couriers: couriers.map((c) => ({
          userId: c.id, displayName: c.display_name, phone: c.phone, accountStatus: c.status, vehicleType: c.vehicle_type,
          balances: balancesFromLines(lines.filter((l) => l.courierUserId === c.id), now),
          pendingCount: pending.filter((p) => p.courier_user_id === c.id).length,
        })),
        pending: pending.map(entryOut),
      },
    });
  } catch (err) {
    serverError(res, err);
  }
});

cashRouter.get('/entries', canView, (req: Request, res: Response) => {
  try {
    const courier = typeof req.query.courier === 'string' ? req.query.courier : '';
    if (!courier) return fail(res, 400, 'INVALID_INPUT', 'Choose a courier.');
    const daysIn = Number(req.query.days);
    const days = Number.isInteger(daysIn) && daysIn >= 1 && daysIn <= 366 ? daysIn : 30;
    const rows = db.prepare(`
      ${ENTRY_SELECT} WHERE l.courier_user_id = ? AND (l.created_at_ts >= ? OR l.status = 'PENDING')
      ORDER BY l.created_at_ts DESC LIMIT 1000
    `).all(courier, Date.now() - days * DAY_MS) as unknown as EntryRow[];
    noStore(res);
    res.json({ success: true, data: rows.map(entryOut) });
  } catch (err) {
    serverError(res, err);
  }
});

const ENTRY_LABEL: Record<string, string> = { COLLECTED: 'Collection', HANDOVER: 'Handover', ADJUSTMENT: 'Adjustment' };

function review(req: Request, res: Response, to: 'CONFIRMED' | 'REJECTED') {
  try {
    const entry = loadEntry(String(req.params.id));
    if (!entry) return fail(res, 404, 'NOT_FOUND', 'Entry not found.');
    if (entry.status !== 'PENDING') return fail(res, 409, 'ALREADY_REVIEWED', 'This entry has already been confirmed or rejected.');
    const b = body(req);
    const reason = text(b.reason ?? b.note);
    if (to === 'REJECTED' && !reason) return fail(res, 400, 'REASON_REQUIRED', 'Say why the entry is rejected.');
    // Owner decision #175: a rejected mobile money reference is never charged automatically; Finance
    // may choose to charge it to the courier in the same step, linked to the rejected entry.
    const charge = to === 'REJECTED' && b.chargeCourier === true;
    if (charge && !(entry.entry_type === 'COLLECTED' && entry.method !== 'CASH')) {
      return fail(res, 400, 'CHARGE_NOT_ALLOWED', 'Only a mobile money payment recorded by the courier can be charged to them.');
    }
    const user = getRequestAuth(req)!.user;
    const now = Date.now();
    inTransaction(db, () => {
      // Only a still-pending row changes, so two people reviewing at once can't both win.
      const changed = db.prepare(`
        UPDATE cash_ledger SET status = ?, confirmed_by = ?, confirmed_at_ts = ? WHERE id = ? AND status = 'PENDING'
      `).run(to, user.id, now, entry.id);
      if (Number(changed.changes) !== 1) throw Object.assign(new Error('raced'), { raced: true });
      const label = ENTRY_LABEL[entry.entry_type] ?? entry.entry_type;
      audit(req, to === 'CONFIRMED' ? 'cash.confirm' : 'cash.reject', 'cash_ledger', entry.id,
        `${label} ${to === 'CONFIRMED' ? 'confirmed' : 'rejected'} (${entry.amount} ${entry.currency}): ${entry.ref}`,
        { status: 'PENDING' },
        { status: to, ref: entry.ref, courierUserId: entry.courier_user_id, amount: entry.amount, currency: entry.currency,
          method: entry.method, ...(entry.momo_reference ? { momoReference: entry.momo_reference } : {}), ...(reason ? { reason } : {}),
          ...(charge ? { chargedToCourier: true } : {}) },
        { conn: db });
      if (charge) {
        const adjId = 'csh_' + crypto.randomBytes(9).toString('hex');
        const adjRef = allocateCashRef(db);
        const note = `Rejected mobile money ${entry.ref}: ${reason}`.slice(0, NOTE_MAX);
        db.prepare(`
          INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, momo_reference,
                                   status, recorded_by, confirmed_by, note, created_at_ts, confirmed_at_ts)
          VALUES (?, ?, ?, ?, 'ADJUSTMENT', 'CASH', ?, ?, NULL, 'CONFIRMED', ?, ?, ?, ?, ?)
        `).run(adjId, adjRef, entry.courier_user_id, entry.job_id, entry.amount, entry.currency, user.id, user.id, note, now, now);
        audit(req, 'cash.adjust', 'cash_ledger', adjId, `Cash adjustment (${entry.amount} ${entry.currency}): ${entry.courier_name ?? entry.courier_user_id}`,
          undefined, { ref: adjRef, courierUserId: entry.courier_user_id, amount: entry.amount, currency: entry.currency, reason: note, rejectedRef: entry.ref },
          { conn: db });
      }
    });
    res.json({ success: true, data: entryOut(loadEntry(entry.id)!) });
  } catch (err) {
    if ((err as { raced?: boolean }).raced) return fail(res, 409, 'ALREADY_REVIEWED', 'This entry has already been confirmed or rejected.');
    serverError(res, err);
  }
}

cashRouter.post('/entries/:id/confirm', canConfirm, (req, res) => review(req, res, 'CONFIRMED'));
cashRouter.post('/entries/:id/reject', canConfirm, (req, res) => review(req, res, 'REJECTED'));

cashRouter.post('/adjustments', canConfirm, (req: Request, res: Response) => {
  try {
    const b = body(req);
    const courierUserId = typeof b.courierUserId === 'string' ? b.courierUserId : '';
    const courier = courierUserId
      ? db.prepare('SELECT u.id, u.display_name FROM users u JOIN couriers c ON c.user_id = u.id WHERE u.id = ?').get(courierUserId) as
        { id: string; display_name: string } | undefined
      : undefined;
    if (!courier) return fail(res, 404, 'NOT_FOUND', 'Courier not found.');
    const currency = typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency) ? b.currency : 'XAF';
    const raw = typeof b.amount === 'number' ? b.amount : NaN;
    // Signed: + the courier owes more, − the courier owes less. readMoney checks the size and decimals.
    const size = readMoney(Math.abs(raw), currency, 'INVALID_CASH', 'The adjustment');
    if (isFail(size)) return res.status(size.status).json({ success: false, code: size.code, error: size.error });
    if (!Number.isFinite(raw) || size === 0) return fail(res, 400, 'INVALID_CASH', 'Enter an amount other than 0 (use − to lower what the courier owes).');
    const amount = raw < 0 ? -size : size;
    const reason = text(b.reason);
    if (!reason) return fail(res, 400, 'REASON_REQUIRED', 'Say why the adjustment is made.');
    const user = getRequestAuth(req)!.user;
    const now = Date.now();
    const id = 'csh_' + crypto.randomBytes(9).toString('hex');
    inTransaction(db, () => {
      const ref = allocateCashRef(db);
      db.prepare(`
        INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, momo_reference,
                                 status, recorded_by, confirmed_by, note, created_at_ts, confirmed_at_ts)
        VALUES (?, ?, ?, NULL, 'ADJUSTMENT', 'CASH', ?, ?, NULL, 'CONFIRMED', ?, ?, ?, ?, ?)
      `).run(id, ref, courier.id, amount, currency, user.id, user.id, reason, now, now);
      audit(req, 'cash.adjust', 'cash_ledger', id, `Cash adjustment (${amount} ${currency}): ${courier.display_name}`,
        undefined, { ref, courierUserId: courier.id, amount, currency, reason }, { conn: db });
    });
    res.status(201).json({ success: true, data: entryOut(loadEntry(id)!) });
  } catch (err) {
    serverError(res, err);
  }
});

cashRouter.get('/report', canView, (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' && req.query.date ? req.query.date : todayIn(BOARD_TIME_ZONE);
    const range = dayRange(date, BOARD_TIME_ZONE);
    if (!range) return fail(res, 400, 'INVALID_DATE', 'Choose a date (YYYY-MM-DD).');
    const rows = dailyCashReport(readCashLines(db), courierNames(), range.start, range.end);
    noStore(res);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="cash-report-${date}.csv"`);
      return res.send(dailyReportCsv(date, rows));
    }
    res.json({ success: true, data: { date, rows } });
  } catch (err) {
    serverError(res, err);
  }
});
