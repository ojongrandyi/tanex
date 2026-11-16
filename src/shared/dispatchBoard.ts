// Dispatch board rules (docs/DISPATCH_SPEC.md §7): which column a job sits in, what makes a job a
// problem, the start of "today" for the Done column, and which couriers to suggest for a job.
// Shared by the server (sidebar badge counts) and the console board, so both count the same way.
// DOM-free.
import type { DispatchStatus, VehicleType } from './dispatchStatus.js';

/** A courier marker greys out, and an active job counts as a problem, after this long without a position. */
export const LOCATION_STALE_MS = 2 * 60_000;
/** The board and the sidebar badge refresh this often (DISPATCH_SPEC §7). */
export const BOARD_REFRESH_MS = 15_000;
/** Day boundary for "Done today". */
export const BOARD_TIME_ZONE = 'Africa/Douala';

export const BOARD_COLUMNS = ['REQUESTED', 'TO_ASSIGN', 'ASSIGNED', 'IN_PROGRESS', 'PROBLEMS', 'DONE_TODAY'] as const;
export type BoardColumn = typeof BOARD_COLUMNS[number];

export type JobProblem = 'FAILED' | 'NOT_ASSIGNED' | 'NOT_ACCEPTED' | 'LATE' | 'STALE_LOCATION' | 'CODE_LOCKED';

/** Admin-set minutes for the waiting-job alerts (DispatchSettings.alertMinutes); 0 = off. */
export interface BoardAlertRules {
  unassigned: number;
  notAccepted: number;
}
/** No waiting-job alerts (for callers that only need the other rules). */
export const NO_ALERT_RULES: BoardAlertRules = { unassigned: 0, notAccepted: 0 };

/** The job fields the board rules read (the console's job shape has all of them). */
export interface BoardJob {
  status: DispatchStatus;
  courierUserId: string | null;
  confirmedAt: number | null;
  assignedAt: number | null;
  scheduledForTs: number | null;
  etaTs: number | null;
  pickedUpAt: number | null;
  onTheWayAt: number | null;
  deliveredAt: number | null;
  cancelledAt: number | null;
  updatedAt: number;
  hasDeliveryCode: boolean;
  deliveryCodeTriesLeft: number | null;
}

const BEFORE_PICKUP: readonly DispatchStatus[] = ['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED'];
const CARRYING: readonly DispatchStatus[] = ['PICKED_UP', 'ON_THE_WAY'];
const FINAL: readonly DispatchStatus[] = ['DELIVERED', 'RETURNED', 'CANCELLED'];

/**
 * Why a job needs attention, in display order. Not assigned / not accepted = a confirmed job still
 * without a courier, or an assigned job the courier hasn't accepted, after the admin's minutes
 * (tracker #170; 0 turns the check off). Late = the preferred pickup time has passed before pickup,
 * or the ETA has passed before delivery. Stale location = the parcel is with the courier and no
 * position arrived for 2 minutes (counted from pickup when none came yet).
 */
export function jobProblems(job: BoardJob, lastPingTs: number | null, now: number, rules: BoardAlertRules = NO_ALERT_RULES): JobProblem[] {
  if (FINAL.includes(job.status)) return [];
  const out: JobProblem[] = [];
  if (job.status === 'FAILED_ATTEMPT') out.push('FAILED');
  const waited = (since: number | null, minutes: number) => minutes > 0 && since !== null && now - since > minutes * 60_000;
  if (job.status === 'CONFIRMED' && waited(job.confirmedAt, rules.unassigned)) out.push('NOT_ASSIGNED');
  if (job.status === 'ASSIGNED' && waited(job.assignedAt, rules.notAccepted)) out.push('NOT_ACCEPTED');
  const latePickup = job.scheduledForTs !== null && BEFORE_PICKUP.includes(job.status) && now > job.scheduledForTs;
  const lateEta = job.etaTs !== null && job.status !== 'FAILED_ATTEMPT' && now > job.etaTs;
  if (latePickup || lateEta) out.push('LATE');
  if (CARRYING.includes(job.status)) {
    const since = Math.max(lastPingTs ?? 0, job.onTheWayAt ?? 0, job.pickedUpAt ?? 0);
    if (since > 0 && now - since > LOCATION_STALE_MS) out.push('STALE_LOCATION');
  }
  if (job.hasDeliveryCode && job.deliveryCodeTriesLeft === 0) out.push('CODE_LOCKED');
  return out;
}

/** When a finished job finished. */
export function finishedAt(job: BoardJob): number {
  if (job.status === 'DELIVERED') return job.deliveredAt ?? job.updatedAt;
  if (job.status === 'CANCELLED') return job.cancelledAt ?? job.updatedAt;
  return job.updatedAt;
}

/** Midnight (as epoch ms) of the day `now` falls on in a time zone. */
export function startOfDay(now: number, timeZone = BOARD_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(now));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Offset of the zone from UTC at `now`, then the local midnight in UTC.
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  const offset = wall - Math.floor(now / 1000) * 1000;
  return Date.UTC(n('year'), n('month') - 1, n('day')) - offset;
}

/** The column a job shows in, or null for a job finished before today (not on the board). */
export function boardColumn(
  job: BoardJob, lastPingTs: number | null, now: number, dayStart = startOfDay(now), rules: BoardAlertRules = NO_ALERT_RULES,
): BoardColumn | null {
  if (FINAL.includes(job.status)) return finishedAt(job) >= dayStart ? 'DONE_TODAY' : null;
  if (jobProblems(job, lastPingTs, now, rules).length > 0) return 'PROBLEMS';
  switch (job.status) {
    case 'REQUESTED': return 'REQUESTED';
    case 'CONFIRMED': return 'TO_ASSIGN';
    case 'ASSIGNED':
    case 'ACCEPTED': return 'ASSIGNED';
    default: return 'IN_PROGRESS';
  }
}

