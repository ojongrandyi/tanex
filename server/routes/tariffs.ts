// Delivery tariffs (docs/DISPATCH_SPEC.md §3, §5, §8, §11): delivery cities, their areas (zones) with
// aliases and an optional map pin, the zone-rate sheet per size with express surcharges, intercity
// weight bands, and the average speeds used for ETAs. Everything needs tariffs.manage except
// GET /areas, the public list of active cities and areas for the booking form (G.6). Every write
// is audited. Nothing here ever creates a price on its own: the suggested-areas import adds names
// only (CLAUDE.md rule 9).
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { requirePermission } from '../middleware/auth.js';
import { inTransaction } from '../auth/schema.js';
import { serverError } from '../errors.js';
import { SIZE_CLASSES, isSizeClass, roundMoney, type SizeClass } from '../../src/shared/localPricing.js';
import { SUGGESTED_AREAS, nameKey } from '../../src/shared/suggestedAreas.js';
import { VEHICLE_TYPES } from '../../src/shared/dispatchStatus.js';
import {
  ALERT_KEYS, ALERT_MAX_MINUTES, isValidAlertMinutes, isValidSpeed, readDispatchSettings, type DispatchSettings,
} from '../../src/shared/dispatchSettings.js';

export const NAME_MAX = 60;
export const ALIASES_MAX = 500;
export const PRICE_MAX = 100_000_000;
export const WEIGHT_MAX_KG = 100_000;
export const BANDS_MAX = 50;
const DISPATCH_SETTINGS_KEY = 'dispatch';

// ---- Rows and output ------------------------------------------------------------------------

interface CityRow { id: string; name: string; country_iso: string; lat: number | null; lng: number | null; time_zone: string; is_active: number }
interface ZoneRow { id: string; city_id: string; name: string; aliases: string | null; lat: number | null; lng: number | null; is_active: number; sort_order: number }
interface RateRow { id: string; city_id: string; from_zone_id: string | null; to_zone_id: string | null; size_class: string; price: number; currency: string; express_surcharge: number | null }
interface IntercityRow { id: string; from_city_id: string; to_city_id: string; max_weight_kg: number; price: number; currency: string }

const cityOut = (r: CityRow) => ({
  id: r.id, name: r.name, countryIso: r.country_iso, lat: r.lat, lng: r.lng, timeZone: r.time_zone, isActive: r.is_active === 1,
});
const zoneOut = (r: ZoneRow) => ({
  id: r.id, cityId: r.city_id, name: r.name, aliases: r.aliases ?? '', lat: r.lat, lng: r.lng, isActive: r.is_active === 1, sortOrder: r.sort_order,
});
const rateOut = (r: RateRow) => ({
  id: r.id, cityId: r.city_id, fromZoneId: r.from_zone_id, toZoneId: r.to_zone_id, sizeClass: r.size_class,
  price: r.price, currency: r.currency, expressSurcharge: r.express_surcharge,
});
const intercityOut = (r: IntercityRow) => ({
  id: r.id, fromCityId: r.from_city_id, toCityId: r.to_city_id, maxWeightKg: r.max_weight_kg, price: r.price, currency: r.currency,
});

const loadCity = (id: string) => db.prepare('SELECT * FROM delivery_cities WHERE id = ?').get(id) as CityRow | undefined;
const loadZone = (id: string) => db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(id) as ZoneRow | undefined;
const citiesAll = () => db.prepare('SELECT * FROM delivery_cities ORDER BY name COLLATE NOCASE, id').all() as unknown as CityRow[];
const zonesOf = (cityId: string) =>
  db.prepare('SELECT * FROM delivery_zones WHERE city_id = ? ORDER BY sort_order, name COLLATE NOCASE, id').all(cityId) as unknown as ZoneRow[];

export function readStoredDispatchSettings(): DispatchSettings {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(DISPATCH_SETTINGS_KEY) as { value_json: string } | undefined;
  try {
    return readDispatchSettings(row ? JSON.parse(row.value_json) : null);
  } catch {
    return readDispatchSettings(null);
  }
}

