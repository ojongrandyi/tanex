import React, { useState } from 'react';
import { Lock, User, ShieldCheck, ArrowRight, AlertCircle, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { AUTH_TEXT } from '../auth/strings';
import { ADMIN_CONSOLE_NAME, LOGO_ALT, LOGO_HEIGHT, LOGO_WHITE, LOGO_WIDTH } from '../config/brand';
import './AdminLogin.css';

interface AdminLoginProps {
  onNavigatePublic: (page: string) => void;
}

/** Shared frame for every console screen shown before the console itself (logo + white card). */
export const AuthCard: React.FC<{ icon?: React.ReactNode; title: string; intro: string; children: React.ReactNode }> = ({
  icon,
  title,
  intro,
  children
}) => (
  <div className="admin-login-shell">
    <img src={LOGO_WHITE} alt={LOGO_ALT} className="admin-login-logo" width={LOGO_WIDTH} height={LOGO_HEIGHT} />
    <div className="admin-login-card">
      <div className="admin-login-badge" aria-hidden="true">
        {icon ?? <ShieldCheck size={22} />}
      </div>
      <h1 className="admin-login-title">{title}</h1>
      <p className="admin-login-sub">{intro}</p>
      {children}
    </div>
  </div>
);

export const AuthError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="admin-login-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      <span>{message}</span>
    </div>
  ) : null;

const T = AUTH_TEXT.login;

export const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigatePublic }) => {
  const { refresh, passwordReset } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'forgot'>('sign-in');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.login(identifier, password);
      // The console (and its data) loads for whoever the session now says is signed in.
      const user = await refresh();
      if (!user) {
        setError(T.failed);
        setSubmitting(false);
      }
    } catch (err: any) {
      // CONTENT §10.1: one message for every wrong-details case (including a locked account).
      const status = err?.status;
      setError(status === 401 ? T.failed : status === 429 ? T.tooMany : err?.message || T.failed);
      setSubmitting(false);
    }
  };

  if (mode === 'forgot') {
    return <ForgotPassword onBack={() => setMode('sign-in')} />;
  }

  return (
    <AuthCard title={ADMIN_CONSOLE_NAME} intro={T.subtitle}>
      <form onSubmit={handleSubmit} className="admin-login-form">
        <div className="admin-login-field">
          <User size={15} className="admin-login-field-icon" aria-hidden="true" />
          <input
            type="text"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
            placeholder={T.identifier}
            aria-label={T.identifier}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div className="admin-login-field">
          <Lock size={15} className="admin-login-field-icon" aria-hidden="true" />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder={T.password}
            aria-label={T.password}
            autoComplete="current-password"
          />
        </div>

        <AuthError message={error} />

        <button type="submit" className="admin-login-submit" disabled={submitting || !identifier.trim() || !password}>
          {submitting ? T.busy : T.submit}
          {!submitting && <ArrowRight size={15} aria-hidden="true" />}
        </button>
      </form>

      {/* Only when the server can email a reset link (IAM_RBAC_SPEC §9). */}
      {passwordReset && (
        <button type="button" className="tx-auth-link" onClick={() => { setError(null); setMode('forgot'); }}>
          {T.forgot}
        </button>
      )}

      <button type="button" className="admin-login-exit" onClick={() => onNavigatePublic('home')}>
        {T.backToSite}
      </button>
    </AuthCard>
  );
};

const F = AUTH_TEXT.forgot;

const ForgotPassword: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err?.status === 429 ? T.tooMany : err?.message || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard icon={<Mail size={22} />} title={F.title} intro={F.intro}>
      {sent ? (
        <div className="tx-auth-success" role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{F.done}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-field">
            <Mail size={15} className="admin-login-field-icon" aria-hidden="true" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder={F.email}
              aria-label={F.email}
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <AuthError message={error} />
          <button type="submit" className="admin-login-submit" disabled={submitting || !email.trim()}>
            {submitting ? F.busy : F.submit}
          </button>
        </form>
      )}
      <button type="button" className="tx-auth-link" onClick={onBack}>
        {F.back}
      </button>
    </AuthCard>
  );
};
