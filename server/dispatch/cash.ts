// Courier cash ledger reads (DISPATCH_SPEC §9), shared by the courier app (own money) and the
// console's Cash & Mobile Money view (cash.view / cash.confirm). Arithmetic lives in
// src/shared/cashReport.ts and src/shared/cashHandover.ts so it is tested without a database.
import type { DatabaseSync } from 'node:sqlite';
import { cashTotals, type CashLine } from '../../src/shared/cashReport.js';
import { handoverDue } from '../../src/shared/cashHandover.js';

interface LedgerRow {
  courier_user_id: string; entry_type: string; method: string; status: string; amount: number; currency: string;
  created_at_ts: number; confirmed_at_ts: number | null;
}

export const toCashLine = (r: LedgerRow): CashLine => ({
  courierUserId: r.courier_user_id, type: r.entry_type, method: r.method, status: r.status, amount: r.amount,
  currency: r.currency, createdAt: r.created_at_ts, confirmedAt: r.confirmed_at_ts,
});

export function readCashLines(conn: DatabaseSync, courierUserId?: string): CashLine[] {
  const sql = `SELECT courier_user_id, entry_type, method, status, amount, currency, created_at_ts, confirmed_at_ts FROM cash_ledger`;
  const rows = (courierUserId
    ? conn.prepare(`${sql} WHERE courier_user_id = ?`).all(courierUserId)
    : conn.prepare(sql).all()) as unknown as LedgerRow[];
  return rows.map(toCashLine);
}

export interface CourierBalance {
  currency: string;
  collected: number;
  handedOver: number;
  pendingHandover: number;
  balance: number;
  outstanding: number;
  dueBy: number | null;
  overdue: boolean;
}

/**
 * A courier's money by currency: balance = cash collected (pending + confirmed) + confirmed
 * adjustments − confirmed handovers. Handovers waiting for Finance are shown apart.
 * outstanding / dueBy / overdue: the 7-day handover deadline.
 */
export function balancesFromLines(lines: readonly CashLine[], now = Date.now()): (CourierBalance & { mobileMoney: number })[] {
  const currencies = [...new Set(lines.map((l) => l.currency))].sort();
  return currencies.map((currency) => {
    const own = lines.filter((l) => l.currency === currency);
    const t = cashTotals(own);
    const due = handoverDue(own.map((l) => ({ type: l.type, method: l.method, status: l.status, amount: l.amount, createdAt: l.createdAt })), now);
    return {
      currency,
      collected: t.collected,
      handedOver: t.handedOver,
      pendingHandover: t.pendingHandover,
      balance: t.balance,
      outstanding: due.outstanding,
      dueBy: due.dueBy,
      overdue: due.overdue,
      mobileMoney: t.mobileMoney,
    };
  });
}

/** The courier app's summary (GET /api/courier/cash). */
export function courierCashSummary(conn: DatabaseSync, courierUserId: string, now = Date.now()): CourierBalance[] {
  return balancesFromLines(readCashLines(conn, courierUserId), now).map(({ mobileMoney: _m, ...b }) => b);
}
