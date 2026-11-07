// Roles and the permission catalogue (docs/IAM_RBAC_SPEC.md §5.3, §6). The locked Super Admin
// role can't be changed or deleted; nobody can add or remove a permission they don't hold
// (except Super Admin); seeded (system) roles can be edited but not deleted.
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { getRequestAuth } from '../auth/permissions.js';
import { inTransaction } from '../auth/schema.js';
import { canGrant } from '../auth/rules.js';
import { PERMISSIONS, PERMISSION_GROUPS, isPermissionKey } from '../../src/shared/permissions.js';

export const ROLE_NAME_MAX = 60;
export const ROLE_DESCRIPTION_MAX = 200;

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system: number;
  is_locked: number;
  created_at_ts: number;
  updated_at_ts: number;
}

function permissionsOf(roleId: string): string[] {
  const rows = db.prepare('SELECT permission_key AS key FROM role_permissions WHERE role_id = ? ORDER BY permission_key')
    .all(roleId) as unknown as { key: string }[];
  return rows.map((r) => r.key);
}

function formatRole(row: RoleRow, userCount: number) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isSystem: row.is_system === 1,
    isLocked: row.is_locked === 1,
    permissions: permissionsOf(row.id),
    userCount,
    createdAt: row.created_at_ts,
    updatedAt: row.updated_at_ts
  };
}

function userCountOf(roleId: string): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM user_roles WHERE role_id = ?').get(roleId) as { c: number }).c;
}

function roleById(id: string) {
  const row = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as RoleRow | undefined;
  return row ? formatRole(row, userCountOf(id)) : null;
}

type Fail = { status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Fail => ({ status, code, error });
const send = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error });
const isFail = (v: unknown): v is Fail => !!v && typeof v === 'object' && 'code' in v && 'status' in v;

interface RoleInput { name?: string; description?: string; permissions?: string[] }

function readRoleInput(body: unknown, creating: boolean): RoleInput | Fail {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: RoleInput = {};
  if (b.name !== undefined || creating) {
    const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > ROLE_NAME_MAX) return fail(400, 'INVALID_NAME', `Enter a role name of 1 to ${ROLE_NAME_MAX} characters.`);
    out.name = name;
  }
  if (b.description !== undefined) {
    if (b.description !== null && typeof b.description !== 'string') return fail(400, 'INVALID_DESCRIPTION', 'Invalid description.');
    const d = typeof b.description === 'string' ? b.description.trim() : '';
    if (d.length > ROLE_DESCRIPTION_MAX) return fail(400, 'INVALID_DESCRIPTION', `Keep the description under ${ROLE_DESCRIPTION_MAX} characters.`);
    out.description = d;
  }
  if (b.permissions !== undefined || creating) {
    const list = b.permissions ?? [];
    // '*' is never a choice: it belongs to the locked Super Admin role only.
    if (!Array.isArray(list) || !list.every((k) => typeof k === 'string' && isPermissionKey(k))) {
      return fail(400, 'UNKNOWN_PERMISSION', 'Choose permissions from the list.');
    }
    out.permissions = [...new Set(list as string[])].sort();
  }
  return out;
}

function nameTaken(name: string, exceptId: string | null): boolean {
  const row = db.prepare('SELECT id FROM roles WHERE name = ? COLLATE NOCASE').get(name) as { id: string } | undefined;
  return !!row && row.id !== exceptId;
}

const CANNOT_GRANT = fail(403, 'CANNOT_GRANT', 'You cannot add or remove permissions you do not hold.');
const ROLE_LOCKED = fail(409, 'ROLE_LOCKED', "The Super Admin role can't be changed.");

export const rolesRouter = Router();

// GET /api/roles: roles.manage, or users.manage (needed to choose roles for an account).
rolesRouter.get('/', requirePermission('roles.manage', 'users.manage'), (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM roles ORDER BY is_locked DESC, name COLLATE NOCASE').all() as unknown as RoleRow[];
  const counts = new Map(
    (db.prepare('SELECT role_id AS id, COUNT(*) AS c FROM user_roles GROUP BY role_id').all() as unknown as { id: string; c: number }[])
      .map((r) => [r.id, r.c])
  );
  res.json({ success: true, data: rows.map((r) => formatRole(r, counts.get(r.id) ?? 0)) });
});

