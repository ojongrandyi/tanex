// Dispatch jobs (docs/DISPATCH_SPEC.md §3–§4, §9): reading and validating job input, pricing,
// creating the linked shipment, and the one function that writes a job's status change with
// everything the spec ties to it: the *_at_ts stamp, the public tracking event (title_key,
// recorded_by), the shipment's status and progress, the audit row, cash ledger rows and, on
// delivery, the Proof of Delivery document. Routes: server/routes/dispatch.ts (staff) and
// server/routes/courier.ts (courier app). The state machine itself is src/shared/dispatchStatus.ts.
import type { Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { audit } from '../audit.js';
import { eventTime } from '../eventTime.js';
import { inTransaction } from '../auth/schema.js';
import { allocateCashRef } from './cashRef.js';
import { createPodDocument } from './podDocument.js';
import { generateUniqueTrackingId } from '../trackingIds.js';
import { normalizePhone } from '../../src/shared/identifier.js';
import { maskName } from '../../src/shared/masking.js';
import { pieceLabel } from '../../src/shared/trackingId.js';
import { shipmentStatusLabel } from '../../src/shared/shipmentStatus.js';
import { eventTitleColumns } from '../../src/shared/eventTitles.js';
import {
  DISPATCH_PROGRESS, DISPATCH_TIMESTAMP_COLUMN, JOB_SCOPES, VEHICLE_TYPES, allowedActions, dispatchEventVars,
  type DispatchActor, type DispatchStatus, type DispatchTransition, type JobScope, type VehicleType,
} from '../../src/shared/dispatchStatus.js';
import {
  SIZE_CLASSES, intercityRateFromRow, isSizeClass, priceIntercityDelivery, priceLocalDelivery, roundMoney, zoneRateFromRow,
  type PriceResult, type SizeClass,
} from '../../src/shared/localPricing.js';

// ---- Limits ----

export const TEXT_MAX = 200;
export const NOTE_MAX = 500;
export const PRICE_MAX = 100_000_000;
export const WEIGHT_MAX_KG = 100_000;
/** Wrong delivery-code entries allowed before dispatch has to override (DISPATCH_SPEC §4). */
export const DELIVERY_CODE_TRIES = 5;
export const DELIVERY_CODE_PATTERN = /^\d{4}$/;
export const CASH_METHODS = ['CASH', 'MTN_MOMO', 'ORANGE_MONEY'] as const;
export type CashMethod = typeof CASH_METHODS[number];
export const PAYERS = ['SENDER', 'RECIPIENT'] as const;

// ---- Rows ----

export interface JobRow {
  id: string;
  tracking_number: string;
  scope: JobScope;
  status: DispatchStatus;
  vehicle_required: VehicleType;
  courier_user_id: string | null;
  pickup_json: string;
  dropoff_json: string;
  size_class: string | null;
  weight_kg: number | null;
  item_description: string | null;
  is_express: number;
  scheduled_for_ts: number | null;
  price: number | null;
  currency: string;
  price_overridden: number;
  payer: string;
  cod_amount: number | null;
  collect_delivery_fee: number;
  delivery_code_hash: string | null;
  delivery_code_attempts: number;
  pod_recipient_name: string | null;
  pod_photo_file: string | null;
  pod_signature_file: string | null;
  pod_note: string | null;
  failure_reason: string | null;
  failure_note: string | null;
  attempts: number;
  notify_locale: string;
  requested_at_ts: number | null;
  confirmed_at_ts: number | null;
  assigned_at_ts: number | null;
  accepted_at_ts: number | null;
  picked_up_at_ts: number | null;
  on_the_way_at_ts: number | null;
  delivered_at_ts: number | null;
  cancelled_at_ts: number | null;
  eta_ts: number | null;
  created_by: string | null;
  created_at_ts: number;
  updated_at_ts: number;
}

/** pickup_json / dropoff_json (DISPATCH_SPEC §3). */
export interface Place {
  cityId: string;
  zoneId: string | null;
  landmark: string;
  directions: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string;
  contactPhone: string;
}

interface CityRow { id: string; name: string; lat: number | null; lng: number | null; time_zone: string; is_active: number }
interface ZoneRow { id: string; city_id: string; name: string; lat: number | null; lng: number | null; is_active: number }

export type Fail = { status: number; code: string; error: string; details?: Record<string, unknown> };
export const fail = (status: number, code: string, error: string, details?: Record<string, unknown>): Fail =>
  ({ status, code, error, ...(details ? { details } : {}) });
export const isFail = (v: unknown): v is Fail => !!v && typeof v === 'object' && 'code' in v && 'status' in v && 'error' in v;

export const loadJob = (conn: DatabaseSync, id: string) =>
  conn.prepare('SELECT * FROM dispatch_jobs WHERE id = ?').get(id) as JobRow | undefined;
const loadCity = (conn: DatabaseSync, id: string | null | undefined) =>
  id ? conn.prepare('SELECT * FROM delivery_cities WHERE id = ?').get(id) as CityRow | undefined : undefined;
const loadZone = (conn: DatabaseSync, id: string | null | undefined) =>
  id ? conn.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(id) as ZoneRow | undefined : undefined;

export function parsePlace(json: string): Place {
  try {
    const p = JSON.parse(json) as Partial<Place>;
    return {
      cityId: String(p.cityId ?? ''), zoneId: p.zoneId ?? null, landmark: String(p.landmark ?? ''),
      directions: p.directions ?? null, lat: p.lat ?? null, lng: p.lng ?? null,
      contactName: String(p.contactName ?? ''), contactPhone: String(p.contactPhone ?? ''),
    };
  } catch {
    return { cityId: '', zoneId: null, landmark: '', directions: null, lat: null, lng: null, contactName: '', contactPhone: '' };
  }
}

// ---- Input ----

const oneLine = (v: string) => v.normalize('NFC').replace(/\s+/g, ' ').trim();
const multiLine = (v: string) => v.normalize('NFC').replace(/\r\n?/g, '\n').trim();

/** Optional single-line text: undefined = absent, null = cleared. */
function readText(value: unknown, max: number, code: string, label: string, multi = false): string | null | undefined | Fail {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return fail(400, code, `${label} must be text.`);
  const v = multi ? multiLine(value) : oneLine(value);
  if (v.length > max) return fail(400, code, `${label} can be up to ${max} characters.`);
  return v || null;
}

export function readMoney(value: unknown, currency: string, code: string, label: string): number | Fail {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > PRICE_MAX) {
    return fail(400, code, `${label} must be a number from 0 to ${PRICE_MAX}.`);
  }
  return roundMoney(value, currency);
}

