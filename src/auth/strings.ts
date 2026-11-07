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
  // Opened from the emailed reset link (B.6, owner to confirm).
  reset: {
    title: 'Set a new password',
    intro: 'Choose a new password for your TanEx account.',
    next: 'New password',
    confirm: 'Confirm new password',
    hint: 'At least 10 characters.',
    submit: 'Save new password',
    busy: 'Saving…',
    done: 'Your password has been changed. Sign in with your new password.',
    signIn: 'Sign in',
    invalid: 'This reset link is invalid or has expired. Ask for a new one.',
    askAgain: 'Ask for a new link'
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
    passwordChanged: 'Password changed. Your other devices have been signed out.',
    sessions: {
      title: 'Where you are signed in',
      thisDevice: 'This device',
      lastActive: (when: string) => `Last active ${when}`,
      signedIn: (when: string) => `Signed in ${when}`,
      unknownDevice: 'Unknown device',
      on: 'on',
      signOutOthers: 'Sign out other devices',
      confirmSignOutOthers: 'Sign out on every other device? This device stays signed in.',
      signedOut: (n: number) => `Signed out on ${n} other device${n === 1 ? '' : 's'}.`,
      none: 'You are only signed in on this device.',
      loading: 'Loading…'
    }
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
    case 'INVALID_TOKEN': return AUTH_TEXT.reset.invalid;
    case 'WRONG_PASSWORD': return AUTH_TEXT.password.wrongCurrent;
    case 'TOO_SHORT': return AUTH_TEXT.password.tooShort;
    case 'SAME_AS_IDENTIFIER': return AUTH_TEXT.password.sameAsIdentifier;
    default: return e?.message || AUTH_TEXT.password.wrongCurrent;
  }
}

// Users, Roles and Audit log screens (CONTENT §10.1; B.5 additions marked owner to confirm).
// English only until D.3, like AUTH_TEXT above.
export const IAM_TEXT = {
  users: {
    title: 'Users',
    add: 'Add user',
    edit: 'Edit user',
    columns: { name: 'Name', contact: 'Email / phone', roles: 'Roles', status: 'Status', lastSignIn: 'Last sign-in', actions: 'Actions' },
    status: { ACTIVE: 'Active', DISABLED: 'Disabled' },
    locked: 'Locked',
    firstSignInPending: 'Password change pending',
    never: 'Never',
    noRoles: 'No role',
    you: 'You',
    actions: {
      edit: 'Edit',
      resetPassword: 'Reset password',
      disable: 'Disable',
      enable: 'Enable',
      signOutEverywhere: 'Sign out everywhere'
    },
    fields: {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      language: 'Language',
      roles: 'Roles'
    },
    contactHint: 'Enter an email address, a phone number or both. Phone numbers without a country code are read as Cameroonian.',
    roleNotGrantable: "You can't give this role: it has permissions you don't hold.",
    create: 'Create user',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    close: 'Close',
    empty: 'No accounts yet.',
    loading: 'Loading…',
    search: 'Search by name, email or phone',
    confirmDisable: (name: string) => `Disable ${name}? They are signed out at once and can't sign in until enabled again.`,
    confirmReset: (name: string) => `Give ${name} a new temporary password? Their current password stops working and they are signed out.`,
    confirmSignOut: (name: string) => `Sign ${name} out on every device?`,
    signedOut: (n: number) => `Signed out of ${n} session${n === 1 ? '' : 's'}.`,
    saved: 'Saved.'
  },
  temp: {
    title: 'Temporary password',
    intro: "Shown once. Share it securely; they'll choose their own at first sign-in.",
    signInWith: 'Signs in with',
    copy: 'Copy',
    copied: 'Copied',
    whatsapp: 'Send on WhatsApp',
    whatsappHint: 'Opens WhatsApp with the message ready. You still tap Send.',
    whatsappNoPhone: 'Add a valid phone number to this account to send it on WhatsApp.',
    done: 'Done'
  },
  roles: {
    title: 'Roles',
    add: 'New role',
    name: 'Name',
    description: 'Description',
    permissions: 'Permissions',
    usersWithRole: (n: number) => `Users with this role: ${n}`,
    system: 'System role',
    locked: "The Super Admin role can't be changed.",
    allPermissions: 'Every permission, including users, roles and settings.',
    notGrantable: "You can't change this permission because you don't hold it.",
    save: 'Save',
    saving: 'Saving…',
    create: 'Create role',
    cancel: 'Cancel',
    delete: 'Delete role',
    confirmDelete: (name: string) => `Delete the role ${name}?`,
    saved: 'Saved.',
    selectPrompt: 'Choose a role to see its permissions.',
    loading: 'Loading…'
  },
  audit: {
    title: 'Audit log',
    filters: { person: 'Person', action: 'Action', record: 'Record', recordId: 'Record ID', date: 'Date', from: 'From', to: 'To' },
    all: { person: 'Everyone', action: 'All actions', record: 'All records' },
    clear: 'Clear filters',
    columns: { when: 'When', person: 'Person', action: 'Action', record: 'Record', summary: 'Summary' },
    before: 'Before',
    after: 'After',
    ip: 'IP address',
    noDetail: 'No field changes recorded for this entry.',
    notSignedIn: 'Not signed in',
    empty: 'No entries match these filters.',
    entries: (n: number) => `${n} entr${n === 1 ? 'y' : 'ies'}`,
    page: (p: number, n: number) => `Page ${p} of ${n}`,
    previous: 'Previous',
    next: 'Next',
    loading: 'Loading…',
    showDetail: 'Show details',
    hideDetail: 'Hide details'
  },
  errors: {
    CANNOT_GRANT: "You can't give permissions you don't hold.",
    CANNOT_MANAGE_USER: "You can't change an account that has permissions you don't hold.",
    LAST_SUPER_ADMIN: 'This is the last active Super Admin. Give the role to someone else first.',
    SELF_DISABLE: "You can't disable your own account.",
    SELF_RESET: 'Use My account to change your own password.',
    EMAIL_TAKEN: 'Another account already uses this email address.',
    PHONE_TAKEN: 'Another account already uses this phone number.',
    IDENTIFIER_REQUIRED: 'Enter an email address or a phone number.',
    INVALID_EMAIL: 'Enter a valid email address.',
    INVALID_PHONE: 'Enter a valid phone number.',
    INVALID_NAME: 'Enter a name.',
    NAME_TAKEN: 'A role with this name already exists.',
    ROLE_LOCKED: "The Super Admin role can't be changed.",
    ROLE_SYSTEM: "System roles can't be deleted. You can rename them or change their permissions.",
    ROLE_IN_USE: 'Some accounts have this role. Remove it from them first.'
  } as Record<string, string>
} as const;

