// Language and formatting for the courier app. The app speaks the courier's own language (their
// account locale, changed on Profile), not the address: the console path is otherwise English.
import { createContext, useCallback, useContext, useMemo } from 'react';
import { readArea, translate } from '../i18n/runtime';
import { formatDateTime, formatMoney, formatTime, formatDate } from '../i18n/format';
import type { CourierMessages } from '../i18n/en/courier';
import type { Dict, KeyPath, Vars } from '../i18n/types';

export type CourierLang = 'en' | 'fr';
export type CourierKey = KeyPath<CourierMessages>;
export type CourierT = (key: CourierKey, vars?: Vars) => string;

export interface CourierText {
  lang: CourierLang;
  t: CourierT;
  money: (amount: number, currency: string) => string;
  dateTime: (ts: number) => string;
  time: (ts: number) => string;
  date: (ts: number) => string;
}

/** Suspends until the courier dictionary of the language is loaded. */
export function useCourierTextValue(lang: CourierLang): CourierText {
  const dict = readArea('courier', lang) as unknown as Dict;
  const t = useCallback<CourierT>((key, vars) => translate(dict, key, lang, vars), [dict, lang]);
  return useMemo(() => ({
    lang,
    t,
    money: (amount, currency) => formatMoney(amount, currency, lang),
    dateTime: (ts) => formatDateTime(ts, lang),
    time: (ts) => formatTime(ts, lang),
    date: (ts) => formatDate(ts, lang),
  }), [lang, t]);
}

export const CourierTextContext = createContext<CourierText | null>(null);

export function useCourierText(): CourierText {
  const v = useContext(CourierTextContext);
  if (!v) throw new Error('useCourierText outside the courier app');
  return v;
}
