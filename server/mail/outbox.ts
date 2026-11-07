// Email outbox (docs/NOTIFICATIONS_SPEC.md §3). Every email is written to `email_outbox` first and
// sent by a worker in the same process every 30 s, so a slow or failing mail server never slows
// down or breaks the request that caused the email. Failed sends are retried after 1, 5, 15 and
// 60 minutes; after 5 attempts the row is FAILED and shows under Settings → Email.
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { db } from '../db.js';
import { mailConfig, mailEnabled, maskEmail, sendMessage } from './mailer.js';
import { renderTemplate, TEMPLATES, type TemplateKey, type TemplateVars } from './templates/index.js';
import type { MailLocale } from './layout.js';

export const MAX_ATTEMPTS = 5;
/** Wait before attempt 2, 3, 4 and 5 (minutes). */
export const RETRY_DELAYS_MS = [1, 5, 15, 60].map((m) => m * 60 * 1000);
export const WORKER_INTERVAL_MS = 30 * 1000;
/** Customer emails (public forms) to one address per hour; stops the forms being used to spam someone. */
export const CUSTOMER_EMAILS_PER_HOUR = 3;
/** Staff alerts of one kind per hour; a spam wave on a public form can't flood the staff inbox. */
export const STAFF_ALERTS_PER_HOUR = 20;