/** The §10.1 wording for an error from the users/roles API, else the server's own message. */
export function iamErrorText(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  return (e?.code && IAM_TEXT.errors[e.code]) || e?.message || 'Something went wrong. Please try again.';
}

// Settings → Email (NOTIFICATIONS_SPEC §3; B.6 additions, owner to confirm). English only until D.3.
export const MAIL_TEXT = {
  tab: 'Email',
  title: 'Email',
  intro: 'Emails to customers and staff go out from the company mailbox. They wait in a queue and are tried again if sending fails.',
  on: 'Email is on',
  off: 'Email is off',
  offHint: 'Add the mail settings (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM) to the server and restart the app. Until then no emails are sent and "Forgot password?" is hidden.',
  fields: { server: 'Server', sender: 'Sender', replyTo: 'Reply-to', account: 'Signs in as' },
  summary: { queued: 'Waiting to send', failed: 'Failed', sent24h: 'Sent in the last 24 hours', lastSent: 'Last sent' },
  never: 'Never',
  test: {
    title: 'Send a test email',
    to: 'Send to',
    submit: 'Send test email',
    busy: 'Sending…',
    sent: (to: string) => `Test email sent to ${to}.`,
    failed: (error: string) => `The test email could not be sent: ${error}. It will be tried again automatically.`
  },
  failedList: {
    title: 'Failed emails',
    empty: 'No failed emails.',
    retry: 'Try again',
    retried: 'Queued again.',
    notRetryable: "Password reset emails can't be sent again. Ask for a new link instead."
  },
  recent: { title: 'Recent emails', empty: 'No emails yet.' },
  columns: { to: 'To', subject: 'Subject', status: 'Status', attempts: 'Attempts', error: 'Last error', created: 'Queued' },
  status: { QUEUED: 'Waiting', SENDING: 'Sending', SENT: 'Sent', FAILED: 'Failed' } as Record<string, string>,
  refresh: 'Refresh',
  loading: 'Loading…',
  manageOnly: 'Sending a test email needs the permission to manage settings.'
};