function readPlace(conn: DatabaseSync, value: unknown, which: 'pickup' | 'dropoff'): Place | Fail {
  const label = which === 'pickup' ? 'Pickup' : 'Drop-off';
  const code = which === 'pickup' ? 'INVALID_PICKUP' : 'INVALID_DROPOFF';
  if (!value || typeof value !== 'object') return fail(400, code, `${label} details are required.`);
  const p = value as Record<string, unknown>;
  const city = loadCity(conn, typeof p.cityId === 'string' ? p.cityId : null);
  if (!city || city.is_active !== 1) return fail(400, code, `${label}: choose a delivery city from the list.`);
  let zoneId: string | null = null;
  if (p.zoneId !== undefined && p.zoneId !== null && p.zoneId !== '') {
    const zone = loadZone(conn, typeof p.zoneId === 'string' ? p.zoneId : null);
    if (!zone || zone.city_id !== city.id || zone.is_active !== 1) return fail(400, code, `${label}: choose an area of ${city.name} from the list.`);
    zoneId = zone.id;
  }
  const landmark = readText(p.landmark, TEXT_MAX, code, `${label} landmark`);
  if (isFail(landmark)) return landmark;
  if (!landmark && !zoneId) return fail(400, code, `${label}: give the area or a landmark.`);
  const directions = readText(p.directions, NOTE_MAX, code, `${label} directions`, true);
  if (isFail(directions)) return directions;
  const contactName = readText(p.contactName, 80, code, `${label} contact name`);
  if (isFail(contactName)) return contactName;
  if (!contactName) return fail(400, code, `${label}: enter the contact's name.`);
  const phone = typeof p.contactPhone === 'string' ? normalizePhone(p.contactPhone) : null;
  if (!phone) return fail(400, code, `${label}: enter a valid contact phone number.`);
  let lat: number | null = null;
  let lng: number | null = null;
  if (p.lat !== undefined && p.lat !== null || p.lng !== undefined && p.lng !== null) {
    const la = Number(p.lat);
    const ln = Number(p.lng);
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || !Number.isFinite(la) || !Number.isFinite(ln)
      || la < -90 || la > 90 || ln < -180 || ln > 180) {
      return fail(400, code, `${label}: the map pin needs a valid latitude and longitude.`);
    }
    lat = Math.round(la * 1e6) / 1e6;
    lng = Math.round(ln * 1e6) / 1e6;
  }
  return { cityId: city.id, zoneId, landmark: landmark ?? '', directions: directions ?? null, lat, lng, contactName, contactPhone: phone };
}

