import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { navigate, useRoute } from '../router/navigation';
import { buildPath } from '../router/routes';
import { isPlainClick } from '../router/Link';
import { useLocale } from '../i18n/I18nProvider';
import { loadLocale, messagesFor, storeLocale, storedLocale, translate } from '../i18n/runtime';
import type { Dict } from '../i18n/types';
import './LanguageSuggestion.css';

// French suggestion banner (I18N_SPEC §3): on the English home page, a browser set to French gets
// a small, dismissible offer of the French site, written in French. No automatic redirect.
// Shown while no choice is stored in tx_locale (or the stored choice is French); "Close" stores
// English, the link stores French.

function prefersFrench(): boolean {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return (langs[0] || '').toLowerCase().startsWith('fr');
}

export const LanguageSuggestion: React.FC = () => {
  const route = useRoute();
  const locale = useLocale();
  const [eligible, setEligible] = useState(false);
  const [ready, setReady] = useState(false);
  const onEnglishHome = route?.id === 'home' && route.lang === 'en' && locale === 'en';

  useEffect(() => {
    if (!onEnglishHome) {
      setEligible(false);
      return;
    }
    const stored = storedLocale();
    if (stored === 'en' || !prefersFrench()) return;
    setEligible(true);
    // The banner is in French, and the French site is the likely next page: fetch it now.
    loadLocale('fr').then(() => setReady(true), () => {});
  }, [onEnglishHome]);

  const fr = messagesFor('fr');
  if (!eligible || !ready || !fr) return null;
  const t = (key: string) => translate(fr.common as Dict, key, 'fr');
  const href = buildPath('home', undefined, 'fr');

  return (
    <div className="tx-langsuggest" lang="fr" role="region" aria-label={t('language.label')}>
      <div className="tx-langsuggest__inner">
        <p className="tx-langsuggest__text">{t('suggest.text')}</p>
        <a
          className="tx-langsuggest__action"
          href={href}
          hrefLang="fr"
          onClick={(e) => {
            storeLocale('fr');
            if (!isPlainClick(e)) return;
            e.preventDefault();
            setEligible(false);
            navigate(href);
          }}
        >
          {t('suggest.action')}
        </a>
        <button
          type="button"
          className="tx-langsuggest__close"
          aria-label={t('suggest.dismiss')}
          title={t('suggest.dismiss')}
          onClick={() => {
            storeLocale('en');
            setEligible(false);
          }}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
