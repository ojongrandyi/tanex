// Couriers (docs/DISPATCH_SPEC.md §2–§3, §11): a courier is a user with the Courier role plus a
// courier profile. POST creates both in one step and returns a temporary password once (shown with
// a WhatsApp link in the console, like Users). Reading needs couriers.view or couriers.manage;
// every change needs couriers.manage and is audited.
//
// Granting the Courier role: holders of couriers.manage may give exactly one kind of role here, a
// role whose only permission is courier.app (the seeded Courier role, even if renamed). They may
// change, reset or disable only accounts with a courier profile that hold nothing beyond their own
// permissions plus courier.app, so this screen can't be used to take over a staff account
// (IAM_RBAC_SPEC §5.3; Decisions log 2026-11-14).
import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth } from '../auth/permissions.js';
import { hashPassword } from '../auth/passwords.js';
import { newUserId } from '../auth/bootstrap.js';
import { inTransaction } from '../auth/schema.js';
import { canManageUser, generateTempPassword, userPermissions } from '../auth/rules.js';
import { serverError } from '../errors.js';
import { IMAGE_CONTENT_TYPES, deleteUpload, resolveUploadPath, writeImageUpload } from '../uploads.js';
import { checkAvatar } from '../blog/authorProfile.js';
import { identifierConflict, isFail, readUserInput, userById } from './users.js';
import { VEHICLE_TYPES, type VehicleType } from '../../src/shared/dispatchStatus.js';

export const PUBLIC_FIRST_NAME_MAX = 30;
export const PLATE_MAX = 20;
export const NOTES_MAX = 500;
const COURIER_PERMISSION = 'courier.app';

interface CourierRow {
  user_id: string;
  vehicle_type: string;
  plate_number: string | null;
  home_city_id: string | null;
  public_first_name: string;
  show_photo_publicly: number;
  photo_file: string | null;
  notes: string | null;
  is_on_duty: number;
  created_at_ts: number;
  updated_at_ts: number;
}

type Fail = { status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Fail => ({ status, code, error });
const send = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error });
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

const loadProfile = (userId: string) => db.prepare('SELECT * FROM couriers WHERE user_id = ?').get(userId) as CourierRow | undefined;

/** The role to give new couriers: one whose only permission is courier.app (seeded Courier first). */
export function courierRoleId(): string | null {
  const rows = db.prepare(`
    SELECT r.id AS id, GROUP_CONCAT(rp.permission_key) AS keys FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id GROUP BY r.id
  `).all() as unknown as { id: string; keys: string }[];
  const only = rows.filter((r) => r.keys === COURIER_PERMISSION).map((r) => r.id);
  return only.includes('role_courier') ? 'role_courier' : only.sort()[0] ?? null;
}

function photoUrl(row: CourierRow): string | null {
  if (!row.photo_file) return null;
  // The file name changes with every new photo, so the query string also busts the cache.
  return `/api/couriers/${encodeURIComponent(row.user_id)}/photo?v=${encodeURIComponent(row.photo_file.split('.')[0])}`;
}

function courierOut(row: CourierRow) {
  const user = userById(row.user_id);
  const city = row.home_city_id
    ? db.prepare('SELECT name FROM delivery_cities WHERE id = ?').get(row.home_city_id) as { name: string } | undefined
    : undefined;
  return {
    userId: row.user_id,
    user,
    vehicleType: row.vehicle_type,
    plateNumber: row.plate_number,
    homeCityId: row.home_city_id,
    homeCityName: city?.name ?? null,
    publicFirstName: row.public_first_name,
    showPhotoPublicly: row.show_photo_publicly === 1,
    photoUrl: photoUrl(row),
    notes: row.notes,
    isOnDuty: row.is_on_duty === 1,
    createdAt: row.created_at_ts,
    updatedAt: row.updated_at_ts,
  };
}

interface ProfileInput {
  vehicleType?: VehicleType;
  plateNumber?: string | null;
  homeCityId?: string | null;
  publicFirstName?: string;
  showPhotoPublicly?: boolean;
  notes?: string | null;
}

