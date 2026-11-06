// Password hashing and policy for staff accounts (docs/IAM_RBAC_SPEC.md §5.5). Never logs
// passwords or hashes.
import bcrypt from 'bcryptjs';
import { checkNewPassword, PASSWORD_MIN_LENGTH, type PasswordProblem } from '../../src/shared/passwordPolicy.js';
import { BCRYPT_COST } from './bootstrap.js';

export { checkNewPassword, PASSWORD_MIN_LENGTH, BCRYPT_COST };
export type { PasswordProblem };

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when the identifier matches no usable account, so an unknown identifier
// takes about as long to reject as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('tanex-no-such-account', BCRYPT_COST);

export async function spendComparableTime(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

/** Policy messages for the API (the console shows its own translated text from B.4). */
export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  too_short: `The new password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  same_as_identifier: 'The new password cannot be your email address or phone number.'
};
