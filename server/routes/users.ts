// Staff accounts (docs/IAM_RBAC_SPEC.md §5.3–§5.5, §6): list, create, edit, roles, disable/enable,
// reset password, sessions. Users are never deleted, only disabled (§5.4). Temporary passwords are
// returned once in the response and never stored or logged in plain text.
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth } from '../auth/permissions.js';
import { hashPassword } from '../auth/passwords.js';
import { looksLikeEmail, newUserId } from '../auth/bootstrap.js';
import { inTransaction } from '../auth/schema.js';
import {
  canGrant,
  canManageUser,
  generateTempPassword,
  lockedRoleIds,
  rolesPermissions,
  userPermissions,
  wouldRemoveLastSuperAdmin
} from '../auth/rules.js';
import { normalizeEmailAddress, normalizePhone } from '../../src/shared/identifier.js';
import { DISPLAY_NAME_MAX } from './auth.js';

const LOCALES = ['en', 'fr'] as const;
const STATUSES = ['ACTIVE', 'DISABLED'] as const;

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  status: string;
  must_change_password: number;
  locale: string;
  locked_until_ts: number | null;
  last_login_ts: number | null;
  created_at_ts: number;
  updated_at_ts: number;
}

const USER_COLUMNS = `id, email, phone, display_name, status, must_change_password, locale,
  locked_until_ts, last_login_ts, created_at_ts, updated_at_ts`;

type RoleRef = { id: string; name: string };

function rolesByUser(userIds: string[]): Map<string, RoleRef[]> {
  const map = new Map<string, RoleRef[]>();
  if (userIds.length === 0) return map;
  const rows = db.prepare(`
    SELECT ur.user_id AS userId, r.id AS id, r.name AS name FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id ORDER BY r.name
  `).all() as unknown as { userId: string; id: string; name: string }[];
  const wanted = new Set(userIds);
  for (const r of rows) {
    if (!wanted.has(r.userId)) continue;
    const list = map.get(r.userId) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.userId, list);
  }
  return map;
}

function formatUser(row: UserRow, roles: RoleRef[], now = Date.now()) {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    locale: row.locale,
    mustChangePassword: row.must_change_password === 1,
    locked: !!row.locked_until_ts && row.locked_until_ts > now,
    lastLoginAt: row.last_login_ts,
    createdAt: row.created_at_ts,
    updatedAt: row.updated_at_ts,
    roles
  };
}

function loadRow(id: string): UserRow | undefined {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as UserRow | undefined;
}

function userById(id: string) {
  const row = loadRow(id);
  return row ? formatUser(row, rolesByUser([id]).get(id) ?? []) : null;
}

type Fail = { status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Fail => ({ status, code, error });
const send = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error });

interface UserInput {
  displayName?: string;
  email?: string | null;
  phone?: string | null;
  locale?: string;
  roleIds?: string[];
  status?: string;
}

/** Validates the fields present in the body. `creating` makes the name required. */
function readUserInput(body: unknown, creating: boolean): UserInput | Fail {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: UserInput = {};

  if (b.displayName !== undefined || creating) {
    const name = typeof b.displayName === 'string' ? b.displayName.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > DISPLAY_NAME_MAX) {
      return fail(400, 'INVALID_NAME', `Enter a name of 1 to ${DISPLAY_NAME_MAX} characters.`);
    }
    out.displayName = name;
  }
  if (b.email !== undefined) {
    const raw = typeof b.email === 'string' ? b.email.trim() : '';
    if (b.email !== null && typeof b.email !== 'string') return fail(400, 'INVALID_EMAIL', 'Enter a valid email address.');
    if (!raw) out.email = null;
    else {
      const email = normalizeEmailAddress(raw);
      if (!looksLikeEmail(email) || email.length > 200) return fail(400, 'INVALID_EMAIL', 'Enter a valid email address.');
      out.email = email;
    }
  }
  if (b.phone !== undefined) {
    if (b.phone !== null && typeof b.phone !== 'string') return fail(400, 'INVALID_PHONE', 'Enter a valid phone number.');
    const raw = typeof b.phone === 'string' ? b.phone.trim() : '';
    if (!raw) out.phone = null;
    else {
      const phone = normalizePhone(raw);
      if (!phone) return fail(400, 'INVALID_PHONE', 'Enter a valid phone number.');
      out.phone = phone;
    }
  }
  if (b.locale !== undefined) {
    if (typeof b.locale !== 'string' || !(LOCALES as readonly string[]).includes(b.locale)) {
      return fail(400, 'INVALID_LOCALE', 'Language must be en or fr.');
    }
    out.locale = b.locale;
  }
  if (b.roleIds !== undefined) {
    if (!Array.isArray(b.roleIds) || !b.roleIds.every((r) => typeof r === 'string')) {
      return fail(400, 'UNKNOWN_ROLE', 'Choose roles from the list.');
    }
    const ids = [...new Set(b.roleIds as string[])];
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      const { c } = db.prepare(`SELECT COUNT(*) AS c FROM roles WHERE id IN (${placeholders})`).get(...ids) as { c: number };
      if (c !== ids.length) return fail(400, 'UNKNOWN_ROLE', 'Choose roles from the list.');
    }
    out.roleIds = ids;
  }
  if (b.status !== undefined) {
    if (typeof b.status !== 'string' || !(STATUSES as readonly string[]).includes(b.status)) {
      return fail(400, 'INVALID_STATUS', 'Status must be ACTIVE or DISABLED.');
    }
    out.status = b.status;
  }
  return out;
}

