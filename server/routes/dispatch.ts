// Dispatch API (docs/DISPATCH_SPEC.md §4, §7, §11): delivery jobs for the console. Reading needs
// dispatch.view or dispatch.manage; every change needs dispatch.manage, goes through the shared
// state machine (src/shared/dispatchStatus.ts) and is audited. Proof-of-delivery files are
// private and served here only to dispatch and finance (the courier has its own route).
import { Router, Request, Response } from 'express';
import path from 'path';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth, loadUserPermissions } from '../auth/permissions.js';
import { inTransaction } from '../auth/schema.js';
import { serverError } from '../errors.js';
import { IMAGE_CONTENT_TYPES, resolveUploadPath } from '../uploads.js';
import {
  NOTE_MAX, applyTransition, checkJobShape, createJobShipment, defaultVehicle, fail, hashDeliveryCode, isFail, jobOut,
  loadJob, newJobId, parsePlace, priceJob, readJobInput, writeTransition, type Fail, type JobRow, type Place,
} from '../dispatch/jobs.js';
import {
  FINAL_DISPATCH_STATUSES, checkTransition, findTransition, isDispatchStatus, type DispatchAction, type DispatchStatus,
  type TransitionErrorCode,
} from '../../src/shared/dispatchStatus.js';
import { hasPermission } from '../../src/shared/permissions.js';

const send = (res: Response, f: Fail) =>
  res.status(f.status).json({ success: false, code: f.code, error: f.error, ...(f.details ? { details: f.details } : {}) });
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
const noStore = (res: Response) => res.set('Cache-Control', 'no-store');
const actorOf = (req: Request) => {
  const auth = getRequestAuth(req)!;
  return { userId: auth.user.id, name: auth.user.displayName };
};

const BEFORE_PICKUP: readonly DispatchStatus[] = ['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED'];
const isFinal = (s: DispatchStatus) => FINAL_DISPATCH_STATUSES.includes(s);

/** HTTP answer for a refused state-machine move. */
export function transitionFail(code: TransitionErrorCode, status: DispatchStatus | null): Fail {
  switch (code) {
    case 'UNKNOWN_ACTION': return fail(400, code, 'Unknown action.');
    case 'INVALID_TRANSITION': return fail(409, code, `This can't be done while the job is ${String(status ?? 'new').toLowerCase().replace(/_/g, ' ')}.`);
    case 'WRONG_ACTOR': return fail(403, code, 'This step is not yours to record.');
    case 'NOT_YOUR_JOB': return fail(403, code, 'This job is not assigned to you.');
    case 'COURIER_REQUIRED': return fail(400, code, 'Choose a courier.');
    case 'POD_REQUIRED': return fail(400, code, 'Add the recipient’s name and a photo before marking it delivered.');
    case 'REASON_REQUIRED': return fail(400, code, 'Choose why the delivery could not be made.');
    case 'NOTE_REQUIRED': return fail(400, code, 'Add a note explaining the reason.');
  }
}

const reasonOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const v = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, NOTE_MAX) : null;
};

/** Loads :id into res.locals.job or answers 404. */
function withJob(req: Request, res: Response): JobRow | null {
  const job = loadJob(db, String(req.params.id));
  if (!job) {
    send(res, fail(404, 'NOT_FOUND', 'Job not found.'));
    return null;
  }
  return job;
}

const PRICE_REQUIRED = fail(409, 'PRICE_REQUIRED', 'No rate matches this job. Set the price by hand with a reason.');