/** Validated job fields present in a create or edit body. */
export interface JobInput {
  scope?: JobScope;
  trackingNumber?: string;
  pickup?: Place;
  dropoff?: Place;
  sizeClass?: SizeClass | null;
  weightKg?: number | null;
  itemDescription?: string | null;
  isExpress?: boolean;
  scheduledForTs?: number | null;
  vehicleRequired?: VehicleType;
  price?: number | null;
  priceReason?: string | null;
  payer?: 'SENDER' | 'RECIPIENT';
  codAmount?: number | null;
  collectDeliveryFee?: boolean;
  /** A new 4-digit code, or null to remove it. */
  deliveryCode?: string | null;
  notifyLocale?: 'en' | 'fr';
}

export function readJobInput(conn: DatabaseSync, b: Record<string, unknown>, creating: boolean): JobInput | Fail {
  const out: JobInput = {};
  if (creating) {
    if (typeof b.scope !== 'string' || !(JOB_SCOPES as readonly string[]).includes(b.scope)) {
      return fail(400, 'INVALID_SCOPE', 'Choose the kind of job: local, intercity, first mile or last mile.');
    }
    out.scope = b.scope as JobScope;
    if (out.scope === 'FIRST_MILE' || out.scope === 'LAST_MILE') {
      const t = typeof b.trackingNumber === 'string' ? b.trackingNumber.trim().toUpperCase() : '';
      const ship = t ? conn.prepare('SELECT service_scope FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(t) as
        { service_scope: string | null } | undefined : undefined;
      if (!ship) return fail(400, 'UNKNOWN_SHIPMENT', 'Enter the tracking ID of the shipment this leg belongs to.');
      if (ship.service_scope === 'LOCAL' || ship.service_scope === 'INTERCITY') {
        return fail(400, 'INVALID_SCOPE', 'First- and last-mile legs belong to worldwide shipments.');
      }
      out.trackingNumber = t;
    }
  }
  if (b.pickup !== undefined || creating) {
    const p = readPlace(conn, b.pickup, 'pickup');
    if (isFail(p)) return p;
    out.pickup = p;
  }
  if (b.dropoff !== undefined || creating) {
    const p = readPlace(conn, b.dropoff, 'dropoff');
    if (isFail(p)) return p;
    out.dropoff = p;
  }
  if (b.sizeClass !== undefined) {
    if (b.sizeClass === null || b.sizeClass === '') out.sizeClass = null;
    else if (!isSizeClass(b.sizeClass)) return fail(400, 'INVALID_SIZE', `Choose a size: ${SIZE_CLASSES.join(', ').toLowerCase()}.`);
    else out.sizeClass = b.sizeClass;
  }
  if (b.weightKg !== undefined) {
    if (b.weightKg === null || b.weightKg === '') out.weightKg = null;
    else if (typeof b.weightKg !== 'number' || !Number.isFinite(b.weightKg) || b.weightKg <= 0 || b.weightKg > WEIGHT_MAX_KG) {
      return fail(400, 'INVALID_WEIGHT', `Weight must be more than 0 and up to ${WEIGHT_MAX_KG} kg.`);
    } else out.weightKg = Math.round(b.weightKg * 100) / 100;
  }
  const item = readText(b.itemDescription, TEXT_MAX, 'INVALID_ITEM', 'The item description');
  if (isFail(item)) return item;
  if (item !== undefined) out.itemDescription = item;
  if (b.isExpress !== undefined) {
    if (typeof b.isExpress !== 'boolean') return fail(400, 'INVALID_INPUT', 'isExpress must be true or false.');
    out.isExpress = b.isExpress;
  }
  if (b.scheduledForTs !== undefined) {
    if (b.scheduledForTs === null) out.scheduledForTs = null;
    else if (typeof b.scheduledForTs !== 'number' || !Number.isInteger(b.scheduledForTs) || b.scheduledForTs <= 0) {
      return fail(400, 'INVALID_TIME', 'The preferred time is not valid.');
    } else out.scheduledForTs = b.scheduledForTs;
  }
  if (b.vehicleRequired !== undefined) {
    if (typeof b.vehicleRequired !== 'string' || !(VEHICLE_TYPES as readonly string[]).includes(b.vehicleRequired)) {
      return fail(400, 'INVALID_VEHICLE', 'Choose a vehicle: bike, van or truck.');
    }
    out.vehicleRequired = b.vehicleRequired as VehicleType;
  }
  if (b.price !== undefined && b.price !== null) {
    const price = readMoney(b.price, 'XAF', 'INVALID_PRICE', 'The price');
    if (isFail(price)) return price;
    out.price = price;
    const reason = readText(b.priceReason, NOTE_MAX, 'REASON_REQUIRED', 'The reason');
    if (isFail(reason)) return reason;
    if (!reason) return fail(400, 'REASON_REQUIRED', 'Give a reason for setting the price by hand.');
    out.priceReason = reason;
  }
  if (b.payer !== undefined) {
    if (!(PAYERS as readonly unknown[]).includes(b.payer)) return fail(400, 'INVALID_PAYER', 'Choose who pays: sender or recipient.');
    out.payer = b.payer as 'SENDER' | 'RECIPIENT';
  }
  if (b.codAmount !== undefined) {
    if (b.codAmount === null || b.codAmount === 0) out.codAmount = null;
    else {
      const cod = readMoney(b.codAmount, 'XAF', 'INVALID_COD', 'The amount to collect');
      if (isFail(cod)) return cod;
      out.codAmount = cod || null;
    }
  }
  if (b.collectDeliveryFee !== undefined) {
    if (typeof b.collectDeliveryFee !== 'boolean') return fail(400, 'INVALID_INPUT', 'collectDeliveryFee must be true or false.');
    out.collectDeliveryFee = b.collectDeliveryFee;
  }
  if (b.deliveryCode !== undefined) {
    if (b.deliveryCode === null || b.deliveryCode === '') out.deliveryCode = null;
    else if (typeof b.deliveryCode !== 'string' || !DELIVERY_CODE_PATTERN.test(b.deliveryCode.trim())) {
      return fail(400, 'INVALID_DELIVERY_CODE', 'The delivery code is 4 digits.');
    } else out.deliveryCode = b.deliveryCode.trim();
  }
  if (b.notifyLocale !== undefined) {
    if (b.notifyLocale !== 'en' && b.notifyLocale !== 'fr') return fail(400, 'INVALID_LOCALE', 'Choose English or French.');
    out.notifyLocale = b.notifyLocale;
  }
  return out;
}

/** Scope rules on the final pickup/drop-off/size/weight of a job. */
export function checkJobShape(scope: JobScope, pickup: Place, dropoff: Place, sizeClass: string | null, weightKg: number | null): Fail | null {
  if (scope === 'LOCAL') {
    if (pickup.cityId !== dropoff.cityId) return fail(400, 'CITY_MISMATCH', 'A local delivery picks up and drops off in the same city.');
    if (!sizeClass) return fail(400, 'INVALID_SIZE', 'Choose the parcel size.');
  }
  if (scope === 'INTERCITY') {
    if (pickup.cityId === dropoff.cityId) return fail(400, 'CITY_MISMATCH', 'An intercity delivery goes between two different cities.');
    if (!weightKg) return fail(400, 'INVALID_WEIGHT', 'Enter the weight for an intercity delivery.');
  }
  return null;
}

/** Vehicle when dispatch doesn't choose one: truck between cities, van for large parcels, else bike. */
export function defaultVehicle(scope: JobScope, pickup: Place, dropoff: Place, sizeClass: string | null): VehicleType {
  if (scope === 'INTERCITY' || pickup.cityId !== dropoff.cityId) return 'TRUCK';
  return sizeClass === 'LARGE' ? 'VAN' : 'BIKE';
}

/** The admin price for a job (same shared functions as the public quote, DISPATCH_SPEC §5). */
export function priceJob(conn: DatabaseSync, pickup: Place, dropoff: Place, sizeClass: string | null, weightKg: number | null, isExpress: boolean): PriceResult {
  if (pickup.cityId === dropoff.cityId) {
    if (!sizeClass) return { ok: false, reason: 'INVALID_REQUEST' };
    const rates = (conn.prepare('SELECT * FROM zone_rates WHERE city_id = ?').all(pickup.cityId) as unknown[]).map(zoneRateFromRow);
    return priceLocalDelivery({ cityId: pickup.cityId, fromZoneId: pickup.zoneId, toZoneId: dropoff.zoneId, sizeClass, express: isExpress }, rates);
  }
  if (!weightKg) return { ok: false, reason: 'INVALID_REQUEST' };
  const rates = (conn.prepare('SELECT * FROM intercity_rates WHERE from_city_id = ? AND to_city_id = ?')
    .all(pickup.cityId, dropoff.cityId) as unknown[]).map(intercityRateFromRow);
  return priceIntercityDelivery({ fromCityId: pickup.cityId, toCityId: dropoff.cityId, weightKg }, rates);
}

// ---- Delivery code ----

export const hashDeliveryCode = (code: string) => bcrypt.hashSync(code, 8);
export const deliveryCodeMatches = (code: string, hash: string) => bcrypt.compareSync(code, hash);

// ---- Output ----

export interface JobOutOptions {
  /** 'dispatch' (console) or 'courier' (courier app): which actions and file URLs to give. */
  view: 'dispatch' | 'courier';
}

function placeOut(conn: DatabaseSync, p: Place) {
  const city = loadCity(conn, p.cityId);
  const zone = loadZone(conn, p.zoneId);
  return { ...p, cityName: city?.name ?? null, zoneName: zone?.name ?? null };
}

export function jobOut(conn: DatabaseSync, row: JobRow, options: JobOutOptions) {
  const courier = row.courier_user_id
    ? conn.prepare(`
        SELECT c.user_id, c.public_first_name, c.vehicle_type, c.plate_number, u.display_name, u.phone
        FROM couriers c JOIN users u ON u.id = c.user_id WHERE c.user_id = ?
      `).get(row.courier_user_id) as
      { user_id: string; public_first_name: string; vehicle_type: string; plate_number: string | null; display_name: string; phone: string | null } | undefined
    : undefined;
  const base = options.view === 'courier' ? `/api/courier/jobs/${encodeURIComponent(row.id)}/pod` : `/api/dispatch/jobs/${encodeURIComponent(row.id)}/pod`;
  const fileUrl = (kind: string, file: string | null) => (file ? `${base}/${kind}?v=${encodeURIComponent(file.split('.')[0])}` : null);
  const actor: DispatchActor = options.view === 'courier' ? 'courier' : 'dispatch';
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    scope: row.scope,
    status: row.status,
    vehicleRequired: row.vehicle_required,
    courierUserId: row.courier_user_id,
    courier: courier ? {
      userId: courier.user_id, publicFirstName: courier.public_first_name, displayName: courier.display_name,
      phone: courier.phone, vehicleType: courier.vehicle_type, plateNumber: courier.plate_number,
    } : null,
    pickup: placeOut(conn, parsePlace(row.pickup_json)),
    dropoff: placeOut(conn, parsePlace(row.dropoff_json)),
    sizeClass: row.size_class,
    weightKg: row.weight_kg,
    itemDescription: row.item_description,
    isExpress: row.is_express === 1,
    scheduledForTs: row.scheduled_for_ts,
    price: row.price,
    currency: row.currency,
    priceOverridden: row.price_overridden === 1,
    payer: row.payer,
    codAmount: row.cod_amount,
    collectDeliveryFee: row.collect_delivery_fee === 1,
    hasDeliveryCode: !!row.delivery_code_hash,
    deliveryCodeTriesLeft: row.delivery_code_hash ? Math.max(0, DELIVERY_CODE_TRIES - row.delivery_code_attempts) : null,
    pod: {
      recipientName: row.pod_recipient_name,
      photoUrl: fileUrl('photo', row.pod_photo_file),
      signatureUrl: fileUrl('signature', row.pod_signature_file),
      note: row.pod_note,
    },
    failureReason: row.failure_reason,
    failureNote: row.failure_note,
    attempts: row.attempts,
    notifyLocale: row.notify_locale,
    requestedAt: row.requested_at_ts,
    confirmedAt: row.confirmed_at_ts,
    assignedAt: row.assigned_at_ts,
    acceptedAt: row.accepted_at_ts,
    pickedUpAt: row.picked_up_at_ts,
    onTheWayAt: row.on_the_way_at_ts,
    deliveredAt: row.delivered_at_ts,
    cancelledAt: row.cancelled_at_ts,
    etaTs: row.eta_ts,
    createdAt: row.created_at_ts,
    updatedAt: row.updated_at_ts,
    allowedActions: allowedActions(row.status, actor),
  };
}

