// Dispatch settings kept by Console → Tariffs (docs/DISPATCH_SPEC.md §7, §8): the average in-town speed
// per vehicle used for the approximate ETA, and the minutes after which a waiting job is flagged on
// the dispatch board (confirmed but not assigned; assigned but not accepted). Stored in the settings
// table under the key 'dispatch'. Speed defaults are the spec's (bike 18 km/h, van/truck 30 km/h);
// alert defaults are 15 and 10 minutes (tracker #170), all editable by the admin. DOM-free.
import { VEHICLE_TYPES, type VehicleType } from './dispatchStatus.js';

export type DispatchAlertMinutes = {
  /** A confirmed job not assigned after this many minutes is a problem; 0 = never. */
  unassigned: number;
  /** An assigned job the courier hasn't accepted after this many minutes is a problem; 0 = never. */
  notAccepted: number;
};

export interface DispatchSettings {
  avgSpeedKmh: Record<VehicleType, number>;
  alertMinutes: DispatchAlertMinutes;
}

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  avgSpeedKmh: { BIKE: 18, VAN: 30, TRUCK: 30 },
  alertMinutes: { unassigned: 15, notAccepted: 10 },
};

export const SPEED_MIN_KMH = 1;
export const SPEED_MAX_KMH = 120;
export const ALERT_MAX_MINUTES = 1440;
export const ALERT_KEYS = ['unassigned', 'notAccepted'] as const;

export function isValidSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= SPEED_MIN_KMH && value <= SPEED_MAX_KMH;
}

/** Whole minutes from 0 (off) to one day. */
export function isValidAlertMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= ALERT_MAX_MINUTES;
}

/** Stored JSON → settings, falling back to the default for anything missing or invalid. */
export function readDispatchSettings(stored: unknown): DispatchSettings {
  const s = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const speeds = s.avgSpeedKmh && typeof s.avgSpeedKmh === 'object' ? (s.avgSpeedKmh as Record<string, unknown>) : {};
  const avgSpeedKmh = { ...DEFAULT_DISPATCH_SETTINGS.avgSpeedKmh };
  for (const v of VEHICLE_TYPES) {
    const n = speeds[v];
    if (isValidSpeed(n)) avgSpeedKmh[v] = Math.round(n * 10) / 10;
  }
  const alerts = s.alertMinutes && typeof s.alertMinutes === 'object' ? (s.alertMinutes as Record<string, unknown>) : {};
  const alertMinutes = { ...DEFAULT_DISPATCH_SETTINGS.alertMinutes };
  for (const k of ALERT_KEYS) {
    const n = alerts[k];
    if (isValidAlertMinutes(n)) alertMinutes[k] = n;
  }
  return { avgSpeedKmh, alertMinutes };
}
