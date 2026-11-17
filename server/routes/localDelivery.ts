// Public local-delivery booking (docs/DISPATCH_SPEC.md §5, §8, §11; CONTENT §7.5; tracker G.6).
//
//   POST /api/local-delivery/quote   the admin price for a city, two areas, a size and express, or
//                                    "no price" (the form then says "We'll confirm your price").
//   POST /api/local-delivery         books a delivery: a LOCAL shipment (TX ID) and its job in
//                                    REQUESTED, with the rate-sheet price when one matches.
//
// Both are public and rate-limited. The customer can only send the fields of the public form: the
// price, vehicle, delivery code and fee collection are decided by the server or by dispatch. Prices
// come only from the admin's rate sheet through the same shared function the console uses
// (src/shared/localPricing.ts); nothing is invented when no rate matches.
import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { inTransaction } from '../auth/schema.js';
import { serverError } from '../errors.js';
import { localQuoteLimiter, publicWriteLimiter } from '../middleware/rateLimit.js';
import { isDeliverableAddress, queueEmail } from '../mail/outbox.js';
import { cleanVar } from '../mail/layout.js';
import { trackUrl } from '../mail/urls.js';
import {
  checkJobShape, createJobShipment, defaultVehicle, fail, isFail, loadJob, newJobId, priceJob, readJobInput, writeTransition,
  type Fail, type Place,
} from '../dispatch/jobs.js';
import { findTransition } from '../../src/shared/dispatchStatus.js';
import { isSizeClass } from '../../src/shared/localPricing.js';

export const localDeliveryRouter = Router();

/** Preferred pickup time: from a few minutes ago (the form was open a while) up to 30 days ahead. */
export const PICKUP_TIME_PAST_MS = 15 * 60_000;
export const PICKUP_TIME_AHEAD_MS = 30 * 86_400_000;
const EMAIL_MAX = 254;
/** Shown as the author of the "Delivery requested" event (console only). */
const ONLINE_ACTOR = { userId: '', name: 'Online booking' };

const send = (res: Response, f: Fail) =>
  res.status(f.status).json({ success: false, code: f.code, error: f.error, ...(f.details ? { details: f.details } : {}) });
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

interface CityRow { id: string; is_active: number }
interface ZoneRow { id: string; city_id: string; is_active: number }

/** An active city, and an area of it (or none). */
function readCityAndZones(cityId: unknown, zoneIds: unknown[]): { cityId: string; zones: (string | null)[] } | Fail {
  const city = typeof cityId === 'string' && cityId
    ? db.prepare('SELECT id, is_active FROM delivery_cities WHERE id = ?').get(cityId) as CityRow | undefined
    : undefined;
  if (!city || city.is_active !== 1) return fail(400, 'INVALID_CITY', 'Choose a delivery city from the list.');
  const zones: (string | null)[] = [];
  for (const z of zoneIds) {
    if (z === undefined || z === null || z === '') {
      zones.push(null);
      continue;
    }
    const zone = typeof z === 'string' ? db.prepare('SELECT id, city_id, is_active FROM delivery_zones WHERE id = ?').get(z) as ZoneRow | undefined : undefined;
    if (!zone || zone.city_id !== city.id || zone.is_active !== 1) return fail(400, 'INVALID_AREA', 'Choose an area from the list.');
    zones.push(zone.id);
  }
  return { cityId: city.id, zones };
}

/** Only the fields a customer may give for a place; the city is the booking's city. */
function publicPlace(cityId: string, value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const p = value as Record<string, unknown>;
  return {
    cityId,
    zoneId: p.zoneId ?? null,
    landmark: p.landmark,
    contactName: p.contactName,
    contactPhone: p.contactPhone,
    ...(p.lat !== undefined && p.lat !== null ? { lat: p.lat } : {}),
    ...(p.lng !== undefined && p.lng !== null ? { lng: p.lng } : {}),
  };
}