// ---- Shipment for a new local / intercity job ----

/**
 * Inserts the shipment (TX ID) behind a new LOCAL or INTERCITY job: booked, 0 %, one piece,
 * service_scope set so server/progress.ts never advances it on a schedule. Coordinates come from
 * the map pin, else the area, else the city; 0 when none is set (the local track view, G.7, uses
 * the job's own places, not these columns).
 */
export function createJobShipment(conn: DatabaseSync, scope: 'LOCAL' | 'INTERCITY', pickup: Place, dropoff: Place,
  input: { itemDescription: string | null; weightKg: number | null; createdBy: string | null }): string {
  const tracking = generateUniqueTrackingId();
  const pc = loadCity(conn, pickup.cityId)!;
  const dc = loadCity(conn, dropoff.cityId)!;
  const coords = (p: Place, city: CityRow) => {
    const zone = loadZone(conn, p.zoneId);
    if (p.lat !== null && p.lng !== null) return { lat: p.lat, lng: p.lng };
    if (zone?.lat != null && zone?.lng != null) return { lat: zone.lat, lng: zone.lng };
    return { lat: city.lat ?? 0, lng: city.lng ?? 0 };
  };
  const o = coords(pickup, pc);
  const d = coords(dropoff, dc);
  const now = Date.now();
  const status = 'BOOKED';
  const weightLbs = input.weightKg ? Math.round(input.weightKg * 2.20462 * 100) / 100 : 0;
  const party = (p: Place, city: CityRow) => ({ name: p.contactName, phone: p.contactPhone, address: p.landmark, city: city.name });
  conn.prepare(`
    INSERT INTO shipments (
      tracking_number, barcode_code, status, status_text, progress_percent, last_updated, created_at,
      estimated_delivery_date, estimated_delivery_time, service, shipment_type, cargo_description,
      total_weight_lbs, total_pieces, declared_value, origin_city, origin_state, origin_lat, origin_lng,
      destination_city, destination_state, destination_lat, destination_lng,
      current_location_city, current_location_state, current_location_lat, current_location_lng,
      current_facility, sender_json, recipient_json, dimensions_json,
      progress_updated_at_ts, created_at_ts, created_by, service_scope
    ) VALUES (?, ?, ?, ?, 0, 'Just now', ?, '', '', ?, 'Parcel', ?, ?, 1, 0, ?, '', ?, ?, ?, '', ?, ?, ?, '', ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)
  `).run(
    tracking, `*${tracking}*`, status, shipmentStatusLabel(status),
    new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    scope === 'LOCAL' ? 'Local Delivery' : 'Intercity Delivery',
    input.itemDescription ?? '',
    weightLbs,
    pc.name, o.lat, o.lng, dc.name, d.lat, d.lng, pc.name, o.lat, o.lng, pc.name,
    JSON.stringify(party(pickup, pc)), JSON.stringify(party(dropoff, dc)),
    now, now, input.createdBy, scope,
  );
  conn.prepare(`
    INSERT INTO shipment_pieces (id, tracking_number, parent_tracking, piece_number, total_pieces, status, status_text,
                                 current_location, weight_lbs, dimensions_json)
    VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, '{}')
  `).run(`${tracking}-P1`, pieceLabel(tracking, 1), tracking, status, shipmentStatusLabel(status), pc.name, weightLbs);
  return tracking;
}

