// English: the master dictionary (I18N_SPEC §5), split per area. `common` is in the main bundle;
// page areas load with their page. Copy comes from docs/CONTENT.md, never invented here.
import common from './en/common';
import type { NotFoundMessages } from './en/notFound';
import home, { type HomeMessages } from './en/home';
import type { ServicesMessages } from './en/services';
import type { AboutMessages } from './en/about';
import type { NetworkMessages } from './en/network';
import type { HelpMessages } from './en/help';
import type { ContactMessages } from './en/contact';
import type { LegalMessages } from './en/legal';
import type { TrackMessages } from './en/track';
import type { TrackResultMessages } from './en/trackResult';
import type { QuoteMessages } from './en/quote';
import type { ShipMessages } from './en/ship';
import type { PaymentMessages } from './en/payment';

export const en = { common };

/** The eagerly loaded part of each language. */
export type Messages = typeof en;

/** Page areas and their English shape. Add an area here, in AREA_LOADERS_EN and in fr.ts. */
export interface AreaMessages {
  notFound: NotFoundMessages;
  home: HomeMessages;
  services: ServicesMessages;
  about: AboutMessages;
  network: NetworkMessages;
  help: HelpMessages;
  contact: ContactMessages;
  legal: LegalMessages;
  track: TrackMessages;
  trackResult: TrackResultMessages;
  quote: QuoteMessages;
  ship: ShipMessages;
  payment: PaymentMessages;
}
export type AreaName = keyof AreaMessages;

export const AREA_LOADERS_EN: { [A in AreaName]: () => Promise<AreaMessages[A]> } = {
  notFound: () => import('./en/notFound').then((m) => m.default),
  // Bundled with HomePage (which primes it via runtime.primeArea): Home is the main first paint.
  home: () => Promise.resolve(home),
  services: () => import('./en/services').then((m) => m.default),
  about: () => import('./en/about').then((m) => m.default),
  network: () => import('./en/network').then((m) => m.default),
  help: () => import('./en/help').then((m) => m.default),
  contact: () => import('./en/contact').then((m) => m.default),
  legal: () => import('./en/legal').then((m) => m.default),
  track: () => import('./en/track').then((m) => m.default),
  trackResult: () => import('./en/trackResult').then((m) => m.default),
  quote: () => import('./en/quote').then((m) => m.default),
  ship: () => import('./en/ship').then((m) => m.default),
  payment: () => import('./en/payment').then((m) => m.default),
};
