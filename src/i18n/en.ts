// English: the master dictionary (I18N_SPEC §5), split per area. `common` is in the main bundle;
// page areas load with their page. Copy comes from docs/CONTENT.md, never invented here.
import common from './en/common';
import type { NotFoundMessages } from './en/notFound';
import home, { type HomeMessages } from './en/home';

export const en = { common };

/** The eagerly loaded part of each language. */
export type Messages = typeof en;

/** Page areas and their English shape. Add an area here, in AREA_LOADERS_EN and in fr.ts. */
export interface AreaMessages {
  notFound: NotFoundMessages;
  home: HomeMessages;
}
export type AreaName = keyof AreaMessages;

export const AREA_LOADERS_EN: { [A in AreaName]: () => Promise<AreaMessages[A]> } = {
  notFound: () => import('./en/notFound').then((m) => m.default),
  // Bundled with HomePage (which primes it via runtime.primeArea): Home is the main first paint.
  home: () => Promise.resolve(home),
};
