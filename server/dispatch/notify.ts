// Automatic emails for a delivery job (DISPATCH_SPEC §10, NOTIFICATIONS_SPEC §4), sent only when
// the sender gave an email address (kept with the shipment's sender, public booking form):
//   booking.confirmed: a LOCAL / INTERCITY job is confirmed (by dispatch, or created confirmed);
//   local.delivered: the parcel reached the recipient (not a first-mile leg, which ends at the office).
// Called by writeTransition inside its transaction, so a rolled-back step queues nothing. Never
// throws (queueEmail doesn't); mail off = nothing queued.
import type { DatabaseSync } from 'node:sqlite';
import { queueEmail } from '../mail/outbox.js';
import { cleanVar } from '../mail/layout.js';
import { trackUrl } from '../mail/urls.js';
import { maskName } from '../../src/shared/masking.js';
import { messageTime } from '../../src/shared/jobMessages.js';
import type { DispatchStatus } from '../../src/shared/dispatchStatus.js';
import { parsePlace, type JobRow } from './jobs.js';

/** The sender's email stored with the shipment, if any. */
export function shipmentSenderEmail(conn: DatabaseSync, trackingNumber: string): string | null {
  const row = conn.prepare('SELECT sender_json FROM shipments WHERE tracking_number = ? AND deleted_at_ts IS NULL').get(trackingNumber) as
    { sender_json: string | null } | undefined;
  try {
    const sender = row?.sender_json ? JSON.parse(row.sender_json) as { email?: unknown } : {};
    return typeof sender.email === 'string' && sender.email.trim() ? sender.email.trim() : null;
  } catch {
    return null;
  }
}

export function queueJobEmails(conn: DatabaseSync, job: JobRow, to: DispatchStatus): void {
  if (to !== 'CONFIRMED' && to !== 'DELIVERED') return;
  if (to === 'CONFIRMED' && job.scope !== 'LOCAL' && job.scope !== 'INTERCITY') return;
  if (to === 'DELIVERED' && job.scope === 'FIRST_MILE') return;
  const email = shipmentSenderEmail(conn, job.tracking_number);
  if (!email) return;
  const locale = job.notify_locale === 'fr' ? 'fr' : 'en';
  const link = trackUrl(job.tracking_number, locale);
  const related = { type: 'shipment', id: job.tracking_number };
  if (to === 'CONFIRMED') {
    const pickup = parsePlace(job.pickup_json);
    const first = (pickup.contactName ?? '').trim().split(/\s+/)[0] ?? '';
    queueEmail({ to: email, template: 'booking.confirmed', locale, related, vars: { name: cleanVar(first), id: job.tracking_number, link } }, conn);
    return;
  }
  const city = conn.prepare('SELECT time_zone FROM delivery_cities WHERE id = ?').get(parsePlace(job.dropoff_json).cityId) as { time_zone: string } | undefined;
  queueEmail({
    to: email, template: 'local.delivered', locale, related,
    vars: {
      id: job.tracking_number,
      masked: maskName(job.pod_recipient_name),
      time: messageTime(job.delivered_at_ts, locale, city?.time_zone ?? 'Africa/Douala'),
      link,
    },
  }, conn);
}
