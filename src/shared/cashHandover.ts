// Courier cash handover rules (DISPATCH_SPEC §9; owner 2026-11-14, tracker #169): money a courier
// collects is handed to the company within 7 days, in cash at the office or by MTN MoMo / Orange
// Money transfer to the company account (with the transaction ID). DOM-free; used by the server
// (GET /api/courier/cash) and the tests.

export const HANDOVER_DEADLINE_DAYS = 7;
const DAY_MS = 86_400_000;

export const HANDOVER_METHODS = ['CASH', 'MTN_MOMO', 'ORANGE_MONEY'] as const;
export type HandoverMethod = typeof HANDOVER_METHODS[number];

export function isHandoverMethod(value: unknown): value is HandoverMethod {
  return typeof value === 'string' && (HANDOVER_METHODS as readonly string[]).includes(value);
}

export interface LedgerLine {
  type: string;      // COLLECTED | HANDOVER | ADJUSTMENT
  /** CASH | MTN_MOMO | ORANGE_MONEY (missing = CASH). A customer's mobile money payment goes to the company account, so it is never due from the courier. */
  method?: string;
  status: string;   // PENDING | CONFIRMED | REJECTED
  amount: number;
  createdAt: number;
}

export interface HandoverDue {
  /** Amount still to hand over (collected and not yet covered by a declared handover). */
  outstanding: number;
  /** When the oldest uncovered collection must be handed over by; null when nothing is due. */
  dueBy: number | null;
  overdue: boolean;
}

/**
 * Oldest-first: declared handovers (pending or confirmed; a rejected one doesn't count) pay off
 * the oldest collections first. The first collection not fully covered sets the deadline:
 * its time + 7 days. One currency at a time.
 */
export function handoverDue(lines: readonly LedgerLine[], now = Date.now()): HandoverDue {
  const collected = lines
    .filter((l) => l.type === 'COLLECTED' && (l.method ?? 'CASH') === 'CASH' && l.status !== 'REJECTED' && l.amount > 0)
    .sort((a, b) => a.createdAt - b.createdAt);
  let covered = lines
    .filter((l) => l.type === 'HANDOVER' && l.status !== 'REJECTED')
    .reduce((s, l) => s + l.amount, 0);
  let outstanding = 0;
  let dueBy: number | null = null;
  for (const c of collected) {
    const take = Math.min(covered, c.amount);
    covered -= take;
    const left = c.amount - take;
    if (left > 0) {
      outstanding += left;
      if (dueBy === null) dueBy = c.createdAt + HANDOVER_DEADLINE_DAYS * DAY_MS;
    }
  }
  return { outstanding, dueBy, overdue: dueBy !== null && now > dueBy };
}
