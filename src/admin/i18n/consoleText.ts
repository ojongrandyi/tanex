// Console languages (tracker I.2, I18N_SPEC §1). The console speaks the signed-in user's own
// language (My account → Language, `users.locale`); before sign-in, the choice on the sign-in
// card (`tx_console_locale`). The address does not decide it: the console has one path.
//
// Each console text module keeps its English object (the master, from docs/CONTENT.md §10) and
// exports `consoleText(area, english)`: an object that reads the active language's version of
// the same shape at the moment a property is read. The French objects live together in
// src/i18n/fr/console/ (one lazy chunk, loaded only for French), typed against the English
// shapes, so a missing or extra key fails the build. ConsoleLanguage (below) switches the
// language and remounts the console so every screen re-reads its text.

// AREAS:BEGIN (one line per text module)
import type { AUTH_TEXT_EN, IAM_TEXT_EN, MAIL_TEXT_EN } from '../../auth/strings';
import type { BLOG_MENU_EN } from '../blog/menuText';
import type { SHOP_MENU_EN } from '../shop/menuText';
import type { DISPATCH_MENU_EN } from '../dispatch/menuText';
import type { CASH_TEXT_EN } from '../cash/strings';
import type { BLOG_TEXT_EN } from '../blog/strings';
import type { DISPATCH_TEXT_EN } from '../dispatch/strings';
import type { BOARD_TEXT_EN } from '../dispatch/boardStrings';
import type { ADMIN_APP_TEXT_EN } from '../AdminApp.text';
import type { ADMIN_LAYOUT_TEXT_EN } from '../AdminLayout.text';
import type { DELETE_SHIPMENT_MODAL_TEXT_EN } from '../components/DeleteShipmentModal.text';
import type { EDIT_SHIPMENT_MODAL_TEXT_EN } from '../components/EditShipmentModal.text';
import type { NEW_PROOFS_PANEL_TEXT_EN } from '../components/NewProofsPanel.text';
import type { PAYMENT_REQUEST_EDITOR_TEXT_EN } from '../components/PaymentRequestEditor.text';
import type { PROOF_FACTS_TEXT_EN } from '../components/ProofFacts.text';
import type { PROOF_REVIEW_CONTROLS_TEXT_EN } from '../components/ProofReviewControls.text';
import type { PROOF_VIEWER_TEXT_EN } from '../components/ProofViewer.text';
import type { RECENTLY_DELETED_MODAL_TEXT_EN } from '../components/RecentlyDeletedModal.text';
import type { SHIPMENT_CONTROL_MODAL_TEXT_EN } from '../components/ShipmentControlModal.text';
import type { SHIPMENT_IMAGES_PANEL_TEXT_EN } from '../components/ShipmentImagesPanel.text';
import type { SHIPMENT_PAYMENT_PANEL_TEXT_EN } from '../components/ShipmentPaymentPanel.text';
import type { ALL_SHIPMENTS_VIEW_TEXT_EN } from '../pages/AllShipmentsView.text';
import type { CREATE_SHIPMENT_VIEW_TEXT_EN } from '../pages/CreateShipmentView.text';
import type { MESSAGES_VIEW_TEXT_EN } from '../pages/MessagesView.text';
import type { OPERATIONS_CENTER_TEXT_EN } from '../pages/OperationsCenter.text';
import type { PAYMENTS_VIEW_TEXT_EN } from '../pages/PaymentsView.text';
import type { QUOTE_REQUESTS_VIEW_TEXT_EN } from '../pages/QuoteRequestsView.text';
import type { SETTINGS_VIEW_TEXT_EN } from '../pages/SettingsView.text';
import type { TRACKING_EVENTS_VIEW_TEXT_EN } from '../pages/TrackingEventsView.text';
import type { DOCUMENT_CENTER_VIEW_TEXT_EN } from '../pages/DocumentCenterView.text';
// AREAS:END

import { intlLocale } from '../../i18n/format';

export type ConsoleLang = 'en' | 'fr';

/** Every console text area and its English shape. */
export interface ConsoleTextAreas {
  auth: typeof AUTH_TEXT_EN;
  iam: typeof IAM_TEXT_EN;
  mail: typeof MAIL_TEXT_EN;
  blogMenu: typeof BLOG_MENU_EN;
  shopMenu: typeof SHOP_MENU_EN;
  dispatchMenu: typeof DISPATCH_MENU_EN;
  cash: typeof CASH_TEXT_EN;
  blog: typeof BLOG_TEXT_EN;
  dispatch: typeof DISPATCH_TEXT_EN;
  board: typeof BOARD_TEXT_EN;
  adminApp: typeof ADMIN_APP_TEXT_EN;
  adminLayout: typeof ADMIN_LAYOUT_TEXT_EN;
  deleteShipmentModal: typeof DELETE_SHIPMENT_MODAL_TEXT_EN;
  editShipmentModal: typeof EDIT_SHIPMENT_MODAL_TEXT_EN;
  newProofsPanel: typeof NEW_PROOFS_PANEL_TEXT_EN;
  paymentRequestEditor: typeof PAYMENT_REQUEST_EDITOR_TEXT_EN;
  proofFacts: typeof PROOF_FACTS_TEXT_EN;
  proofReviewControls: typeof PROOF_REVIEW_CONTROLS_TEXT_EN;
  proofViewer: typeof PROOF_VIEWER_TEXT_EN;
  recentlyDeletedModal: typeof RECENTLY_DELETED_MODAL_TEXT_EN;
  shipmentControlModal: typeof SHIPMENT_CONTROL_MODAL_TEXT_EN;
  shipmentImagesPanel: typeof SHIPMENT_IMAGES_PANEL_TEXT_EN;
  shipmentPaymentPanel: typeof SHIPMENT_PAYMENT_PANEL_TEXT_EN;
  allShipmentsView: typeof ALL_SHIPMENTS_VIEW_TEXT_EN;
  createShipmentView: typeof CREATE_SHIPMENT_VIEW_TEXT_EN;
  messagesView: typeof MESSAGES_VIEW_TEXT_EN;
  operationsCenter: typeof OPERATIONS_CENTER_TEXT_EN;
  paymentsView: typeof PAYMENTS_VIEW_TEXT_EN;
  quoteRequestsView: typeof QUOTE_REQUESTS_VIEW_TEXT_EN;
  settingsView: typeof SETTINGS_VIEW_TEXT_EN;
  trackingEventsView: typeof TRACKING_EVENTS_VIEW_TEXT_EN;
  documentCenterView: typeof DOCUMENT_CENTER_VIEW_TEXT_EN;
}
export type ConsoleArea = keyof ConsoleTextAreas;

