// Audit trail for staff actions and sign-ins (docs/IAM_RBAC_SPEC.md §5.9). before/after should
// hold only the changed fields; anything that looks like a secret is dropped before writing.
import type { Request, Response, NextFunction, RequestHandler } from 'express';
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

type FromReq<T> = (req: Request, res: Response) => T;

/**
 * Route middleware: writes one audit row when the response finishes with a 2xx/3xx status, so
 * a route only needs `audited(...)` in its middleware list. The entity id comes from `entityId`
 * or, for ids the handler creates, from `res.locals.auditEntityId`. With `signedInOnly` (public
 * routes that staff also use) anonymous calls are not recorded.
 */
export function audited(
  action: string,
  entityType: string,
  entityId: FromReq<string | null | undefined> | null,
  summary: string | FromReq<string>,
  options: { after?: FromReq<unknown>; signedInOnly?: boolean } = {}
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Express puts the parent's params back once the router is done, which is before
    // 'finish'; keep this route's params for the callbacks.
    const params = { ...req.params };
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      if (options.signedInOnly && !getRequestAuth(req)) return;
      const outer = req.params;
      req.params = params;
      try {
        const id = (res.locals.auditEntityId as string | undefined) ?? entityId?.(req, res) ?? null;
        const text = typeof summary === 'string' ? summary : summary(req, res);
        audit(req, action, entityType, id ? String(id) : null, text, undefined, options.after?.(req, res));
      } catch (err) {
        console.error(`[audit] could not record ${action}:`, err);
      } finally {
        req.params = outer;
      }
    });
    next();
  };
}

/** The `:param` value from the URL, upper-cased for tracking numbers. */
export const param = (name: string, upper = false): FromReq<string | null> => (req) => {
  const v = (req.params as Record<string, string | undefined>)[name];
  return v ? (upper ? v.trim().toUpperCase() : v) : null;
};
