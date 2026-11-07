// Shipment status names shown to customers and staff (CONTENT §6.3 / CONTENT_FR §6.3). Shared by
// the browser and the server so the public track page, the admin console and server-written status
// text agree. The API stores and returns codes; each client shows the name in its language
// (I18N_SPEC §5). `label` is the English name, which the server writes into status_text.

export type StatusTone = 'booked' | 'transit' | 'out' | 'delivered' | 'hold' | 'delayed' | 'returning';

export type StatusLang = 'en' | 'fr';

interface StatusDef {
  value: string;
  /** English name (same as labels.en). */
  label: string;
  labels: Record<StatusLang, string>;
  tone: StatusTone;
}

function def(value: string, en: string, fr: string, tone: StatusTone): StatusDef {
  return { value, label: en, labels: { en, fr }, tone };
}

// The statuses an admin can set, in journey order. `value` is the stored code (DB column
// `status`); codes are not renamed, only their names.
export const SHIPMENT_STATUS_OPTIONS: readonly StatusDef[] = [
  def('BOOKED', 'Booked', 'Réservé', 'booked'),
  def('RECEIVED', 'Collected', 'Récupéré', 'transit'),
  def('PROCESSING', 'At origin gateway', 'À la plateforme de départ', 'transit'),
  def('DEPARTED_FACILITY', 'Departed', 'Parti', 'transit'),
  def('IN_TRANSIT', 'In transit', 'En transit', 'transit'),
  def('DESTINATION_PROCESSING', 'Arrived at destination gateway', 'Arrivé à la plateforme de destination', 'transit'),
  def('CUSTOMS_CLEARANCE', 'Customs clearance', 'Dédouanement', 'transit'),
  def('OUT_FOR_DELIVERY', 'Out for delivery', 'En cours de livraison', 'out'),
  def('DELIVERED', 'Delivered', 'Livré', 'delivered'),
  def('ON_HOLD', 'On hold', 'En attente', 'hold'),
  def('DELAYED', 'Delayed', 'Retardé', 'delayed'),
  def('RETURNED', 'Returning to sender', "Retour à l'expéditeur", 'returning'),
];

/** Name of the CANCELLED code, which is not in the list staff pick from. */
export const CANCELLED_LABEL: Record<StatusLang, string> = { en: 'Cancelled', fr: 'Annulé' };

// Older codes still found in stored rows, shown under the nearest current name.
const LEGACY_STATUS: Record<string, string> = {
  CREATED: 'BOOKED',
  AWAITING_PICKUP: 'BOOKED',
  PROCESSED: 'PROCESSING',
  AT_FACILITY: 'IN_TRANSIT',
  HELD: 'ON_HOLD',
  EXCEPTION: 'ON_HOLD',
  DELIVERY_ATTEMPTED: 'DELAYED',
};

const BY_VALUE = new Map(SHIPMENT_STATUS_OPTIONS.map((s) => [s.value, s]));

/** The current status code a stored code is shown as (legacy codes map to their nearest). */
export function canonicalStatus(status: unknown): string {
  const code = String(status ?? '').trim().toUpperCase();
  return LEGACY_STATUS[code] ?? code;
}

function lookup(status: unknown): StatusDef | undefined {
  return BY_VALUE.get(canonicalStatus(status));
}

/** Display name when the code is a shipment status (current or legacy), otherwise undefined. */
export function knownStatusLabel(status: unknown, lang: StatusLang = 'en'): string | undefined {
  return lookup(status)?.labels[lang];
}

/** Display name for any stored status code, e.g. DESTINATION_PROCESSING -> "Arrived at destination gateway". */
export function shipmentStatusLabel(status: unknown, lang: StatusLang = 'en'): string {
  const found = lookup(status);
  if (found) return found.labels[lang];
  const code = String(status ?? '').trim();
  if (code.toUpperCase() === 'CANCELLED') return CANCELLED_LABEL[lang];
  // Unknown code: readable rather than blank ("SOME_CODE" -> "Some code").
  const words = code.replace(/_/g, ' ').toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : BY_VALUE.get('IN_TRANSIT')!.labels[lang];
}

/** Colour family for badges. */
export function shipmentStatusTone(status: unknown): StatusTone {
  return lookup(status)?.tone ?? 'booked';
}
