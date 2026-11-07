// Stable error codes in API answers (I18N_SPEC §5). Every `{ success: false }` answer carries a
// `code` next to the English `error`; clients show their own text for the code. Routes set a
// specific code where the client needs to tell cases apart; otherwise the server fills in the
// general code for the HTTP status (server/middleware/errorCodes.ts). Codes are never renamed.

/** General codes, one per HTTP status family. */
export const GENERAL_ERROR_CODES = {
  400: 'BAD_REQUEST',
  401: 'AUTH_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
} as const;

/** Codes public pages map to their own text (src/i18n/<lang>/common.ts `errors`). */
export const PUBLIC_ERROR_CODES = [
  ...Object.values(GENERAL_ERROR_CODES),
  'NETWORK',
  'MALFORMED_BODY',
  'INVALID_TRACKING_ID',
  'SHIPMENT_NOT_FOUND',
  'QUOTE_NOT_FOUND',
  'NO_PAYMENT_REQUEST',
  'NOT_ACCEPTING',
  'TOO_MANY_OPEN',
  'VALIDATION_FAILED',
  'MISSING_FIELDS',
  'CONTACT_REQUIRED',
  'INVALID_EMAIL',
] as const;

export type PublicErrorCode = typeof PUBLIC_ERROR_CODES[number];

/** The general code for an HTTP status (any other 4xx → BAD_REQUEST, 5xx → SERVER_ERROR). */
export function generalErrorCode(status: number): string {
  const known = (GENERAL_ERROR_CODES as Record<number, string>)[status];
  if (known) return known;
  return status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST';
}

export function isPublicErrorCode(code: unknown): code is PublicErrorCode {
  return typeof code === 'string' && (PUBLIC_ERROR_CODES as readonly string[]).includes(code);
}
