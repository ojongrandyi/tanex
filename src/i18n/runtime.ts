// Loaded dictionaries, the remembered language and the t() function (I18N_SPEC §3, §5).
// English `common` is always present; French is fetched the first time a French page opens
// (main.tsx waits for it before the first render on a /fr/ address, so there is no flash).
import { en, AREA_LOADERS_EN, type AreaMessages, type AreaName, type Messages } from './en';
import { AREA_LOADERS_FR, loadFrMessages } from './fr';
import { frenchSpacing } from '../shared/typography';
import type { Dict, Locale, Translation, Vars } from './types';

// ---- Common dictionaries ----

const loaded: Partial<Record<Locale, Translation<Messages>>> = { en };
const pending: Partial<Record<Locale, Promise<void>>> = {};
const listeners = new Set<() => void>();

export function subscribeMessages(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The common dictionary of a language, or undefined while it isn't loaded. */
export function messagesFor(locale: Locale): Translation<Messages> | undefined {
  return loaded[locale];
}

/** Fetches a language's common dictionary once. Resolves when it can be shown. */
export function loadLocale(locale: Locale): Promise<void> {
  if (loaded[locale]) return Promise.resolve();
  if (!pending[locale]) {
    pending[locale] = loadFrMessages()
      .then((m) => {
        loaded[locale] = m;
        listeners.forEach((fn) => fn());
      })
      .catch((err) => {
        delete pending[locale];
        throw err;
      });
  }
  return pending[locale]!;
}

// ---- Page areas (lazy, read with Suspense) ----

type AreaEntry = { status: 'pending'; promise: Promise<unknown> } | { status: 'done'; value: Dict } | { status: 'error'; error: unknown };
const areas = new Map<string, AreaEntry>();

/**
 * Registers an area dictionary that is already in the bundle, so its page renders without
 * suspending. Used for the homepage's English text: Home is the most visited first paint, and
 * waiting for a separate dictionary chunk would delay its largest contentful paint.
 */
export function primeArea<A extends AreaName>(area: A, locale: Locale, value: Translation<AreaMessages[A]>): void {
  areas.set(`${locale}:${area}`, { status: 'done', value: value as unknown as Dict });
}

/** Returns a page area's dictionary, or throws the load promise for the nearest <Suspense>. */
export function readArea<A extends AreaName>(area: A, locale: Locale): Translation<AreaMessages[A]> {
  const key = `${locale}:${area}`;
  let entry = areas.get(key);
  if (!entry) {
    const loader = locale === 'fr' ? AREA_LOADERS_FR[area] : AREA_LOADERS_EN[area];
    const promise = loader().then(
      (value) => { areas.set(key, { status: 'done', value: value as Dict }); },
      (error) => { areas.set(key, { status: 'error', error }); },
    );
    entry = { status: 'pending', promise };
    areas.set(key, entry);
  }
  if (entry.status === 'pending') throw entry.promise;
  if (entry.status === 'error') {
    areas.delete(key); // try again on the next render
    throw entry.error;
  }
  return entry.value as unknown as Translation<AreaMessages[A]>;
}

// ---- t() ----

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Looks a key up and fills {variables}; French gets its typography. Unknown keys return the key. */
export function translate(dict: Dict, key: string, locale: Locale, vars?: Vars): string {
  const template = lookup(dict, key);
  // Keys are checked at build time; a key built at runtime that doesn't exist shows as itself.
  if (template === undefined) return key;
  const text = locale === 'fr' ? frenchSpacing(template) : template;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

// ---- Remembered choice (tx_locale) ----

export const LOCALE_STORAGE_KEY = 'tx_locale';

export function storedLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === 'en' || value === 'fr' ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}