// ---- Status changes ----

export interface CashEntryInput {
  amount: number;
  method: CashMethod;
  momoReference: string | null;
  note: string | null;
}

export function readCashEntries(value: unknown, currency: string): CashEntryInput[] | Fail {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 3) return fail(400, 'INVALID_CASH', 'Record up to 3 payments collected.');
  const out: CashEntryInput[] = [];
  for (const raw of value) {
    const e = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const amount = readMoney(e.amount, currency, 'INVALID_CASH', 'The amount collected');
    if (isFail(amount)) return amount;
    if (amount <= 0) return fail(400, 'INVALID_CASH', 'The amount collected must be more than 0.');
    if (!(CASH_METHODS as readonly unknown[]).includes(e.method)) return fail(400, 'INVALID_CASH', 'Choose how it was paid: cash, MTN MoMo or Orange Money.');
    const ref = readText(e.momoReference, 60, 'INVALID_CASH', 'The transaction reference');
    if (isFail(ref)) return ref;
    if (e.method !== 'CASH' && !ref) return fail(400, 'MOMO_REFERENCE_REQUIRED', 'Enter the mobile money transaction reference.');
    const note = readText(e.note, NOTE_MAX, 'INVALID_CASH', 'The note', true);
    if (isFail(note)) return note;
    out.push({ amount, method: e.method as CashMethod, momoReference: e.method === 'CASH' ? null : ref ?? null, note: note ?? null });
  }
  return out;
}

