// Shop order retention (SHOP_SPEC §17; periods for the lawyer to confirm, tracker #11/#112).
// Order and money records stay 10 years (OHADA accounting rules): nothing is deleted here. The
// contact and delivery details the accounts don't need (phone, WhatsApp, email, address, landmark,
// customer note) are blanked 2 years after the order closed (delivered, collected, cancelled or
// returned), `anonymised_at_ts` is set, and each run that changes something writes one audit entry.
// The order's last change (`updated_at_ts`) stands for its closing time: never earlier than it.
// The dispatch job's copy of the address follows the dispatch data rules (DISPATCH_SPEC).
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { FINAL_ORDER_STATUSES } from '../../src/shared/shopOrderStatus.js';

export const CONTACT_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Blanks the contact details of orders closed before the retention period; returns how many. */
export function anonymiseOldOrders(conn: DatabaseSync, now = Date.now()): number {
  const statuses = FINAL_ORDER_STATUSES.map(() => '?').join(', ');
  const ids = (conn.prepare(`
    SELECT id FROM shop_orders
    WHERE anonymised_at_ts IS NULL AND status IN (${statuses}) AND updated_at_ts < ?
  `).all(...FINAL_ORDER_STATUSES, now - CONTACT_RETENTION_MS) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return 0;

  const blank = conn.prepare(`
    UPDATE shop_orders SET customer_phone = '', customer_whatsapp = NULL, customer_email = NULL,
      address_text = NULL, landmark = NULL, customer_note = NULL, anonymised_at_ts = ?
    WHERE id = ? AND anonymised_at_ts IS NULL
  `);
  conn.exec('BEGIN');
  try {
    for (const id of ids) blank.run(now, id);
    conn.prepare(`
      INSERT INTO audit_log (id, at_ts, actor_user_id, actor_name, action, entity_type, entity_id, summary, before_json, after_json, ip)
      VALUES (?, ?, NULL, 'system', 'shop.order.anonymise', 'shop_order', NULL, ?, NULL, ?, NULL)
    `).run(randomUUID(), now, `Contact details removed from ${ids.length} shop order(s) closed over 2 years ago`, JSON.stringify({ orderIds: ids }));
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
  return ids.length;
}

/** Runs anonymiseOldOrders at start-up, then once a day. */
export function startShopRetention(conn: DatabaseSync): NodeJS.Timeout {
  const tick = () => {
    try {
      const n = anonymiseOldOrders(conn);
      if (n > 0) console.log(`[shop] contact details removed from ${n} order(s) past retention`);
    } catch (err) {
      console.error('[shop] order retention failed:', err);
    }
  };
  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
  return timer;
}
