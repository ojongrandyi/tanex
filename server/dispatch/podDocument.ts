// Proof of Delivery document (CONTENT §11; tracker #38): written by the server in the same
// transaction as a job's move to DELIVERED, so every delivered local, intercity or last-mile job
// has one in the Document Center. The paper itself is drawn by the console
// (DocumentCenterView, docType 'POD'); the photo and signature stay private files served only to
// dispatch, finance and the courier (server/routes/dispatch.ts).
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { LEGAL_NAME } from '../../src/config/brand.js';
import { SIZE_CLASS_LABELS, isSizeClass } from '../../src/shared/localPricing.js';
import { formatEventTimestamp } from '../../src/shared/timeZones.js';
import type { JobRow } from './jobs.js';

/** documents.details_json of a POD. */
export interface PodDetails {
  jobId: string;
  scope: string;
  deliveredAtTs: number;
  timeZone: string;
  deliveredAtText: string;
  receivedBy: string;
  courierName: string | null;
  courierPublicName: string | null;
  vehicleType: string | null;
  hasPhoto: boolean;
  hasSignature: boolean;
  note: string | null;
  codAmount: number | null;
  currency: string;
  cashRefs: string[];
  attempts: number;
}

function newPodId(conn: DatabaseSync, now: number): string {
  const year = new Date(now).getFullYear();
  const exists = conn.prepare('SELECT 1 FROM documents WHERE id = ?');
  for (let i = 0; i < 20; i++) {
    const id = `POD-${year}-${crypto.randomInt(10000, 100000)}`;
    if (!exists.get(id)) return id;
  }
  throw new Error('Could not allocate a free Proof of Delivery number.');
}

export function createPodDocument(conn: DatabaseSync, job: JobRow, generatedBy: string, cashRefs: string[]): string {
  const now = Date.now();
  const pickup = JSON.parse(job.pickup_json) as Record<string, any>;
  const dropoff = JSON.parse(job.dropoff_json) as Record<string, any>;
  const city = (id: unknown) => conn.prepare('SELECT name, time_zone FROM delivery_cities WHERE id = ?').get(String(id ?? '')) as
    { name: string; time_zone: string } | undefined;
  const zone = (id: unknown) => id ? conn.prepare('SELECT name FROM delivery_zones WHERE id = ?').get(String(id)) as { name: string } | undefined : undefined;
  const pc = city(pickup.cityId);
  const dc = city(dropoff.cityId);
  const address = (p: Record<string, any>) => [zone(p.zoneId)?.name, p.landmark].filter(Boolean).join(', ') || null;
  const courier = job.courier_user_id
    ? conn.prepare('SELECT c.public_first_name, c.vehicle_type, u.display_name FROM couriers c JOIN users u ON u.id = c.user_id WHERE c.user_id = ?')
      .get(job.courier_user_id) as { public_first_name: string; vehicle_type: string; display_name: string } | undefined
    : undefined;
  const deliveredAt = job.delivered_at_ts ?? now;
  const timeZone = dc?.time_zone || 'Africa/Douala';
  const details: PodDetails = {
    jobId: job.id,
    scope: job.scope,
    deliveredAtTs: deliveredAt,
    timeZone,
    deliveredAtText: formatEventTimestamp(deliveredAt, timeZone),
    receivedBy: job.pod_recipient_name ?? '',
    courierName: courier?.display_name ?? null,
    courierPublicName: courier?.public_first_name ?? null,
    vehicleType: courier?.vehicle_type ?? null,
    hasPhoto: !!job.pod_photo_file,
    hasSignature: !!job.pod_signature_file,
    note: job.pod_note,
    codAmount: job.cod_amount,
    currency: job.currency,
    cashRefs,
    attempts: job.attempts,
  };
  const cargo = job.item_description || (isSizeClass(job.size_class) ? `${SIZE_CLASS_LABELS[job.size_class].en} parcel` : 'Parcel');
  const service = job.scope === 'LOCAL' ? 'Local Delivery' : job.scope === 'INTERCITY' ? 'Intercity Delivery'
    : job.scope === 'LAST_MILE' ? 'Last-mile Delivery' : 'First-mile Collection';
  const id = newPodId(conn, now);
  const dateStr = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  conn.prepare(`
    INSERT INTO documents (
      id, doc_type, title, shipment_tracking, sender_name, sender_address, sender_city, sender_state, sender_phone,
      recipient_name, recipient_address, recipient_city, recipient_state, recipient_phone,
      cargo_description, shipment_type, service, weight_lbs, pieces, declared_value, bol_carrier,
      created_date, status, version, version_history_json, file_size, created_at_ts, details_json
    ) VALUES (?, 'POD', 'Proof of Delivery', ?, ?, ?, ?, '', ?, ?, ?, ?, '', ?, ?, 'Parcel', ?, ?, 1, 0, ?, ?, 'GENERATED', 1, ?, NULL, ?, ?)
  `).run(
    id, job.tracking_number,
    String(pickup.contactName ?? ''), address(pickup), pc?.name ?? '', pickup.contactPhone ?? null,
    String(dropoff.contactName ?? ''), address(dropoff), dc?.name ?? '', dropoff.contactPhone ?? null,
    cargo, service, job.weight_kg ? Math.round(job.weight_kg * 2.20462 * 100) / 100 : 0, LEGAL_NAME,
    dateStr,
    JSON.stringify([{ version: 1, createdDate: `${dateStr} ${timeStr}`, generatedBy, notes: 'Generated when the delivery was completed.' }]),
    now, JSON.stringify(details),
  );
  return id;
}
