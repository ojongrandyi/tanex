// Wraps the console path (sign-in, forced password change, console, courier app): picks the
// language (the user's account language, or the sign-in card's choice before sign-in), loads it,
// and remounts the subtree when it changes so every screen re-reads its text (consoleText.ts).
import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import {
  isConsoleLangReady,
  loadConsoleLang,
  setConsoleLang,
  storeConsoleLang,
  storedConsoleLang,
  subscribeConsoleLang,
  type ConsoleLang,
} from './consoleText';

interface ConsoleLangValue {
  lang: ConsoleLang;
  /** The sign-in card's switch (before sign-in only; afterwards My account decides). */
  chooseSignInLang: (lang: ConsoleLang) => void;
}

const ConsoleLangContext = createContext<ConsoleLangValue>({ lang: 'en', chooseSignInLang: () => {} });

export function useConsoleLang(): ConsoleLangValue {
  return useContext(ConsoleLangContext);
}

export const ConsoleLanguage: React.FC<{
  userLocale: string | null | undefined;
  fallback: React.ReactNode;
  children: React.ReactNode;
}> = ({ userLocale, fallback, children }) => {
  const [signInLang, setSignInLang] = useState<ConsoleLang>(storedConsoleLang);
  const wanted: ConsoleLang = userLocale ? (userLocale === 'fr' ? 'fr' : 'en') : signInLang;
  const ready = useSyncExternalStore(subscribeConsoleLang, () => isConsoleLangReady(wanted), () => true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready) return;
    setFailed(false);
    loadConsoleLang(wanted).catch((err) => {
      console.warn('[console i18n] could not load', wanted, err);
      setFailed(true);
    });
  }, [ready, wanted]);

  // If French can't be fetched (offline), the console still works, in English.
  const lang: ConsoleLang = ready ? wanted : 'en';
  setConsoleLang(lang); // idempotent; must happen before the children render

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const chooseSignInLang = useCallback((l: ConsoleLang) => {
    storeConsoleLang(l);
    setSignInLang(l);
  }, []);

  if (!ready && !failed) return <>{fallback}</>;
  return (
    <ConsoleLangContext.Provider value={{ lang, chooseSignInLang }}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </ConsoleLangContext.Provider>
  );
};
