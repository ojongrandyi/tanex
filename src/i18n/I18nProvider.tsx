// I18nProvider, useT, useLocale, useAreaT (I18N_SPEC §5). The address decides the language
// (I18N_SPEC §3): /fr/… is French, everything else English. The console stays English until
// phase I. While French is still loading (a back/forward step onto a /fr/ page), English shows.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { isAdminPathname } from '../config/brand';
import { currentLang, useRoute } from '../router/navigation';
import { loadLocale, messagesFor, readArea, subscribeMessages, translate } from './runtime';
import { isPublicErrorCode } from '../shared/apiErrors';
import type { AreaMessages, AreaName, Messages } from './en';
import type { Dict, KeyPath, Locale, Vars } from './types';

interface I18nValue {
  locale: Locale;
  messages: Dict;
}

const I18nContext = createContext<I18nValue>({ locale: 'en', messages: messagesFor('en')!.common as Dict });

function requestedLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  if (isAdminPathname(window.location.pathname)) return 'en';
  return currentLang();
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useRoute(); // re-render on every navigation
  const requested = requestedLocale();
  const ready = useSyncExternalStore(subscribeMessages, () => Boolean(messagesFor(requested)), () => true);

  useEffect(() => {
    if (!ready) loadLocale(requested).catch((err) => console.warn('[i18n] could not load', requested, err));
  }, [ready, requested]);

  const locale: Locale = ready ? requested : 'en';
  const value = useMemo<I18nValue>(() => ({ locale, messages: messagesFor(locale)!.common as Dict }), [locale]);

  // <html lang> follows what is shown (the server already sends it for the first page).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export type CommonKey = KeyPath<Messages['common']>;
export type TFunction<K extends string = CommonKey> = (key: K, vars?: Vars) => string;

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/** t('header.track'), t('footer.copyright', { year, legalName }); keys are checked by TypeScript. */
export function useT(): TFunction {
  const { locale, messages } = useContext(I18nContext);
  return useCallback((key: CommonKey, vars?: Vars) => translate(messages, key, locale, vars), [locale, messages]);
}

/** t() for a page area, loaded with the page (suspends until its dictionary is in). */
export function useAreaT<A extends AreaName>(area: A): TFunction<KeyPath<AreaMessages[A]>> {
  const locale = useLocale();
  const dict = readArea(area, locale) as unknown as Dict;
  return useCallback((key: KeyPath<AreaMessages[A]>, vars?: Vars) => translate(dict, key, locale, vars), [dict, locale]);
}

/** Text for an API error: the code's text in the page language, else the server's English. */
export function useApiErrorText(): (err: unknown, fallback?: string) => string {
  const t = useT();
  const locale = useLocale();
  return useCallback((err: unknown, fallback?: string) => {
    const e = err as { code?: unknown; message?: unknown; unreachable?: boolean } | null;
    const code = e?.unreachable ? 'NETWORK' : typeof e?.code === 'string' ? e.code : '';
    const message = typeof e?.message === 'string' ? e.message : '';
    // English pages keep the server's own, more specific English message.
    if (locale === 'en' && message) return message;
    if (isPublicErrorCode(code)) return t(`errors.${code}`);
    return locale === 'en' && fallback ? fallback : t('errors.SERVER_ERROR');
  }, [t, locale]);
}
