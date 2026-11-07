// Every API error answer carries a stable `code` (I18N_SPEC §5): routes set a specific one where
// the client needs to tell cases apart; any `{ success: false }` answer without one gets the
// general code for its HTTP status (src/shared/apiErrors.ts). The English `error` is unchanged.
import type { NextFunction, Request, Response } from 'express';
import { generalErrorCode } from '../../src/shared/apiErrors.js';

export function addErrorCodes(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body?: unknown) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>;
      if (b.success === false && typeof b.code !== 'string') {
        return json({ ...b, code: generalErrorCode(res.statusCode) });
      }
    }
    return json(body);
  }) as Response['json'];
  next();
}