const EMAIL_PATTERN = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** A single plain address (no display name, no list), at most 254 characters. */
export function isDeliverableAddress(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function createMailTables(conn: DatabaseSync): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id TEXT PRIMARY KEY,
      to_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text TEXT NOT NULL,
      template_key TEXT NOT NULL,
      locale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      related_type TEXT,
      related_id TEXT,
      created_at_ts INTEGER NOT NULL,
      sent_at_ts INTEGER,
      next_attempt_at_ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_due ON email_outbox (status, next_attempt_at_ts);
    CREATE INDEX IF NOT EXISTS idx_outbox_to ON email_outbox (to_addr, created_at_ts);
  `);
}

export interface QueueOptions<K extends TemplateKey> {
  to: string;
  template: K;
  locale: MailLocale;
  vars: TemplateVars[K];
  related?: { type: string; id: string };
  now?: number;
}

/**
 * Renders a template and queues it. Returns the outbox id, or null when nothing was queued:
 * mail is off, the address isn't a single valid address, or (customer templates) the address
 * already got CUSTOMER_EMAILS_PER_HOUR emails in the last hour. Never throws.
 */
export function queueEmail<K extends TemplateKey>(opts: QueueOptions<K>, conn: DatabaseSync = db): string | null {
  try {
    if (!mailEnabled()) return null;
    const to = opts.to.trim().toLowerCase();
    if (!isDeliverableAddress(to)) return null;
    const now = opts.now ?? Date.now();
    const entry = TEMPLATES[opts.template];

    if (entry.customer) {
      const customerKeys = (Object.keys(TEMPLATES) as TemplateKey[]).filter((k) => TEMPLATES[k].customer);
      const { c } = conn.prepare(`
        SELECT COUNT(*) AS c FROM email_outbox
        WHERE to_addr = ? AND created_at_ts > ? AND template_key IN (${customerKeys.map(() => '?').join(', ')})
      `).get(to, now - 60 * 60 * 1000, ...customerKeys) as { c: number };
      if (c >= CUSTOMER_EMAILS_PER_HOUR) {
        console.warn(`[mail] ${opts.template} to ${maskEmail(to)} not queued: hourly limit reached`);
        return null;
      }
    }

    if ((entry as { staffAlert?: boolean }).staffAlert) {
      const { c } = conn.prepare(`
        SELECT COUNT(*) AS c FROM email_outbox WHERE template_key = ? AND created_at_ts > ?
      `).get(opts.template, now - 60 * 60 * 1000) as { c: number };
      if (c >= STAFF_ALERTS_PER_HOUR) {
        console.warn(`[mail] ${opts.template} not queued: hourly limit for staff alerts reached`);
        return null;
      }
    }

    const rendered = renderTemplate(opts.template, opts.locale, opts.vars);
    const id = 'mail_' + crypto.randomBytes(12).toString('hex');
    conn.prepare(`
      INSERT INTO email_outbox (id, to_addr, subject, html, text, template_key, locale, status, attempts,
        related_type, related_id, created_at_ts, next_attempt_at_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 0, ?, ?, ?, ?)
    `).run(id, to, rendered.subject, rendered.html, rendered.text, opts.template, opts.locale,
      opts.related?.type ?? null, opts.related?.id ?? null, now, now);
    kickWorker();
    return id;
  } catch (err) {
    console.error(`[mail] could not queue ${opts.template}:`, err);
    return null;
  }
}

interface OutboxRow {
  id: string;
  to_addr: string;
  subject: string;
  html: string;
  text: string;
  template_key: string;
  status: string;
  attempts: number;
}

/** Short, single-line error text for the console; nothing that could hold a password. */
function errorText(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string } | null;
  const parts = [e?.code, e?.responseCode ? String(e.responseCode) : null, e?.message].filter(Boolean);
  return (parts.join(' ') || 'Unknown error').replace(/\s+/g, ' ').slice(0, 300);
}

function isSensitive(templateKey: string): boolean {
  return (TEMPLATES as Record<string, { sensitive: boolean }>)[templateKey]?.sensitive === true;
}

/** Sends one row now and records the result. Returns true when sent. */
export async function deliver(row: OutboxRow, conn: DatabaseSync = db, now: number = Date.now()): Promise<boolean> {
  const attempts = row.attempts + 1;
  // Claim the row first, so a second pass can't pick it up while this send is in flight.
  conn.prepare(`UPDATE email_outbox SET attempts = ?, status = 'SENDING' WHERE id = ?`).run(attempts, row.id);
  try {
    await sendMessage({ to: row.to_addr, subject: row.subject, html: row.html, text: row.text });
    // A reset link is a secret: once delivered, the stored copy is no longer needed.
    const blank = isSensitive(row.template_key);
    conn.prepare(`
      UPDATE email_outbox SET status = 'SENT', sent_at_ts = ?, last_error = NULL
        ${blank ? ", html = '', text = ''" : ''}
      WHERE id = ?
    `).run(Date.now(), row.id);
    return true;
  } catch (err) {
    const error = errorText(err);
    if (attempts >= MAX_ATTEMPTS) {
      const blank = isSensitive(row.template_key);
      conn.prepare(`
        UPDATE email_outbox SET status = 'FAILED', last_error = ? ${blank ? ", html = '', text = ''" : ''} WHERE id = ?
      `).run(error, row.id);
      console.error(`[mail] ${row.template_key} to ${maskEmail(row.to_addr)} failed after ${attempts} attempts: ${error}`);
    } else {
      conn.prepare(`UPDATE email_outbox SET status = 'QUEUED', last_error = ?, next_attempt_at_ts = ? WHERE id = ?`)
        .run(error, now + RETRY_DELAYS_MS[attempts - 1], row.id);
      console.warn(`[mail] ${row.template_key} to ${maskEmail(row.to_addr)} attempt ${attempts} failed: ${error}`);
    }
    return false;
  }
}

/**
 * Sends one queued row at once (Settings → Email "Send test email") and returns the result.
 * A failure is retried by the worker like any other message.
 */
export async function deliverNow(id: string, conn: DatabaseSync = db): Promise<{ sent: boolean; error: string | null }> {
  const row = conn.prepare(`
    SELECT id, to_addr, subject, html, text, template_key, status, attempts FROM email_outbox WHERE id = ? AND status = 'QUEUED'
  `).get(id) as OutboxRow | undefined;
  if (!row) {
    const done = conn.prepare('SELECT status, last_error FROM email_outbox WHERE id = ?').get(id) as { status: string; last_error: string | null } | undefined;
    return { sent: done?.status === 'SENT', error: done?.last_error ?? null };
  }
  const sent = await deliver(row, conn);
  const after = conn.prepare('SELECT last_error FROM email_outbox WHERE id = ?').get(id) as { last_error: string | null };
  return { sent, error: sent ? null : after.last_error };
}

let running = false;

/** Sends every due QUEUED row, oldest first. Returns how many were sent. */
export async function processOutbox(conn: DatabaseSync = db, now: number = Date.now()): Promise<number> {
  if (running) return 0;
  running = true;
  let sent = 0;
  try {
    if (!mailEnabled()) return 0;
    const rows = conn.prepare(`
      SELECT id, to_addr, subject, html, text, template_key, status, attempts FROM email_outbox
      WHERE status = 'QUEUED' AND next_attempt_at_ts <= ? ORDER BY created_at_ts LIMIT 20
    `).all(now) as unknown as OutboxRow[];
    for (const row of rows) {
      if (await deliver(row, conn, now)) sent++;
    }
  } catch (err) {
    console.error('[mail] outbox pass failed:', err);
  } finally {
    running = false;
  }
  return sent;
}

let timer: NodeJS.Timeout | null = null;
let kickPending = false;

/** Sends soon after something is queued instead of waiting up to 30 s (only while the worker runs). */
function kickWorker(): void {
  if (!timer || kickPending) return;
  kickPending = true;
  setTimeout(() => {
    kickPending = false;
    void processOutbox();
  }, 250).unref();
}

/**
 * Starts the 30 s worker (server start). Rows left in SENDING by a crash or restart go back to
 * QUEUED first, so they are tried again.
 */
export function startOutboxWorker(conn: DatabaseSync = db): void {
  if (timer) return;
  conn.prepare(`UPDATE email_outbox SET status = 'QUEUED' WHERE status = 'SENDING'`).run();
  timer = setInterval(() => { void processOutbox(conn); }, WORKER_INTERVAL_MS);
  timer.unref();
  if (mailEnabled()) {
    console.log('[mail] Email is on; outbox worker started.');
    void processOutbox(conn);
  } else {
    console.log('[mail] Email is off (SMTP_HOST not set): nothing is queued; password reset by email is hidden.');
  }
}

export function stopOutboxWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export interface OutboxSummary {
  queued: number;
  failed: number;
  sentLast24h: number;
  lastSentAt: number | null;
}

export function outboxSummary(conn: DatabaseSync = db, now: number = Date.now()): OutboxSummary {
  const count = (sql: string, ...args: (string | number)[]) => (conn.prepare(sql).get(...args) as { c: number }).c;
  const last = conn.prepare(`SELECT MAX(sent_at_ts) AS t FROM email_outbox WHERE status = 'SENT'`).get() as { t: number | null };
  return {
    queued: count(`SELECT COUNT(*) AS c FROM email_outbox WHERE status IN ('QUEUED', 'SENDING')`),
    failed: count(`SELECT COUNT(*) AS c FROM email_outbox WHERE status = 'FAILED'`),
    sentLast24h: count(`SELECT COUNT(*) AS c FROM email_outbox WHERE status = 'SENT' AND sent_at_ts > ?`, now - 24 * 60 * 60 * 1000),
    lastSentAt: last.t ?? null
  };
}

export interface OutboxListItem {
  id: string;
  to: string;
  subject: string;
  templateKey: string;
  locale: string;
  status: string;
  attempts: number;
  lastError: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: number;
  sentAt: number | null;
  nextAttemptAt: number | null;
}

/**
 * Rows for the console, newest first. Never includes the body (a reset email's body holds a
 * live link). `status` limits to one status.
 */
export function listOutbox(status: string | null, limit = 50, conn: DatabaseSync = db): OutboxListItem[] {
  const rows = conn.prepare(`
    SELECT id, to_addr, subject, template_key, locale, status, attempts, last_error, related_type, related_id,
      created_at_ts, sent_at_ts, next_attempt_at_ts
    FROM email_outbox ${status ? 'WHERE status = ?' : ''} ORDER BY created_at_ts DESC LIMIT ?
  `).all(...(status ? [status, limit] : [limit])) as any[];
  return rows.map((r) => ({
    id: r.id,
    to: r.to_addr,
    subject: r.subject,
    templateKey: r.template_key,
    locale: r.locale,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error,
    relatedType: r.related_type,
    relatedId: r.related_id,
    createdAt: r.created_at_ts,
    sentAt: r.sent_at_ts,
    nextAttemptAt: r.status === 'QUEUED' ? r.next_attempt_at_ts : null
  }));
}

/**
 * Puts a FAILED message back in the queue for 5 more attempts. A reset email whose body was
 * blanked can't be retried (the user asks for a new link instead). Returns false when the row
 * isn't FAILED or can't be retried.
 */
export function retryFailed(id: string, conn: DatabaseSync = db, now: number = Date.now()): boolean {
  const row = conn.prepare(`SELECT status, template_key, html FROM email_outbox WHERE id = ?`).get(id) as
    { status: string; template_key: string; html: string } | undefined;
  if (!row || row.status !== 'FAILED' || !row.html) return false;
  conn.prepare(`UPDATE email_outbox SET status = 'QUEUED', attempts = 0, next_attempt_at_ts = ? WHERE id = ?`).run(now, id);
  kickWorker();
  return true;
}

/**
 * Alert to the staff mailbox (MAIL_STAFF_ALERTS_TO, NOTIFICATIONS_SPEC §4), in English. Does
 * nothing when the variable is unset or not a single address.
 */
export function queueStaffAlert<K extends 'contact.staff_alert' | 'payment.proof_received'>(
  template: K,
  vars: TemplateVars[K],
  related?: { type: string; id: string }
): string | null {
  const to = (mailConfig()?.staffAlertsTo || '').trim();
  if (!to) return null;
  return queueEmail({ to, template, locale: 'en', vars, related });
}
