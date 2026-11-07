// Console sign-in and account copy (docs/CONTENT.md §10.1). English only until the i18n
// foundation (tracker D.3) moves these into src/i18n/en.ts and fr.ts; kept in one object so
// that move is a straight copy.
export const AUTH_TEXT = {
  login: {
    subtitle: 'Sign in with your work email or phone number.',
    identifier: 'Email or phone',
    password: 'Password',
    submit: 'Sign in',
    busy: 'Signing in…',
    failed: 'Incorrect sign-in details. Please try again.',
    tooMany: 'Too many login attempts. Try again in a few minutes.',
    forgot: 'Forgot password?',
    backToSite: '← Back to public site'
  },
  forgot: {
    title: 'Reset your password',
    intro: "Enter your work email. If it matches an account, we'll send a reset link.",
    email: 'Work email',
    submit: 'Send reset link',
    busy: 'Sending…',
    done: 'If that email has an account, a reset link is on its way.',
    back: 'Back to sign in'
  },
  forced: {
    title: 'Choose a new password',
    intro: 'For your security, set your own password before you continue.',
    current: 'Temporary password',
    next: 'New password',
    confirm: 'Confirm new password',
    hint: 'At least 10 characters.',
    submit: 'Save and continue',
    busy: 'Saving…'
  },
  password: {
    mismatch: "The passwords don't match.",
    wrongCurrent: 'The current password is incorrect.',
    tooShort: 'At least 10 characters.',
    sameAsIdentifier: "The new password can't be your email address or phone number."
  },
  account: {
    menu: 'My account',
    title: 'My account',
    signedInAs: (who: string) => `Signed in as ${who}`,
    roles: 'Roles',
    name: 'Name',
    language: 'Language',
    languages: { en: 'English', fr: 'Français' },
    languageHint: 'Used for the console and the emails we send you.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved.',
    changePassword: 'Change password',
    current: 'Current password',
    next: 'New password',
    confirm: 'Confirm new password',
    passwordChanged: 'Password changed. Your other devices have been signed out.'
  },
  courier: {
    title: 'Courier app coming soon',
    body: 'Your account is set up. The courier app will open here as soon as it is ready.'
  },
  noAccess: {
    title: 'No access yet',
    body: 'Your account has no permissions yet. Ask an administrator to give you a role.'
  },
  signOut: 'Sign out'
} as const;

/** Maps a change-password error from the server to the §10.1 wording. */
export function passwordErrorText(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  switch (e?.code) {
    case 'WRONG_PASSWORD': return AUTH_TEXT.password.wrongCurrent;
    case 'TOO_SHORT': return AUTH_TEXT.password.tooShort;
    case 'SAME_AS_IDENTIFIER': return AUTH_TEXT.password.sameAsIdentifier;
    default: return e?.message || AUTH_TEXT.password.wrongCurrent;
  }
}