/** Jobs waiting for dispatch (the sidebar badge): Requested + To assign + Problems. */
export function needsAttention(column: BoardColumn | null): boolean {
  return column === 'REQUESTED' || column === 'TO_ASSIGN' || column === 'PROBLEMS';
}

// ---- Courier suggestions ----

export interface LatLng { lat: number; lng: number }

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface SuggestCourier {
  userId: string;
  displayName: string;
  vehicleType: VehicleType | string;
  homeCityId: string | null;
  isOnDuty: boolean;
  accountStatus: string;
  activeJobs: number;
  lastPosition: { lat: number; lng: number; recordedAt: number } | null;
}

/**
 * Why a courier isn't a first choice. LARGER_VEHICLE can still carry the job (a van for a bike job)
 * and is the mildest; SMALLER_VEHICLE may not fit the parcel and ranks last.
 */
export type SuggestionMiss = 'LARGER_VEHICLE' | 'OFF_DUTY' | 'OTHER_CITY' | 'SMALLER_VEHICLE';

/** Capacity order: a vehicle can carry jobs meant for any vehicle before it. */
export const VEHICLE_CAPACITY: Record<string, number> = { BIKE: 1, VAN: 2, TRUCK: 3 };
/** A courier with a fresh position this close to the pickup counts as in the city, whatever their home city. */
export const NEARBY_KM = 15;

const MISS_WEIGHT: Record<SuggestionMiss, number> = { LARGER_VEHICLE: 1, OFF_DUTY: 2, OTHER_CITY: 2, SMALLER_VEHICLE: 4 };

export interface CourierSuggestion<C extends SuggestCourier = SuggestCourier> {
  courier: C;
  /** On duty, in the pickup city (home city or a fresh position nearby), exactly the vehicle the job needs. */
  recommended: boolean;
  /** Why it isn't recommended (empty when it is), mildest first. */
  misses: SuggestionMiss[];
  /** From the courier's last known position to the pickup; null when either is unknown. */
  distanceKm: number | null;
  /** Age of that position in ms; null without a position. */
  positionAgeMs: number | null;
}

/**
 * Couriers for a job, best first (DISPATCH_SPEC §7, tracker #170). Recommended: on duty, in the
 * pickup city (home city, or a position under 2 minutes old within NEARBY_KM of the pickup, so a
 * rider working away from home still shows), and exactly the vehicle the job needs; sorted by
 * distance from the pickup, then current load. Then every other active courier, ordered by how far
 * it is from fitting: a larger vehicle (can carry it) before off duty or another city, a smaller
 * vehicle last. Dispatch can still choose any of them. Disabled accounts and the courier already on
 * the job are left out.
 */
export function suggestCouriers<C extends SuggestCourier>(
  job: { pickupCityId: string; pickup: LatLng | null; vehicleRequired: string; courierUserId: string | null },
  couriers: readonly C[],
  now: number,
): CourierSuggestion<C>[] {
  const rows = couriers
    .filter((c) => c.accountStatus === 'ACTIVE' && c.userId !== job.courierUserId)
    .map((c): CourierSuggestion<C> => {
      const pos = c.lastPosition;
      const km = pos && job.pickup ? distanceKm(pos, job.pickup) : null;
      const freshNearby = km !== null && km <= NEARBY_KM && now - pos!.recordedAt <= LOCATION_STALE_MS;
      const misses: SuggestionMiss[] = [];
      const have = VEHICLE_CAPACITY[c.vehicleType] ?? 0;
      const need = VEHICLE_CAPACITY[job.vehicleRequired] ?? 0;
      if (have > need) misses.push('LARGER_VEHICLE');
      if (!c.isOnDuty) misses.push('OFF_DUTY');
      if (c.homeCityId !== job.pickupCityId && !freshNearby) misses.push('OTHER_CITY');
      if (have < need) misses.push('SMALLER_VEHICLE');
      return {
        courier: c,
        recommended: misses.length === 0,
        misses,
        distanceKm: km === null ? null : Math.round(km * 10) / 10,
        positionAgeMs: pos ? Math.max(0, now - pos.recordedAt) : null,
      };
    });
  const far = Number.POSITIVE_INFINITY;
  const weight = (s: CourierSuggestion<C>) => s.misses.reduce((n, m) => n + MISS_WEIGHT[m], 0);
  return rows.sort((a, b) =>
    weight(a) - weight(b)
    || (a.distanceKm ?? far) - (b.distanceKm ?? far)
    || a.courier.activeJobs - b.courier.activeJobs
    || a.courier.displayName.localeCompare(b.courier.displayName));
}

/** Best map point for a place: its pin, else its area's pin, else its city's pin. */
export function placePoint(
  place: { lat: number | null; lng: number | null; zoneId: string | null; cityId: string },
  zones: readonly { id: string; lat: number | null; lng: number | null }[],
  cities: readonly { id: string; lat: number | null; lng: number | null }[],
): LatLng | null {
  if (place.lat !== null && place.lng !== null) return { lat: place.lat, lng: place.lng };
  const z = place.zoneId ? zones.find((x) => x.id === place.zoneId) : undefined;
  if (z && z.lat !== null && z.lng !== null) return { lat: z.lat, lng: z.lng };
  const c = cities.find((x) => x.id === place.cityId);
  if (c && c.lat !== null && c.lng !== null) return { lat: c.lat, lng: c.lng };
  return null;
}