export interface TransitionContext {
  req: Request;
  actor: { userId: string; name: string };
  /** When it happened (device time for courier actions, already checked). */
  at: number;
  /** Extra dispatch_jobs columns to set with the status (courier, POD fields, reason...). */
  sets?: Record<string, string | number | null>;
  cash?: CashEntryInput[];
  auditSummary: string;
  auditBefore?: Record<string, unknown>;
  auditAfter?: Record<string, unknown>;
  /** Cancel: also move a LOCAL/INTERCITY shipment to the trash. */
  trashShipment?: boolean;
}

/**
 * What a move does to the shipment for each kind of job. LOCAL and INTERCITY jobs are the whole
 * shipment (spec §4 table). A LAST_MILE leg finishes a worldwide shipment, so only its final
 * steps show publicly and change the status; a FIRST_MILE leg (customer's door to the office)
 * only adds the pick-up event (tracker #163, owner to confirm).
 */
function shipmentEffect(scope: JobScope, t: DispatchTransition): { event: boolean; status: string | null; progress: number | null } {
  if (scope === 'LOCAL' || scope === 'INTERCITY') {
    return { event: !!t.eventKey, status: t.shipmentStatus, progress: DISPATCH_PROGRESS[t.to] };
  }
  if (scope === 'LAST_MILE') {
    const late = t.action === 'pick_up' || t.action === 'start_delivery' || t.action === 'deliver' || t.action === 'fail';
    const status = t.action === 'start_delivery' || t.action === 'deliver' || t.action === 'fail' ? t.shipmentStatus : null;
    return { event: late && !!t.eventKey, status, progress: t.action === 'deliver' ? 100 : null };
  }
  return { event: t.action === 'pick_up', status: null, progress: null };
}

