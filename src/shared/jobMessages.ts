// WhatsApp click-to-chat messages for a delivery job (DISPATCH_SPEC §10, NOTIFICATIONS_SPEC §2, §4):
// which message fits the job's current step, to whom, in the job's notify_locale. Shared by the
// dispatch board, the courier app and the server (which checks a logged tap against this list).
// DOM-free. Opening a link sends nothing: the person still taps Send in WhatsApp.
import type { DispatchStatus } from './dispatchStatus.js';
import { failureReasonLabel } from './dispatchStatus.js';
import { maskName } from './masking.js';
import { buildWhatsAppLink, type WhatsAppLocale, type WhatsAppTemplateKey } from './whatsapp.js';

/** Templates offered for a job. */
export const JOB_MESSAGE_TEMPLATES = [
  'booking.confirmed', 'local.share_recipient', 'local.assigned', 'local.on_the_way', 'local.delivered', 'local.failed',
] as const satisfies readonly WhatsAppTemplateKey[];
export type JobMessageTemplate = typeof JOB_MESSAGE_TEMPLATES[number];
export type JobMessageTo = 'sender' | 'recipient';
export type JobMessageView = 'dispatch' | 'courier';

export function isJobMessageTemplate(value: unknown): value is JobMessageTemplate {
  return typeof value === 'string' && (JOB_MESSAGE_TEMPLATES as readonly string[]).includes(value);
}

/**
 * The right moments (DISPATCH_SPEC §10). Dispatch: booking confirmation (+ the recipient's share
 * link) once confirmed, courier assigned, on the way, delivered, failed attempt. The courier app
 * only gets the messages of the steps the courier records: on the way, delivered, failed.
 */
export function jobMessagePlan(status: DispatchStatus, view: JobMessageView): { template: JobMessageTemplate; to: JobMessageTo }[] {
  switch (status) {
    case 'CONFIRMED':
      return view === 'dispatch' ? [{ template: 'booking.confirmed', to: 'sender' }, { template: 'local.share_recipient', to: 'recipient' }] : [];
    case 'ASSIGNED':
    case 'ACCEPTED':
      return view === 'dispatch' ? [{ template: 'local.assigned', to: 'recipient' }, { template: 'local.assigned', to: 'sender' }] : [];
    case 'PICKED_UP':
    case 'ON_THE_WAY':
      return [{ template: 'local.on_the_way', to: 'recipient' }];
    case 'DELIVERED':
      return [{ template: 'local.delivered', to: 'sender' }];
    case 'FAILED_ATTEMPT':
      return [{ template: 'local.failed', to: 'sender' }];
    default:
      return [];
  }
}

export function isPlannedMessage(status: DispatchStatus, view: JobMessageView, template: string, to: string): boolean {
  return jobMessagePlan(status, view).some((m) => m.template === template && m.to === to);
}

export interface JobMessageInput {
  status: DispatchStatus;
  trackingNumber: string;
  locale: WhatsAppLocale;
  /** Public tracking page in the job's language. */
  trackLink: string;
  senderName: string | null;
  senderPhone: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  riderFirstName: string | null;
  podRecipientName: string | null;
  deliveredAt: number | null;
  failureReason: string | null;
  timeZone?: string;
}

export interface JobMessage {
  template: JobMessageTemplate;
  to: JobMessageTo;
  /** Null when the phone number isn't valid (the button is disabled with a hint). */
  link: string | null;
}

/** "14:05" in the city's time zone (24-hour in both languages). */
export function messageTime(ts: number | null, locale: WhatsAppLocale, timeZone = 'Africa/Douala'): string {
  if (!ts) return '';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(ts));
}

const firstName = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

export function buildJobMessages(input: JobMessageInput, view: JobMessageView): JobMessage[] {
  const vars = (to: JobMessageTo): Record<string, string> => ({
    // Greetings use the first name only; the other person's details never go in a message.
    name: firstName(to === 'sender' ? input.senderName : input.recipientName),
    sender: firstName(input.senderName),
    id: input.trackingNumber,
    link: input.trackLink,
    rider: input.riderFirstName ?? '',
    masked: input.podRecipientName ? maskName(input.podRecipientName) : '',
    time: messageTime(input.deliveredAt, input.locale, input.timeZone),
    reason: input.failureReason ? failureReasonLabel(input.failureReason, input.locale).toLowerCase() : '',
  });
  return jobMessagePlan(input.status, view).map(({ template, to }) => ({
    template,
    to,
    link: buildWhatsAppLink(to === 'sender' ? input.senderPhone : input.recipientPhone, template, vars(to), input.locale),
  }));
}
