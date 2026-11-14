// Courier app API client (server/routes/courier.ts, DISPATCH_SPEC §6, §11). Reads go through the
// shared fetchApi (retried on CDN hiccups); writes go through the offline queue (./offlineQueue.ts),
// which sends them with sendRaw so it can tell "no answer" (keep and retry) from "refused" (drop).
import { fetchApi, handleResponse } from '../services/api';
import type { DispatchAction, DispatchStatus, VehicleType } from '../shared/dispatchStatus';

export interface CourierPlace {
  cityId: string;
  zoneId: string | null;
  landmark: string | null;
  directions: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string | null;
  contactPhone: string | null;
  cityName: string | null;
  zoneName: string | null;
}

/** GET /api/courier/jobs item (jobOut with view 'courier'). */
export interface CourierJob {
  id: string;
  trackingNumber: string;
  scope: string;
  status: DispatchStatus;
  vehicleRequired: VehicleType;
  courierUserId: string | null;
  pickup: CourierPlace;
  dropoff: CourierPlace;
  sizeClass: 'SMALL' | 'MEDIUM' | 'LARGE' | null;
  weightKg: number | null;
  itemDescription: string | null;
  isExpress: boolean;
  scheduledForTs: number | null;
  price: number | null;
  currency: string;
  payer: 'SENDER' | 'RECIPIENT';
  codAmount: number | null;
  collectDeliveryFee: boolean;
  hasDeliveryCode: boolean;
  deliveryCodeTriesLeft: number | null;
  pod: { recipientName: string | null; photoUrl: string | null; signatureUrl: string | null; note: string | null };
  failureReason: string | null;
  failureNote: string | null;
  attempts: number;
  assignedAt: number | null;
  pickedUpAt: number | null;
  deliveredAt: number | null;
  cancelledAt: number | null;
  createdAt: number;
  updatedAt: number;
  allowedActions: DispatchAction[];
}

export interface CourierProfile {
  vehicleType: VehicleType;
  plateNumber: string | null;
  publicFirstName: string;
  homeCityName: string | null;
  isOnDuty: boolean;
  showPhotoPublicly: boolean;
  photoUrl: string | null;
}

export interface CashBalance { currency: string; collected: number; handedOver: number; pendingHandover: number; balance: number }
export interface CashEntry {
  id: string; ref: string; jobId: string | null; trackingNumber: string | null; type: 'COLLECTED' | 'HANDOVER' | 'ADJUSTMENT';
  method: string; amount: number; currency: string; momoReference: string | null; status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  note: string | null; createdAt: number; confirmedAt: number | null;
}
export interface CashState { balances: CashBalance[]; entries: CashEntry[] }

export type CashMethod = 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY';
export interface CashInput { amount: number; method: CashMethod; momoReference?: string }

const BASE = '/api/courier';

async function getJson<T>(url: string): Promise<T> {
  return handleResponse<T>(await fetchApi(url, { credentials: 'include', cache: 'no-store' }));
}

export const courierApi = {
  jobs: () => getJson<CourierJob[]>(`${BASE}/jobs`),
  me: () => getJson<CourierProfile>(`${BASE}/me`),
  cash: () => getJson<CashState>(`${BASE}/cash`),
  async updateMe(changes: { isOnDuty?: boolean; showPhotoPublicly?: false }): Promise<CourierProfile> {
    const res = await fetchApi(`${BASE}/me`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    return handleResponse<CourierProfile>(res);
  },
};

/** What the queue needs to know about an answer. status 0 = no answer (offline, CDN page, timeout). */
export interface RawResult {
  status: number;
  ok: boolean;
  data?: unknown;
  code?: string;
  error?: string;
  details?: Record<string, unknown>;
}

const SEND_TIMEOUT_MS = 30_000;

/** One write, sent once. Never throws. */
export async function sendRaw(url: string, init: RequestInit): Promise<RawResult> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store', signal: ctrl.signal });
    const type = res.headers.get('content-type') || '';
    // Not the app's answer (the host's bot check or restart page): treat as no answer and retry.
    if (!type.includes('json')) return { status: 0, ok: false };
    const json = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!json) return { status: 0, ok: false };
    const ok = res.ok && json.success !== false;
    return {
      status: res.status,
      ok,
      data: json.data,
      code: typeof json.code === 'string' ? json.code : undefined,
      error: typeof json.error === 'string' ? json.error : undefined,
      details: json.details && typeof json.details === 'object' ? json.details as Record<string, unknown> : undefined,
    };
  } catch {
    return { status: 0, ok: false };
  } finally {
    window.clearTimeout(timer);
  }
}

export const courierUrls = {
  action: (jobId: string) => `${BASE}/jobs/${encodeURIComponent(jobId)}/action`,
  pod: (jobId: string) => `${BASE}/pod/${encodeURIComponent(jobId)}`,
  handover: () => `${BASE}/cash/handover`,
  location: () => `${BASE}/location`,
};
