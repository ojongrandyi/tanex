// Audit trail for staff actions and sign-ins (docs/IAM_RBAC_SPEC.md §5.9). before/after should
// hold only the changed fields; anything that looks like a secret is dropped before writing.
import type { Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { db } from './db.js';
import { getRequestAuth } from './auth/permissions.js';

// Field names never written to the log, at any depth (passwords, hashes, tokens, secrets).
const SECRET_KEY = /pass(word)?|hash|token|secret|otp|totp/i;

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = stripSecrets(v);
    }
    return out;
  }
  return value;
}

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(stripSecrets(value));
}

export interface AuditActor {
  userId: string | null;
  name: string;
}

/**
 * Writes one audit row. The actor is the signed-in user unless one is given (e.g. a failed
 * sign-in, where nobody is signed in). Never throws: a failed audit write is logged, not
 * allowed to undo the action it describes.
 */
export function audit(
  req: Request,
  action: string,
  entityType: string | null,
  entityId: string | null,
  summary: string,
  before?: unknown,
  after?: unknown,
  options: { actor?: AuditActor; conn?: DatabaseSync } = {}
): void {
  try {
    const conn = options.conn ?? db;
    let actor = options.actor;
    if (!actor) {
      const auth = getRequestAuth(req);
      actor = auth ? { userId: auth.user.id, name: auth.user.displayName } : { userId: null, name: 'anonymous' };
    }
    conn.prepare(`
      INSERT INTO audit_log (id, at_ts, actor_user_id, actor_name, action, entity_type, entity_id, summary, before_json, after_json, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'aud_' + crypto.randomBytes(12).toString('hex'),
      Date.now(),
      actor.userId,
      actor.name,
      action,
      entityType,
      entityId,
      summary,
      toJson(before),
      toJson(after),
      req.ip ?? null
    );
  } catch (err) {
    console.error(`[audit] could not record ${action}:`, err);
  }
}
