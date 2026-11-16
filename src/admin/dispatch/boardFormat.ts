// Formatting for the dispatch board: money with its currency, times in Africa/Douala.
import { formatCurrencyAmount } from '../../shared/currency';
import { BOARD_TIME_ZONE } from '../../shared/dispatchBoard';

export const money = (amount: number, currency: string) => formatCurrencyAmount(amount, currency, 'en-GB');

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: BOARD_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: BOARD_TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: BOARD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "14:05" today, "12 Nov 14:05" on another day (Cameroon time). */
export function when(ts: number, now = Date.now()): string {
  return dayKey.format(ts) === dayKey.format(now) ? timeFmt.format(ts) : dayTimeFmt.format(ts);
}

export const minutesAgo = (ts: number, now: number) => Math.max(0, Math.floor((now - ts) / 60_000));

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
}

/** Area (or landmark) and city of a place, for cards and the map. */
export function placeLine(p: { zoneName: string | null; landmark: string; cityName: string | null }): string {
  return [p.zoneName || p.landmark, p.cityName].filter(Boolean).join(', ');
}