const isFail = (v: unknown): v is Fail => !!v && typeof v === 'object' && 'code' in v && 'status' in v;

/** 409 when another user already has this email or phone. */
function identifierConflict(email: string | null | undefined, phone: string | null | undefined, exceptId: string | null): Fail | null {
  if (email) {
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (row && row.id !== exceptId) return fail(409, 'EMAIL_TAKEN', 'Another account already uses this email address.');
  }
  if (phone) {
    const row = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) as { id: string } | undefined;
    if (row && row.id !== exceptId) return fail(409, 'PHONE_TAKEN', 'Another account already uses this phone number.');
  }
  return null;
}

const roleNames = (ids: string[]): string[] => {
  if (ids.length === 0) return [];
  const rows = db.prepare(`SELECT id, name FROM roles WHERE id IN (${ids.map(() => '?').join(', ')})`)
    .all(...ids) as unknown as RoleRef[];
  return rows.map((r) => r.name).sort();
};

/**
 * Loads the target (404) and checks the actor may manage it (403): the target can't hold any
 * permission the actor lacks. Puts the row on res.locals.
 */
function loadManageableTarget(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  const row = loadRow(id);
  if (!row) return send(res, fail(404, 'NOT_FOUND', 'User not found.'));
  const actor = getRequestAuth(req)!;
  if (!canManageUser(actor.permissions, userPermissions(db, id))) {
    return send(res, fail(403, 'CANNOT_MANAGE_USER', 'You cannot change an account that has permissions you do not hold.'));
  }
  res.locals.target = row;
  next();
}

function noStore(res: Response) {
  res.set('Cache-Control', 'no-store');
}

export const usersRouter = Router();

