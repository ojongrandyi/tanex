// Types for the dictionaries (I18N_SPEC §5). English is the master: every other language is a
// Translation of the English shape, so a missing or extra key fails the build.
import type { Lang } from '../router/routes';

export type Locale = Lang;
export const LOCALES: readonly Locale[] = ['en', 'fr'];

/** A dictionary: nested objects of strings. Variables are written {name}. */
export interface Dict {
  readonly [key: string]: string | Dict;
}

/** Same keys as T, any string values. */
export type Translation<T> = { readonly [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };

/** Dotted key paths to the strings of T, e.g. 'header.track'. */
export type KeyPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${KeyPath<T[K]>}`;
}[keyof T & string];

export type Vars = Record<string, string | number>;
