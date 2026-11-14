// Local and intercity delivery prices from the admin's rate tables (docs/DISPATCH_SPEC.md §5).
// The same functions price the public booking form and the server, so the customer sees the price
// the server will store. No prices live in code: with no matching rate the result is
// { ok: false } and the form says "We'll confirm your price" (the job stays REQUESTED until
// dispatch prices it). DOM-free.

export const SIZE_CLASSES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export type SizeClass = typeof SIZE_CLASSES[number];

/** Short size names (CONTENT §7.5 / CONTENT_FR §7.5; the limits are owner to confirm). */
export const SIZE_CLASS_LABELS: Record<SizeClass, Record<'en' | 'fr', string>> = {
  SMALL: { en: 'Small', fr: 'Petit' },
  MEDIUM: { en: 'Medium', fr: 'Moyen' },
  LARGE: { en: 'Large', fr: 'Grand' },
};

export function isSizeClass(value: unknown): value is SizeClass {
  return typeof value === 'string' && (SIZE_CLASSES as readonly string[]).includes(value);
}

/** A zone_rates row. A null zone means "any other zone" in that position. */
export interface ZoneRate {
  id: string;
  cityId: string;
  fromZoneId: string | null;
  toZoneId: string | null;
  sizeClass: string;
  price: number;
  currency: string;
  /** Added for express; null = no express price for this rate. */
  expressSurcharge: number | null;
}

/** An intercity_rates row: one weight band of a city pair. */
export interface IntercityRate {
  id: string;
  fromCityId: string;
  toCityId: string;
  maxWeightKg: number;
  price: number;
  currency: string;
}

export function zoneRateFromRow(row: any): ZoneRate {
  return {
    id: String(row.id),
    cityId: String(row.city_id),
    fromZoneId: row.from_zone_id ?? null,
    toZoneId: row.to_zone_id ?? null,
    sizeClass: String(row.size_class),
    price: Number(row.price),
    currency: String(row.currency || 'XAF'),
    expressSurcharge: row.express_surcharge === null || row.express_surcharge === undefined ? null : Number(row.express_surcharge),
  };
}

export function intercityRateFromRow(row: any): IntercityRate {
  return {
    id: String(row.id),
    fromCityId: String(row.from_city_id),
    toCityId: String(row.to_city_id),
    maxWeightKg: Number(row.max_weight_kg),
    price: Number(row.price),
    currency: String(row.currency || 'XAF'),
  };
}

/** Which rate row matched: both zones, pickup zone only, drop-off zone only, or the city default. */
export type RateMatch = 'EXACT' | 'FROM_ZONE' | 'TO_ZONE' | 'ANY_ZONE';

export type PriceResult =
  | { ok: true; price: number; currency: string; basePrice: number; expressSurcharge: number; rateId: string; match?: RateMatch }
  | { ok: false; reason: 'INVALID_REQUEST' | 'NO_RATE' | 'NO_EXPRESS_RATE' };

/** XAF and XOF have no decimals; other currencies keep cents. */
export function roundMoney(amount: number, currency: string): number {
  const code = (currency || '').toUpperCase();
  if (code === 'XAF' || code === 'XOF') return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const sameId = (a: string | null | undefined, b: string | null | undefined) => (a ?? null) === (b ?? null);

/**
 * Price of a delivery inside one city. Rates are directional (pickup zone -> drop-off zone). The
 * most specific rate for the size wins, in this order:
 *   1. pickup zone -> drop-off zone
 *   2. pickup zone -> any other zone
 *   3. any other zone -> drop-off zone
 *   4. any other zone -> any other zone (the city's default for that size)
 * Express adds the matched rate's surcharge; a rate without one has no automatic express price.
 * When two rows share the same zones and size, the first one given wins.
 */
export function priceLocalDelivery(
  request: { cityId: string; fromZoneId: string | null; toZoneId: string | null; sizeClass: string; express?: boolean },
  rates: readonly ZoneRate[],
): PriceResult {
  if (!request.cityId || !isSizeClass(request.sizeClass)) return { ok: false, reason: 'INVALID_REQUEST' };
  const from = request.fromZoneId || null;
  const to = request.toZoneId || null;
  const candidates = rates.filter((r) => r.cityId === request.cityId && r.sizeClass === request.sizeClass && usable(r.price));

  const order: [RateMatch, string | null, string | null][] = [
    ['EXACT', from, to],
    ['FROM_ZONE', from, null],
    ['TO_ZONE', null, to],
    ['ANY_ZONE', null, null],
  ];
  for (const [match, f, t] of order) {
    // Skip steps that need a zone the request doesn't have (they'd repeat a later step).
    if ((match === 'EXACT' && (!f || !t)) || (match === 'FROM_ZONE' && !f) || (match === 'TO_ZONE' && !t)) continue;
    const rate = candidates.find((r) => sameId(r.fromZoneId, f) && sameId(r.toZoneId, t));
    if (!rate) continue;
    let surcharge = 0;
    if (request.express) {
      if (!usable(rate.expressSurcharge)) return { ok: false, reason: 'NO_EXPRESS_RATE' };
      surcharge = rate.expressSurcharge;
    }
    return {
      ok: true,
      price: roundMoney(rate.price + surcharge, rate.currency),
      currency: rate.currency,
      basePrice: roundMoney(rate.price, rate.currency),
      expressSurcharge: roundMoney(surcharge, rate.currency),
      rateId: rate.id,
      match,
    };
  }
  return { ok: false, reason: 'NO_RATE' };
}

/**
 * Price of a delivery between two cities: the band of that city pair (in that direction) with the
 * smallest maximum weight that the parcel fits under. Heavier than every band = no price.
 */
export function priceIntercityDelivery(
  request: { fromCityId: string; toCityId: string; weightKg: number },
  rates: readonly IntercityRate[],
): PriceResult {
  const { fromCityId, toCityId, weightKg } = request;
  if (!fromCityId || !toCityId || fromCityId === toCityId || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { ok: false, reason: 'INVALID_REQUEST' };
  }
  const band = rates
    .filter((r) => r.fromCityId === fromCityId && r.toCityId === toCityId && usable(r.price)
      && Number.isFinite(r.maxWeightKg) && r.maxWeightKg >= weightKg)
    .sort((a, b) => a.maxWeightKg - b.maxWeightKg)[0];
  if (!band) return { ok: false, reason: 'NO_RATE' };
  const price = roundMoney(band.price, band.currency);
  return { ok: true, price, currency: band.currency, basePrice: price, expressSurcharge: 0, rateId: band.id };
}