function fullState() {
  return {
    cities: citiesAll().map(cityOut),
    zones: (db.prepare('SELECT * FROM delivery_zones ORDER BY city_id, sort_order, name COLLATE NOCASE, id').all() as unknown as ZoneRow[]).map(zoneOut),
    rates: (db.prepare('SELECT * FROM zone_rates ORDER BY city_id, size_class, id').all() as unknown as RateRow[]).map(rateOut),
    intercity: (db.prepare('SELECT * FROM intercity_rates ORDER BY from_city_id, to_city_id, max_weight_kg').all() as unknown as IntercityRow[]).map(intercityOut),
    settings: readStoredDispatchSettings(),
  };
}

// ---- Input checks ---------------------------------------------------------------------------

type Fail = { status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Fail => ({ status, code, error });
const isFail = (v: unknown): v is Fail => !!v && typeof v === 'object' && 'code' in v && 'status' in v && 'error' in v;
const send = (res: Response, f: Fail) => res.status(f.status).json({ success: false, code: f.code, error: f.error });
const body = (req: Request) => (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
const newId = (prefix: string) => prefix + crypto.randomBytes(9).toString('hex');

function readName(value: unknown): string | Fail {
  const name = typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > NAME_MAX) return fail(400, 'INVALID_NAME', `Enter a name of 1 to ${NAME_MAX} characters.`);
  return name;
}

/** "a, b ,, c" → "a, b, c" (duplicates and empties dropped); empty → null. */
function readAliases(value: unknown): string | null | Fail {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return fail(400, 'INVALID_ALIASES', 'Other names must be text, separated by commas.');
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of value.split(',')) {
    const p = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!p || seen.has(nameKey(p))) continue;
    if (p.length > NAME_MAX) return fail(400, 'INVALID_ALIASES', `Each other name can be up to ${NAME_MAX} characters.`);
    seen.add(nameKey(p));
    parts.push(p);
  }
  const joined = parts.join(', ');
  if (joined.length > ALIASES_MAX) return fail(400, 'INVALID_ALIASES', `Other names can be up to ${ALIASES_MAX} characters in all.`);
  return joined || null;
}

/** Both null (no pin) or both valid coordinates. Only read when either key is present. */
function readPin(b: Record<string, unknown>): { lat: number | null; lng: number | null } | Fail {
  const { lat, lng } = b;
  if ((lat === null || lat === '') && (lng === null || lng === '')) return { lat: null, lng: null };
  const la = typeof lat === 'number' ? lat : NaN;
  const ln = typeof lng === 'number' ? lng : NaN;
  if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
    return fail(400, 'INVALID_PIN', 'The map pin needs a valid latitude and longitude.');
  }
  return { lat: Math.round(la * 1e6) / 1e6, lng: Math.round(ln * 1e6) / 1e6 };
}

function readCurrency(value: unknown): string | Fail {
  const c = value === undefined || value === null || value === '' ? 'XAF' : String(value).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return fail(400, 'INVALID_CURRENCY', 'Enter a three-letter currency code, for example XAF.');
  return c;
}

function readMoney(value: unknown, currency: string, field: string): number | Fail {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > PRICE_MAX) {
    return fail(400, 'INVALID_PRICE', `${field} must be a number from 0 to ${PRICE_MAX}.`);
  }
  return roundMoney(value, currency);
}

const cityNameTaken = (name: string, exceptId: string | null) =>
  citiesAll().some((c) => c.id !== exceptId && nameKey(c.name) === nameKey(name));
const zoneNameTaken = (cityId: string, name: string, exceptId: string | null) =>
  zonesOf(cityId).some((z) => z.id !== exceptId && nameKey(z.name) === nameKey(name));

const nextSortOrder = (cityId: string) =>
  ((db.prepare('SELECT MAX(sort_order) AS m FROM delivery_zones WHERE city_id = ?').get(cityId) as { m: number | null }).m ?? -1) + 1;

