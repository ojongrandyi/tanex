// Public tracking of local and intercity deliveries (docs/DISPATCH_SPEC.md §8, CONTENT §6.9; tracker
// G.7). The rules for what a customer may see: the stepper position for a job status, when the
// courier card and live position are shown, the approximate ETA and how often the page refreshes.
// The server builds the public block with these (server/dispatch/publicTracking.ts) and the track
// page reads the same constants. DOM-free.
import { distanceKm, LOCATION_STALE_MS, type LatLng } from './dispatchBoard.js';
import {
  FINAL_DISPATCH_STATUSES, LOCATION_SHARING_STATUSES,
  type DispatchStatus, type FailureReason, type VehicleType,
} from './dispatchStatus.js';

/** The track page refreshes this often while the delivery isn't finished (DISPATCH_SPEC §8). */
export const LOCAL_TRACK_POLL_MS = 20_000;
/** A courier position older than this is not shown (same 2 minutes as the dispatch board). */
export const LIVE_POSITION_MAX_AGE_MS = LOCATION_STALE_MS;
/** Straight-line distance × this ≈ road distance (DISPATCH_SPEC §8). */
export const ROAD_FACTOR = 1.4;

/** Stepper (CONTENT §6.9): Requested → Courier assigned → Picked up → On the way → Delivered. */
export const LOCAL_STEPS = ['requested', 'assigned', 'pickedUp', 'onTheWay', 'delivered'] as const;
export type LocalStep = typeof LOCAL_STEPS[number];

/** Index in LOCAL_STEPS reached by a job status. A failed attempt stays on "On the way". */
export function localStepIndex(status: DispatchStatus): number {
  switch (status) {
    case 'REQUESTED':
    case 'CONFIRMED':
    case 'CANCELLED':
      return 0;
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 1;
    case 'PICKED_UP':
      return 2;
    case 'ON_THE_WAY':
    case 'FAILED_ATTEMPT':
    case 'RETURNED':
      return 3;
    case 'DELIVERED':
      return 4;
  }
}

export type LocalOutcome = 'ACTIVE' | 'DELIVERED' | 'FAILED' | 'RETURNED' | 'CANCELLED';

export function localOutcome(status: DispatchStatus): LocalOutcome {
  if (status === 'DELIVERED') return 'DELIVERED';
  if (status === 'FAILED_ATTEMPT') return 'FAILED';
  if (status === 'RETURNED') return 'RETURNED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'ACTIVE';
}

/** The page keeps refreshing until the job can't change any more. */
export function isLocalTrackingOpen(status: DispatchStatus): boolean {
  return !FINAL_DISPATCH_STATUSES.includes(status);
}

/** The courier card is shown from assignment until the parcel is handed over (or the try fails). */
export function showsCourier(status: DispatchStatus): boolean {
  return status === 'ASSIGNED' || status === 'ACCEPTED' || LOCATION_SHARING_STATUSES.includes(status);
}

/** The live map (and the position) only while the courier carries the parcel. */
export function showsLivePosition(status: DispatchStatus): boolean {
  return LOCATION_SHARING_STATUSES.includes(status);
}

/** A position may be shown when it is at most 2 minutes old (and not from the future). */
export function isPositionFresh(recordedAtTs: number, now: number): boolean {
  return Number.isFinite(recordedAtTs) && now - recordedAtTs <= LIVE_POSITION_MAX_AGE_MS && recordedAtTs <= now + 60_000;
}

/**
 * Approximate minutes to the drop-off: straight-line distance × 1.4 ÷ the vehicle's average speed,
 * rounded up, at least 1. Above 15 minutes it rounds up to 5 minutes, so the page doesn't suggest
 * more precision than it has. null without a speed.
 */
export function etaMinutes(from: LatLng, to: LatLng, speedKmh: number): number | null {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return null;
  const minutes = (distanceKm(from, to) * ROAD_FACTOR / speedKmh) * 60;
  if (!Number.isFinite(minutes)) return null;
  const up = Math.max(1, Math.ceil(minutes));
  return up > 15 ? Math.ceil(up / 5) * 5 : up;
}

/** A point on the public map: an area or city pin, never the customer's own map pin. */
export interface PublicPoint {
  lat: number;
  lng: number;
}

/**
 * The `localDelivery` block of GET /api/track/:id for LOCAL and INTERCITY shipments. Holds no phone
 * numbers, no full names, no addresses or landmarks, no notes and no prices. The courier and the
 * position appear only during the delivery (see the functions above).
 */
export interface PublicLocalDelivery {
  scope: 'LOCAL' | 'INTERCITY';
  status: DispatchStatus;
  /** Index in LOCAL_STEPS. */
  step: number;
  outcome: LocalOutcome;
  /** Failure reason code (shown in the page language) while the last attempt failed. */
  failureReason: FailureReason | null;
  vehicle: VehicleType;
  /** When each step was reached (epoch ms), null if not (yet). */
  times: Record<LocalStep, number | null>;
  courier: { firstName: string; vehicle: VehicleType; photoUrl: string | null } | null;
  /** The courier carries the parcel: the live map is on. */
  live: boolean;
  /** Last position, only while live and at most 2 minutes old. ageMs is its age when the answer was made. */
  position: { lat: number; lng: number; ageMs: number } | null;
  /** Approximate minutes to the drop-off, only with a fresh position. */
  etaMinutes: number | null;
  route: {
    pickupCity: string | null;
    dropoffCity: string | null;
    pickupArea: string | null;
    dropoffArea: string | null;
    pickup: PublicPoint | null;
    dropoff: PublicPoint | null;
  };
  /** After delivery: the masked name of who received it, when, and whether a photo was taken. */
  pod: { recipient: string; deliveredAt: number | null; photo: boolean } | null;
  /** Refresh interval for the page; null when the delivery is finished. */
  pollMs: number | null;
}
