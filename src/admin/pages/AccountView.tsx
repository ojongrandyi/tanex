// My account (docs/IAM_RBAC_SPEC.md §9): the signed-in user's name, language and password,
// where you are signed in, and sign out. Avatar, job title and bio (the blog author profile)
// are added with the blog phase (tracker F.1).
import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, LogOut, UserCircle, KeyRound } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { AUTH_TEXT, passwordErrorText } from '../../auth/strings';
import { newPasswordProblem } from '../AuthScreens';
import { MySessions } from '../components/MySessions';
import './AccountView.css';

const T = AUTH_TEXT.account;
type Locale = 'en' | 'fr';

const Notice: React.FC<{ kind: 'ok' | 'error'; text: string }> = ({ kind, text }) => (
  <div className={`tx-account-notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    {kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
    <span>{text}</span>
  </div>
);

export const AccountView: React.FC = () => {
  const { user, setUser, logout } = useAuth();

  const [name, setName] = useState(user?.displayName ?? '');
  const [locale, setLocale] = useState<Locale>(user?.locale === 'fr' ? 'fr' : 'en');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!user) return null;

  const profileChanged = name.trim() !== user.displayName || locale !== user.locale;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileChanged || !name.trim() || profileBusy) return;
    setProfileBusy(true);
    setProfileNotice(null);
    try {
      const updated = await api.updateMyAccount({ displayName: name.trim(), locale });
      if (updated) {
        setUser(updated);
        setName(updated.displayName);
      }
      setProfileNotice({ kind: 'ok', text: T.saved });
    } catch (err: any) {
      setProfileNotice({ kind: 'error', text: err?.message || 'Could not save.' });
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    const problem = newPasswordProblem(next, confirm, { email: user.email, phone: user.phone });
    if (problem) {
      setPwNotice({ kind: 'error', text: problem });
      return;
    }
    setPwBusy(true);
    setPwNotice(null);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setPwNotice({ kind: 'ok', text: T.passwordChanged });
    } catch (err) {
      setPwNotice({ kind: 'error', text: passwordErrorText(err) });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="tx-account animate-fade-in">
      <section className="tx-account-card" aria-labelledby="tx-account-profile">
        <header className="tx-account-card-head">
          <UserCircle size={18} aria-hidden="true" />
          <h2 id="tx-account-profile">{T.title}</h2>
        </header>
        <p className="tx-account-meta">{T.signedInAs(user.email || user.phone || '')}</p>
        <p className="tx-account-meta">
          <span className="tx-account-meta-label">{T.roles}:</span>{' '}
          {user.roles.length ? user.roles.map((r) => r.name).join(', ') : '–'}
        </p>

        <form onSubmit={saveProfile} className="tx-account-form">
          <label className="tx-account-field">
            <span>{T.name}</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(e) => { setName(e.target.value); setProfileNotice(null); }}
            />
          </label>
          <label className="tx-account-field">
            <span>{T.language}</span>
            <select value={locale} onChange={(e) => { setLocale(e.target.value as Locale); setProfileNotice(null); }}>
              <option value="en">{T.languages.en}</option>
              <option value="fr">{T.languages.fr}</option>
            </select>
            <small>{T.languageHint}</small>
          </label>
          {profileNotice && <Notice {...profileNotice} />}
          <div className="tx-account-actions">
            <button type="submit" className="tx-account-btn primary" disabled={!profileChanged || !name.trim() || profileBusy}>
              {profileBusy ? T.saving : T.save}
            </button>
          </div>
        </form>
      </section>

      <section className="tx-account-card" aria-labelledby="tx-account-password">
        <header className="tx-account-card-head">
          <KeyRound size={18} aria-hidden="true" />
          <h2 id="tx-account-password">{T.changePassword}</h2>
        </header>
        <form onSubmit={savePassword} className="tx-account-form">
          <input type="text" name="username" autoComplete="username" value={user.email || user.phone || ''} readOnly hidden />
          <label className="tx-account-field">
            <span>{T.current}</span>
            <input type="password" value={current} autoComplete="current-password"
              onChange={(e) => { setCurrent(e.target.value); setPwNotice(null); }} />
          </label>
          <label className="tx-account-field">
            <span>{T.next}</span>
            <input type="password" value={next} autoComplete="new-password"
              onChange={(e) => { setNext(e.target.value); setPwNotice(null); }} />
            <small>{AUTH_TEXT.forced.hint}</small>
          </label>
          <label className="tx-account-field">
            <span>{T.confirm}</span>
            <input type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => { setConfirm(e.target.value); setPwNotice(null); }} />
          </label>
          {pwNotice && <Notice {...pwNotice} />}
          <div className="tx-account-actions">
            <button type="submit" className="tx-account-btn primary" disabled={pwBusy || !current || !next || !confirm}>
              {pwBusy ? T.saving : T.changePassword}
            </button>
          </div>
        </form>
      </section>

      <MySessions />

      <div className="tx-account-signout">
        <button type="button" className="tx-account-btn" onClick={() => { logout(); }}>
          <LogOut size={15} aria-hidden="true" />
          <span>{AUTH_TEXT.signOut}</span>
        </button>
      </div>
    </div>
  );
};