/** Jobs whose pickup or drop-off names this city / zone (they keep the id, so it can't go away). */
function jobsUsing(field: 'cityId' | 'zoneId', id: string): number {
  const { c } = db.prepare(`
    SELECT COUNT(*) AS c FROM dispatch_jobs
    WHERE json_extract(pickup_json, '$.${field}') = ? OR json_extract(dropoff_json, '$.${field}') = ?
  `).get(id, id) as { c: number };
  return c;
}

/** Records only the fields that changed. */
function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (after[k] === undefined || JSON.stringify(before[k]) === JSON.stringify(after[k])) continue;
    b[k] = before[k];
    a[k] = after[k];
  }
  return { before: b, after: a, changed: Object.keys(a) };
}

export const tariffsRouter = Router();

// ---- Public ---------------------------------------------------------------------------------

// GET /api/tariffs/areas (public): active cities and their active areas, for the booking form.
// Names and pins only; no prices (those come from the price API in G.6).
tariffsRouter.get('/areas', (_req: Request, res: Response) => {
  try {
    const cities = (db.prepare('SELECT * FROM delivery_cities WHERE is_active = 1 ORDER BY name COLLATE NOCASE, id').all() as unknown as CityRow[]);
    const zones = db.prepare('SELECT * FROM delivery_zones WHERE is_active = 1 ORDER BY sort_order, name COLLATE NOCASE, id').all() as unknown as ZoneRow[];
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      success: true,
      data: cities.map((c) => ({
        id: c.id, name: c.name, lat: c.lat, lng: c.lng,
        zones: zones.filter((z) => z.city_id === c.id).map((z) => ({ id: z.id, name: z.name, aliases: z.aliases ?? '', lat: z.lat, lng: z.lng })),
      })),
    });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Console: everything ----------------------------------------------------------------------

// GET /api/tariffs → { cities, zones, rates, intercity, settings }
tariffsRouter.get('/', requirePermission('tariffs.manage'), (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Cities ---------------------------------------------------------------------------------

// POST /api/tariffs/cities { name, lat?, lng? }
tariffsRouter.post('/cities', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const b = body(req);
    const name = readName(b.name);
    if (isFail(name)) return send(res, name);
    const pin = 'lat' in b || 'lng' in b ? readPin(b) : { lat: null, lng: null };
    if (isFail(pin)) return send(res, pin);
    if (cityNameTaken(name, null)) return send(res, fail(409, 'CITY_EXISTS', 'A city with this name already exists.'));
    const id = newId('city_');
    db.prepare('INSERT INTO delivery_cities (id, name, lat, lng, is_active) VALUES (?, ?, ?, ?, 1)').run(id, name, pin.lat, pin.lng);
    audit(req, 'tariffs.city_create', 'delivery_city', id, `Delivery city added: ${name}`, undefined, { name, ...pin });
    res.status(201).json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// PATCH /api/tariffs/cities/:id { name?, lat?, lng?, isActive? }
tariffsRouter.patch('/cities/:id', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const city = loadCity(String(req.params.id));
    if (!city) return send(res, fail(404, 'NOT_FOUND', 'City not found.'));
    const b = body(req);
    const next: Record<string, unknown> = {};
    if (b.name !== undefined) {
      const name = readName(b.name);
      if (isFail(name)) return send(res, name);
      if (cityNameTaken(name, city.id)) return send(res, fail(409, 'CITY_EXISTS', 'A city with this name already exists.'));
      next.name = name;
    }
    if ('lat' in b || 'lng' in b) {
      const pin = readPin(b);
      if (isFail(pin)) return send(res, pin);
      next.lat = pin.lat;
      next.lng = pin.lng;
    }
    if (b.isActive !== undefined) {
      if (typeof b.isActive !== 'boolean') return send(res, fail(400, 'INVALID_INPUT', 'isActive must be true or false.'));
      next.isActive = b.isActive;
    }
    const d = diff({ name: city.name, lat: city.lat, lng: city.lng, isActive: city.is_active === 1 }, next);
    if (d.changed.length) {
      db.prepare('UPDATE delivery_cities SET name = ?, lat = ?, lng = ?, is_active = ? WHERE id = ?').run(
        (next.name ?? city.name) as string,
        ('lat' in next ? next.lat : city.lat) as number | null,
        ('lng' in next ? next.lng : city.lng) as number | null,
        next.isActive === undefined ? city.is_active : next.isActive ? 1 : 0,
        city.id,
      );
      audit(req, 'tariffs.city_update', 'delivery_city', city.id, `Delivery city updated (${d.changed.join(', ')}): ${city.name}`, d.before, d.after);
    }
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/tariffs/cities/:id: only a city nothing uses yet (no areas, rates, couriers or
// jobs); otherwise turn it off instead.
tariffsRouter.delete('/cities/:id', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const city = loadCity(String(req.params.id));
    if (!city) return send(res, fail(404, 'NOT_FOUND', 'City not found.'));
    const count = (sql: string, ...args: string[]) => (db.prepare(sql).get(...args) as { c: number }).c;
    const used = count('SELECT COUNT(*) AS c FROM delivery_zones WHERE city_id = ?', city.id)
      + count('SELECT COUNT(*) AS c FROM zone_rates WHERE city_id = ?', city.id)
      + count('SELECT COUNT(*) AS c FROM intercity_rates WHERE from_city_id = ? OR to_city_id = ?', city.id, city.id)
      + count('SELECT COUNT(*) AS c FROM couriers WHERE home_city_id = ?', city.id)
      + jobsUsing('cityId', city.id);
    if (used > 0) {
      return send(res, fail(409, 'CITY_IN_USE', 'This city has areas, rates, couriers or jobs. Turn it off instead, or remove those first.'));
    }
    db.prepare('DELETE FROM delivery_cities WHERE id = ?').run(city.id);
    audit(req, 'tariffs.city_delete', 'delivery_city', city.id, `Delivery city deleted: ${city.name}`, { name: city.name });
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Areas (zones) ----------------------------------------------------------------------------

// POST /api/tariffs/cities/:id/zones { name, aliases?, lat?, lng? }
tariffsRouter.post('/cities/:id/zones', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const city = loadCity(String(req.params.id));
    if (!city) return send(res, fail(404, 'NOT_FOUND', 'City not found.'));
    const b = body(req);
    const name = readName(b.name);
    if (isFail(name)) return send(res, name);
    const aliases = readAliases(b.aliases);
    if (isFail(aliases)) return send(res, aliases);
    const pin = 'lat' in b || 'lng' in b ? readPin(b) : { lat: null, lng: null };
    if (isFail(pin)) return send(res, pin);
    if (zoneNameTaken(city.id, name, null)) return send(res, fail(409, 'ZONE_EXISTS', 'This city already has an area with this name.'));
    const id = newId('zone_');
    db.prepare(`
      INSERT INTO delivery_zones (id, city_id, name, aliases, lat, lng, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, city.id, name, aliases, pin.lat, pin.lng, nextSortOrder(city.id));
    audit(req, 'tariffs.zone_create', 'delivery_zone', id, `Area added in ${city.name}: ${name}`, undefined, { name, aliases, ...pin });
    res.status(201).json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// PATCH /api/tariffs/zones/:id { name?, aliases?, lat?, lng?, isActive? }
tariffsRouter.patch('/zones/:id', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const zone = loadZone(String(req.params.id));
    if (!zone) return send(res, fail(404, 'NOT_FOUND', 'Area not found.'));
    const b = body(req);
    const next: Record<string, unknown> = {};
    if (b.name !== undefined) {
      const name = readName(b.name);
      if (isFail(name)) return send(res, name);
      if (zoneNameTaken(zone.city_id, name, zone.id)) return send(res, fail(409, 'ZONE_EXISTS', 'This city already has an area with this name.'));
      next.name = name;
    }
    if (b.aliases !== undefined) {
      const aliases = readAliases(b.aliases);
      if (isFail(aliases)) return send(res, aliases);
      next.aliases = aliases;
    }
    if ('lat' in b || 'lng' in b) {
      const pin = readPin(b);
      if (isFail(pin)) return send(res, pin);
      next.lat = pin.lat;
      next.lng = pin.lng;
    }
    if (b.isActive !== undefined) {
      if (typeof b.isActive !== 'boolean') return send(res, fail(400, 'INVALID_INPUT', 'isActive must be true or false.'));
      next.isActive = b.isActive;
    }
    const d = diff({ name: zone.name, aliases: zone.aliases, lat: zone.lat, lng: zone.lng, isActive: zone.is_active === 1 }, next);
    if (d.changed.length) {
      db.prepare('UPDATE delivery_zones SET name = ?, aliases = ?, lat = ?, lng = ?, is_active = ? WHERE id = ?').run(
        (next.name ?? zone.name) as string,
        ('aliases' in next ? next.aliases : zone.aliases) as string | null,
        ('lat' in next ? next.lat : zone.lat) as number | null,
        ('lng' in next ? next.lng : zone.lng) as number | null,
        next.isActive === undefined ? zone.is_active : next.isActive ? 1 : 0,
        zone.id,
      );
      audit(req, 'tariffs.zone_update', 'delivery_zone', zone.id, `Area updated (${d.changed.join(', ')}): ${zone.name}`, d.before, d.after);
    }
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// PUT /api/tariffs/cities/:id/zone-order { zoneIds } (every area of the city, in the new order)
tariffsRouter.put('/cities/:id/zone-order', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const city = loadCity(String(req.params.id));
    if (!city) return send(res, fail(404, 'NOT_FOUND', 'City not found.'));
    const ids = body(req).zoneIds;
    const current = zonesOf(city.id);
    if (!Array.isArray(ids) || ids.length !== current.length || new Set(ids).size !== ids.length
      || !ids.every((id) => current.some((z) => z.id === id))) {
      return send(res, fail(400, 'INVALID_ORDER', 'Send every area of this city once, in the new order.'));
    }
    const before = current.map((z) => z.name);
    inTransaction(db, () => {
      const set = db.prepare('UPDATE delivery_zones SET sort_order = ? WHERE id = ?');
      (ids as string[]).forEach((id, i) => set.run(i, id));
    });
    const after = zonesOf(city.id).map((z) => z.name);
    if (before.join('|') !== after.join('|')) {
      audit(req, 'tariffs.zone_reorder', 'delivery_city', city.id, `Areas reordered in ${city.name}`, { order: before }, { order: after });
    }
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// DELETE /api/tariffs/zones/:id: only an area no rate or job uses; otherwise turn it off.
tariffsRouter.delete('/zones/:id', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const zone = loadZone(String(req.params.id));
    if (!zone) return send(res, fail(404, 'NOT_FOUND', 'Area not found.'));
    const { c } = db.prepare('SELECT COUNT(*) AS c FROM zone_rates WHERE from_zone_id = ? OR to_zone_id = ?').get(zone.id, zone.id) as { c: number };
    if (c > 0 || jobsUsing('zoneId', zone.id) > 0) {
      return send(res, fail(409, 'ZONE_IN_USE', 'This area has rates or jobs. Turn it off instead, or remove its rates first.'));
    }
    db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(zone.id);
    audit(req, 'tariffs.zone_delete', 'delivery_zone', zone.id, `Area deleted: ${zone.name}`, { name: zone.name, aliases: zone.aliases });
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /api/tariffs/import-suggested { cities?: string[] } (names from SUGGESTED_AREAS; all when
// omitted). Creates missing cities and adds missing areas by name. Never adds prices or pins.
tariffsRouter.post('/import-suggested', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const wanted = body(req).cities;
    if (wanted !== undefined && (!Array.isArray(wanted) || !wanted.every((n) => typeof n === 'string'))) {
      return send(res, fail(400, 'INVALID_INPUT', 'Choose cities from the suggested list.'));
    }
    const pick = wanted === undefined ? SUGGESTED_AREAS
      : SUGGESTED_AREAS.filter((s) => (wanted as string[]).some((w) => nameKey(w) === nameKey(s.name)));
    if (pick.length === 0) return send(res, fail(400, 'INVALID_INPUT', 'Choose cities from the suggested list.'));

    const added: Record<string, string[]> = {};
    const citiesCreated: string[] = [];
    inTransaction(db, () => {
      for (const s of pick) {
        let city = citiesAll().find((c) => nameKey(c.name) === nameKey(s.name));
        if (!city) {
          const id = newId('city_');
          db.prepare('INSERT INTO delivery_cities (id, name, is_active) VALUES (?, ?, 1)').run(id, s.name);
          city = loadCity(id)!;
          citiesCreated.push(s.name);
        }
        const have = new Set(zonesOf(city.id).map((z) => nameKey(z.name)));
        let order = nextSortOrder(city.id);
        for (const area of s.areas) {
          if (have.has(nameKey(area))) continue;
          db.prepare('INSERT INTO delivery_zones (id, city_id, name, is_active, sort_order) VALUES (?, ?, ?, 1, ?)')
            .run(newId('zone_'), city.id, area, order++);
          have.add(nameKey(area));
          (added[s.name] ??= []).push(area);
        }
      }
    });
    const areaCount = Object.values(added).reduce((n, list) => n + list.length, 0);
    audit(req, 'tariffs.import_suggested', 'delivery_city', null,
      `Suggested areas imported (no prices): ${citiesCreated.length} cities and ${areaCount} areas added`,
      undefined, { citiesCreated, areasAdded: added });
    res.json({ success: true, data: { ...fullState(), imported: { cities: citiesCreated.length, areas: areaCount } } });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Zone rates -------------------------------------------------------------------------------

interface RateInput { fromZoneId: string | null; toZoneId: string | null; price: number; expressSurcharge: number | null }

// PUT /api/tariffs/cities/:id/rates { sizeClass, currency, rates: [{ fromZoneId, toZoneId, price,
// expressSurcharge }] }: replaces the whole sheet for that city and size. A null area = "any other
// area". An empty list removes every rate of that size.
tariffsRouter.put('/cities/:id/rates', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const city = loadCity(String(req.params.id));
    if (!city) return send(res, fail(404, 'NOT_FOUND', 'City not found.'));
    const b = body(req);
    if (!isSizeClass(b.sizeClass)) return send(res, fail(400, 'INVALID_SIZE', `Size must be one of ${SIZE_CLASSES.join(', ')}.`));
    const size: SizeClass = b.sizeClass;
    const currency = readCurrency(b.currency);
    if (isFail(currency)) return send(res, currency);
    if (!Array.isArray(b.rates) || b.rates.length > 2500) return send(res, fail(400, 'INVALID_RATES', 'Send the rates as a list.'));

    const zoneIds = new Set(zonesOf(city.id).map((z) => z.id));
    const zoneName = new Map(zonesOf(city.id).map((z) => [z.id, z.name]));
    const seen = new Set<string>();
    const rates: RateInput[] = [];
    for (const raw of b.rates as unknown[]) {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const from = r.fromZoneId === null || r.fromZoneId === undefined || r.fromZoneId === '' ? null : String(r.fromZoneId);
      const to = r.toZoneId === null || r.toZoneId === undefined || r.toZoneId === '' ? null : String(r.toZoneId);
      if ((from && !zoneIds.has(from)) || (to && !zoneIds.has(to))) {
        return send(res, fail(400, 'UNKNOWN_ZONE', 'A rate names an area that is not in this city.'));
      }
      const pair = `${from ?? '*'}>${to ?? '*'}`;
      if (seen.has(pair)) return send(res, fail(400, 'DUPLICATE_RATE', 'Each pair of areas can have only one rate per size.'));
      seen.add(pair);
      const price = readMoney(r.price, currency, 'Price');
      if (isFail(price)) return send(res, price);
      let express: number | null = null;
      if (r.expressSurcharge !== null && r.expressSurcharge !== undefined && r.expressSurcharge !== '') {
        const e = readMoney(r.expressSurcharge, currency, 'Express surcharge');
        if (isFail(e)) return send(res, e);
        express = e;
      }
      rates.push({ fromZoneId: from, toZoneId: to, price, expressSurcharge: express });
    }

    const old = db.prepare('SELECT * FROM zone_rates WHERE city_id = ? AND size_class = ?').all(city.id, size) as unknown as RateRow[];
    const label = (from: string | null, to: string | null) =>
      `${from ? zoneName.get(from) ?? from : 'Any other area'} → ${to ? zoneName.get(to) ?? to : 'Any other area'}`;
    const cell = (price: number, express: number | null, cur: string) => ({ price, expressSurcharge: express, currency: cur });
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const oldByPair = new Map(old.map((r) => [`${r.from_zone_id ?? '*'}>${r.to_zone_id ?? '*'}`, r]));
    for (const r of rates) {
      const o = oldByPair.get(`${r.fromZoneId ?? '*'}>${r.toZoneId ?? '*'}`);
      const now = cell(r.price, r.expressSurcharge, currency);
      if (o && JSON.stringify(cell(o.price, o.express_surcharge, o.currency)) === JSON.stringify(now)) continue;
      const key = label(r.fromZoneId, r.toZoneId);
      if (o) before[key] = cell(o.price, o.express_surcharge, o.currency);
      after[key] = now;
    }
    for (const o of old) {
      if (seen.has(`${o.from_zone_id ?? '*'}>${o.to_zone_id ?? '*'}`)) continue;
      const key = label(o.from_zone_id, o.to_zone_id);
      before[key] = cell(o.price, o.express_surcharge, o.currency);
      after[key] = null;
    }

    const changes = Object.keys(after).length;
    if (changes > 0) {
      inTransaction(db, () => {
        db.prepare('DELETE FROM zone_rates WHERE city_id = ? AND size_class = ?').run(city.id, size);
        const insert = db.prepare(`
          INSERT INTO zone_rates (id, city_id, from_zone_id, to_zone_id, size_class, price, currency, express_surcharge)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of rates) insert.run(newId('rate_'), city.id, r.fromZoneId, r.toZoneId, size, r.price, currency, r.expressSurcharge);
      });
      audit(req, 'tariffs.rates_update', 'delivery_city', city.id,
        `Rates for ${size.toLowerCase()} parcels in ${city.name}: ${changes} change${changes === 1 ? '' : 's'} (${rates.length} rates)`,
        before, after);
    }
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Intercity --------------------------------------------------------------------------------

// PUT /api/tariffs/intercity { fromCityId, toCityId, currency, bands: [{ maxWeightKg, price }] }:
// replaces the weight bands of one direction. An empty list removes that direction's rates.
tariffsRouter.put('/intercity', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const b = body(req);
    const from = loadCity(String(b.fromCityId ?? ''));
    const to = loadCity(String(b.toCityId ?? ''));
    if (!from || !to) return send(res, fail(400, 'UNKNOWN_CITY', 'Choose both cities from the list.'));
    if (from.id === to.id) return send(res, fail(400, 'SAME_CITY', 'Choose two different cities.'));
    const currency = readCurrency(b.currency);
    if (isFail(currency)) return send(res, currency);
    if (!Array.isArray(b.bands) || b.bands.length > BANDS_MAX) {
      return send(res, fail(400, 'INVALID_BANDS', `Send up to ${BANDS_MAX} weight bands.`));
    }
    const bands: { maxWeightKg: number; price: number }[] = [];
    for (const raw of b.bands as unknown[]) {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const w = r.maxWeightKg;
      if (typeof w !== 'number' || !Number.isFinite(w) || w <= 0 || w > WEIGHT_MAX_KG) {
        return send(res, fail(400, 'INVALID_WEIGHT', `Each band needs a maximum weight from 0 to ${WEIGHT_MAX_KG} kg.`));
      }
      const weight = Math.round(w * 100) / 100;
      if (bands.some((x) => x.maxWeightKg === weight)) return send(res, fail(400, 'DUPLICATE_BAND', 'Two bands have the same maximum weight.'));
      const price = readMoney(r.price, currency, 'Price');
      if (isFail(price)) return send(res, price);
      bands.push({ maxWeightKg: weight, price });
    }
    bands.sort((x, y) => x.maxWeightKg - y.maxWeightKg);

    const old = db.prepare('SELECT * FROM intercity_rates WHERE from_city_id = ? AND to_city_id = ? ORDER BY max_weight_kg')
      .all(from.id, to.id) as unknown as IntercityRow[];
    const fmt = (rows: { maxWeightKg: number; price: number; currency: string }[]) => rows.map((r) => `≤ ${r.maxWeightKg} kg: ${r.price} ${r.currency}`);
    const before = fmt(old.map((r) => ({ maxWeightKg: r.max_weight_kg, price: r.price, currency: r.currency })));
    const after = fmt(bands.map((r) => ({ ...r, currency })));
    if (before.join('|') !== after.join('|')) {
      inTransaction(db, () => {
        db.prepare('DELETE FROM intercity_rates WHERE from_city_id = ? AND to_city_id = ?').run(from.id, to.id);
        const insert = db.prepare(`
          INSERT INTO intercity_rates (id, from_city_id, to_city_id, max_weight_kg, price, currency) VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const band of bands) insert.run(newId('icr_'), from.id, to.id, band.maxWeightKg, band.price, currency);
      });
      audit(req, 'tariffs.intercity_update', 'intercity_rate', `${from.id}>${to.id}`,
        `Intercity rates ${from.name} → ${to.name}: ${bands.length} band${bands.length === 1 ? '' : 's'}`,
        { bands: before }, { bands: after });
    }
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});

// ---- Settings ---------------------------------------------------------------------------------

// PUT /api/tariffs/settings { avgSpeedKmh?: { BIKE, VAN, TRUCK }, alertMinutes?: { unassigned, notAccepted } }
// Average in-town speeds for ETAs and the dispatch board's waiting-job alerts (0 = off). Either part
// may be sent alone; the other is kept.
tariffsRouter.put('/settings', requirePermission('tariffs.manage'), (req: Request, res: Response) => {
  try {
    const b = body(req);
    const obj = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : null);
    if (b.avgSpeedKmh === undefined && b.alertMinutes === undefined) {
      return send(res, fail(400, 'INVALID_INPUT', 'Send avgSpeedKmh, alertMinutes or both.'));
    }
    const speeds = obj(b.avgSpeedKmh);
    if (b.avgSpeedKmh !== undefined && (!speeds || !VEHICLE_TYPES.every((v) => isValidSpeed(speeds[v])))) {
      return send(res, fail(400, 'INVALID_SPEED', 'Enter an average speed from 1 to 120 km/h for each vehicle.'));
    }
    const alerts = obj(b.alertMinutes);
    if (b.alertMinutes !== undefined && (!alerts || !ALERT_KEYS.every((k) => isValidAlertMinutes(alerts[k])))) {
      return send(res, fail(400, 'INVALID_ALERT_MINUTES', `Enter whole minutes from 0 to ${ALERT_MAX_MINUTES} (0 turns the alert off).`));
    }
    const current = readStoredDispatchSettings();
    const next = readDispatchSettings({ avgSpeedKmh: speeds ?? current.avgSpeedKmh, alertMinutes: alerts ?? current.alertMinutes });
    const ds = diff(current.avgSpeedKmh, next.avgSpeedKmh);
    const da = diff(current.alertMinutes, next.alertMinutes);
    if (ds.changed.length || da.changed.length) {
      const parts = [
        ...(ds.changed.length ? [`average speeds (${ds.changed.join(', ')})`] : []),
        ...(da.changed.length ? [`board alerts (${da.changed.join(', ')})`] : []),
      ];
      db.prepare('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)').run(DISPATCH_SETTINGS_KEY, JSON.stringify(next));
      audit(req, 'tariffs.settings_update', 'settings', DISPATCH_SETTINGS_KEY, `Dispatch settings changed: ${parts.join('; ')}`,
        { ...(ds.changed.length ? { avgSpeedKmh: ds.before } : {}), ...(da.changed.length ? { alertMinutes: da.before } : {}) },
        { ...(ds.changed.length ? { avgSpeedKmh: ds.after } : {}), ...(da.changed.length ? { alertMinutes: da.after } : {}) });
    }
    res.json({ success: true, data: fullState() });
  } catch (err) {
    serverError(res, err);
  }
});
