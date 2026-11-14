// Profile (DISPATCH_SPEC §6 screen 5): vehicle and public name, language, photo consent (the courier
// can withdraw it; staff record it, tracker #161), password change, install and sign out.
import React, { useEffect, useState } from 'react';
import { Download, LogOut } from 'lucide-react';
import { api } from '../services/api';
import { PASSWORD_MIN_LENGTH } from '../shared/passwordPolicy';
import { useCourierText, type CourierLang } from './context';
import type { CourierProfile } from './courierApi';
import { canInstall, onInstallChange, promptInstall } from './pwa';
import { errorText } from './ui';

export const ProfileScreen: React.FC<{
  profile: CourierProfile | null;
  displayName: string;
  onLanguage: (lang: CourierLang) => Promise<void>;
  onWithdrawConsent: () => Promise<void>;
  onSignOut: () => void;
}> = ({ profile, displayName, onLanguage, onWithdrawConsent, onSignOut }) => {
  const { t, lang } = useCourierText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installable, setInstallable] = useState(canInstall);
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const e = err as { code?: string; unreachable?: boolean; message?: string };
      setError(errorText(t, e.unreachable ? 'NETWORK' : e.code, undefined, e.message, lang));
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < PASSWORD_MIN_LENGTH) return setPwMsg({ ok: false, text: t('profile.passwordShort', { n: PASSWORD_MIN_LENGTH }) });
    if (next !== repeat) return setPwMsg({ ok: false, text: t('profile.passwordMismatch') });
    setPwBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent(''); setNext(''); setRepeat('');
      setPwMsg({ ok: true, text: t('profile.passwordSaved') });
    } catch (err) {
      const x = err as { code?: string; unreachable?: boolean; message?: string };
      const text = x.code === 'TOO_SHORT' ? t('profile.passwordShort', { n: PASSWORD_MIN_LENGTH })
        : errorText(t, x.unreachable ? 'NETWORK' : x.code, undefined, x.message, lang);
      setPwMsg({ ok: false, text });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <section className="tx-cr-screen" aria-labelledby="cr-profile">
      <h1 id="cr-profile" className="tx-cr-h1">{t('profile.title')}</h1>
      <div className="tx-cr-panel">
        <p className="tx-cr-profile-name">{displayName}</p>
        {profile && (
          <dl className="tx-cr-dl">
            <div><dt>{t('profile.publicName')}</dt><dd>{profile.publicFirstName}</dd></div>
            <div><dt>{t('profile.vehicle')}</dt><dd>{t(`vehicles.${profile.vehicleType}`)}</dd></div>
            {profile.plateNumber && <div><dt>{t('profile.plate')}</dt><dd>{profile.plateNumber}</dd></div>}
            {profile.homeCityName && <div><dt>{t('profile.city')}</dt><dd>{profile.homeCityName}</dd></div>}
          </dl>
        )}
      </div>

      <fieldset className="tx-cr-panel">
        <legend className="tx-cr-h2">{t('profile.language')}</legend>
        <div className="tx-cr-segment">
          {(['en', 'fr'] as const).map((l) => (
            <label key={l} className={`tx-cr-segment__opt${lang === l ? ' is-on' : ''}`} lang={l}>
              <input type="radio" name="cr-lang" checked={lang === l} disabled={busy} onChange={() => run(() => onLanguage(l))} />
              {l === 'en' ? t('profile.english') : t('profile.french')}
            </label>
          ))}
        </div>
      </fieldset>

      {profile && (
        <div className="tx-cr-panel">
          <h2 className="tx-cr-h2">{t('profile.photo')}</h2>
          {profile.photoUrl ? (
            <div className="tx-cr-photo-row">
              <img src={profile.photoUrl} alt={profile.publicFirstName} width={72} height={72} className="tx-cr-avatar" loading="lazy" />
              <p>{profile.showPhotoPublicly ? t('profile.photoShown') : t('profile.photoHidden')}</p>
            </div>
          ) : <p className="tx-cr-muted">{t('profile.noPhoto')}</p>}
          {profile.showPhotoPublicly && (
            <button
              type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--block" disabled={busy}
              onClick={() => { if (window.confirm(t('profile.withdrawConfirm'))) run(onWithdrawConsent); }}
            >{t('profile.withdraw')}</button>
          )}
        </div>
      )}
      {error && <p className="tx-cr-error" role="alert">{error}</p>}

      <form className="tx-cr-panel tx-cr-form" onSubmit={changePassword} noValidate>
        <h2 className="tx-cr-h2">{t('profile.password')}</h2>
        <label className="tx-cr-field" htmlFor="pw-current">
          <span>{t('profile.currentPassword')}</span>
          <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="tx-cr-field" htmlFor="pw-new">
          <span>{t('profile.newPassword')}</span>
          <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <small>{t('profile.passwordHint', { n: PASSWORD_MIN_LENGTH })}</small>
        </label>
        <label className="tx-cr-field" htmlFor="pw-repeat">
          <span>{t('profile.confirmPassword')}</span>
          <input id="pw-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {pwMsg && <p className={pwMsg.ok ? 'tx-cr-ok' : 'tx-cr-error'} role={pwMsg.ok ? 'status' : 'alert'}>{pwMsg.text}</p>}
        <button type="submit" className="tx-cr-btn tx-cr-btn--secondary tx-cr-btn--block" disabled={pwBusy || !current || !next}>{t('profile.password')}</button>
      </form>

      {installable && (
        <div className="tx-cr-panel">
          <p className="tx-cr-muted">{t('profile.installHint')}</p>
          <button type="button" className="tx-cr-btn tx-cr-btn--secondary tx-cr-btn--block" onClick={() => promptInstall()}>
            <Download size={20} aria-hidden="true" /> {t('profile.install')}
          </button>
        </div>
      )}

      <button type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--block tx-cr-btn--large" onClick={onSignOut}>
        <LogOut size={20} aria-hidden="true" /> {t('app.signOut')}
      </button>
    </section>
  );
};
