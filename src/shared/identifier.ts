// Sign-in identifier: an email address or a phone number (docs/IAM_RBAC_SPEC.md §5.6).
// Shared by client and server; DOM-free. Phones are stored and matched in E.164 form;
// numbers typed without a country code are read as Cameroonian.
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export const DEFAULT_PHONE_COUNTRY = 'CM' as const;

export type Identifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

/** E.164 (e.g. +237651059345), or null when it isn't a valid phone number. */
export function normalizePhone(phone: string): string | null {
  const parsed = parsePhoneNumberFromString(phone.trim(), DEFAULT_PHONE_COUNTRY);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** Anything containing '@' is an email; otherwise a phone number. Null when unusable. */
export function normalizeIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes('@')) return { kind: 'email', value: normalizeEmailAddress(value) };
  const phone = normalizePhone(value);
  return phone ? { kind: 'phone', value: phone } : null;
}