const oneLine = (v: string) => v.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Validates the profile fields present in the body. `creating` makes vehicle and public name required. */
function readProfileInput(b: Record<string, unknown>, creating: boolean): ProfileInput | Fail {
  const out: ProfileInput = {};
  if (b.vehicleType !== undefined || creating) {
    if (typeof b.vehicleType !== 'string' || !(VEHICLE_TYPES as readonly string[]).includes(b.vehicleType)) {
      return fail(400, 'INVALID_VEHICLE', 'Choose a vehicle: bike, van or truck.');
    }
    out.vehicleType = b.vehicleType as VehicleType;
  }
  if (b.plateNumber !== undefined) {
    if (b.plateNumber !== null && typeof b.plateNumber !== 'string') return fail(400, 'INVALID_PLATE', 'Enter the plate number as text.');
    const plate = typeof b.plateNumber === 'string' ? oneLine(b.plateNumber).toUpperCase() : '';
    if (plate.length > PLATE_MAX) return fail(400, 'INVALID_PLATE', `The plate number can be up to ${PLATE_MAX} characters.`);
    out.plateNumber = plate || null;
  }
  if (b.homeCityId !== undefined) {
    const id = typeof b.homeCityId === 'string' ? b.homeCityId : '';
    if (b.homeCityId === null || id === '') out.homeCityId = null;
    else if (!db.prepare('SELECT 1 FROM delivery_cities WHERE id = ?').get(id)) return fail(400, 'UNKNOWN_CITY', 'Choose the home city from the list.');
    else out.homeCityId = id;
  }
  if (b.publicFirstName !== undefined || creating) {
    const name = typeof b.publicFirstName === 'string' ? oneLine(b.publicFirstName) : '';
    if (!name || name.length > PUBLIC_FIRST_NAME_MAX) {
      return fail(400, 'INVALID_PUBLIC_NAME', `Enter the name customers see, 1 to ${PUBLIC_FIRST_NAME_MAX} characters.`);
    }
    out.publicFirstName = name;
  }
  if (b.showPhotoPublicly !== undefined) {
    if (typeof b.showPhotoPublicly !== 'boolean') return fail(400, 'INVALID_INPUT', 'showPhotoPublicly must be true or false.');
    out.showPhotoPublicly = b.showPhotoPublicly;
  }
  if (b.notes !== undefined) {
    if (b.notes !== null && typeof b.notes !== 'string') return fail(400, 'INVALID_NOTES', 'Notes must be text.');
    const notes = typeof b.notes === 'string' ? b.notes.normalize('NFC').replace(/\r\n?/g, '\n').trim() : '';
    if (notes.length > NOTES_MAX) return fail(400, 'INVALID_NOTES', `Notes can be up to ${NOTES_MAX} characters.`);
    out.notes = notes || null;
  }
  return out;
}

/** The actor's permissions plus courier.app: what they may hand out or manage on this screen. */
function courierScope(req: Request): string[] {
  return [...getRequestAuth(req)!.permissions, COURIER_PERMISSION];
}

/** 404 unless the id is a courier; 403 when the account holds permissions beyond the actor's scope. */
function loadManageableCourier(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  const profile = loadProfile(id);
  if (!profile) return send(res, fail(404, 'NOT_FOUND', 'Courier not found.'));
  if (!canManageUser(courierScope(req), userPermissions(db, id))) {
    return send(res, fail(403, 'CANNOT_MANAGE_USER', 'You cannot change an account that has permissions you do not hold.'));
  }
  res.locals.profile = profile;
  next();
}

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

export const couriersRouter = Router();

