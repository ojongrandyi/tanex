// Courier positions (DISPATCH_SPEC §3, §6): recorded only while the courier has a job being picked
// up or on the way, kept 30 days, then purged by a timer started from server/index.ts. The same
// sweep drops courier idempotency keys after 30 days (an offline phone retries within hours).
import type { DatabaseSync } from 'node:sqlite';

export const LOCATION_RETENTION_MS = 30 * 86_400_000;
export const ACTION_KEY_RETENTION_MS = 30 * 86_400_000;
const PURGE_INTERVAL_MS = 60 * 60_000;
/** Points accepted in one request (a phone that was offline sends its backlog). */
export const MAX_POINTS_PER_REQUEST = 50;

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedMps: number | null;
  heading: number | null;
  recordedAtTs: number;
}

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

/**
 * One point from the courier app, or null when it isn't valid. A device time more than 5 minutes
 * ahead or older than 24 hours is replaced by the server time.
 */
export function readLocationPoint(raw: unknown, now = Date.now()): LocationPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const lat = num(p.lat, -90, 90);
  const lng = num(p.lng, -180, 180);
  if (lat === null || lng === null) return null;
  const ts = typeof p.recordedAtTs === 'number' && Number.isFinite(p.recordedAtTs) ? Math.round(p.recordedAtTs) : NaN;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    accuracyM: num(p.accuracyM, 0, 100_000),
    speedMps: num(p.speedMps, 0, 200),
    heading: num(p.heading, 0, 360),
    recordedAtTs: Number.isFinite(ts) && ts <= now + 5 * 60_000 && ts >= now - 86_400_000 ? Math.min(ts, now) : now,
  };
}

export function insertLocations(conn: DatabaseSync, courierUserId: string, jobId: string, points: readonly LocationPoint[]): void {
  const stmt = conn.prepare(`
    INSERT INTO courier_locations (courier_user_id, job_id, lat, lng, accuracy_m, speed_mps, heading, recorded_at_ts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of points) stmt.run(courierUserId, jobId, p.lat, p.lng, p.accuracyM, p.speedMps, p.heading, p.recordedAtTs);
}

/** Deletes positions older than 30 days and old idempotency keys. Returns the positions removed. */
export function purgeOldLocations(conn: DatabaseSync, now = Date.now()): number {
  const removed = conn.prepare('DELETE FROM courier_locations WHERE recorded_at_ts < ?').run(now - LOCATION_RETENTION_MS);
  conn.prepare('DELETE FROM dispatch_action_keys WHERE created_at_ts < ?').run(now - ACTION_KEY_RETENTION_MS);
  return Number(removed.changes);
}

export function startLocationPurge(conn: DatabaseSync): NodeJS.Timeout {
  const tick = () => {
    try {
      const n = purgeOldLocations(conn);
      if (n > 0) console.log(`[dispatch] ${n} courier position(s) older than 30 days removed`);
    } catch (err) {
      console.error('[dispatch] location purge failed:', err);
    }
  };
  tick();
  const timer = setInterval(tick, PURGE_INTERVAL_MS);
  timer.unref();
  return timer;
}
