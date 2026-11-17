// Cash & Mobile Money API client (server/routes/cash.ts, DISPATCH_SPEC §9). Console-only: imported
// from the lazy Cash view chunk.
import { fetchApi, handleResponse } from '../../services/api';
import type { DailyReportRow } from '../../shared/cashReport';

export interface CashBalance {
  currency: string; collected: number; handedOver: number; pendingHandover: number; balance: number;
  outstanding: number; dueBy: number | null; overdue: boolean; mobileMoney: number;
}
export interface CashCourier {
  userId: string; displayName: string; phone: string | null; accountStatus: string; vehicleType: string | null;
  balances: CashBalance[]; pendingCount: number;
}
export interface CashEntry {
  id: string; ref: string; courierUserId: string; courierName: string | null; jobId: string | null; trackingNumber: string | null;
  type: 'COLLECTED' | 'HANDOVER' | 'ADJUSTMENT'; method: string; amount: number; currency: string; momoReference: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; note: string | null; recordedByName: string | null; confirmedByName: string | null;
  createdAt: number; confirmedAt: number | null;
}
export interface CashOverview { serverTime: number; today: string; couriers: CashCourier[]; pending: CashEntry[] }
export interface CashReport { date: string; rows: DailyReportRow[] }

const C = '/api/cash';

async function send<R>(method: string, url: string, body?: unknown): Promise<R> {
  const res = await fetchApi(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleResponse<R>(res);
}

export const reportCsvUrl = (date: string) => `${C}/report?date=${encodeURIComponent(date)}&format=csv`;

export const cashApi = {
  overview: () => send<CashOverview>('GET', `${C}/overview`),
  entries: (courierUserId: string) => send<CashEntry[]>('GET', `${C}/entries?courier=${encodeURIComponent(courierUserId)}`),
  confirm: (id: string) => send<CashEntry>('POST', `${C}/entries/${encodeURIComponent(id)}/confirm`, {}),
  reject: (id: string, reason: string) => send<CashEntry>('POST', `${C}/entries/${encodeURIComponent(id)}/reject`, { reason }),
  adjust: (courierUserId: string, amount: number, currency: string, reason: string) =>
    send<CashEntry>('POST', `${C}/adjustments`, { courierUserId, amount, currency, reason }),
  report: (date: string) => send<CashReport>('GET', `${C}/report?date=${encodeURIComponent(date)}`),
};
