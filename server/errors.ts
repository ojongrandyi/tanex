// One answer for unexpected server errors. The real error (SQL text, file paths, stack) is
// logged with a short reference and never sent to the browser; the reference in the answer lets
// staff find the log line when someone reports the problem.
import crypto from 'crypto';
import type { Response } from 'express';

export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';

export function serverError(res: Response, err: unknown): Response {
  const ref = crypto.randomBytes(4).toString('hex').toUpperCase();
  const req = res.req;
  console.error(`[server] ${ref} ${req?.method ?? ''} ${req?.originalUrl?.split('?')[0] ?? ''} failed:`, err);
  if (res.headersSent) return res;
  return res.status(500).json({ success: false, code: 'SERVER_ERROR', ref, error: `${SERVER_ERROR_MESSAGE} (ref ${ref})` });
}
