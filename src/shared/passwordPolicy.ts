// Staff password rules (docs/IAM_RBAC_SPEC.md §5.5). Shared by client and server; DOM-free.
// Returns an error code rather than a sentence so each caller can show it in its own language.

export const PASSWORD_MIN_LENGTH = 10;

export type PasswordProblem = 'too_short' | 'same_as_identifier';

export function checkNewPassword(
  password: string,
  identifiers: { email?: string | null; phone?: string | null } = {}
): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'too_short';
  const lowered = password.trim().toLowerCase();
  for (const id of [identifiers.email, identifiers.phone]) {
    if (id && lowered === id.trim().toLowerCase()) return 'same_as_identifier';
  }
  return null;
}
