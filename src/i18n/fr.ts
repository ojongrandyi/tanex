// French, typed against the English master (I18N_SPEC §5): each area file `satisfies
// Translation<…>` of its English twin, and the loaders below must cover every area, so a missing
// or extra key or area fails the build. Everything French is loaded on demand.
// Copy comes from docs/CONTENT_FR.md.
import type { AreaMessages, AreaName, Messages } from './en';
import type { Translation } from './types';

export const loadFrMessages = (): Promise<Translation<Messages>> =>
  import('./fr/common').then((m) => ({ common: m.default }));

export const AREA_LOADERS_FR: { [A in AreaName]: () => Promise<Translation<AreaMessages[A]>> } = {
  notFound: () => import('./fr/notFound').then((m) => m.default),
  home: () => import('./fr/home').then((m) => m.default),
};
