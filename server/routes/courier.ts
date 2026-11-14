// Courier app API (docs/DISPATCH_SPEC.md §6, §11): a courier's own jobs, the steps they record,
// their position during a delivery, and the proof-of-delivery upload. Every route needs
// courier.app and only ever touches jobs assigned to the signed-in user.
//
// Actions carry a client-generated idempotency key: the phone queues actions offline and retries
// until the server answers, so a key already applied returns the stored answer instead of
// applying the step twice. The key is written in the same transaction as the step.
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth } from '../auth/permissions.js';
import { inTransaction } from '../auth/schema.js';
import { serverError } from '../errors.js';
import { readMultipart } from '../multipart.js';
import {
  DEFAULT_IMAGE_TYPES, IMAGE_CONTENT_TYPES, MAX_UPLOAD_BYTES, deleteUpload, detectImageType, resolveUploadPath, writeImageUpload,
} from '../uploads.js';
import {
  DELIVERY_CODE_TRIES, NOTE_MAX, actionTime, deliveryCodeMatches, fail, isFail, jobOut, loadJob, readCashEntries,
  readMoney, writeTransition, type Fail, type JobRow,
} from '../dispatch/jobs.js';
import { allocateCashRef } from '../dispatch/cashRef.js';
import { MAX_POINTS_PER_REQUEST, insertLocations, readLocationPoint, type LocationPoint } from '../dispatch/locations.js';
import { sendPodFile, transitionFail } from './dispatch.js';
import {
  FINAL_DISPATCH_STATUSES, LOCATION_SHARING_STATUSES, checkTransition, isDispatchAction, type DispatchAction,
} from '../../src/shared/dispatchStatus.js';

const send = (res: Response, f: Fail) =>
  res.status(f.status).json({ success: false, code: f.code, error: f.error, ...(f.details ? { details: f.details } : {}) });
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
const noStore = (res: Response) => res.set('Cache-Control', 'no-store');
const me = (req: Request) => getRequestAuth(req)!.user;

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;
const HISTORY_MS = 30 * 86_400_000;
const SIGNATURE_MAX_BYTES = 512 * 1024;
const NOT_FOUND = fail(404, 'NOT_FOUND', 'Job not found.');
const NOT_YOURS = fail(403, 'NOT_YOUR_JOB', 'This job is not assigned to you.');

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const v = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  return v ? v.slice(0, max) : null;
};

/** The job if it is assigned to the signed-in courier; otherwise answers and returns null. */
function ownJob(req: Request, res: Response, missing: Fail = NOT_FOUND): JobRow | null {
  const job = loadJob(db, String(req.params.id));
  if (!job || job.courier_user_id !== me(req).id) {
    send(res, job ? missing : NOT_FOUND);
    return null;
  }
  return job;
}

export const courierRouter = Router();
courierRouter.use(requirePermission('courier.app'));

