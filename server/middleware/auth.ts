import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getRequestAuth } from '../auth/permissions.js';
import { hasPermission, type PermissionKey } from '../../src/shared/permissions.js';

export { SESSION_COOKIE } from '../auth/sessionStore.js';

// An earlier Origin-header CSRF check was removed: behind Hostinger's CDN and proxy chain the
// forwarded scheme/host didn't survive reliably and it rejected real admin writes. CSRF is
// covered by the session cookie's sameSite=lax plus requireJsonOrMultipart below
// (IAM_RBAC_SPEC §5.8).

/** 401 unless an active user is signed in. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getRequestAuth(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

/** 401 when signed out, 403 unless the user holds at least one of the keys (any-of). */
export function requirePermission(...keys: PermissionKey[]): RequestHandler {
  if (keys.length === 0) throw new Error('requirePermission needs at least one permission key');
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getRequestAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!keys.some((k) => hasPermission(auth.permissions, k))) {
      return res.status(403).json({ success: false, error: 'You do not have permission to do this.' });
    }
    next();
  };
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rejects state-changing /api requests whose Content-Type isn't JSON or multipart (spec §5.8),
 * which blocks plain cross-site form posts (urlencoded / text/plain). Requests without a
 * Content-Type and without a body (e.g. logout, most DELETEs) pass.
 */
export function requireJsonOrMultipart(req: Request, res: Response, next: NextFunction) {
  if (!STATE_CHANGING.has(req.method)) return next();
  const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!type) {
    const length = Number(req.headers['content-length'] || 0);
    if (length === 0 && !req.headers['transfer-encoding']) return next();
  } else if (type === 'application/json' || type === 'multipart/form-data') {
    return next();
  }
  res.status(415).json({ success: false, error: 'Unsupported content type.' });
}
