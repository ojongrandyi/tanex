// notification_log (docs/NOTIFICATIONS_SPEC.md §2, §3): one row each time a WhatsApp click-to-chat
// link is opened from the console, the courier app or the booking page. It records that the link
// was OPENED, not that a message was sent (the person still taps Send in WhatsApp). Phone numbers
// are stored masked; the message text is never stored (it can hold a temporary password).
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { maskPhone } from '../../src/shared/masking.js';

export function createNotificationTables(conn: DatabaseSync): void {
  conn.exec(`
    -- channel: WHATSAPP_LINK (EMAIL rows stay in email_outbox); status: OPENED.
    CREATE TABLE IF NOT EXISTS notification_log (
      id TEXT PRIMARY KEY,
      at_ts INTEGER NOT NULL,
      channel TEXT NOT NULL,
      template_key TEXT NOT NULL,
      locale TEXT NOT NULL,
      to_masked TEXT,
      related_type TEXT,
      related_id TEXT,
      user_id TEXT,
      status TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notification_log_related ON notification_log (related_type, related_id, at_ts);
  `);
}

export interface NotificationLogInput {
  channel: 'WHATSAPP_LINK';
  templateKey: string;
  locale: 'en' | 'fr';
  /** Raw phone; stored masked. */
  phone: string | null;
  related: { type: string; id: string } | null;
  userId: string | null;
  now?: number;
}

export function logNotification(conn: DatabaseSync, input: NotificationLogInput): string {
  const id = 'ntf_' + crypto.randomBytes(9).toString('hex');
  conn.prepare(`
    INSERT INTO notification_log (id, at_ts, channel, template_key, locale, to_masked, related_type, related_id, user_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPENED')
  `).run(id, input.now ?? Date.now(), input.channel, input.templateKey, input.locale, maskPhone(input.phone) ?? null,
    input.related?.type ?? null, input.related?.id ?? null, input.userId);
  return id;
}

export interface NotificationLogRow {
  at_ts: number; channel: string; template_key: string; locale: string; to_masked: string | null; user_id: string | null; status: string;
}

export function readNotificationLog(conn: DatabaseSync, related: { type: string; id: string }[]): (NotificationLogRow & { user_name: string | null })[] {
  if (related.length === 0) return [];
  const where = related.map(() => '(n.related_type = ? AND n.related_id = ?)').join(' OR ');
  return conn.prepare(`
    SELECT n.at_ts, n.channel, n.template_key, n.locale, n.to_masked, n.user_id, n.status, u.display_name AS user_name
    FROM notification_log n LEFT JOIN users u ON u.id = n.user_id
    WHERE ${where} ORDER BY n.at_ts, n.id
  `).all(...related.flatMap((r) => [r.type, r.id])) as unknown as (NotificationLogRow & { user_name: string | null })[];
}