/** Sends a stored proof-of-delivery file. */
export function sendPodFile(res: Response, job: JobRow, kind: string) {
  const file = kind === 'photo' ? job.pod_photo_file : kind === 'signature' ? job.pod_signature_file : null;
  const filePath = file ? resolveUploadPath('pod', file) : null;
  if (!file || !filePath) return send(res, fail(404, 'NOT_FOUND', 'No file.'));
  res.setHeader('Content-Type', IMAGE_CONTENT_TYPES[path.extname(file).slice(1)]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(filePath, { cacheControl: false }, (err) => {
    if (err && !res.headersSent) send(res, fail(404, 'NOT_FOUND', 'No file.'));
  });
}

export const dispatchRouter = Router();
const canView = requirePermission('dispatch.view', 'dispatch.manage');
const canManage = requirePermission('dispatch.manage');

// GET /api/dispatch/jobs?status=&scope=&cityId=&courierUserId=&q=&limit=
dispatchRouter.get('/jobs', canView, (req: Request, res: Response) => {
  try {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const q = req.query;
    if (typeof q.status === 'string' && q.status) {
      const statuses = q.status.split(',').filter(isDispatchStatus);
      if (statuses.length) {
        where.push(`status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (typeof q.scope === 'string' && q.scope) { where.push('scope = ?'); params.push(q.scope); }
    if (typeof q.courierUserId === 'string' && q.courierUserId) { where.push('courier_user_id = ?'); params.push(q.courierUserId); }
    if (typeof q.cityId === 'string' && q.cityId) {
      where.push("(json_extract(pickup_json, '$.cityId') = ? OR json_extract(dropoff_json, '$.cityId') = ?)");
      params.push(q.cityId, q.cityId);
    }
    if (typeof q.q === 'string' && q.q.trim()) { where.push('tracking_number LIKE ?'); params.push(`%${q.q.trim().toUpperCase()}%`); }
    const limit = Math.min(Math.max(Number(q.limit) || 200, 1), 500);
    const rows = db.prepare(`
      SELECT * FROM dispatch_jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at_ts DESC, id LIMIT ${limit}
    `).all(...params) as unknown as JobRow[];
    noStore(res);
    res.json({ success: true, data: rows.map((r) => jobOut(db, r, { view: 'dispatch' })) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/dispatch/board: active jobs, jobs finished in the last 24 h, and couriers with their
// last position (one call for the board, DISPATCH_SPEC §7).
dispatchRouter.get('/board', canView, (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const since = now - 86_400_000;
    const finals = FINAL_DISPATCH_STATUSES.map(() => '?').join(',');
    const jobs = db.prepare(`
      SELECT * FROM dispatch_jobs
      WHERE status NOT IN (${finals}) OR updated_at_ts >= ?
      ORDER BY updated_at_ts DESC, id LIMIT 500
    `).all(...FINAL_DISPATCH_STATUSES, since) as unknown as JobRow[];
    const couriers = db.prepare(`
      SELECT c.user_id, c.public_first_name, c.vehicle_type, c.home_city_id, c.is_on_duty, u.display_name, u.phone, u.status,
        (SELECT COUNT(*) FROM dispatch_jobs j WHERE j.courier_user_id = c.user_id AND j.status IN ('ASSIGNED','ACCEPTED','PICKED_UP','ON_THE_WAY')) AS active_jobs
      FROM couriers c JOIN users u ON u.id = c.user_id
      ORDER BY u.display_name COLLATE NOCASE, c.user_id
    `).all() as unknown as {
      user_id: string; public_first_name: string; vehicle_type: string; home_city_id: string | null; is_on_duty: number;
      display_name: string; phone: string | null; status: string; active_jobs: number;
    }[];
    const lastPing = db.prepare(`
      SELECT lat, lng, accuracy_m, speed_mps, heading, recorded_at_ts, job_id FROM courier_locations
      WHERE courier_user_id = ? ORDER BY recorded_at_ts DESC, id DESC LIMIT 1
    `);
    noStore(res);
    res.json({
      success: true,
      data: {
        serverTime: now,
        jobs: jobs.map((r) => jobOut(db, r, { view: 'dispatch' })),
        couriers: couriers.map((c) => {
          const p = lastPing.get(c.user_id) as
            { lat: number; lng: number; accuracy_m: number | null; speed_mps: number | null; heading: number | null; recorded_at_ts: number; job_id: string | null } | undefined;
          return {
            userId: c.user_id, displayName: c.display_name, publicFirstName: c.public_first_name, phone: c.phone,
            vehicleType: c.vehicle_type, homeCityId: c.home_city_id, isOnDuty: c.is_on_duty === 1, accountStatus: c.status,
            activeJobs: c.active_jobs,
            lastPosition: p ? {
              lat: p.lat, lng: p.lng, accuracyM: p.accuracy_m, speedMps: p.speed_mps, heading: p.heading,
              recordedAt: p.recorded_at_ts, jobId: p.job_id,
            } : null,
          };
        }),
      },
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/dispatch/jobs/:id
dispatchRouter.get('/jobs/:id', canView, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    noStore(res);
    res.json({ success: true, data: jobOut(db, job, { view: 'dispatch' }) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/dispatch/jobs/:id/pod/photo | /signature (dispatch and finance)
dispatchRouter.get('/jobs/:id/pod/:kind', requirePermission('dispatch.view', 'dispatch.manage', 'cash.view', 'cash.confirm'),
  (req: Request, res: Response) => {
    const job = loadJob(db, String(req.params.id));
    if (!job) return send(res, fail(404, 'NOT_FOUND', 'No file.'));
    sendPodFile(res, job, String(req.params.kind));
  });

// POST /api/dispatch/jobs { scope, trackingNumber? (first/last mile), pickup, dropoff, sizeClass?,
// weightKg?, itemDescription?, isExpress?, scheduledForTs?, vehicleRequired?, price? + priceReason,
// payer?, codAmount?, collectDeliveryFee?, deliveryCode?, notifyLocale? } → the job, CONFIRMED
dispatchRouter.post('/jobs', canManage, (req: Request, res: Response) => {
  try {
    const input = readJobInput(db, body(req), true);
    if (isFail(input)) return send(res, input);
    const scope = input.scope!;
    const pickup = input.pickup!;
    const dropoff = input.dropoff!;
    const sizeClass = input.sizeClass ?? null;
    const weightKg = input.weightKg ?? null;
    const shape = checkJobShape(scope, pickup, dropoff, sizeClass, weightKg);
    if (shape) return send(res, shape);
    const isExpress = !!input.isExpress;
    let price: number;
    let currency = 'XAF';
    const overridden = input.price !== undefined && input.price !== null;
    if (overridden) {
      price = input.price!;
    } else {
      const quote = priceJob(db, pickup, dropoff, sizeClass, weightKg, isExpress);
      if (!quote.ok) return send(res, quote.reason === 'NO_EXPRESS_RATE'
        ? fail(409, 'PRICE_REQUIRED', 'This rate has no express surcharge. Set the price by hand with a reason.') : PRICE_REQUIRED);
      price = quote.price;
      currency = quote.currency;
    }
    const actor = actorOf(req);
    const transition = findTransition(null, 'create')!;
    const now = Date.now();
    const id = newJobId();
    const row = inTransaction(db, () => {
      const tracking = scope === 'LOCAL' || scope === 'INTERCITY'
        ? createJobShipment(db, scope, pickup, dropoff, { itemDescription: input.itemDescription ?? null, weightKg, createdBy: actor.userId })
        : input.trackingNumber!;
      db.prepare(`
        INSERT INTO dispatch_jobs (id, tracking_number, scope, status, vehicle_required, pickup_json, dropoff_json, size_class,
          weight_kg, item_description, is_express, scheduled_for_ts, price, currency, price_overridden, payer, cod_amount,
          collect_delivery_fee, delivery_code_hash, notify_locale, created_by, created_at_ts, updated_at_ts)
        VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, tracking, scope, input.vehicleRequired ?? defaultVehicle(scope, pickup, dropoff, sizeClass),
        JSON.stringify(pickup), JSON.stringify(dropoff), sizeClass, weightKg, input.itemDescription ?? null, isExpress ? 1 : 0,
        input.scheduledForTs ?? null, price, currency, overridden ? 1 : 0, input.payer ?? 'SENDER', input.codAmount ?? null,
        input.collectDeliveryFee ? 1 : 0, input.deliveryCode ? hashDeliveryCode(input.deliveryCode) : null,
        input.notifyLocale ?? 'en', actor.userId, now, now);
      return writeTransition(db, loadJob(db, id)!, transition, {
        req, actor, at: now,
        auditSummary: `Delivery job created for ${tracking} (${scope.toLowerCase()})`,
        auditBefore: { status: null },
        auditAfter: {
          scope, price, currency, priceOverridden: overridden, ...(overridden ? { priceReason: input.priceReason } : {}),
          codAmount: input.codAmount ?? null, payer: input.payer ?? 'SENDER', deliveryCode: input.deliveryCode ? 'set' : 'none',
        },
      });
    });
    noStore(res);
    res.status(201).json({ success: true, data: jobOut(db, row, { view: 'dispatch' }) });
  } catch (err) {
    serverError(res, err);
  }
});

// PATCH /api/dispatch/jobs/:id (before pickup): places, size, weight, item, express, time, vehicle,
// payer, COD, fee collection, delivery code, language. The price follows the rate sheet unless it
// was set by hand.
dispatchRouter.patch('/jobs/:id', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    if (!BEFORE_PICKUP.includes(job.status)) return send(res, fail(409, 'JOB_LOCKED', 'A job can only be edited before pickup.'));
    const b = body(req);
    if (b.price !== undefined) return send(res, fail(400, 'INVALID_INPUT', 'Change the price with POST /price.'));
    const input = readJobInput(db, b, false);
    if (isFail(input)) return send(res, input);
    const pickup: Place = input.pickup ?? parsePlace(job.pickup_json);
    const dropoff: Place = input.dropoff ?? parsePlace(job.dropoff_json);
    const sizeClass = input.sizeClass !== undefined ? input.sizeClass : job.size_class;
    const weightKg = input.weightKg !== undefined ? input.weightKg : job.weight_kg;
    const isExpress = input.isExpress ?? job.is_express === 1;
    const shape = checkJobShape(job.scope, pickup, dropoff, sizeClass, weightKg);
    if (shape) return send(res, shape);

    const sets: Record<string, string | number | null> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const change = (col: string, field: string, oldValue: unknown, newValue: unknown, stored: string | number | null = newValue as never) => {
      if (newValue === undefined || JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
      sets[col] = stored;
      before[field] = oldValue;
      after[field] = newValue;
    };
    change('pickup_json', 'pickup', parsePlace(job.pickup_json), input.pickup, input.pickup ? JSON.stringify(input.pickup) : null);
    change('dropoff_json', 'dropoff', parsePlace(job.dropoff_json), input.dropoff, input.dropoff ? JSON.stringify(input.dropoff) : null);
    change('size_class', 'sizeClass', job.size_class, input.sizeClass);
    change('weight_kg', 'weightKg', job.weight_kg, input.weightKg);
    change('item_description', 'itemDescription', job.item_description, input.itemDescription);
    change('is_express', 'isExpress', job.is_express === 1, input.isExpress, input.isExpress ? 1 : 0);
    change('scheduled_for_ts', 'scheduledForTs', job.scheduled_for_ts, input.scheduledForTs);
    change('vehicle_required', 'vehicleRequired', job.vehicle_required, input.vehicleRequired);
    change('payer', 'payer', job.payer, input.payer);
    change('cod_amount', 'codAmount', job.cod_amount, input.codAmount);
    change('collect_delivery_fee', 'collectDeliveryFee', job.collect_delivery_fee === 1, input.collectDeliveryFee, input.collectDeliveryFee ? 1 : 0);
    change('notify_locale', 'notifyLocale', job.notify_locale, input.notifyLocale);
    if (input.deliveryCode !== undefined) {
      // A new code (or none) always resets the tries; the code itself is never logged.
      sets.delivery_code_hash = input.deliveryCode ? hashDeliveryCode(input.deliveryCode) : null;
      sets.delivery_code_attempts = 0;
      before.deliveryCode = job.delivery_code_hash ? 'set' : 'none';
      after.deliveryCode = input.deliveryCode ? 'changed' : 'none';
    }
    const priceAffecting = ['pickup', 'dropoff', 'sizeClass', 'weightKg', 'isExpress'].some((k) => k in after);
    if (priceAffecting && job.price_overridden !== 1) {
      const quote = priceJob(db, pickup, dropoff, sizeClass, weightKg, isExpress);
      if (!quote.ok) return send(res, PRICE_REQUIRED);
      change('price', 'price', job.price, quote.price);
      change('currency', 'currency', job.currency, quote.currency);
    }
    if (Object.keys(after).length === 0) return res.json({ success: true, data: jobOut(db, job, { view: 'dispatch' }) });

    inTransaction(db, () => {
      const cols = Object.keys(sets);
      db.prepare(`UPDATE dispatch_jobs SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at_ts = ? WHERE id = ?`)
        .run(...cols.map((c) => sets[c]), Date.now(), job.id);
      // Keep the shipment's parties and item in step for jobs that are the whole shipment.
      if (job.scope === 'LOCAL' || job.scope === 'INTERCITY') {
        const city = (id: string) => (db.prepare('SELECT name FROM delivery_cities WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? '';
        const party = (p: Place) => JSON.stringify({ name: p.contactName, phone: p.contactPhone, address: p.landmark, city: city(p.cityId) });
        db.prepare('UPDATE shipments SET sender_json = ?, recipient_json = ?, cargo_description = COALESCE(?, cargo_description) WHERE tracking_number = ?')
          .run(party(pickup), party(dropoff), input.itemDescription === undefined ? null : input.itemDescription ?? '', job.tracking_number);
      }
      audit(req, 'dispatch.update', 'dispatch_job', job.id, `Delivery job updated (${Object.keys(after).join(', ')}): ${job.tracking_number}`,
        before, after, { conn: db });
    });
    res.json({ success: true, data: jobOut(db, loadJob(db, job.id)!, { view: 'dispatch' }) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/dispatch/jobs/:id/price { price: number, reason } sets the price by hand;
// { price: null } goes back to the rate sheet.
dispatchRouter.post('/jobs/:id/price', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    if (isFinal(job.status)) return send(res, fail(409, 'JOB_LOCKED', 'This job is finished.'));
    const b = body(req);
    let price: number;
    let currency = job.currency;
    let overridden: boolean;
    let reason: string | null = null;
    if (b.price === null) {
      const quote = priceJob(db, parsePlace(job.pickup_json), parsePlace(job.dropoff_json), job.size_class, job.weight_kg, job.is_express === 1);
      if (!quote.ok) return send(res, PRICE_REQUIRED);
      price = quote.price;
      currency = quote.currency;
      overridden = false;
    } else {
      const input = readJobInput(db, { price: b.price, priceReason: b.reason }, false);
      if (isFail(input)) return send(res, input);
      if (input.price === undefined || input.price === null) return send(res, fail(400, 'INVALID_PRICE', 'Enter the price.'));
      price = input.price;
      reason = input.priceReason ?? null;
      overridden = true;
    }
    inTransaction(db, () => {
      db.prepare('UPDATE dispatch_jobs SET price = ?, currency = ?, price_overridden = ?, updated_at_ts = ? WHERE id = ?')
        .run(price, currency, overridden ? 1 : 0, Date.now(), job.id);
      audit(req, 'dispatch.price', 'dispatch_job', job.id,
        overridden ? `Price set by hand to ${price} ${currency}: ${job.tracking_number}` : `Price back to the rate sheet (${price} ${currency}): ${job.tracking_number}`,
        { price: job.price, currency: job.currency, priceOverridden: job.price_overridden === 1 },
        { price, currency, priceOverridden: overridden, ...(reason ? { reason } : {}) }, { conn: db });
    });
    res.json({ success: true, data: jobOut(db, loadJob(db, job.id)!, { view: 'dispatch' }) });
  } catch (err) {
    serverError(res, err);
  }
});

/** Runs one dispatch move through the state machine and writes it. */
function dispatchMove(
  req: Request, res: Response, job: JobRow, action: DispatchAction,
  extra: { courierUserId?: string; sets?: Record<string, string | number | null>; summary: string;
    before?: Record<string, unknown>; after?: Record<string, unknown>; trashShipment?: boolean },
) {
  const check = checkTransition({ status: job.status, courierUserId: job.courier_user_id }, action, 'dispatch', { courierUserId: extra.courierUserId });
  if (!check.ok) return send(res, transitionFail(check.code, job.status));
  const updated = applyTransition(db, job, check.transition, {
    req, actor: actorOf(req), at: Date.now(), sets: extra.sets, auditSummary: extra.summary,
    auditBefore: extra.before, auditAfter: extra.after, trashShipment: extra.trashShipment,
  });
  res.json({ success: true, data: jobOut(db, updated, { view: 'dispatch' }) });
}

// POST /api/dispatch/jobs/:id/confirm (a requested job, once priced)
dispatchRouter.post('/jobs/:id/confirm', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    if (job.status === 'REQUESTED' && job.price === null) return send(res, PRICE_REQUIRED);
    dispatchMove(req, res, job, 'confirm', { summary: `Delivery confirmed: ${job.tracking_number}` });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/dispatch/jobs/:id/assign { courierUserId }: assigns a confirmed (or failed) job, or
// reassigns one before pickup; the earlier courier stays in the audit log and tracking history.
dispatchRouter.post('/jobs/:id/assign', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    const courierUserId = typeof body(req).courierUserId === 'string' ? String(body(req).courierUserId) : '';
    const action: DispatchAction = job.status === 'ASSIGNED' || job.status === 'ACCEPTED' ? 'reassign' : 'assign';
    if (courierUserId) {
      const courier = db.prepare(`
        SELECT c.user_id, c.public_first_name, u.status FROM couriers c JOIN users u ON u.id = c.user_id WHERE c.user_id = ?
      `).get(courierUserId) as { user_id: string; public_first_name: string; status: string } | undefined;
      if (!courier || !hasPermission(loadUserPermissions(db, courierUserId), 'courier.app')) {
        return send(res, fail(400, 'UNKNOWN_COURIER', 'Choose a courier from the list.'));
      }
      if (courier.status !== 'ACTIVE') return send(res, fail(409, 'COURIER_DISABLED', 'This courier’s account is disabled.'));
      if (action === 'reassign' && courierUserId === job.courier_user_id) {
        return send(res, fail(409, 'SAME_COURIER', 'The job is already with this courier.'));
      }
    }
    if (job.price === null) return send(res, PRICE_REQUIRED);
    const name = courierUserId
      ? (db.prepare('SELECT display_name FROM users WHERE id = ?').get(courierUserId) as { display_name: string } | undefined)?.display_name
      : undefined;
    dispatchMove(req, res, job, action, {
      courierUserId,
      sets: { courier_user_id: courierUserId, ...(action === 'reassign' ? { accepted_at_ts: null } : {}) },
      summary: `${action === 'reassign' ? 'Reassigned' : 'Assigned'} to ${name ?? courierUserId}: ${job.tracking_number}`,
      before: { courierUserId: job.courier_user_id },
      after: { courierUserId },
    });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/dispatch/jobs/:id/cancel { reason, trashShipment? } (before pickup)
dispatchRouter.post('/jobs/:id/cancel', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    const b = body(req);
    const reason = reasonOf(b.reason);
    if (!reason) return send(res, fail(400, 'REASON_REQUIRED', 'Give a reason for cancelling.'));
    if (b.trashShipment !== undefined && typeof b.trashShipment !== 'boolean') {
      return send(res, fail(400, 'INVALID_INPUT', 'trashShipment must be true or false.'));
    }
    dispatchMove(req, res, job, 'cancel', {
      summary: `Delivery cancelled: ${job.tracking_number}`,
      after: { reason, trashShipment: b.trashShipment === true },
      trashShipment: b.trashShipment === true,
    });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/dispatch/jobs/:id/return { note? } (after a failed attempt)
dispatchRouter.post('/jobs/:id/return', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    const note = reasonOf(body(req).note);
    dispatchMove(req, res, job, 'return', { summary: `Returned to sender: ${job.tracking_number}`, after: note ? { note } : {} });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/dispatch/jobs/:id/delivery-code-override { reason }: after the tries run out (or the
// recipient lost the code), dispatch lifts the code so the courier can complete the delivery.
dispatchRouter.post('/jobs/:id/delivery-code-override', canManage, (req: Request, res: Response) => {
  try {
    const job = withJob(req, res);
    if (!job) return;
    if (isFinal(job.status)) return send(res, fail(409, 'JOB_LOCKED', 'This job is finished.'));
    if (!job.delivery_code_hash) return send(res, fail(409, 'NO_DELIVERY_CODE', 'This job has no delivery code.'));
    const reason = reasonOf(body(req).reason);
    if (!reason) return send(res, fail(400, 'REASON_REQUIRED', 'Give a reason for lifting the delivery code.'));
    inTransaction(db, () => {
      db.prepare('UPDATE dispatch_jobs SET delivery_code_hash = NULL, delivery_code_attempts = 0, updated_at_ts = ? WHERE id = ?').run(Date.now(), job.id);
      audit(req, 'dispatch.code_override', 'dispatch_job', job.id, `Delivery code lifted: ${job.tracking_number}`,
        { deliveryCode: 'set', wrongTries: job.delivery_code_attempts }, { deliveryCode: 'none', reason }, { conn: db });
    });
    res.json({ success: true, data: jobOut(db, loadJob(db, job.id)!, { view: 'dispatch' }) });
  } catch (err) {
    serverError(res, err);
  }
});