/** Same shape as the English object, any wording: strings stay strings, functions keep their parameters. */
export type Widen<T> =
  T extends string ? string
    : T extends (...args: infer A) => infer R ? (...args: A) => (R extends string ? string : Widen<R>)
      : T extends readonly (infer U)[] ? readonly Widen<U>[]
        : { readonly [K in keyof T]: Widen<T[K]> };

export type ConsoleTranslation = { readonly [A in ConsoleArea]: Widen<ConsoleTextAreas[A]> };

let active: ConsoleLang = 'en';
let french: ConsoleTranslation | null = null;
let frenchLoading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function consoleLang(): ConsoleLang {
  return active;
}

/** Intl locale for dates and numbers in the console: the site's own (en-CM / fr-CM, format.ts). */
export function consoleIntlLocale(): string {
  return intlLocale(active);
}

export function isConsoleLangReady(lang: ConsoleLang): boolean {
  return lang === 'en' || french !== null;
}

/** Loads the French chunk once. */
export function loadConsoleLang(lang: ConsoleLang): Promise<void> {
  if (isConsoleLangReady(lang)) return Promise.resolve();
  if (!frenchLoading) {
    frenchLoading = import('../../i18n/fr/console').then(
      (m) => { french = m.default; listeners.forEach((l) => l()); },
      (err) => { frenchLoading = null; throw err; },
    );
  }
  return frenchLoading;
}

/** Makes `lang` the active console language (it must be loaded). */
export function setConsoleLang(lang: ConsoleLang): void {
  active = isConsoleLangReady(lang) ? lang : 'en';
}

export function subscribeConsoleLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

const isSection = (v: unknown): v is object =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * The text object for `area` in the active language. Every read goes to the active language, and
 * nested sections are live too, so `const T = AUTH_TEXT.login` at module level still follows the
 * language. A string or function read into a module-level constant would keep the first
 * language: read those while rendering or in a handler.
 */
export function consoleText<A extends ConsoleArea>(area: A, english: ConsoleTextAreas[A]): ConsoleTextAreas[A] {
  const sections = new Map<string, object>();
  const resolve = (root: unknown, path: readonly PropertyKey[]): unknown =>
    path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<PropertyKey, unknown>)[k] : undefined), root);
  const section = (path: readonly PropertyKey[]): object => {
    const id = path.map(String).join('\u0000');
    const cached = sections.get(id);
    if (cached) return cached;
    const englishPart = resolve(english, path) as object;
    // Falls back to English if a translation lacks the section (the build checks it doesn't).
    const current = (): object => {
      if (active !== 'fr' || !french) return englishPart;
      const fr = resolve(french[area], path);
      return isSection(fr) ? fr : englishPart;
    };
    const proxy = new Proxy(englishPart, {
      get: (_t, prop) => {
        const v = Reflect.get(current(), prop);
        return isSection(v) && isSection(Reflect.get(englishPart, prop)) ? section([...path, prop]) : v;
      },
      has: (_t, prop) => Reflect.has(current(), prop),
      ownKeys: () => Reflect.ownKeys(current()),
      getOwnPropertyDescriptor: (_t, prop) => {
        const d = Reflect.getOwnPropertyDescriptor(current(), prop);
        if (!d) return undefined;
        if (!('value' in d)) return { ...d, configurable: true };
        const v = d.value;
        return { ...d, configurable: true, value: isSection(v) && isSection(Reflect.get(englishPart, prop)) ? section([...path, prop]) : v };
      },
    });
    sections.set(id, proxy);
    return proxy;
  };
  return section([]) as ConsoleTextAreas[A];
}

// ---- Pre-sign-in choice (the sign-in card's language switch) ----

export const CONSOLE_LOCALE_KEY = 'tx_console_locale';

export function storedConsoleLang(): ConsoleLang {
  try {
    return window.localStorage.getItem(CONSOLE_LOCALE_KEY) === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function storeConsoleLang(lang: ConsoleLang): void {
  try {
    window.localStorage.setItem(CONSOLE_LOCALE_KEY, lang);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}
