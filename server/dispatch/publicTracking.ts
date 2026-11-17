// The public view of a local or intercity delivery (docs/DISPATCH_SPEC.md §8; tracker G.7), added to
// GET /api/track/:id as `localDelivery`. Privacy rules (spec §8 "Privacy", src/shared/localTracking.ts):
// no phone numbers, no full names, no landmarks or customer map pins, no prices or notes; the
// courier's first name (and photo, only with consent) while the job is theirs; the position only
// while the parcel is on its way and at most 2 minutes old; after delivery only the route and a
// masked proof-of-delivery line.
import type { DatabaseSync } from 'node:sqlite';
import { parsePlace, type JobRow, type Place } from './jobs.js';
import { readStoredDispatchSettings } from '../routes/tariffs.js';
import { maskName } from '../../src/shared/masking.js';
import { isFailureReason, isDispatchStatus } from '../../src/shared/dispatchStatus.js';
import {
  LIVE_POSITION_MAX_AGE_MS, LOCAL_TRACK_POLL_MS, etaMinutes, isLocalTrackingOpen, isPositionFresh, localOutcome,
  localStepIndex, showsCourier, showsLivePosition, type PublicLocalDelivery, type PublicPoint,
} from '../../src/shared/localTracking.js';

interface CityRow { id: string; name: string; lat: number | null; lng: number | null }
interface ZoneRow { id: string; name: string; lat: number | null; lng: number | null }
interface CourierRow { public_first_name: string; vehicle_type: string; show_photo_publicly: number; photo_file: string | null }

const point = (lat: number | null | undefined, lng: number | null | undefined): PublicPoint | null =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

/** The LOCAL or INTERCITY job behind a shipment (the latest one, if dispatch ever made two). */
export function shipmentJob(conn: DatabaseSync, trackingNumber: string): JobRow | undefined {
  return conn.prepare(`
    SELECT * FROM dispatch_jobs WHERE tracking_number = ? AND scope IN ('LOCAL', 'INTERCITY')
    ORDER BY created_at_ts DESC, id DESC LIMIT 1
  `).get(trackingNumber) as JobRow | undefined;
}

/** The courier's photo file when the customer may see it now (consent and the job is theirs), else null. */
export function publicCourierPhoto(conn: DatabaseSync, job: JobRow): string | null {
  if (!job.courier_user_id || !showsCourier(job.status)) return null;
  const c = conn.prepare('SELECT show_photo_publicly, photo_file FROM couriers WHERE user_id = ?').get(job.courier_user_id) as
    Pick<CourierRow, 'show_photo_publicly' | 'photo_file'> | undefined;
  return c && c.show_photo_publicly === 1 && c.photo_file ? c.photo_file : null;
}

export function publicLocalDelivery(conn: DatabaseSync, job: JobRow, now = Date.now()): PublicLocalDelivery | null {
  if ((job.scope !== 'LOCAL' && job.scope !== 'INTERCITY') || !isDispatchStatus(job.status)) return null;
  const pickup = parsePlace(job.pickup_json);
  const dropoff = parsePlace(job.dropoff_json);
  const city = (id: string) => conn.prepare('SELECT id, name, lat, lng FROM delivery_cities WHERE id = ?').get(id) as CityRow | undefined;
  const zone = (id: string | null) => (id
    ? conn.prepare('SELECT id, name, lat, lng FROM delivery_zones WHERE id = ?').get(id) as ZoneRow | undefined
    : undefined);
  const pc = city(pickup.cityId);
  const dc = city(dropoff.cityId);
  const pz = zone(pickup.zoneId);
  const dz = zone(dropoff.zoneId);
  // Public map points are the area's pin, else the city's: never the customer's own pin.
  const areaPoint = (z: ZoneRow | undefined, c: CityRow | undefined) => point(z?.lat, z?.lng) ?? point(c?.lat, c?.lng);
  // The ETA aims at the most precise drop-off point known, which is not sent.
  const exactPoint = (p: Place, z: ZoneRow | undefined, c: CityRow | undefined) => point(p.lat, p.lng) ?? areaPoint(z, c);

  const status = job.status;
  let courier: PublicLocalDelivery['courier'] = null;
  if (job.courier_user_id && showsCourier(status)) {
    const c = conn.prepare('SELECT public_first_name, vehicle_type, show_photo_publicly, photo_file FROM couriers WHERE user_id = ?')
      .get(job.courier_user_id) as CourierRow | undefined;
    if (c) {
      const photo = c.show_photo_publicly === 1 && c.photo_file ? c.photo_file : null;
      courier = {
        firstName: c.public_first_name,
        vehicle: (c.vehicle_type as PublicLocalDelivery['vehicle']) || job.vehicle_required,
        // The file name changes with each new photo, so it also refreshes the browser's copy.
        photoUrl: photo ? `/api/track/${encodeURIComponent(job.tracking_number)}/courier-photo?v=${encodeURIComponent(photo.split('.')[0])}` : null,
      };
    }
  }

  const live = showsLivePosition(status) && !!job.courier_user_id;
  let position: PublicLocalDelivery['position'] = null;
  let eta: number | null = null;
  if (live) {
    // This job's own points only, from its courier, and only a fresh one.
    const last = conn.prepare(`
      SELECT lat, lng, recorded_at_ts FROM courier_locations
      WHERE job_id = ? AND courier_user_id = ? AND recorded_at_ts >= ?
      ORDER BY recorded_at_ts DESC, id DESC LIMIT 1
    `).get(job.id, job.courier_user_id, now - LIVE_POSITION_MAX_AGE_MS) as { lat: number; lng: number; recorded_at_ts: number } | undefined;
    if (last && isPositionFresh(last.recorded_at_ts, now)) {
      position = { lat: last.lat, lng: last.lng, ageMs: Math.max(0, now - last.recorded_at_ts) };
      const target = exactPoint(dropoff, dz, dc);
      const speed = readStoredDispatchSettings().avgSpeedKmh[job.vehicle_required];
      eta = target ? etaMinutes(position, target, speed) : null;
    }
  }

  const delivered = status === 'DELIVERED';
  return {
    scope: job.scope,
    status,
    step: localStepIndex(status),
    outcome: localOutcome(status),
    failureReason: status === 'FAILED_ATTEMPT' && isFailureReason(job.failure_reason) ? job.failure_reason : null,
    vehicle: job.vehicle_required,
    times: {
      requested: job.requested_at_ts ?? job.confirmed_at_ts ?? job.created_at_ts,
      assigned: job.assigned_at_ts,
      pickedUp: job.picked_up_at_ts,
      onTheWay: job.on_the_way_at_ts,
      delivered: job.delivered_at_ts,
    },
    courier,
    live,
    position,
    etaMinutes: eta,
    route: {
      pickupCity: pc?.name ?? null,
      dropoffCity: dc?.name ?? null,
      pickupArea: pz?.name ?? null,
      dropoffArea: dz?.name ?? null,
      pickup: areaPoint(pz, pc),
      dropoff: areaPoint(dz, dc),
    },
    pod: delivered
      ? { recipient: maskName(job.pod_recipient_name), deliveredAt: job.delivered_at_ts, photo: !!job.pod_photo_file }
      : null,
    pollMs: isLocalTrackingOpen(status) ? LOCAL_TRACK_POLL_MS : null,
  };
}
