// Dispatch board API client (server/routes/dispatch.ts, DISPATCH_SPEC §7, §11). Console-only: imported
// from the lazy dispatch board chunk, except `dispatchSummary`, which the sidebar badge uses.
import { fetchApi, handleResponse } from '../../services/api';
import type { DispatchAction, DispatchStatus, JobScope, VehicleType } from '../../shared/dispatchStatus';
import type { SizeClass } from '../../shared/localPricing';

export interface JobPlace {
  cityId: string;
  zoneId: string | null;
  landmark: string;
  directions: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string;
  contactPhone: string;
  cityName: string | null;
  zoneName: string | null;
}

export interface DispatchJob {
  id: string;
  trackingNumber: string;
  scope: JobScope;
  status: DispatchStatus;
  vehicleRequired: VehicleType;
  courierUserId: string | null;
  courier: { userId: string; publicFirstName: string; displayName: string; phone: string | null; vehicleType: string; plateNumber: string | null } | null;
  pickup: JobPlace;
  dropoff: JobPlace;
  sizeClass: SizeClass | null;
  weightKg: number | null;
  itemDescription: string | null;
  isExpress: boolean;
  scheduledForTs: number | null;
  price: number | null;
  currency: string;
  priceOverridden: boolean;
  payer: 'SENDER' | 'RECIPIENT';
  codAmount: number | null;
  collectDeliveryFee: boolean;
  hasDeliveryCode: boolean;
  deliveryCodeTriesLeft: number | null;
  pod: { recipientName: string | null; photoUrl: string | null; signatureUrl: string | null; note: string | null };
  failureReason: string | null;
  failureNote: string | null;
  attempts: number;
  notifyLocale: 'en' | 'fr';
  requestedAt: number | null;
  confirmedAt: number | null;
  assignedAt: number | null;
  acceptedAt: number | null;
  pickedUpAt: number | null;
  onTheWayAt: number | null;
  deliveredAt: number | null;
  cancelledAt: number | null;
  etaTs: number | null;
  createdAt: number;
  updatedAt: number;
  allowedActions: DispatchAction[];
}

export interface BoardCourier {
  userId: string;
  displayName: string;
  publicFirstName: string;
  phone: string | null;
  vehicleType: VehicleType;
  homeCityId: string | null;
  isOnDuty: boolean;
  accountStatus: string;
  activeJobs: number;
  lastPosition: { lat: number; lng: number; accuracyM: number | null; speedMps: number | null; heading: number | null; recordedAt: number; jobId: string | null } | null;
}

export interface BoardCity { id: string; name: string; lat: number | null; lng: number | null; isActive: boolean }
export interface BoardZone { id: string; cityId: string; name: string; lat: number | null; lng: number | null; isActive: boolean }

export interface BoardData {
  serverTime: number;
  /** Waiting-job alert minutes set in Tariffs (0 = off). */
  alertMinutes: { unassigned: number; notAccepted: number };
  cities: BoardCity[];
  zones: BoardZone[];
  jobs: DispatchJob[];
  couriers: BoardCourier[];
}

export interface JobHistory {
  timeline: { at: number; actorName: string | null; action: string; summary: string | null; reason: string | null }[];
  cash: { ref: string; entryType: string; method: string; amount: number; currency: string; momoReference: string | null; status: string; at: number }[];
  notifications: { channel: 'EMAIL' | 'WHATSAPP_LINK'; to: string; template: string; locale: string; status: string; at: number; sentAt: number | null; byName: string | null }[];
}

export interface DispatchSummary { requested: number; toAssign: number; problems: number; attention: number }

export type QuoteResult =
  | { ok: true; price: number; currency: string; match: string | null }
  | { ok: false; reason: string };

export interface PlaceInput {
  cityId: string;
  zoneId: string | null;
  landmark: string;
  directions: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string;
  contactPhone: string;
}

export interface JobCreateInput {
  scope: JobScope;
  trackingNumber?: string;
  pickup: PlaceInput;
  dropoff: PlaceInput;
  sizeClass?: SizeClass | null;
  weightKg?: number | null;
  itemDescription?: string | null;
  isExpress?: boolean;
  scheduledForTs?: number | null;
  vehicleRequired?: VehicleType;
  price?: number;
  priceReason?: string;
  payer?: 'SENDER' | 'RECIPIENT';
  codAmount?: number | null;
  collectDeliveryFee?: boolean;
  deliveryCode?: string | null;
  notifyLocale?: 'en' | 'fr';
}

const J = '/api/dispatch';
const job = (id: string) => `${J}/jobs/${encodeURIComponent(id)}`;

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

export const dispatchSummary = () => send<DispatchSummary>('GET', `${J}/summary`);

export const boardApi = {
  board: () => send<BoardData>('GET', `${J}/board`),
  history: (id: string) => send<JobHistory>('GET', `${job(id)}/history`),
  quote: (input: { pickup: { cityId: string; zoneId: string | null }; dropoff: { cityId: string; zoneId: string | null };
    sizeClass?: SizeClass | null; weightKg?: number | null; isExpress?: boolean }) => send<QuoteResult>('POST', `${J}/quote`, input),
  create: (input: JobCreateInput) => send<DispatchJob>('POST', `${J}/jobs`, input),
  confirm: (id: string) => send<DispatchJob>('POST', `${job(id)}/confirm`, {}),
  assign: (id: string, courierUserId: string) => send<DispatchJob>('POST', `${job(id)}/assign`, { courierUserId }),
  setPrice: (id: string, price: number, reason: string) => send<DispatchJob>('POST', `${job(id)}/price`, { price, reason }),
  priceFromRates: (id: string) => send<DispatchJob>('POST', `${job(id)}/price`, { price: null }),
  cancel: (id: string, reason: string, trashShipment: boolean) => send<DispatchJob>('POST', `${job(id)}/cancel`, { reason, trashShipment }),
  markReturned: (id: string, note: string) => send<DispatchJob>('POST', `${job(id)}/return`, note ? { note } : {}),
  liftCode: (id: string, reason: string) => send<DispatchJob>('POST', `${job(id)}/delivery-code-override`, { reason }),
};
