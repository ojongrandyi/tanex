// Dispatch job lifecycle (docs/DISPATCH_SPEC.md §4): statuses, who may move a job from one status
// to the next, and what each move writes to the linked shipment (status, progress, tracking event).
// Shared by the server (which enforces it) and the browser (which only shows the actions it
// allows). DOM-free. Names: CONTENT §6.9, §10.2, §10.3 / CONTENT_FR.
import type { EventTitleKey } from './eventTitles.js';

export type DispatchLang = 'en' | 'fr';

// ---- Scopes, vehicles, statuses ----

/** shipments.service_scope. NULL on older rows means INTERNATIONAL. */
export const SERVICE_SCOPES = ['INTERNATIONAL', 'LOCAL', 'INTERCITY'] as const;
export type ServiceScope = typeof SERVICE_SCOPES[number];

/** dispatch_jobs.scope: a whole local/intercity delivery, or a first/last-mile leg of an international one. */
export const JOB_SCOPES = ['LOCAL', 'INTERCITY', 'FIRST_MILE', 'LAST_MILE'] as const;
export type JobScope = typeof JOB_SCOPES[number];

export const VEHICLE_TYPES = ['BIKE', 'VAN', 'TRUCK'] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

export const VEHICLE_LABELS: Record<VehicleType, Record<DispatchLang, string>> = {
  BIKE: { en: 'Bike', fr: 'Moto' },
  VAN: { en: 'Van', fr: 'Fourgonnette' },
  TRUCK: { en: 'Truck', fr: 'Camion' },
};

/**
 * Whether a shipment's progress is advanced on a schedule by server/progress.ts. LOCAL and
 * INTERCITY shipments move only when a courier records a real step.
 */
export function usesScheduleProgress(serviceScope: unknown): boolean {
  const scope = typeof serviceScope === 'string' ? serviceScope.trim().toUpperCase() : '';
  return scope !== 'LOCAL' && scope !== 'INTERCITY';
}

export const DISPATCH_STATUSES = [
  'REQUESTED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY',
  'DELIVERED', 'FAILED_ATTEMPT', 'RETURNED', 'CANCELLED',
] as const;
export type DispatchStatus = typeof DISPATCH_STATUSES[number];

export function isDispatchStatus(value: unknown): value is DispatchStatus {
  return typeof value === 'string' && (DISPATCH_STATUSES as readonly string[]).includes(value);
}

/** Job status names for the console and courier app (CONTENT §10.2, owner to confirm). */
export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, Record<DispatchLang, string>> = {
  REQUESTED: { en: 'Requested', fr: 'Demandée' },
  CONFIRMED: { en: 'Confirmed', fr: 'Confirmée' },
  ASSIGNED: { en: 'Assigned', fr: 'Assignée' },
  ACCEPTED: { en: 'Accepted', fr: 'Acceptée' },
  PICKED_UP: { en: 'Picked up', fr: 'Colis récupéré' },
  ON_THE_WAY: { en: 'On the way', fr: 'En route' },
  DELIVERED: { en: 'Delivered', fr: 'Livrée' },
  FAILED_ATTEMPT: { en: 'Delivery attempt unsuccessful', fr: 'Tentative de livraison infructueuse' },
  RETURNED: { en: 'Returned to sender', fr: "Retournée à l'expéditeur" },
  CANCELLED: { en: 'Cancelled', fr: 'Annulée' },
};

export function dispatchStatusLabel(status: unknown, lang: DispatchLang = 'en'): string {
  return isDispatchStatus(status) ? DISPATCH_STATUS_LABELS[status][lang] : String(status ?? '');
}

/** Statuses during which the courier app shares its position (DISPATCH_SPEC §6). */
export const LOCATION_SHARING_STATUSES: readonly DispatchStatus[] = ['PICKED_UP', 'ON_THE_WAY'];

/** Statuses a job never leaves. */
export const FINAL_DISPATCH_STATUSES: readonly DispatchStatus[] = ['DELIVERED', 'RETURNED', 'CANCELLED'];

// ---- Failure reasons (fixed list, CONTENT §10.3) ----

export const FAILURE_REASONS = [
  'RECIPIENT_UNREACHABLE', 'RECIPIENT_ABSENT', 'WRONG_ADDRESS', 'REFUSED',
  'UNSAFE_TO_DELIVER', 'VEHICLE_PROBLEM', 'OTHER',
] as const;
export type FailureReason = typeof FAILURE_REASONS[number];

export const FAILURE_REASON_LABELS: Record<FailureReason, Record<DispatchLang, string>> = {
  RECIPIENT_UNREACHABLE: { en: 'Recipient unreachable', fr: 'Destinataire injoignable' },
  RECIPIENT_ABSENT: { en: 'Recipient not available', fr: 'Destinataire absent' },
  WRONG_ADDRESS: { en: 'Wrong address', fr: 'Mauvaise adresse' },
  REFUSED: { en: 'Refused', fr: 'Refusé' },
  UNSAFE_TO_DELIVER: { en: 'Unsafe to deliver', fr: 'Livraison dangereuse' },
  VEHICLE_PROBLEM: { en: 'Vehicle problem', fr: 'Problème de véhicule' },
  OTHER: { en: 'Other', fr: 'Autre' },
};