// POST /api/local-delivery/quote { cityId, pickupZoneId?, dropoffZoneId?, sizeClass, isExpress? }
//   → { priced: true, price, currency } | { priced: false, reason: 'NO_RATE' | 'NO_EXPRESS_RATE' }
localDeliveryRouter.post('/quote', localQuoteLimiter, (req: Request, res: Response) => {
  try {
    const b = body(req);
    const place = readCityAndZones(b.cityId, [b.pickupZoneId, b.dropoffZoneId]);
    if (isFail(place)) return send(res, place);
    if (!isSizeClass(b.sizeClass)) return send(res, fail(400, 'INVALID_SIZE', 'Choose the parcel size.'));
    const at = (zoneId: string | null): Place =>
      ({ cityId: place.cityId, zoneId, landmark: '', directions: null, lat: null, lng: null, contactName: '', contactPhone: '' });
    const quote = priceJob(db, at(place.zones[0]), at(place.zones[1]), b.sizeClass, null, b.isExpress === true);
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: quote.ok
        ? { priced: true, price: quote.price, currency: quote.currency }
        : { priced: false, reason: quote.reason === 'NO_EXPRESS_RATE' ? 'NO_EXPRESS_RATE' : 'NO_RATE' },
    });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/local-delivery { cityId, pickup: { zoneId?, landmark, contactName, contactPhone, lat?, lng? },
//   dropoff: { same }, sizeClass, itemDescription?, isExpress?, payer?, codAmount?, scheduledForTs?,
//   email?, locale? } → 201 { trackingNumber, priced, price, currency }
localDeliveryRouter.post('/', publicWriteLimiter, (req: Request, res: Response) => {
  try {
    const b = body(req);
    const pickupIn = b.pickup && typeof b.pickup === 'object' ? b.pickup as Record<string, unknown> : {};
    const dropoffIn = b.dropoff && typeof b.dropoff === 'object' ? b.dropoff as Record<string, unknown> : {};
    const place = readCityAndZones(b.cityId, [pickupIn.zoneId, dropoffIn.zoneId]);
    if (isFail(place)) return send(res, place);

    const now = Date.now();
    if (b.scheduledForTs !== undefined && b.scheduledForTs !== null) {
      const ts = b.scheduledForTs;
      if (typeof ts !== 'number' || !Number.isInteger(ts) || ts < now - PICKUP_TIME_PAST_MS || ts > now + PICKUP_TIME_AHEAD_MS) {
        return send(res, fail(400, 'INVALID_TIME', 'Choose a pickup time from now up to 30 days ahead.'));
      }
    }
    const email = str(b.email).trim();
    if (email && (email.length > EMAIL_MAX || !isDeliverableAddress(email))) {
      return send(res, fail(400, 'INVALID_EMAIL', 'Enter a valid email address, or leave it empty.'));
    }
    const locale = b.locale === 'fr' ? 'fr' : 'en';

    const input = readJobInput(db, {
      scope: 'LOCAL',
      pickup: publicPlace(place.cityId, b.pickup),
      dropoff: publicPlace(place.cityId, b.dropoff),
      sizeClass: b.sizeClass,
      itemDescription: b.itemDescription,
      isExpress: b.isExpress ?? false,
      scheduledForTs: b.scheduledForTs ?? null,
      payer: b.payer ?? 'SENDER',
      codAmount: b.codAmount ?? null,
      notifyLocale: locale,
    }, true);
    if (isFail(input)) return send(res, input);
    const pickup = input.pickup!;
    const dropoff = input.dropoff!;
    const sizeClass = input.sizeClass ?? null;
    const shape = checkJobShape('LOCAL', pickup, dropoff, sizeClass, null);
    if (shape) return send(res, shape);

    const isExpress = !!input.isExpress;
    const quote = priceJob(db, pickup, dropoff, sizeClass, null, isExpress);
    const payer = input.payer ?? 'SENDER';
    const transition = findTransition(null, 'request')!;
    const id = newJobId();
    const row = inTransaction(db, () => {
      const tracking = createJobShipment(db, 'LOCAL', pickup, dropoff, {
        itemDescription: input.itemDescription ?? null, weightKg: null, createdBy: null, senderEmail: email || null,
      });
      db.prepare(`
        INSERT INTO dispatch_jobs (id, tracking_number, scope, status, vehicle_required, pickup_json, dropoff_json, size_class,
          weight_kg, item_description, is_express, scheduled_for_ts, price, currency, price_overridden, payer, cod_amount,
          collect_delivery_fee, delivery_code_hash, notify_locale, created_by, created_at_ts, updated_at_ts)
        VALUES (?, ?, 'LOCAL', 'REQUESTED', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, NULL, ?, ?)
      `).run(id, tracking, defaultVehicle('LOCAL', pickup, dropoff, sizeClass), JSON.stringify(pickup), JSON.stringify(dropoff),
        sizeClass, input.itemDescription ?? null, isExpress ? 1 : 0, input.scheduledForTs ?? null,
        quote.ok ? quote.price : null, quote.ok ? quote.currency : 'XAF', payer, input.codAmount ?? null,
        // When the recipient pays, the courier collects the fee on delivery; dispatch can change it.
        payer === 'RECIPIENT' ? 1 : 0, locale, now, now);
      return writeTransition(db, loadJob(db, id)!, transition, {
        req, actor: ONLINE_ACTOR, at: now,
        auditSummary: `Delivery booked online: ${tracking}`,
        auditBefore: { status: null },
        auditAfter: {
          scope: 'LOCAL', price: quote.ok ? quote.price : null, priced: quote.ok, payer,
          codAmount: input.codAmount ?? null, isExpress, email: email ? 'given' : 'none',
        },
      });
    });

    if (email) {
      queueEmail({
        to: email,
        template: 'local.booked',
        locale,
        vars: { name: cleanVar(pickup.contactName), id: row.tracking_number, link: trackUrl(row.tracking_number, locale) },
        related: { type: 'shipment', id: row.tracking_number },
      });
    }

    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      success: true,
      data: {
        trackingNumber: row.tracking_number,
        priced: quote.ok,
        price: quote.ok ? quote.price : null,
        currency: quote.ok ? quote.currency : 'XAF',
      },
    });
  } catch (err) {
    serverError(res, err);
  }
});
