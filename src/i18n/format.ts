// Locale-aware formatting (I18N_SPEC §5): dates, times, numbers, money and distances with Intl,
// in en-CM / fr-CM. DOM-free, so tests (and later the server) can use it.
//
// Money: XAF has no minor units and shows as "FCFA" after the amount in both languages, as in
// the owner's copy ("from 500 FCFA" / "à partir de 500 FCFA"); other currencies keep 2 decimals
// and their symbol. Times default to the office zone, Africa/Douala.
import { OFFICE_TIME_ZONE, OPENING_HOURS, type OpeningHours } from '../config/brand';
import { frenchSpacing } from '../shared/typography';
import type { Locale } from './types';

export { frenchSpacing };

const NBSP = ' ';

export function intlLocale(locale: Locale): string {
  return locale === 'fr' ? 'fr-CM' : 'en-CM';
}

function toDate(value: Date | number | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatNumber(value: number, locale: Locale, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** Decimal places a currency is shown with: 0 for XAF (and XOF), else 2. */
export function currencyDecimals(currency: string): number {
  return currency === 'XAF' || currency === 'XOF' ? 0 : 2;
}

/** "1,500 FCFA" / "1 500 FCFA"; "$350.00" / "350,00 $US". */
export function formatMoney(amount: number, currency: string, locale: Locale): string {
  const code = currency.toUpperCase();
  const decimals = currencyDecimals(code);
  if (code === 'XAF') {
    const n = formatNumber(amount, locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return `${n}${NBSP}FCFA`;
  }
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

type DateInput = Date | number | string;

export function formatDate(value: DateInput, locale: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }, timeZone = OFFICE_TIME_ZONE): string {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone }).format(d);
}

export function formatTime(value: DateInput, locale: Locale, timeZone = OFFICE_TIME_ZONE): string {
  return formatDate(value, locale, { hour: 'numeric', minute: '2-digit' }, timeZone);
}

export function formatDateTime(value: DateInput, locale: Locale, timeZone = OFFICE_TIME_ZONE): string {
  return formatDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }, timeZone);
}

/** "12.5 km" / "12,5 km". */
export function formatDistanceKm(km: number, locale: Locale): string {
  return `${formatNumber(km, locale, { maximumFractionDigits: km < 10 ? 1 : 0 })}${NBSP}km`;
}

/** A 24-hour "HH:MM" clock as written in each language: "9:00 AM" / "9 h 00". */
export function formatClock(hhmm: string, locale: Locale): string {
  const [h, m] = hhmm.split(':').map(Number);
  const mm = String(m || 0).padStart(2, '0');
  if (locale === 'fr') return `${h}${NBSP}h${NBSP}${mm}`;
  return `${((h + 11) % 12) + 1}:${mm}${NBSP}${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Opening hours in a language, written to follow "Open" / "Ouvert": "24/7" / "24 h/24, 7 j/7",
 * or a range "9:00 AM – 4:00 PM" / "de 9 h 00 à 16 h 00".
 */
export function formatOpeningHoursIn(locale: Locale, hours: OpeningHours = OPENING_HOURS): string {
  if (hours.allDay) return locale === 'fr' ? `24${NBSP}h/24, 7${NBSP}j/7` : '24/7';
  if (locale === 'fr') return `de ${formatClock(hours.opens, locale)} à ${formatClock(hours.closes, locale)}`;
  return `${formatClock(hours.opens, locale)} – ${formatClock(hours.closes, locale)}`;
}
