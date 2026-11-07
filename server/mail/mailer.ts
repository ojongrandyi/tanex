// Email sending over SMTP (docs/NOTIFICATIONS_SPEC.md §3). Off when SMTP_HOST is unset: nothing
// is queued and features that need email (self-service password reset) stay hidden. Settings
// are read from the environment on each call, so a restart after editing .env picks them up and
// tests can switch the mailer on and off.
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  from: string;
  replyTo: string | null;
  staffAlertsTo: string | null;
}

/** The mail settings without the password (safe to show in the console). Null when mail is off. */
export function mailConfig(): MailConfig | null {
  const host = (process.env.SMTP_HOST || '').trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv ? secureEnv === 'true' || secureEnv === '1' : port === 465;
  const user = (process.env.SMTP_USER || '').trim() || null;
  const from = (process.env.MAIL_FROM || '').trim() || user || '';
  return {
    host,
    port,
    secure,
    user,
    from,
    replyTo: (process.env.MAIL_REPLY_TO || '').trim() || null,
    staffAlertsTo: (process.env.MAIL_STAFF_ALERTS_TO || '').trim() || null
  };
}

/** True when SMTP is configured (SMTP_HOST and a sender address). */
export function mailEnabled(): boolean {
  const cfg = mailConfig();
  return !!cfg && !!cfg.from;
}

export interface OutgoingMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type SendFn = (msg: OutgoingMessage) => Promise<void>;

let transport: Transporter | null = null;
let transportKey = '';
let testSender: SendFn | null = null;

/** Tests replace the SMTP connection with their own function (null restores SMTP). */
export function setSenderForTests(fn: SendFn | null): void {
  testSender = fn;
}

function getTransport(cfg: MailConfig): Transporter {
  const pass = process.env.SMTP_PASS || '';
  // Rebuilt only when the settings change; the key never leaves this module.
  const key = JSON.stringify([cfg.host, cfg.port, cfg.secure, cfg.user, pass]);
  if (!transport || key !== transportKey) {
    transport?.close();
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass } : undefined,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
      // No protocol logging: it would print the AUTH exchange.
      logger: false,
      debug: false
    });
    transportKey = key;
  }
  return transport;
}

/** Sends one message now. Throws on failure; the error message never includes the password. */
export async function sendMessage(msg: OutgoingMessage): Promise<void> {
  if (testSender) return testSender(msg);
  const cfg = mailConfig();
  if (!cfg || !cfg.from) throw new Error('Email is not configured (SMTP_HOST / MAIL_FROM).');
  await getTransport(cfg).sendMail({
    from: cfg.from,
    to: msg.to,
    replyTo: cfg.replyTo || undefined,
    subject: msg.subject,
    html: msg.html,
    text: msg.text
  });
}

/** "j***@example.com": enough to recognise an address in logs without printing it. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}
