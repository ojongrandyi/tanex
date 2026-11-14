// Dispatch settings kept by Console → Tariffs (docs/DISPATCH_SPEC.md §8): the average in-town speed
// per vehicle used for the approximate ETA. Stored in the settings table under the key 'dispatch'.
// The defaults are the spec's (bike 18 km/h, van/truck 30 km/h) until the admin changes them. DOM-free.
import { VEHICLE_TYPES, type VehicleType } from './dispatchStatus.js';

export interface DispatchSettings {
  avgSpeedKmh: Record<VehicleType, number>;
}

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  avgSpeedKmh: { BIKE: 18, VAN: 30, TRUCK: 30 },
};

export const SPEED_MIN_KMH = 1;
export const SPEED_MAX_KMH = 120;

export function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= SPEED_MIN_KMH && value <= SPEED_MAX_KMH;
}

/** Stored JSON → settings, falling back to the default for anything missing or invalid. */
export function readDispatchSettings(stored: unknown): DispatchSettings {
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>).avgSpeedKmh : undefined;
  const speeds = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const avgSpeedKmh = { ...DEFAULT_DISPATCH_SETTINGS.avgSpeedKmh };
  for (const v of VEHICLE_TYPES) {
    const n = speeds[v];
    if (isValidSpeed(n)) avgSpeedKmh[v] = Math.round(n * 10) / 10;
  }
  return { avgSpeedKmh };
}