// GET /api/users
usersRouter.get('/', requirePermission('users.view'), (_req: Request, res: Response) => {
  const rows = db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY display_name COLLATE NOCASE, id`).all() as unknown as UserRow[];
  const roles = rolesByUser(rows.map((r) => r.id));
  const now = Date.now();
  res.json({ success: true, data: rows.map((r) => formatUser(r, roles.get(r.id) ?? [], now)) });
});

// GET /api/users/:id
usersRouter.get('/:id', requirePermission('users.view'), (req: Request, res: Response) => {
  const user = userById(String(req.params.id));
  if (!user) return send(res, fail(404, 'NOT_FOUND', 'User not found.'));
  res.json({ success: true, data: user });
});

// POST /api/users  { displayName, email?, phone?, locale?, roleIds? } → { user, tempPassword }
usersRouter.post('/', requirePermission('users.manage'), async (req: Request, res: Response) => {
  try {
    const actor = getRequestAuth(req)!;
    const input = readUserInput(req.body, true);
    if (isFail(input)) return send(res, input);
    const email = input.email ?? null;
    const phone = input.phone ?? null;
    if (!email && !phone) return send(res, fail(400, 'IDENTIFIER_REQUIRED', 'Enter an email address or a phone number.'));
    const conflict = identifierConflict(email, phone, null);
    if (conflict) return send(res, conflict);
    const roleIds = input.roleIds ?? [];
    if (!canGrant(actor.permissions, rolesPermissions(db, roleIds))) {
      return send(res, fail(403, 'CANNOT_GRANT', 'You cannot give a role with permissions you do not hold.'));
    }

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    const id = newUserId();
    const now = Date.now();
    inTransaction(db, () => {
      db.prepare(`
        INSERT INTO users (id, email, phone, display_name, password_hash, status, must_change_password,
                           locale, failed_logins, created_at_ts, updated_at_ts, created_by)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?, 0, ?, ?, ?)
      `).run(id, email, phone, input.displayName!, hash, input.locale ?? 'en', now, now, actor.user.id);
      const grant = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
      for (const roleId of roleIds) grant.run(id, roleId);
    });

    audit(req, 'user.create', 'user', id, `Account created for ${input.displayName}`, undefined, {
      displayName: input.displayName, email, phone, locale: input.locale ?? 'en', roles: roleNames(roleIds)
    });
    noStore(res);
    res.status(201).json({ success: true, data: { user: userById(id), tempPassword } });
  } catch (err) {
    console.error('[users] create failed:', err);
    res.status(500).json({ success: false, error: 'Could not create the account.' });
  }
});

// PATCH /api/users/:id  { displayName?, email?, phone?, locale?, roleIds?, status? }
usersRouter.patch('/:id', requirePermission('users.manage'), loadManageableTarget, (req: Request, res: Response) => {
  try {
    const actor = getRequestAuth(req)!;
    const target = res.locals.target as UserRow;
    const input = readUserInput(req.body, false);
    if (isFail(input)) return send(res, input);

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const sets: Record<string, string | null> = {};
    const note = (field: string, column: string, oldValue: string | null, newValue: string | null | undefined) => {
      if (newValue === undefined || newValue === oldValue) return;
      before[field] = oldValue;
      after[field] = newValue;
      sets[column] = newValue;
    };
    note('displayName', 'display_name', target.display_name, input.displayName);
    note('email', 'email', target.email, input.email);
    note('phone', 'phone', target.phone, input.phone);
    note('locale', 'locale', target.locale, input.locale);
    note('status', 'status', target.status, input.status);

    const newEmail = 'email' in sets ? sets.email : target.email;
    const newPhone = 'phone' in sets ? sets.phone : target.phone;
    if (!newEmail && !newPhone) return send(res, fail(400, 'IDENTIFIER_REQUIRED', 'Enter an email address or a phone number.'));
    const conflict = identifierConflict('email' in sets ? sets.email : null, 'phone' in sets ? sets.phone : null, target.id);
    if (conflict) return send(res, conflict);

    const disabling = sets.status === 'DISABLED';
    if (disabling && target.id === actor.user.id) {
      return send(res, fail(409, 'SELF_DISABLE', 'You cannot disable your own account.'));
    }

    // Roles: anything added must be grantable by the actor.
    const oldRoleIds = (db.prepare('SELECT role_id AS id FROM user_roles WHERE user_id = ?').all(target.id) as unknown as { id: string }[])
      .map((r) => r.id).sort();
    let rolesChanged = false;
    let newRoleIds = oldRoleIds;
    if (input.roleIds) {
      newRoleIds = [...input.roleIds].sort();
      rolesChanged = newRoleIds.join('|') !== oldRoleIds.join('|');
      const added = newRoleIds.filter((r) => !oldRoleIds.includes(r));
      if (!canGrant(actor.permissions, rolesPermissions(db, added))) {
        return send(res, fail(403, 'CANNOT_GRANT', 'You cannot give a role with permissions you do not hold.'));
      }
      if (rolesChanged) {
        before.roles = roleNames(oldRoleIds);
        after.roles = roleNames(newRoleIds);
      }
    }

    const locked = lockedRoleIds(db);
    if (wouldRemoveLastSuperAdmin(db, target.id, {
      disable: disabling,
      keepsSuperAdminRole: newRoleIds.some((r) => locked.includes(r))
    })) {
      return send(res, fail(409, 'LAST_SUPER_ADMIN', 'This is the last active Super Admin. Give the role to someone else first.'));
    }

    const columns = Object.keys(sets);
    if (columns.length === 0 && !rolesChanged) {
      return res.json({ success: true, data: userById(target.id) });
    }

    const now = Date.now();
    inTransaction(db, () => {
      if (columns.length > 0) {
        db.prepare(`UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at_ts = ? WHERE id = ?`)
          .run(...columns.map((c) => sets[c]), now, target.id);
      }
      // Enabling also clears a sign-in lockout.
      if (sets.status === 'ACTIVE') {
        db.prepare('UPDATE users SET failed_logins = 0, locked_until_ts = NULL WHERE id = ?').run(target.id);
      }
      if (rolesChanged) {
        db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(target.id);
        const grant = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
        for (const roleId of newRoleIds) grant.run(target.id, roleId);
        if (columns.length === 0) db.prepare('UPDATE users SET updated_at_ts = ? WHERE id = ?').run(now, target.id);
      }
      // Disabling signs the user out everywhere (spec §5.7).
      if (disabling) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    });

    const fields = Object.keys(after);
    const action = 'status' in after ? (disabling ? 'user.disable' : 'user.enable') : 'user.update';
    const summary = action === 'user.disable'
      ? `Account disabled and signed out: ${target.display_name}`
      : action === 'user.enable'
        ? `Account enabled: ${target.display_name}`
        : `Account updated (${fields.join(', ')}): ${target.display_name}`;
    audit(req, action, 'user', target.id, summary, before, after);
    res.json({ success: true, data: userById(target.id) });
  } catch (err) {
    console.error('[users] update failed:', err);
    res.status(500).json({ success: false, error: 'Could not update the account.' });
  }
});

// POST /api/users/:id/reset-password → { user, tempPassword }
usersRouter.post('/:id/reset-password', requirePermission('users.manage'), loadManageableTarget, async (req: Request, res: Response) => {
  try {
    const actor = getRequestAuth(req)!;
    const target = res.locals.target as UserRow;
    if (target.id === actor.user.id) {
      return send(res, fail(409, 'SELF_RESET', 'Use My account to change your own password.'));
    }
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    inTransaction(db, () => {
      db.prepare(`
        UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until_ts = NULL,
                         updated_at_ts = ? WHERE id = ?
      `).run(hash, Date.now(), target.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    });
    audit(req, 'user.reset_password', 'user', target.id,
      `Temporary password issued and sessions signed out: ${target.display_name}`);
    noStore(res);
    res.json({ success: true, data: { user: userById(target.id), tempPassword } });
  } catch (err) {
    console.error('[users] reset-password failed:', err);
    res.status(500).json({ success: false, error: 'Could not reset the password.' });
  }
});

// GET /api/users/:id/sessions: active sessions (the session id itself is never returned).
usersRouter.get('/:id/sessions', requirePermission('users.manage'), loadManageableTarget, (req: Request, res: Response) => {
  const target = res.locals.target as UserRow;
  const rows = db.prepare(`
    SELECT sid, created_at_ts, last_seen_ts, expires_at_ts, ip, user_agent FROM sessions
    WHERE user_id = ? AND expires_at_ts > ? ORDER BY COALESCE(last_seen_ts, created_at_ts) DESC
  `).all(target.id, Date.now()) as unknown as {
    sid: string; created_at_ts: number; last_seen_ts: number | null; expires_at_ts: number; ip: string | null; user_agent: string | null;
  }[];
  res.json({
    success: true,
    data: rows.map((r) => ({
      createdAt: r.created_at_ts,
      lastSeenAt: r.last_seen_ts,
      expiresAt: r.expires_at_ts,
      ip: r.ip,
      userAgent: r.user_agent,
      current: r.sid === req.sessionID
    }))
  });
});

// DELETE /api/users/:id/sessions: sign out everywhere (keeps the caller's own current session).
usersRouter.delete('/:id/sessions', requirePermission('users.manage'), loadManageableTarget, (req: Request, res: Response) => {
  const target = res.locals.target as UserRow;
  const result = db.prepare('DELETE FROM sessions WHERE user_id = ? AND sid <> ?').run(target.id, req.sessionID ?? '');
  const count = Number(result.changes);
  audit(req, 'user.sessions_revoke', 'user', target.id, `Signed out everywhere (${count} session${count === 1 ? '' : 's'}): ${target.display_name}`);
  res.json({ success: true, data: { signedOut: count } });
});
