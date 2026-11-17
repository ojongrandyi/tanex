// Courier cash: balance and the daily per-courier report (DISPATCH_SPEC §9). DOM-free; used by the
// server (GET /api/courier/cash, /api/cash/*) and the tests.
//
// Only money the courier actually holds counts in the balance: cash collected at the door. A
// customer payment by MTN MoMo / Orange Money goes straight to the company account; the courier
// only records its transaction reference, which Finance checks against the wallet statement.

export interface CashLine {
  courierUserId: string;
  type: string;      // COLLECTED | HANDOVER | ADJUSTMENT
  method: string;    // CASH | MTN_MOMO | ORANGE_MONEY
  status: string;    // PENDING | CONFIRMED | REJECTED
  amount: number;
  currency: string;
  createdAt: number;
  confirmedAt: number | null;
}

/** Collected by the courier in cash (what they must hand over). */
export const isCashInHand = (l: Pick<CashLine, 'type' | 'method' | 'status'>) =>
  l.type === 'COLLECTED' && l.method === 'CASH' && l.status !== 'REJECTED';

export interface CashTotals {
  /** Cash collected, pending or confirmed. */
  collected: number;
  /** Customer mobile money payments recorded by the courier (paid to the company account). */
  mobileMoney: number;
  handedOver: number;
  pendingHandover: number;
  adjustments: number;
  /** collected + confirmed adjustments − confirmed handovers. */
  balance: number;
}

/** Totals for one courier and one currency. */
export function cashTotals(lines: readonly Pick<CashLine, 'type' | 'method' | 'status' | 'amount'>[]): CashTotals {
  const sum = (ok: (l: typeof lines[number]) => boolean) => lines.filter(ok).reduce((s, l) => s + l.amount, 0);
  const collected = sum(isCashInHand);
  const mobileMoney = sum((l) => l.type === 'COLLECTED' && l.method !== 'CASH' && l.status !== 'REJECTED');
  const handedOver = sum((l) => l.type === 'HANDOVER' && l.status === 'CONFIRMED');
  const pendingHandover = sum((l) => l.type === 'HANDOVER' && l.status === 'PENDING');
  const adjustments = sum((l) => l.type === 'ADJUSTMENT' && l.status === 'CONFIRMED');
  return { collected, mobileMoney, handedOver, pendingHandover, adjustments, balance: collected + adjustments - handedOver };
}

export interface DailyReportRow {
  courierUserId: string;
  courierName: string;
  currency: string;
  /** Cash collected during the day. */
  collected: number;
  /** Mobile money references recorded during the day. */
  mobileMoney: number;
  /** Handovers declared during the day (not rejected). */
  handoversDeclared: number;
  /** Handovers Finance confirmed during the day. */
  handoversConfirmed: number;
  /** Adjustments recorded during the day. */
  adjustments: number;
  /** Rows still waiting for Finance at the end of the day. */
  pendingCount: number;
  /** Balance at the end of the day. */
  balanceEnd: number;
}

/**
 * One row per courier and currency with activity during [dayStart, dayEnd) or a balance left at
 * the end of it. Statuses are read as they are now (a handover confirmed later counts as declared
 * on its day and as confirmed on the day Finance confirmed it).
 */
export function dailyCashReport(
  lines: readonly CashLine[], names: Readonly<Record<string, string>>, dayStart: number, dayEnd: number,
): DailyReportRow[] {
  const inDay = (ts: number | null) => ts !== null && ts >= dayStart && ts < dayEnd;
  const groups = new Map<string, CashLine[]>();
  for (const l of lines) {
    if (l.createdAt >= dayEnd) continue;
    const key = `${l.courierUserId}\u0000${l.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const rows: DailyReportRow[] = [];
  for (const [key, group] of groups) {
    const [courierUserId, currency] = key.split('\u0000');
    const day = group.filter((l) => inDay(l.createdAt));
    const sum = (list: CashLine[], ok: (l: CashLine) => boolean) => list.filter(ok).reduce((s, l) => s + l.amount, 0);
    // End-of-day balance: what existed by then, with handovers counted once confirmed by then.
    const asOfEnd = group.map((l) => (l.type === 'HANDOVER' && l.status === 'CONFIRMED' && (l.confirmedAt ?? 0) >= dayEnd
      ? { ...l, status: 'PENDING' } : l));
    const row: DailyReportRow = {
      courierUserId,
      courierName: names[courierUserId] ?? courierUserId,
      currency,
      collected: sum(day, isCashInHand),
      mobileMoney: sum(day, (l) => l.type === 'COLLECTED' && l.method !== 'CASH' && l.status !== 'REJECTED'),
      handoversDeclared: sum(day, (l) => l.type === 'HANDOVER' && l.status !== 'REJECTED'),
      handoversConfirmed: sum(group, (l) => l.type === 'HANDOVER' && l.status === 'CONFIRMED' && inDay(l.confirmedAt)),
      adjustments: sum(day, (l) => l.type === 'ADJUSTMENT' && l.status === 'CONFIRMED'),
      pendingCount: group.filter((l) => l.status === 'PENDING' || (l.confirmedAt !== null && l.confirmedAt >= dayEnd)).length,
      balanceEnd: cashTotals(asOfEnd).balance,
    };
    const active = day.length > 0 || row.handoversConfirmed !== 0 || row.balanceEnd !== 0;
    if (active) rows.push(row);
  }
  return rows.sort((a, b) => a.courierName.localeCompare(b.courierName) || a.currency.localeCompare(b.currency));
}

/** One CSV field: quoted when needed, and a leading = + - @ is neutralised for spreadsheets. */
export function csvField(value: string | number): string {
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const DAILY_REPORT_COLUMNS = [
  'Date', 'Courier', 'Currency', 'Cash collected', 'Mobile money recorded', 'Handovers declared',
  'Handovers confirmed', 'Adjustments', 'Waiting for Finance', 'Balance at end of day',
] as const;

/** CSV (comma-separated, CRLF lines, UTF-8 with BOM so spreadsheets read accents). */
export function dailyReportCsv(date: string, rows: readonly DailyReportRow[]): string {
  const lines = [DAILY_REPORT_COLUMNS.map(csvField).join(',')];
  for (const r of rows) {
    lines.push([date, r.courierName, r.currency, r.collected, r.mobileMoney, r.handoversDeclared, r.handoversConfirmed,
      r.adjustments, r.pendingCount, r.balanceEnd].map(csvField).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Start and end (epoch ms) of a YYYY-MM-DD day in a time zone, or null for a bad date. */
export function dayRange(date: string, timeZone = 'Africa/Douala'): { start: number; end: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const offsetAt = (ts: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ts));
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - ts;
  };
  const start = utcMidnight - offsetAt(utcMidnight);
  const nextMidnight = utcMidnight + 86_400_000;
  return { start, end: nextMidnight - offsetAt(nextMidnight) };
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayIn(timeZone = 'Africa/Douala', now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