// GET /api/courier/jobs: active jobs, then the last 30 days of finished ones.
courierRouter.get('/jobs', (req: Request, res: Response) => {
  try {
    const finals = FINAL_DISPATCH_STATUSES.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT * FROM dispatch_jobs
      WHERE courier_user_id = ? AND (status NOT IN (${finals}) OR updated_at_ts >= ?)
      ORDER BY CASE WHEN status IN (${finals}) THEN 1 ELSE 0 END, COALESCE(scheduled_for_ts, assigned_at_ts, created_at_ts), id
      LIMIT 300
    `).all(me(req).id, ...FINAL_DISPATCH_STATUSES, Date.now() - HISTORY_MS, ...FINAL_DISPATCH_STATUSES) as unknown as JobRow[];
    noStore(res);
    res.json({ success: true, data: rows.map((r) => jobOut(db, r, { view: 'courier' })) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/courier/jobs/:id
courierRouter.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const job = ownJob(req, res);
    if (!job) return;
    noStore(res);
    res.json({ success: true, data: jobOut(db, job, { view: 'courier' }) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/courier/jobs/:id/pod/photo | /signature (own jobs only)
courierRouter.get('/jobs/:id/pod/:kind', (req: Request, res: Response) => {
  const job = ownJob(req, res);
  if (!job) return;
  sendPodFile(res, job, String(req.params.kind));
});

// POST /api/courier/jobs/:id/action { action, idempotencyKey, deviceTs?, failureReason?, note?,
// recipientName?, deliveryCode?, cash?: [{ amount, method, momoReference?, note? }] }
// action: accept | decline | pick_up | start_delivery | deliver | fail
courierRouter.post('/jobs/:id/action', (req: Request, res: Response) => {
  try {
    const user = me(req);
    const b = body(req);
    const key = typeof b.idempotencyKey === 'string' ? b.idempotencyKey : '';
    if (!IDEMPOTENCY_KEY.test(key)) {
      return send(res, fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Each action needs an idempotency key (8 to 100 letters, digits, - or _).'));
    }
    const action = b.action;
    if (!isDispatchAction(action)) return send(res, fail(400, 'UNKNOWN_ACTION', 'Unknown action.'));
    const jobId = String(req.params.id);

    // Replay: the same key already applied this action to this job.
    const seen = db.prepare('SELECT job_id, action, response_json FROM dispatch_action_keys WHERE courier_user_id = ? AND idem_key = ?')
      .get(user.id, key) as { job_id: string; action: string; response_json: string } | undefined;
    if (seen) {
      if (seen.job_id !== jobId || seen.action !== action) {
        return send(res, fail(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for another action.'));
      }
      return res.json({ ...JSON.parse(seen.response_json), replayed: true });
    }

    const job = ownJob(req, res, NOT_YOURS);
    if (!job) return;

    const recipientName = text(b.recipientName, 80) ?? job.pod_recipient_name;
    const note = text(b.note, NOTE_MAX);
    const check = checkTransition({ status: job.status, courierUserId: job.courier_user_id }, action, 'courier', {
      actingUserId: user.id,
      podRecipientName: recipientName,
      podPhotoFile: job.pod_photo_file,
      failureReason: typeof b.failureReason === 'string' ? b.failureReason : null,
      note,
    });
    if (!check.ok) return send(res, transitionFail(check.code, job.status));

    const takesCash: readonly DispatchAction[] = ['pick_up', 'deliver'];
    if (b.cash !== undefined && b.cash !== null && !takesCash.includes(action)) {
      return send(res, fail(400, 'INVALID_CASH', 'Money is recorded at pickup or delivery.'));
    }
    const cash = readCashEntries(b.cash, job.currency);
    if (isFail(cash)) return send(res, cash);

    // Delivery code (DISPATCH_SPEC §4): checked against the hash; every wrong entry counts, even
    // though the step is refused, and after 5 only a dispatch override unlocks the job.
    if (action === 'deliver' && job.delivery_code_hash) {
      if (job.delivery_code_attempts >= DELIVERY_CODE_TRIES) {
        return send(res, fail(423, 'DELIVERY_CODE_LOCKED', 'Too many wrong codes. Call the office to unlock this delivery.', { triesLeft: 0 }));
      }
      const code = typeof b.deliveryCode === 'string' ? b.deliveryCode.trim() : '';
      if (!code || !deliveryCodeMatches(code, job.delivery_code_hash)) {
        db.prepare('UPDATE dispatch_jobs SET delivery_code_attempts = delivery_code_attempts + 1, updated_at_ts = ? WHERE id = ?').run(Date.now(), job.id);
        const left = Math.max(0, DELIVERY_CODE_TRIES - job.delivery_code_attempts - 1);
        audit(req, 'dispatch.code_wrong', 'dispatch_job', job.id, `Wrong delivery code entered (${left} tries left): ${job.tracking_number}`);
        return send(res, left === 0
          ? fail(423, 'DELIVERY_CODE_LOCKED', 'Too many wrong codes. Call the office to unlock this delivery.', { triesLeft: 0 })
          : fail(400, 'DELIVERY_CODE_WRONG', 'The delivery code is not right.', { triesLeft: left }));
      }
    }

    const sets: Record<string, string | number | null> = {};
    const after: Record<string, unknown> = {};
    if (action === 'decline') sets.courier_user_id = null;
    if (action === 'deliver') {
      sets.pod_recipient_name = recipientName;
      if (note) sets.pod_note = note;
      after.recipientName = recipientName;
    }
    if (action === 'fail') {
      sets.failure_reason = String(b.failureReason);
      sets.failure_note = note;
      sets.attempts = job.attempts + 1;
      after.failureReason = b.failureReason;
      if (note) after.note = note;
    }
    const at = actionTime(b.deviceTs, job);
    if (typeof b.deviceTs === 'number') after.deviceTs = b.deviceTs;
    const label: Record<string, string> = {
      accept: 'Job accepted', decline: 'Job declined', pick_up: 'Picked up', start_delivery: 'On the way',
      deliver: 'Delivered', fail: 'Delivery attempt unsuccessful',
    };

    const response = inTransaction(db, () => {
      const updated = writeTransition(db, job, check.transition, {
        req, actor: { userId: user.id, name: user.displayName }, at, sets, cash,
        auditSummary: `${label[action] ?? action} (courier): ${job.tracking_number}`,
        auditAfter: { ...after, idempotencyKey: key },
      });
      const out = { success: true, data: jobOut(db, updated, { view: 'courier' }) };
      db.prepare(`
        INSERT INTO dispatch_action_keys (courier_user_id, idem_key, job_id, action, response_json, created_at_ts)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, key, job.id, action, JSON.stringify(out), Date.now());
      return out;
    });
    res.json(response);
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/courier/location { jobId?, points: [{ lat, lng, accuracyM?, speedMps?, heading?, recordedAtTs? }] }
// (or one point's fields at the top level). Only accepted while the courier has a job picked up
// or on the way: location is never collected outside active jobs.
courierRouter.post('/location', (req: Request, res: Response) => {
  try {
    const user = me(req);
    const b = body(req);
    const raw = Array.isArray(b.points) ? b.points : [b];
    if (raw.length === 0 || raw.length > MAX_POINTS_PER_REQUEST) {
      return send(res, fail(400, 'INVALID_LOCATION', `Send 1 to ${MAX_POINTS_PER_REQUEST} positions.`));
    }
    const points: LocationPoint[] = [];
    for (const r of raw) {
      const p = readLocationPoint(r);
      if (!p) return send(res, fail(400, 'INVALID_LOCATION', 'A position needs a valid latitude and longitude.'));
      points.push(p);
    }
    const statuses = LOCATION_SHARING_STATUSES.map(() => '?').join(',');
    const jobId = typeof b.jobId === 'string' && b.jobId ? b.jobId : null;
    const job = db.prepare(`
      SELECT id FROM dispatch_jobs WHERE courier_user_id = ? AND status IN (${statuses}) ${jobId ? 'AND id = ?' : ''}
      ORDER BY updated_at_ts DESC LIMIT 1
    `).get(user.id, ...LOCATION_SHARING_STATUSES, ...(jobId ? [jobId] : [])) as { id: string } | undefined;
    if (!job) return send(res, fail(409, 'NO_ACTIVE_JOB', 'Your position is only shared while you are delivering.'));
    inTransaction(db, () => insertLocations(db, user.id, job.id, points));
    res.json({ success: true, data: { accepted: points.length, jobId: job.id } });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/courier/pod/:id (multipart/form-data): photo (JPG/PNG/WebP), signature? (PNG),
// recipientName?, note?. Stored privately under UPLOADS_DIR/pod; a new upload replaces the old
// files. Allowed while the parcel is with the courier (picked up or on the way).
courierRouter.post('/pod/:id', async (req: Request, res: Response) => {
  try {
    const job = ownJob(req, res, NOT_YOURS);
    if (!job) {
      req.resume();
      return;
    }
    if (job.status !== 'PICKED_UP' && job.status !== 'ON_THE_WAY') {
      req.resume();
      return send(res, fail(409, 'INVALID_TRANSITION', 'Proof of delivery is added during the delivery.'));
    }
    const parsed = await readMultipart(req, { maxBytes: MAX_UPLOAD_BYTES + SIGNATURE_MAX_BYTES + 64 * 1024, maxParts: 6 });
    if (!parsed.ok) return send(res, fail(parsed.status, parsed.code, parsed.error));
    const { fields, files } = parsed.body;
    const photo = files.photo;
    const signature = files.signature;
    if (!photo && !signature) return send(res, fail(400, 'POD_REQUIRED', 'Add a photo of the delivered parcel.'));
    const photoType = photo ? detectImageType(photo.data) : null;
    if (photo && (photo.data.length > MAX_UPLOAD_BYTES || !photoType || !DEFAULT_IMAGE_TYPES.includes(photoType))) {
      return send(res, fail(400, 'INVALID_PHOTO', photo.data.length > MAX_UPLOAD_BYTES ? 'The photo is too large.' : 'Only JPG, PNG or WebP photos are accepted.'));
    }
    if (signature && (signature.data.length > SIGNATURE_MAX_BYTES || detectImageType(signature.data) !== 'png')) {
      return send(res, fail(400, 'INVALID_SIGNATURE', 'The signature must be a PNG image under 512 KB.'));
    }

    // Re-read: the job may have moved while the upload was streaming.
    const current = loadJob(db, job.id)!;
    if (current.courier_user_id !== me(req).id || (current.status !== 'PICKED_UP' && current.status !== 'ON_THE_WAY')) {
      return send(res, fail(409, 'INVALID_TRANSITION', 'Proof of delivery is added during the delivery.'));
    }
    const savedPhoto = photo ? writeImageUpload('pod', photo.data, photoType!) : null;
    const savedSig = signature ? writeImageUpload('pod', signature.data, 'png') : null;
    const recipientName = text(fields.recipientName, 80);
    const note = text(fields.note, NOTE_MAX);
    try {
      inTransaction(db, () => {
        db.prepare(`
          UPDATE dispatch_jobs SET pod_photo_file = COALESCE(?, pod_photo_file), pod_signature_file = COALESCE(?, pod_signature_file),
            pod_recipient_name = COALESCE(?, pod_recipient_name), pod_note = COALESCE(?, pod_note), updated_at_ts = ?
          WHERE id = ?
        `).run(savedPhoto?.fileName ?? null, savedSig?.fileName ?? null, recipientName, note, Date.now(), job.id);
        audit(req, 'dispatch.pod_upload', 'dispatch_job', job.id, `Proof of delivery added: ${job.tracking_number}`, undefined, {
          photo: savedPhoto ? (current.pod_photo_file ? 'replaced' : 'added') : 'unchanged',
          signature: savedSig ? (current.pod_signature_file ? 'replaced' : 'added') : 'unchanged',
          ...(recipientName ? { recipientName } : {}),
        }, { conn: db });
      });
    } catch (err) {
      if (savedPhoto) deleteUpload('pod', savedPhoto.fileName);
      if (savedSig) deleteUpload('pod', savedSig.fileName);
      throw err;
    }
    if (savedPhoto && current.pod_photo_file) deleteUpload('pod', current.pod_photo_file);
    if (savedSig && current.pod_signature_file) deleteUpload('pod', current.pod_signature_file);
    res.json({ success: true, data: jobOut(db, loadJob(db, job.id)!, { view: 'courier' }) });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Profile, duty and cash (courier app Today, Cash and Profile screens; DISPATCH_SPEC §6, §9) ----

interface OwnProfileRow {
  user_id: string; vehicle_type: string; plate_number: string | null; public_first_name: string;
  show_photo_publicly: number; photo_file: string | null; is_on_duty: number; city_name: string | null;
}

function ownProfile(req: Request): OwnProfileRow | undefined {
  return db.prepare(`
    SELECT c.user_id, c.vehicle_type, c.plate_number, c.public_first_name, c.show_photo_publicly, c.photo_file,
           c.is_on_duty, dc.name AS city_name
    FROM couriers c LEFT JOIN delivery_cities dc ON dc.id = c.home_city_id WHERE c.user_id = ?
  `).get(me(req).id) as OwnProfileRow | undefined;
}

const NO_PROFILE = fail(404, 'NO_COURIER_PROFILE', 'This account has no courier profile yet. Ask the office to finish it.');

function profileOut(row: OwnProfileRow) {
  return {
    vehicleType: row.vehicle_type,
    plateNumber: row.plate_number,
    publicFirstName: row.public_first_name,
    homeCityName: row.city_name,
    isOnDuty: row.is_on_duty === 1,
    showPhotoPublicly: row.show_photo_publicly === 1,
    photoUrl: row.photo_file ? `/api/courier/me/photo?v=${encodeURIComponent(row.photo_file.split('.')[0])}` : null,
  };
}

// GET /api/courier/me: own profile (vehicle, public first name, duty, photo consent).
courierRouter.get('/me', (req: Request, res: Response) => {
  try {
    const row = ownProfile(req);
    if (!row) return send(res, NO_PROFILE);
    noStore(res);
    res.json({ success: true, data: profileOut(row) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/courier/me/photo: own photo (the one customers may see with consent).
courierRouter.get('/me/photo', (req: Request, res: Response) => {
  const row = ownProfile(req);
  const filePath = row?.photo_file ? resolveUploadPath('couriers', row.photo_file) : null;
  if (!row?.photo_file || !filePath) return send(res, fail(404, 'NOT_FOUND', 'No photo.'));
  res.setHeader('Content-Type', IMAGE_CONTENT_TYPES[path.extname(row.photo_file).slice(1)]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(filePath, { cacheControl: false }, (err) => {
    if (err && !res.headersSent) send(res, fail(404, 'NOT_FOUND', 'No photo.'));
  });
});

// PATCH /api/courier/me { isOnDuty?: boolean, showPhotoPublicly?: false }
// The courier starts and ends their shift, and may withdraw photo consent. Staff record the
// agreement (tracker #161); the courier can only take it back here.
courierRouter.patch('/me', (req: Request, res: Response) => {
  try {
    const row = ownProfile(req);
    if (!row) return send(res, NO_PROFILE);
    const b = body(req);
    if (b.isOnDuty !== undefined && typeof b.isOnDuty !== 'boolean') {
      return send(res, fail(400, 'INVALID_REQUEST', 'isOnDuty must be true or false.'));
    }
    if (b.showPhotoPublicly !== undefined && b.showPhotoPublicly !== false) {
      return send(res, fail(403, 'CONSENT_BY_STAFF', 'Ask the office to record your agreement to show your photo.'));
    }
    const duty = typeof b.isOnDuty === 'boolean' && (row.is_on_duty === 1) !== b.isOnDuty ? b.isOnDuty : null;
    const withdraw = b.showPhotoPublicly === false && row.show_photo_publicly === 1;
    if (duty !== null || withdraw) {
      const now = Date.now();
      const name = me(req).displayName;
      inTransaction(db, () => {
        if (duty !== null) {
          db.prepare('UPDATE couriers SET is_on_duty = ?, updated_at_ts = ? WHERE user_id = ?').run(duty ? 1 : 0, now, row.user_id);
          audit(req, 'courier.duty', 'user', row.user_id, `${duty ? 'On duty' : 'Off duty'} (courier app): ${name}`,
            { isOnDuty: !duty }, { isOnDuty: duty }, { conn: db });
        }
        if (withdraw) {
          db.prepare('UPDATE couriers SET show_photo_publicly = 0, updated_at_ts = ? WHERE user_id = ?').run(now, row.user_id);
          audit(req, 'courier.consent_withdrawn', 'user', row.user_id, `Photo consent withdrawn (courier app): ${name}`,
            { showPhotoPublicly: true }, { showPhotoPublicly: false }, { conn: db });
        }
      });
    }
    res.json({ success: true, data: profileOut(ownProfile(req)!) });
  } catch (err) {
    serverError(res, err);
  }
});

interface CashRow {
  id: string; ref: string; job_id: string | null; entry_type: string; method: string; amount: number; currency: string;
  momo_reference: string | null; status: string; note: string | null; created_at_ts: number; confirmed_at_ts: number | null;
  tracking_number: string | null;
}

/**
 * A courier's money by currency (DISPATCH_SPEC §9): balance = collected (pending + confirmed)
 * + confirmed adjustments − confirmed handovers. Handovers waiting for Finance are shown apart.
 */
export function courierCashSummary(courierUserId: string) {
  const sums = db.prepare(`
    SELECT currency,
      COALESCE(SUM(CASE WHEN entry_type = 'COLLECTED' AND status != 'REJECTED' THEN amount END), 0) AS collected,
      COALESCE(SUM(CASE WHEN entry_type = 'HANDOVER' AND status = 'CONFIRMED' THEN amount END), 0) AS handed_over,
      COALESCE(SUM(CASE WHEN entry_type = 'HANDOVER' AND status = 'PENDING' THEN amount END), 0) AS pending_handover,
      COALESCE(SUM(CASE WHEN entry_type = 'ADJUSTMENT' AND status = 'CONFIRMED' THEN amount END), 0) AS adjustments
    FROM cash_ledger WHERE courier_user_id = ? GROUP BY currency ORDER BY currency
  `).all(courierUserId) as { currency: string; collected: number; handed_over: number; pending_handover: number; adjustments: number }[];
  return sums.map((s) => ({
    currency: s.currency,
    collected: s.collected,
    handedOver: s.handed_over,
    pendingHandover: s.pending_handover,
    balance: s.collected + s.adjustments - s.handed_over,
  }));
}

const cashOut = (r: CashRow) => ({
  id: r.id, ref: r.ref, jobId: r.job_id, trackingNumber: r.tracking_number, type: r.entry_type, method: r.method,
  amount: r.amount, currency: r.currency, momoReference: r.momo_reference, status: r.status, note: r.note,
  createdAt: r.created_at_ts, confirmedAt: r.confirmed_at_ts,
});

// GET /api/courier/cash: own balance by currency, entries of the last 30 days and anything pending.
courierRouter.get('/cash', (req: Request, res: Response) => {
  try {
    const id = me(req).id;
    const rows = db.prepare(`
      SELECT l.*, j.tracking_number FROM cash_ledger l LEFT JOIN dispatch_jobs j ON j.id = l.job_id
      WHERE l.courier_user_id = ? AND (l.created_at_ts >= ? OR l.status = 'PENDING')
      ORDER BY l.created_at_ts DESC LIMIT 300
    `).all(id, Date.now() - HISTORY_MS) as unknown as CashRow[];
    noStore(res);
    res.json({ success: true, data: { balances: courierCashSummary(id), entries: rows.map(cashOut) } });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/courier/cash/handover { amount, currency?, note?, idempotencyKey, deviceTs? }
// The courier declares cash handed to the office; it stays PENDING until Finance confirms it
// (cash.confirm, G.8). Queued offline like job actions: a repeated key returns the stored answer.
// Keys share dispatch_action_keys with job actions (job_id '-', action 'cash_handover').
courierRouter.post('/cash/handover', (req: Request, res: Response) => {
  try {
    const user = me(req);
    const b = body(req);
    const key = typeof b.idempotencyKey === 'string' ? b.idempotencyKey : '';
    if (!IDEMPOTENCY_KEY.test(key)) {
      return send(res, fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Each action needs an idempotency key (8 to 100 letters, digits, - or _).'));
    }
    const seen = db.prepare('SELECT action, response_json FROM dispatch_action_keys WHERE courier_user_id = ? AND idem_key = ?')
      .get(user.id, key) as { action: string; response_json: string } | undefined;
    if (seen) {
      if (seen.action !== 'cash_handover') {
        return send(res, fail(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for another action.'));
      }
      return res.json({ ...JSON.parse(seen.response_json), replayed: true });
    }
    const currency = typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency) ? b.currency : 'XAF';
    const amount = readMoney(b.amount, currency, 'INVALID_CASH', 'The amount handed over');
    if (isFail(amount)) return send(res, amount);
    if (amount <= 0) return send(res, fail(400, 'INVALID_CASH', 'The amount handed over must be more than 0.'));
    const note = text(b.note, NOTE_MAX);
    const now = Date.now();
    const device = typeof b.deviceTs === 'number' && Number.isFinite(b.deviceTs) ? Math.round(b.deviceTs) : NaN;
    const at = device <= now && device > now - 7 * 86_400_000 ? device : now;
    const response = inTransaction(db, () => {
      const ref = allocateCashRef(db);
      const id = 'csh_' + crypto.randomBytes(9).toString('hex');
      db.prepare(`
        INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, momo_reference,
                                 status, recorded_by, note, created_at_ts)
        VALUES (?, ?, ?, NULL, 'HANDOVER', 'CASH', ?, ?, NULL, 'PENDING', ?, ?, ?)
      `).run(id, ref, user.id, amount, currency, user.id, note, at);
      audit(req, 'cash.handover', 'cash_ledger', id, `Cash handover declared (${amount} ${currency}): ${user.displayName}`,
        undefined, { ref, amount, currency, idempotencyKey: key, ...(note ? { note } : {}) }, { conn: db });
      const row = db.prepare('SELECT l.*, NULL AS tracking_number FROM cash_ledger l WHERE l.id = ?').get(id) as unknown as CashRow;
      const out = { success: true, data: cashOut(row) };
      db.prepare(`
        INSERT INTO dispatch_action_keys (courier_user_id, idem_key, job_id, action, response_json, created_at_ts)
        VALUES (?, ?, '-', 'cash_handover', ?, ?)
      `).run(user.id, key, JSON.stringify(out), now);
      return out;
    });
    res.json(response);
  } catch (err) {
    serverError(res, err);
  }
});