function insertTrackingEvent(conn: DatabaseSync, job: JobRow, t: DispatchTransition, ctx: TransitionContext, shipmentStatus: string, vars: Record<string, string>) {
  const place = parsePlace(t.to === 'ACCEPTED' || t.to === 'PICKED_UP' || t.to === 'ASSIGNED' || t.to === 'CONFIRMED'
    || t.to === 'REQUESTED' || t.to === 'CANCELLED' ? job.pickup_json : job.dropoff_json);
  const city = loadCity(conn, place.cityId);
  const location = city?.name ?? '';
  const time = eventTime(location, { occurredAt: ctx.at, timeZone: city?.time_zone ?? 'Africa/Douala' });
  const title = eventTitleColumns(t.eventKey!, vars);
  const count = (conn.prepare('SELECT COUNT(*) AS c FROM tracking_events WHERE shipment_tracking = ?').get(job.tracking_number) as { c: number }).c;
  conn.prepare('UPDATE tracking_events SET current_flag = 0 WHERE shipment_tracking = ?').run(job.tracking_number);
  // Description repeats the (masked) title: tracking events are public, so no names, phones or
  // courier notes go in them.
  conn.prepare(`
    INSERT INTO tracking_events (
      id, shipment_tracking, status, title, location, facility, timestamp, description, operator_notes,
      delay_flag, completed, current_flag, sort_order, recorded_by, occurred_at_ts, time_zone, title_key, title_vars_json
    ) VALUES (?, ?, ?, ?, ?, '', ?, ?, NULL, ?, 1, 1, ?, ?, ?, ?, ?, ?)
  `).run(
    `e-${ctx.at}-${crypto.randomBytes(4).toString('hex')}`, job.tracking_number, shipmentStatus, title.title, location,
    time.timestamp, title.title, t.to === 'FAILED_ATTEMPT' ? 1 : 0, count + 1, ctx.actor.name,
    time.occurredAtTs, time.timeZone, title.titleKey, title.titleVarsJson,
  );
}

/**
 * Writes a checked transition (call checkTransition first). Not wrapped in a transaction: use
 * applyTransition, or call this inside your own inTransaction with other writes (idempotency key).
 * Returns the updated row.
 */