export function isFailureReason(value: unknown): value is FailureReason {
  return typeof value === 'string' && (FAILURE_REASONS as readonly string[]).includes(value);
}

/** Name of a failure reason code; anything else is shown as stored. */
export function failureReasonLabel(reason: unknown, lang: DispatchLang = 'en'): string {
  return isFailureReason(reason) ? FAILURE_REASON_LABELS[reason][lang] : String(reason ?? '');
}

// ---- Transitions (DISPATCH_SPEC §4 table) ----

export type DispatchActor = 'customer' | 'dispatch' | 'courier';

export type DispatchAction =
  | 'request' | 'create' | 'confirm' | 'assign' | 'reassign' | 'accept' | 'decline'
  | 'pick_up' | 'start_delivery' | 'deliver' | 'fail' | 'return' | 'cancel';

export interface DispatchTransition {
  action: DispatchAction;
  /** null = the job is being created. */
  from: readonly (DispatchStatus | null)[];
  to: DispatchStatus;
  actor: DispatchActor;
  /** Public tracking event written on the shipment; null = internal step, no event. */
  eventKey: EventTitleKey | null;
  /** Shipment status code set on the linked shipment; null = left as it is. */
  shipmentStatus: string | null;
}

const BEFORE_PICKUP: readonly DispatchStatus[] = ['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED'];

export const DISPATCH_TRANSITIONS: readonly DispatchTransition[] = [
  { action: 'request', from: [null], to: 'REQUESTED', actor: 'customer', eventKey: 'event.local_requested', shipmentStatus: 'BOOKED' },
  { action: 'create', from: [null], to: 'CONFIRMED', actor: 'dispatch', eventKey: 'event.local_confirmed', shipmentStatus: 'BOOKED' },
  { action: 'confirm', from: ['REQUESTED'], to: 'CONFIRMED', actor: 'dispatch', eventKey: 'event.local_confirmed', shipmentStatus: 'BOOKED' },
  { action: 'assign', from: ['CONFIRMED', 'FAILED_ATTEMPT'], to: 'ASSIGNED', actor: 'dispatch', eventKey: 'event.local_assigned', shipmentStatus: 'BOOKED' },
  // Reassign (DISPATCH_SPEC §7, CONTENT §10.2): a different courier before pickup; the earlier
  // assignment stays in the audit log and the tracking history.
  { action: 'reassign', from: ['ASSIGNED', 'ACCEPTED'], to: 'ASSIGNED', actor: 'dispatch', eventKey: 'event.local_assigned', shipmentStatus: 'BOOKED' },
  { action: 'accept', from: ['ASSIGNED'], to: 'ACCEPTED', actor: 'courier', eventKey: null, shipmentStatus: null },
  { action: 'decline', from: ['ASSIGNED'], to: 'CONFIRMED', actor: 'courier', eventKey: null, shipmentStatus: null },
  { action: 'pick_up', from: ['ACCEPTED'], to: 'PICKED_UP', actor: 'courier', eventKey: 'event.local_picked_up', shipmentStatus: 'RECEIVED' },
  { action: 'start_delivery', from: ['PICKED_UP'], to: 'ON_THE_WAY', actor: 'courier', eventKey: 'event.local_on_the_way', shipmentStatus: 'OUT_FOR_DELIVERY' },
  { action: 'deliver', from: ['ON_THE_WAY'], to: 'DELIVERED', actor: 'courier', eventKey: 'event.local_delivered', shipmentStatus: 'DELIVERED' },
  { action: 'fail', from: ['ON_THE_WAY'], to: 'FAILED_ATTEMPT', actor: 'courier', eventKey: 'event.local_failed', shipmentStatus: 'DELAYED' },
  { action: 'return', from: ['FAILED_ATTEMPT'], to: 'RETURNED', actor: 'dispatch', eventKey: 'event.local_returned', shipmentStatus: 'RETURNED' },
  // Whether the shipment is also moved to the trash is dispatch's choice, made by the route.
  { action: 'cancel', from: BEFORE_PICKUP, to: 'CANCELLED', actor: 'dispatch', eventKey: 'event.local_cancelled', shipmentStatus: null },
];

const BY_ACTION = new Map(DISPATCH_TRANSITIONS.map((t) => [t.action, t]));

export function isDispatchAction(value: unknown): value is DispatchAction {
  return typeof value === 'string' && BY_ACTION.has(value as DispatchAction);
}