// GET /api/couriers
couriersRouter.get('/', requirePermission('couriers.view', 'couriers.manage'), (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT c.* FROM couriers c JOIN users u ON u.id = c.user_id ORDER BY u.display_name COLLATE NOCASE, c.user_id
    `).all() as unknown as CourierRow[];
    noStore(res);
    res.json({ success: true, data: rows.map(courierOut) });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/couriers/:id/photo (console only; customers see it only with consent, from G.7)
couriersRouter.get('/:id/photo', requirePermission('couriers.view', 'couriers.manage'), (req: Request, res: Response) => {
  const profile = loadProfile(String(req.params.id));
  const filePath = profile?.photo_file ? resolveUploadPath('couriers', profile.photo_file) : null;
  if (!profile?.photo_file || !filePath) return send(res, fail(404, 'NOT_FOUND', 'No photo.'));
  res.setHeader('Content-Type', IMAGE_CONTENT_TYPES[path.extname(profile.photo_file).slice(1)]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(filePath, { cacheControl: false }, (err) => {
    if (err && !res.headersSent) send(res, fail(404, 'NOT_FOUND', 'No photo.'));
  });
});

// POST /api/couriers { displayName, phone, email?, locale?, vehicleType, plateNumber?, homeCityId?,
// publicFirstName, showPhotoPublicly?, notes?, photo? } → { courier, user, tempPassword }
couriersRouter.post('/', requirePermission('couriers.manage'), async (req: Request, res: Response) => {
  try {
    const actor = getRequestAuth(req)!;
    const b = body(req);
    const userInput = readUserInput({ displayName: b.displayName, email: b.email ?? null, phone: b.phone ?? null, locale: b.locale ?? 'en' }, true);
    if (isFail(userInput)) return send(res, userInput);
    if (!userInput.phone) return send(res, fail(400, 'PHONE_REQUIRED', 'Enter the courier’s phone number.'));
    const profile = readProfileInput(b, true);
    if (isFail(profile)) return send(res, profile);
    const conflict = identifierConflict(userInput.email ?? null, userInput.phone, null);
    if (conflict) return send(res, conflict);
    const roleId = courierRoleId();
    if (!roleId) {
      return send(res, fail(409, 'COURIER_ROLE_MISSING', 'No role gives only the courier app. Ask a Super Admin to restore the Courier role.'));
    }
    let photo: ReturnType<typeof checkAvatar> | null = null;
    if (b.photo !== undefined && b.photo !== null && b.photo !== '') {
      photo = checkAvatar(b.photo);
      if (!photo.ok) return send(res, fail(400, 'INVALID_PHOTO', photo.error));
    }

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    const id = newUserId();
    const now = Date.now();
    const saved = photo?.ok ? writeImageUpload('couriers', photo.buffer, photo.type) : null;
    try {
      inTransaction(db, () => {
        db.prepare(`
          INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password,
                             locale, failed_logins, created_at_ts, updated_at_ts, created_by)
          VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?, 0, ?, ?, ?)
        `).run(id, userInput.email ?? null, userInput.phone!, userInput.displayName!, hash, userInput.locale ?? 'en', now, now, actor.user.id);
        db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, roleId);
        db.prepare(`
          INSERT INTO couriers (user_id, vehicle_type, plate_number, home_city_id, public_first_name, show_photo_publicly,
                                photo_file, notes, is_on_duty, created_at_ts, updated_at_ts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(id, profile.vehicleType!, profile.plateNumber ?? null, profile.homeCityId ?? null, profile.publicFirstName!,
          profile.showPhotoPublicly ? 1 : 0, saved?.fileName ?? null, profile.notes ?? null, now, now);
      });
    } catch (err) {
      if (saved) deleteUpload('couriers', saved.fileName);
      throw err;
    }

    const roleName = (db.prepare('SELECT name FROM roles WHERE id = ?').get(roleId) as { name: string }).name;
    audit(req, 'courier.create', 'user', id, `Courier account created for ${userInput.displayName}`, undefined, {
      displayName: userInput.displayName, email: userInput.email ?? null, phone: userInput.phone, locale: userInput.locale ?? 'en',
      roles: [roleName], vehicleType: profile.vehicleType, plateNumber: profile.plateNumber ?? null,
      homeCityId: profile.homeCityId ?? null, publicFirstName: profile.publicFirstName,
      showPhotoPublicly: !!profile.showPhotoPublicly, photo: saved ? 'added' : 'none',
    });
    noStore(res);
    res.status(201).json({ success: true, data: { courier: courierOut(loadProfile(id)!), user: userById(id), tempPassword } });
  } catch (err) {
    serverError(res, err);
  }
});