export function writeTransition(conn: DatabaseSync, job: JobRow, t: DispatchTransition, ctx: TransitionContext): JobRow {
  const sets: Record<string, string | number | null> = { ...(ctx.sets ?? {}), status: t.to, updated_at_ts: Date.now() };
  const tsColumn = DISPATCH_TIMESTAMP_COLUMN[t.to];
  if (tsColumn) sets[tsColumn] = ctx.at;
  const cols = Object.keys(sets);
  conn.prepare(`UPDATE dispatch_jobs SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => sets[c]), job.id);
  const updated = loadJob(conn, job.id)!;

  const effect = shipmentEffect(job.scope, t);
  const ship = conn.prepare('SELECT status, progress_percent FROM shipments WHERE tracking_number = ?').get(job.tracking_number) as
    { status: string; progress_percent: number } | undefined;
  if (ship) {
    const status = effect.status ?? ship.status;
    if (effect.status || effect.progress !== null) {
      conn.prepare(`
        UPDATE shipments SET status = ?, status_text = ?, progress_percent = ?, last_updated = 'Just now', progress_updated_at_ts = ?
        WHERE tracking_number = ?
      `).run(status, shipmentStatusLabel(status), effect.progress ?? ship.progress_percent, Date.now(), job.tracking_number);
      if (effect.status) {
        conn.prepare('UPDATE shipment_pieces SET status = ?, status_text = ? WHERE parent_tracking = ?')
          .run(status, shipmentStatusLabel(status), job.tracking_number);
      }
    }
    if (effect.event) {
      const courier = updated.courier_user_id
        ? conn.prepare('SELECT public_first_name FROM couriers WHERE user_id = ?').get(updated.courier_user_id) as { public_first_name: string } | undefined
        : undefined;
      const vars = dispatchEventVars(t, {
        riderFirstName: courier?.public_first_name,
        maskedRecipientName: maskName(updated.pod_recipient_name),
        failureReason: updated.failure_reason,
      });
      insertTrackingEvent(conn, updated, t, ctx, status, vars);
    }
    if (ctx.trashShipment && (job.scope === 'LOCAL' || job.scope === 'INTERCITY')) {
      conn.prepare('UPDATE shipments SET deleted_at_ts = ? WHERE tracking_number = ? AND deleted_at_ts IS NULL').run(Date.now(), job.tracking_number);
    }
  }

  const cashRefs: string[] = [];
  for (const c of ctx.cash ?? []) {
    const ref = allocateCashRef(conn);
    conn.prepare(`
      INSERT INTO cash_ledger (id, ref, courier_user_id, job_id, entry_type, method, amount, currency, momo_reference,
                               status, recorded_by, note, created_at_ts)
      VALUES (?, ?, ?, ?, 'COLLECTED', ?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `).run('csh_' + crypto.randomBytes(9).toString('hex'), ref, updated.courier_user_id ?? ctx.actor.userId, job.id,
      c.method, c.amount, job.currency, c.momoReference, ctx.actor.userId, c.note, ctx.at);
    cashRefs.push(ref);
  }

  let podDocumentId: string | null = null;
  if (t.to === 'DELIVERED') podDocumentId = createPodDocument(conn, updated, ctx.actor.name, cashRefs);

  audit(ctx.req, `dispatch.${t.action}`, 'dispatch_job', job.id, ctx.auditSummary,
    { status: job.status, ...(ctx.auditBefore ?? {}) },
    {
      status: t.to, trackingNumber: job.tracking_number, ...(ctx.auditAfter ?? {}),
      ...(cashRefs.length ? { cash: (ctx.cash ?? []).map((c, i) => ({ ref: cashRefs[i], amount: c.amount, method: c.method })) } : {}),
      ...(podDocumentId ? { podDocumentId } : {}),
    },
    { conn });
  return updated;
}

export function applyTransition(conn: DatabaseSync, job: JobRow, t: DispatchTransition, ctx: TransitionContext): JobRow {
  return inTransaction(conn, () => writeTransition(conn, job, t, ctx));
}

/** Device time of a courier action if plausible (last 7 days, not ahead), else now. */
export function actionTime(deviceTs: unknown, job: JobRow, now = Date.now()): number {
  const n = typeof deviceTs === 'number' && Number.isFinite(deviceTs) ? Math.round(deviceTs) : NaN;
  const latestStep = Math.max(0, ...[job.requested_at_ts, job.confirmed_at_ts, job.assigned_at_ts, job.accepted_at_ts,
    job.picked_up_at_ts, job.on_the_way_at_ts].map((v) => v ?? 0));
  if (!Number.isFinite(n) || n > now + 5 * 60_000 || n < now - 7 * 86_400_000 || n < latestStep) return now;
  return Math.min(n, now);
}

/** A new job id ('job_' + random, DISPATCH_SPEC §3). */
export const newJobId = () => 'job_' + crypto.randomBytes(9).toString('hex');
