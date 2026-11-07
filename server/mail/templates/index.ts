// Email templates by key and language (docs/NOTIFICATIONS_SPEC.md §4; copy in CONTENT §14 and
// CONTENT_FR §14). Each file returns { subject, html, text }.
import type { MailLocale, RenderedEmail } from '../layout.js';
import authResetEn from './auth.reset.en.js';
import authResetFr from './auth.reset.fr.js';
import quoteReceivedEn from './quote.received.en.js';
import quoteReceivedFr from './quote.received.fr.js';
import contactReceivedEn from './contact.received.en.js';
import contactReceivedFr from './contact.received.fr.js';
import mailTestEn from './mail.test.en.js';
import mailTestFr from './mail.test.fr.js';
import contactStaffAlertEn from './contact.staff_alert.en.js';
import contactStaffAlertFr from './contact.staff_alert.fr.js';
import proofReceivedEn from './payment.proof_received.en.js';
import proofReceivedFr from './payment.proof_received.fr.js';

export interface TemplateVars {
  'auth.reset': { url: string };
  'quote.received': { name: string; ref: string; url: string };
  'contact.received': { name: string; ref: string };
  'mail.test': Record<string, never>;
  'contact.staff_alert': { name: string; ref: string; subject: string; url: string };
  'payment.proof_received': { id: string; url: string };
}

export type TemplateKey = keyof TemplateVars;

interface TemplateEntry<K extends TemplateKey> {
  render: Record<MailLocale, (vars: TemplateVars[K]) => RenderedEmail>;
  /**
   * The body holds a secret (a reset link). Its stored copy is blanked once the message is sent
   * or given up on, and the console never shows a body.
   */
  sensitive: boolean;
  /** Sent to a customer address typed on a public form (per-address hourly cap applies). */
  customer: boolean;
  /** Alert to the staff mailbox caused by a public form (hourly cap per template). */
  staffAlert?: boolean;
}

export const TEMPLATES: { [K in TemplateKey]: TemplateEntry<K> } = {
  'auth.reset': { render: { en: authResetEn, fr: authResetFr }, sensitive: true, customer: false },
  'quote.received': { render: { en: quoteReceivedEn, fr: quoteReceivedFr }, sensitive: false, customer: true },
  'contact.received': { render: { en: contactReceivedEn, fr: contactReceivedFr }, sensitive: false, customer: true },
  'mail.test': { render: { en: mailTestEn, fr: mailTestFr }, sensitive: false, customer: false },
  'contact.staff_alert': { render: { en: contactStaffAlertEn, fr: contactStaffAlertFr }, sensitive: false, customer: false, staffAlert: true },
  'payment.proof_received': { render: { en: proofReceivedEn, fr: proofReceivedFr }, sensitive: false, customer: false, staffAlert: true }
};

export function renderTemplate<K extends TemplateKey>(key: K, locale: MailLocale, vars: TemplateVars[K]): RenderedEmail {
  return TEMPLATES[key].render[locale](vars);
}