// PATCH /api/couriers/:id { displayName?, phone?, email?, locale?, status?, vehicleType?,
// plateNumber?, homeCityId?, publicFirstName?, showPhotoPublicly?, notes? }
couriersRouter.patch('/:id', requirePermission('couriers.manage'), loadManageableCourier, (req: Request, res: Response) => {
  try {
    const actor = getRequestAuth(req)!;
    const row = res.locals.profile as CourierRow;
    const b = body(req);
    const userFields: Record<string, unknown> = {};
    for (const k of ['displayName', 'email', 'phone', 'locale', 'status']) if (b[k] !== undefined) userFields[k] = b[k];
    const userInput = readUserInput(userFields, false);
    if (isFail(userInput)) return send(res, userInput);
    const profile = readProfileInput(b, false);
    if (isFail(profile)) return send(res, profile);

    const user = db.prepare('SELECT display_name, email, phone, locale, status FROM users WHERE id = ?').get(row.user_id) as
      { display_name: string; email: string | null; phone: string | null; locale: string; status: string };
    if (userInput.phone === null) return send(res, fail(400, 'PHONE_REQUIRED', 'Enter the courier’s phone number.'));
    const conflict = identifierConflict(userInput.email ?? null, userInput.phone ?? null, row.user_id);
    if (conflict) return send(res, conflict);
    if (userInput.status === 'DISABLED' && row.user_id === actor.user.id) {
      return send(res, fail(409, 'SELF_DISABLE', 'You cannot disable your own account.'));
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const userSets: Record<string, string | null> = {};
    const profileSets: Record<string, string | number | null> = {};
    const note = (field: string, oldValue: unknown, newValue: unknown) => {
      if (newValue === undefined || newValue === oldValue) return false;
      before[field] = oldValue;
      after[field] = newValue;
      return true;
    };
    if (note('displayName', user.display_name, userInput.displayName)) userSets.display_name = userInput.displayName!;
    if (note('email', user.email, userInput.email)) userSets.email = userInput.email ?? null;
    if (note('phone', user.phone, userInput.phone)) userSets.phone = userInput.phone ?? null;
    if (note('locale', user.locale, userInput.locale)) userSets.locale = userInput.locale!;
    if (note('status', user.status, userInput.status)) userSets.status = userInput.status!;
    if (note('vehicleType', row.vehicle_type, profile.vehicleType)) profileSets.vehicle_type = profile.vehicleType!;
    if (note('plateNumber', row.plate_number, profile.plateNumber)) profileSets.plate_number = profile.plateNumber ?? null;
    if (note('homeCityId', row.home_city_id, profile.homeCityId)) profileSets.home_city_id = profile.homeCityId ?? null;
    if (note('publicFirstName', row.public_first_name, profile.publicFirstName)) profileSets.public_first_name = profile.publicFirstName!;
    if (note('showPhotoPublicly', row.show_photo_publicly === 1, profile.showPhotoPublicly)) profileSets.show_photo_publicly = profile.showPhotoPublicly ? 1 : 0;
    if (note('notes', row.notes, profile.notes)) profileSets.notes = profile.notes ?? null;

    const fields = Object.keys(after);
    if (fields.length > 0) {
      const now = Date.now();
      const disabling = userSets.status === 'DISABLED';
      inTransaction(db, () => {
        const uc = Object.keys(userSets);
        if (uc.length) {
          db.prepare(`UPDATE users SET ${uc.map((c) => `${c} = ?`).join(', ')}, updated_at_ts = ? WHERE id = ?`)
            .run(...uc.map((c) => userSets[c]), now, row.user_id);
        }
        if (userSets.status === 'ACTIVE') db.prepare('UPDATE users SET failed_logins = 0, locked_until_ts = NULL WHERE id = ?').run(row.user_id);
        // Disabling signs the courier out everywhere and takes them off duty.
        if (disabling) {
          db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
          profileSets.is_on_duty = 0;
        }
        const pc = Object.keys(profileSets);
        if (pc.length) {
          db.prepare(`UPDATE couriers SET ${pc.map((c) => `${c} = ?`).join(', ')}, updated_at_ts = ? WHERE user_id = ?`)
            .run(...pc.map((c) => profileSets[c]), now, row.user_id);
        }
      });
      const action = 'status' in after ? (disabling ? 'courier.disable' : 'courier.enable') : 'courier.update';
      const name = (userSets.display_name as string | undefined) ?? user.display_name;
      const summary = action === 'courier.disable' ? `Courier disabled and signed out: ${name}`
        : action === 'courier.enable' ? `Courier enabled: ${name}`
          : `Courier updated (${fields.join(', ')}): ${name}`;
      audit(req, action, 'user', row.user_id, summary, before, after);
    }
    res.json({ success: true, data: courierOut(loadProfile(row.user_id)!) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/couriers/:id/photo { image }: replaces the courier's photo.
couriersRouter.post('/:id/photo', requirePermission('couriers.manage'), loadManageableCourier, (req: Request, res: Response) => {
  try {
    const row = res.locals.profile as CourierRow;
    const checked = checkAvatar(body(req).image);
    if (!checked.ok) return send(res, fail(400, 'INVALID_PHOTO', checked.error));
    const saved = writeImageUpload('couriers', checked.buffer, checked.type);
    db.prepare('UPDATE couriers SET photo_file = ?, updated_at_ts = ? WHERE user_id = ?').run(saved.fileName, Date.now(), row.user_id);
    if (row.photo_file) deleteUpload('couriers', row.photo_file);
    audit(req, 'courier.photo_update', 'user', row.user_id, `Courier photo ${row.photo_file ? 'replaced' : 'added'}: ${row.public_first_name}`,
      undefined, { sizeBytes: saved.sizeBytes });
    res.json({ success: true, data: courierOut(loadProfile(row.user_id)!) });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/couriers/:id/photo
couriersRouter.delete('/:id/photo', requirePermission('couriers.manage'), loadManageableCourier, (req: Request, res: Response) => {
  try {
    const row = res.locals.profile as CourierRow;
    if (row.photo_file) {
      db.prepare('UPDATE couriers SET photo_file = NULL, updated_at_ts = ? WHERE user_id = ?').run(Date.now(), row.user_id);
      deleteUpload('couriers', row.photo_file);
      audit(req, 'courier.photo_remove', 'user', row.user_id, `Courier photo removed: ${row.public_first_name}`);
    }
    res.json({ success: true, data: courierOut(loadProfile(row.user_id)!) });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/couriers/:id/reset-password → { courier, user, tempPassword }
couriersRouter.post('/:id/reset-password', requirePermission('couriers.manage'), loadManageableCourier, async (req: Request, res: Response) => {
  try {
    const actor = getRequestAuth(req)!;
    const row = res.locals.profile as CourierRow;
    if (row.user_id === actor.user.id) return send(res, fail(409, 'SELF_RESET', 'Use My account to change your own password.'));
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    inTransaction(db, () => {
      db.prepare(`
        UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until_ts = NULL,
                         updated_at_ts = ? WHERE id = ?
      `).run(hash, Date.now(), row.user_id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    });
    const user = userById(row.user_id);
    audit(req, 'courier.reset_password', 'user', row.user_id, `Temporary password issued and sessions signed out: ${user?.displayName ?? row.user_id}`);
    noStore(res);
    res.json({ success: true, data: { courier: courierOut(loadProfile(row.user_id)!), user, tempPassword } });
  } catch (err) {
    serverError(res, err);
  }
});
