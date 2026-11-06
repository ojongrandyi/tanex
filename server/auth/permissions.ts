// Who is signed in and what they may do (docs/IAM_RBAC_SPEC.md §5.1). Permissions are read
// from the database on every request (cached on the request), so a revoked role or a disabled
// account takes effect at once. '*' (Super Admin) grants every key.
import type { Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { db } from '../db.js';
import { ALL_PERMISSIONS, hasPermission, type PermissionKey } from '../../src/shared/permissions.js';

const COURIER_APP: PermissionKey = 'courier.app';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  locale: string;
  status: string;
  mustChangePassword: boolean;
}

export interface RequestAuth {
  user: AuthUser;
  roles: { id: string; name: string }[];
  /** Granted keys as stored, including '*' for Super Admin. */
  permissions: string[];
}

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  locale: string;
  status: string;
  must_change_password: number;
}

export function loadUser(conn: DatabaseSync, userId: string): AuthUser | null {
  const row = conn.prepare(`
    SELECT id, email, phone, display_name, locale, status, must_change_password FROM users WHERE id = ?
  `).get(userId) as UserRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.display_name,
    locale: row.locale,
    status: row.status,
    mustChangePassword: row.must_change_password === 1
  };
}

export function loadUserRoles(conn: DatabaseSync, userId: string): { id: string; name: string }[] {
  return conn.prepare(`
    SELECT r.id AS id, r.name AS name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? ORDER BY r.name
  `).all(userId) as unknown as { id: string; name: string }[];
}

/** Union of the user's roles' grants, sorted; '*' when any role holds it. */
export function loadUserPermissions(conn: DatabaseSync, userId: string): string[] {
  const rows = conn.prepare(`
    SELECT DISTINCT rp.permission_key AS key FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = ?
  `).all(userId) as unknown as { key: string }[];
  const keys = rows.map((r) => r.key);
  return keys.includes(ALL_PERMISSIONS) ? [ALL_PERMISSIONS] : keys.sort();
}

/** True when the user's only permission is courier.app (gets the 7-day session). */
export function isCourierOnly(permissions: readonly string[]): boolean {
  return permissions.length === 1 && permissions[0] === COURIER_APP;
}

/** The active account behind a session, or null (no session, unknown or disabled user). */
export function loadAuth(conn: DatabaseSync, userId: string | undefined): RequestAuth | null {
  if (!userId) return null;
  const user = loadUser(conn, userId);
  if (!user || user.status !== 'ACTIVE') return null;
  return { user, roles: loadUserRoles(conn, userId), permissions: loadUserPermissions(conn, userId) };
}

const cache = new WeakMap<Request, RequestAuth | null>();

/** The signed-in user for this request, read once per request. */
export function getRequestAuth(req: Request): RequestAuth | null {
  if (cache.has(req)) return cache.get(req)!;
  const auth = loadAuth(db, req.session?.userId);
  cache.set(req, auth);
  return auth;
}

/** Forget the cached value (after login/logout changes who is signed in). */
export function resetRequestAuth(req: Request): void {
  cache.delete(req);
}

/** True when the signed-in user holds at least one of the keys. */
export function requestHasPermission(req: Request, ...keys: PermissionKey[]): boolean {
  const auth = getRequestAuth(req);
  if (!auth) return false;
  return keys.some((k) => hasPermission(auth.permissions, k));
}