/** The transition an action makes from a status, or undefined when it isn't allowed from there. */
export function findTransition(from: DispatchStatus | null, action: DispatchAction): DispatchTransition | undefined {
  const t = BY_ACTION.get(action);
  return t && t.from.includes(from) ? t : undefined;
}

/** Actions an actor may take on a job in this status (for showing buttons). */
export function allowedActions(from: DispatchStatus | null, actor: DispatchActor): DispatchAction[] {
  return DISPATCH_TRANSITIONS.filter((t) => t.actor === actor && t.from.includes(from)).map((t) => t.action);
}

/** Shipment progress for a job status (DISPATCH_SPEC §4: 0/20/40/60/100); null = left as it is. */
export const DISPATCH_PROGRESS: Record<DispatchStatus, number | null> = {
  REQUESTED: 0,
  CONFIRMED: 0,
  ASSIGNED: 20,
  ACCEPTED: 20,
  PICKED_UP: 40,
  ON_THE_WAY: 60,
  DELIVERED: 100,
  FAILED_ATTEMPT: 60,
  RETURNED: null,
  CANCELLED: null,
};

/** dispatch_jobs column stamped with the time a job reaches a status. */
export const DISPATCH_TIMESTAMP_COLUMN: Partial<Record<DispatchStatus, string>> = {
  REQUESTED: 'requested_at_ts',
  CONFIRMED: 'confirmed_at_ts',
  ASSIGNED: 'assigned_at_ts',
  ACCEPTED: 'accepted_at_ts',
  PICKED_UP: 'picked_up_at_ts',
  ON_THE_WAY: 'on_the_way_at_ts',
  DELIVERED: 'delivered_at_ts',
  CANCELLED: 'cancelled_at_ts',
};

// ---- Checking a requested move ----

export interface TransitionInput {
  /** The signed-in user making the move (couriers may act only on their own jobs). */
  actingUserId?: string | null;
  /** assign / reassign: the courier who gets the job. */
  courierUserId?: string | null;
  /** deliver: proof of delivery. */
  podRecipientName?: string | null;
  podPhotoFile?: string | null;
  /** fail: one of FAILURE_REASONS; OTHER needs a note. */
  failureReason?: string | null;
  note?: string | null;
}

export type TransitionErrorCode =
  | 'UNKNOWN_ACTION' | 'INVALID_TRANSITION' | 'WRONG_ACTOR' | 'NOT_YOUR_JOB'
  | 'COURIER_REQUIRED' | 'POD_REQUIRED' | 'REASON_REQUIRED' | 'NOTE_REQUIRED';

export type TransitionCheck =
  | { ok: true; transition: DispatchTransition }
  | { ok: false; code: TransitionErrorCode };

const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/**
 * Whether an actor may make this move on a job, with the data the move requires. The server calls
 * it before writing; the delivery-code check (hashed code, 5 tries) is done by the server on top.
 */
export function checkTransition(
  job: { status: DispatchStatus | null; courierUserId?: string | null },
  action: unknown,
  actor: DispatchActor,
  input: TransitionInput = {},
): TransitionCheck {
  if (!isDispatchAction(action)) return { ok: false, code: 'UNKNOWN_ACTION' };
  const transition = findTransition(job.status, action);
  if (!transition) return { ok: false, code: 'INVALID_TRANSITION' };
  if (transition.actor !== actor) return { ok: false, code: 'WRONG_ACTOR' };
  if (actor === 'courier' && (!filled(input.actingUserId) || input.actingUserId !== job.courierUserId)) {
    return { ok: false, code: 'NOT_YOUR_JOB' };
  }
  if ((action === 'assign' || action === 'reassign') && !filled(input.courierUserId)) {
    return { ok: false, code: 'COURIER_REQUIRED' };
  }
  if (action === 'deliver' && (!filled(input.podRecipientName) || !filled(input.podPhotoFile))) {
    return { ok: false, code: 'POD_REQUIRED' };
  }
  if (action === 'fail') {
    if (!isFailureReason(input.failureReason)) return { ok: false, code: 'REASON_REQUIRED' };
    if (input.failureReason === 'OTHER' && !filled(input.note)) return { ok: false, code: 'NOTE_REQUIRED' };
  }
  return { ok: true, transition };
}

/**
 * Variables for the tracking event a move writes. The recipient name is stored masked, since the
 * title is public; the failure reason is stored as its code and shown in the page language.
 */
export function dispatchEventVars(
  transition: DispatchTransition,
  data: { riderFirstName?: string | null; maskedRecipientName?: string | null; failureReason?: string | null },
): Record<string, string> {
  switch (transition.eventKey) {
    case 'event.local_picked_up': return { rider: (data.riderFirstName ?? '').trim() };
    case 'event.local_delivered': return { recipient: (data.maskedRecipientName ?? '').trim() };
    case 'event.local_failed': return { failureReason: String(data.failureReason ?? '') };
    default: return {};
  }
}
