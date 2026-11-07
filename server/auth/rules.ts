// Account and role safety rules (docs/IAM_RBAC_SPEC.md §5.3): no privilege escalation, the last
// active Super Admin stays, temporary passwords. Takes the connection as a parameter so tests
// can use their own database.
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { ALL_PERMISSIONS } from '../../src/shared/permissions.js';
import { loadUserPermissions } from './permissions.js';

/** True when the granted keys include '*' (Super Admin). */
export function isAllPowerful(granted: readonly string[]): boolean {
  return granted.includes(ALL_PERMISSIONS);
}

/**
 * True when someone holding `granted` may hand out every key in `keys` (spec §5.3: nobody can
 * grant a permission they don't hold, except Super Admin). '*' in `keys` needs '*'.
 */
export function canGrant(granted: readonly string[], keys: Iterable<string>): boolean {
  if (isAllPowerful(granted)) return true;
  const held = new Set(granted);
  for (const k of keys) {
    if (k === ALL_PERMISSIONS || !held.has(k)) return false;
  }
  return true;
}

/**
 * True when the actor may edit, disable, reset or sign out the target: the target must hold
 * nothing the actor lacks. Otherwise a user manager could reset a Super Admin's password and
 * sign in as them, which is the escalation §5.3 forbids.
 */
export function canManageUser(actorGranted: readonly string[], targetGranted: readonly string[]): boolean {
  return canGrant(actorGranted, targetGranted);
}

/** Every key granted by the given roles (may include '*'). */
export function rolesPermissions(conn: DatabaseSync, roleIds: readonly string[]): string[] {
  if (roleIds.length === 0) return [];
  const placeholders = roleIds.map(() => '?').join(', ');
  const rows = conn.prepare(
    `SELECT DISTINCT permission_key AS key FROM role_permissions WHERE role_id IN (${placeholders})`
  ).all(...roleIds) as unknown as { key: string }[];
  return rows.map((r) => r.key);
}

/** The ids of the locked (Super Admin) roles. */
export function lockedRoleIds(conn: DatabaseSync): string[] {
  const rows = conn.prepare('SELECT id FROM roles WHERE is_locked = 1').all() as unknown as { id: string }[];
  return rows.map((r) => r.id);
}

/** True when the user holds a locked (Super Admin) role. */
export function holdsSuperAdminRole(conn: DatabaseSync, userId: string): boolean {
  const row = conn.prepare(`
    SELECT 1 AS x FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.is_locked = 1 LIMIT 1
  `).get(userId);
  return !!row;
}

/** Active users holding a Super Admin role, other than `exceptUserId`. */
export function countOtherActiveSuperAdmins(conn: DatabaseSync, exceptUserId: string): number {
  const { c } = conn.prepare(`
    SELECT COUNT(DISTINCT u.id) AS c FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.is_locked = 1 AND u.status = 'ACTIVE' AND u.id <> ?
  `).get(exceptUserId) as { c: number };
  return c;
}

/**
 * True when this change would leave no active Super Admin: the target is an active Super Admin
 * today, would lose the role or be disabled, and nobody else is one.
 */
export function wouldRemoveLastSuperAdmin(
  conn: DatabaseSync,
  targetUserId: string,
  change: { disable: boolean; keepsSuperAdminRole: boolean }
): boolean {
  const row = conn.prepare('SELECT status FROM users WHERE id = ?').get(targetUserId) as { status: string } | undefined;
  if (!row || row.status !== 'ACTIVE' || !holdsSuperAdminRole(conn, targetUserId)) return false;
  if (!change.disable && change.keepsSuperAdminRole) return false;
  return countOtherActiveSuperAdmins(conn, targetUserId) === 0;
}

/** The user's effective keys (union of roles; '*' collapses). */
export function userPermissions(conn: DatabaseSync, userId: string): string[] {
  return loadUserPermissions(conn, userId);
}

// Lower-case letters and digits without look-alikes (no i, l, o, 0, 1), so a temporary password
// read aloud or typed on a phone keyboard comes out right. 12 characters from 31 ≈ 59 bits;
// with the account lockout and a forced change at first sign-in that is plenty.
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A temporary password like `k7mq-3xpa-9rtd` (14 characters; meets the 10-character policy). */
export function generateTempPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let part = '';
    for (let i = 0; i < 4; i++) part += TEMP_ALPHABET[crypto.randomInt(TEMP_ALPHABET.length)];
    groups.push(part);
  }
  return groups.join('-');
}
