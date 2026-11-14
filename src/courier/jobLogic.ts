// Pure helpers for the courier app: the status a job will have once the steps saved on the phone
// are synced, the money to collect at each step, and the call / WhatsApp / Maps links.
import {
  FINAL_DISPATCH_STATUSES, LOCATION_SHARING_STATUSES, allowedActions, findTransition, isDispatchAction,
  type DispatchAction, type DispatchStatus,
} from '../shared/dispatchStatus';
import { whatsAppDigits } from '../shared/whatsapp';
import { normalizePhone } from '../shared/identifier';
import type { CourierJob, CourierPlace } from './courierApi';
import type { QueueItem } from './offlineQueue';

/** Job actions waiting on the phone for this job, oldest first. */
export function pendingActions(jobId: string, pending: readonly QueueItem[]): DispatchAction[] {
  return pending
    .filter((i) => i.kind === 'action' && i.jobId === jobId && isDispatchAction(i.body?.action))
    .map((i) => i.body!.action as DispatchAction);
}

/** The job as the courier will see it once the waiting steps are synced. */
export function viewStatus(job: CourierJob, pending: readonly QueueItem[]): DispatchStatus {
  let status: DispatchStatus = job.status;
  for (const action of pendingActions(job.id, pending)) {
    const t = findTransition(status, action);
    if (t) status = t.to;
  }
  return status;
}

export function courierActions(status: DispatchStatus): DispatchAction[] {
  return allowedActions(status, 'courier');
}

export const isFinal = (status: DispatchStatus) => FINAL_DISPATCH_STATUSES.includes(status);
export const sharesLocation = (status: DispatchStatus) => LOCATION_SHARING_STATUSES.includes(status);

/** Delivery fee the sender pays the courier at pickup. */
export function pickupCollect(job: CourierJob): number {
  return job.payer === 'SENDER' && job.collectDeliveryFee && job.price ? job.price : 0;
}

/** Money to collect at delivery: the goods (COD) plus the fee when the recipient pays it on the spot. */
export function deliveryCollect(job: CourierJob): { cod: number; fee: number; total: number } {
  const cod = job.codAmount && job.codAmount > 0 ? job.codAmount : 0;
  const fee = job.payer === 'RECIPIENT' && job.collectDeliveryFee && job.price ? job.price : 0;
  return { cod, fee, total: cod + fee };
}

export function telLink(phone: string | null): string | null {
  if (!phone) return null;
  const e164 = normalizePhone(phone);
  return e164 ? `tel:${e164}` : `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsAppLink(phone: string | null): string | null {
  const digits = whatsAppDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

/** Google Maps: the pin when there is one, otherwise a search for the landmark, area and city. */
export function mapsLink(place: CourierPlace): string {
  if (place.lat !== null && place.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  const q = [place.landmark, place.zoneName, place.cityName, 'Cameroon'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function placeTitle(place: CourierPlace): string {
  return [place.zoneName, place.cityName].filter(Boolean).join(', ');
}
