// Titles of the tracking events the server writes itself (CONTENT §6.11 / CONTENT_FR §6.11).
// Shared by the server and the browser. The server stores the English title in
// tracking_events.title plus title_key and title_vars_json (I18N_SPEC §5), so the public track
// page can show the event in French. Titles typed by staff have no key and show as written; so
// do rows stored before the key existed.
import { shipmentStatusLabel, type StatusLang } from './shipmentStatus.js';
import { frenchSpacing } from './typography.js';

export const EVENT_TITLES = {
  'event.registered': { en: 'Consignment Registered & Barcode Issued', fr: 'Envoi enregistré et code-barres attribué' },
  'event.registered_from_quote': { en: 'Consignment Registered from Rate Quote', fr: "Envoi enregistré à partir d'un devis" },
  'event.return_registered': { en: 'Return Shipment Registered', fr: 'Envoi retour enregistré' },
  'event.returning': { en: 'Returning to sender: {reason}', fr: "Retour à l'expéditeur : {reason}" },
  'event.departed_auto': { en: 'Departed Facility — Transit Underway', fr: 'Parti de la plateforme, en transit' },
  'event.payment_confirmed': { en: 'Payment confirmed', fr: 'Paiement confirmé' },
  'event.checkpoint': { en: 'Checkpoint Scan Verified', fr: 'Scan de contrôle vérifié' },
  // A status change without a title of its own: the status name ({status} is the code).
  'event.status': { en: '{status}', fr: '{status}' },
} as const satisfies Record<string, Record<StatusLang, string>>;

export type EventTitleKey = keyof typeof EVENT_TITLES;
export type EventTitleVars = Record<string, string>;

export function isEventTitleKey(value: unknown): value is EventTitleKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENT_TITLES, value);
}

/** The title of a keyed event in a language. `status` vars are codes, shown by name. */
export function renderEventTitle(key: EventTitleKey, vars: EventTitleVars = {}, lang: StatusLang = 'en'): string {
  const template = lang === 'fr' ? frenchSpacing(EVENT_TITLES[key].fr) : EVENT_TITLES[key][lang];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name] ?? '';
    return name === 'status' ? shipmentStatusLabel(value, lang) : value;
  });
}

/** Columns for an INSERT: English title, key, vars as JSON. */
export function eventTitleColumns(key: EventTitleKey, vars: EventTitleVars = {}): { title: string; titleKey: string; titleVarsJson: string | null } {
  return {
    title: renderEventTitle(key, vars, 'en'),
    titleKey: key,
    titleVarsJson: Object.keys(vars).length ? JSON.stringify(vars) : null,
  };
}

/** Parses stored title_vars_json; anything malformed reads as no vars. */
export function parseEventTitleVars(json: unknown): EventTitleVars {
  if (typeof json !== 'string' || !json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: EventTitleVars = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** What the browser shows for an event: the keyed title in its language, else the stored text. */
export function eventTitleText(
  event: { title: string; titleKey?: string | null; titleVars?: EventTitleVars | null },
  lang: StatusLang,
): string {
  if (lang === 'en' || !isEventTitleKey(event.titleKey)) return event.title;
  return renderEventTitle(event.titleKey, event.titleVars ?? {}, lang);
}