// POST /api/roles  { name, description?, permissions }
rolesRouter.post('/', requirePermission('roles.manage'), (req: Request, res: Response) => {
  const actor = getRequestAuth(req)!;
  const input = readRoleInput(req.body, true);
  if (isFail(input)) return send(res, input);
  if (nameTaken(input.name!, null)) return send(res, fail(409, 'NAME_TAKEN', 'A role with this name already exists.'));
  if (!canGrant(actor.permissions, input.permissions!)) return send(res, CANNOT_GRANT);

  const id = 'role_' + crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  inTransaction(db, () => {
    db.prepare(`
      INSERT INTO roles (id, name, description, is_system, is_locked, created_at_ts, updated_at_ts)
      VALUES (?, ?, ?, 0, 0, ?, ?)
    `).run(id, input.name!, input.description ?? '', now, now);
    const grant = db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
    for (const key of input.permissions!) grant.run(id, key);
  });
  audit(req, 'role.create', 'role', id, `Role created: ${input.name}`, undefined, {
    name: input.name, description: input.description ?? '', permissions: input.permissions
  });
  res.status(201).json({ success: true, data: roleById(id) });
});

// PATCH /api/roles/:id  { name?, description?, permissions? }
rolesRouter.patch('/:id', requirePermission('roles.manage'), (req: Request, res: Response) => {
  const actor = getRequestAuth(req)!;
  const row = db.prepare('SELECT * FROM roles WHERE id = ?').get(String(req.params.id)) as RoleRow | undefined;
  if (!row) return send(res, fail(404, 'NOT_FOUND', 'Role not found.'));
  if (row.is_locked === 1) return send(res, ROLE_LOCKED);
  const input = readRoleInput(req.body, false);
  if (isFail(input)) return send(res, input);

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (input.name !== undefined && input.name !== row.name) {
    if (nameTaken(input.name, row.id)) return send(res, fail(409, 'NAME_TAKEN', 'A role with this name already exists.'));
    before.name = row.name;
    after.name = input.name;
  }
  if (input.description !== undefined && input.description !== (row.description ?? '')) {
    before.description = row.description ?? '';
    after.description = input.description;
  }
  const oldKeys = permissionsOf(row.id);
  let permissionsChanged = false;
  if (input.permissions) {
    const added = input.permissions.filter((k) => !oldKeys.includes(k));
    const removed = oldKeys.filter((k) => !input.permissions!.includes(k));
    permissionsChanged = added.length > 0 || removed.length > 0;
    if (!canGrant(actor.permissions, [...added, ...removed])) return send(res, CANNOT_GRANT);
    if (permissionsChanged) {
      before.permissions = oldKeys;
      after.permissions = input.permissions;
    }
  }
  if (Object.keys(after).length === 0) return res.json({ success: true, data: roleById(row.id) });

  inTransaction(db, () => {
    db.prepare('UPDATE roles SET name = ?, description = ?, updated_at_ts = ? WHERE id = ?').run(
      (after.name as string | undefined) ?? row.name,
      (after.description as string | undefined) ?? row.description ?? '',
      Date.now(),
      row.id
    );
    if (permissionsChanged) {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(row.id);
      const grant = db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
      for (const key of input.permissions!) grant.run(row.id, key);
    }
  });
  const name = (after.name as string | undefined) ?? row.name;
  audit(req, permissionsChanged ? 'role.permissions.set' : 'role.update', 'role', row.id,
    `Role updated (${Object.keys(after).join(', ')}): ${name}`, before, after);
  res.json({ success: true, data: roleById(row.id) });
});

// DELETE /api/roles/:id: custom roles nobody holds.
rolesRouter.delete('/:id', requirePermission('roles.manage'), (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM roles WHERE id = ?').get(String(req.params.id)) as RoleRow | undefined;
  if (!row) return send(res, fail(404, 'NOT_FOUND', 'Role not found.'));
  if (row.is_locked === 1) return send(res, ROLE_LOCKED);
  if (row.is_system === 1) return send(res, fail(409, 'ROLE_SYSTEM', "System roles can't be deleted. You can rename them or change their permissions."));
  const users = userCountOf(row.id);
  if (users > 0) return send(res, fail(409, 'ROLE_IN_USE', `${users} account${users === 1 ? ' has' : 's have'} this role. Remove it from them first.`));
  const keys = permissionsOf(row.id);
  inTransaction(db, () => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(row.id);
    db.prepare('DELETE FROM roles WHERE id = ?').run(row.id);
  });
  audit(req, 'role.delete', 'role', row.id, `Role deleted: ${row.name}`, { name: row.name, description: row.description ?? '', permissions: keys });
  res.json({ success: true });
});

export const permissionsRouter = Router();

// GET /api/permissions: the catalogue with groups and EN/FR descriptions.
permissionsRouter.get('/', requirePermission('roles.manage'), (_req: Request, res: Response) => {
  res.json({ success: true, data: { groups: PERMISSION_GROUPS, permissions: PERMISSIONS } });
});
