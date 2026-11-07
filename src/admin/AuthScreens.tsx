// Screens a signed-in user sees instead of the console (docs/IAM_RBAC_SPEC.md §5.5, §9):
// the forced password change, the courier placeholder (courier app: tracker G.4) and the
// "no access yet" screen for an account without permissions.
import React, { useState } from 'react';
import { KeyRound, Bike, Lock, LogOut } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { AUTH_TEXT, passwordErrorText } from '../auth/strings';
import { checkNewPassword } from '../shared/passwordPolicy';
import { AuthCard, AuthError } from './AdminLogin';
import './AdminLogin.css';

const SignOutButton: React.FC = () => {
  const { logout } = useAuth();
  return (
    <button type="button" className="tx-auth-link" onClick={() => { logout(); }}>
      <LogOut size={13} aria-hidden="true" />
      <span>{AUTH_TEXT.signOut}</span>
    </button>
  );
};

/** The local password checks, in the §10.1 wording; null when the new password may be sent. */
export function newPasswordProblem(
  next: string,
  confirm: string,
  identifiers: { email?: string | null; phone?: string | null }
): string | null {
  const problem = checkNewPassword(next, identifiers);
  if (problem === 'too_short') return AUTH_TEXT.password.tooShort;
  if (problem === 'same_as_identifier') return AUTH_TEXT.password.sameAsIdentifier;
  if (next !== confirm) return AUTH_TEXT.password.mismatch;
  return null;
}

const F = AUTH_TEXT.forced;

export const ForcedPasswordChange: React.FC = () => {
  const { user, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const problem = newPasswordProblem(next, confirm, { email: user?.email, phone: user?.phone });
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      // must-change is now cleared on the server; reading the session again opens the console.
      await refresh();
    } catch (err) {
      setError(passwordErrorText(err));
      setSubmitting(false);
    }
  };

  const field = (value: string, set: (v: string) => void, label: string, autoComplete: string, autoFocus = false) => (
    <div className="admin-login-field">
      <Lock size={15} className="admin-login-field-icon" aria-hidden="true" />
      <input
        type="password"
        value={value}
        onChange={(e) => { set(e.target.value); setError(null); }}
        placeholder={label}
        aria-label={label}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
    </div>
  );

  return (
    <AuthCard icon={<KeyRound size={22} />} title={F.title} intro={F.intro}>
      <form onSubmit={handleSubmit} className="admin-login-form">
        {/* Hidden username so password managers save the new password against the right account. */}
        <input type="text" name="username" autoComplete="username" value={user?.email || user?.phone || ''} readOnly hidden />
        {field(current, setCurrent, F.current, 'current-password', true)}
        {field(next, setNext, F.next, 'new-password')}
        {field(confirm, setConfirm, F.confirm, 'new-password')}
        <p className="tx-auth-hint">{F.hint}</p>
        <AuthError message={error} />
        <button type="submit" className="admin-login-submit" disabled={submitting || !current || !next || !confirm}>
          {submitting ? F.busy : F.submit}
        </button>
      </form>
      <SignOutButton />
    </AuthCard>
  );
};

/** Courier-only accounts until the courier app ships (tracker G.4). */
export const CourierComingSoon: React.FC = () => (
  <AuthCard icon={<Bike size={22} />} title={AUTH_TEXT.courier.title} intro={AUTH_TEXT.courier.body}>
    <SignOutButton />
  </AuthCard>
);

/** Signed in, but no role grants anything yet. */
export const NoAccess: React.FC = () => (
  <AuthCard title={AUTH_TEXT.noAccess.title} intro={AUTH_TEXT.noAccess.body}>
    <SignOutButton />
  </AuthCard>
);
