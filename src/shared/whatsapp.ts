// WhatsApp click-to-chat links (docs/NOTIFICATIONS_SPEC.md §2). Shared by client and server;
// DOM-free. Builds a wa.me link with a prefilled message from the templates in CONTENT §14 /
// CONTENT_FR §14. Opening the link does not send anything: the person still taps Send in
// WhatsApp, so callers say "Opened in WhatsApp", never "Sent".
import { COMPANY_SHORT } from '../config/brand.js';
import { normalizePhone } from './identifier.js';

export type WhatsAppLocale = 'en' | 'fr';

const B = COMPANY_SHORT;

/** Message templates (CONTENT §14 EN / CONTENT_FR §14). `{name}`-style placeholders. */
export const WHATSAPP_TEMPLATES = {
  'booking.confirmed': {
    en: `Hello {name}, your ${B} booking is confirmed. Tracking ID: {id}. Follow it here: {link}`,
    fr: `Bonjour {name}, votre réservation ${B} est confirmée. Numéro de suivi : {id}. Suivez-la ici : {link}`
  },
  'local.share_recipient': {
    en: `Hello {name}, {sender} is sending you a parcel with ${B}. Follow the delivery live: {link}`,
    fr: `Bonjour {name}, {sender} vous envoie un colis avec ${B}. Suivez la livraison en direct : {link}`
  },
  'local.assigned': {
    en: `Your ${B} rider {rider} is on the job for {id}. Track: {link}`,
    fr: `Votre livreur ${B} {rider} prend en charge {id}. Suivi : {link}`
  },
  'local.on_the_way': {
    en: 'Your parcel {id} is on the way with {rider}. Follow live: {link}',
    fr: 'Votre colis {id} est en route avec {rider}. Suivez en direct : {link}'
  },
  'local.delivered': {
    en: `Delivered: {id} was received by {masked} at {time}. Thank you for choosing ${B}.`,
    fr: `Livré : {id} a été reçu par {masked} à {time}. Merci d'avoir choisi ${B}.`
  },
  'local.failed': {
    en: "We couldn't deliver {id}: {reason}. Our team will contact you to arrange a new time.",
    fr: "Nous n'avons pas pu livrer {id} : {reason}. Notre équipe vous contactera pour convenir d'un nouveau créneau."
  },
  'auth.temp_password': {
    en: `Your ${B} console account is ready. Sign in at {url} with {identifier} and this temporary password: {password}. You'll choose your own when you sign in.`,
    fr: `Votre compte ${B} est prêt. Connectez-vous sur {url} avec {identifier} et ce mot de passe temporaire : {password}. Vous choisirez le vôtre à la connexion.`
  }
} as const satisfies Record<string, Record<WhatsAppLocale, string>>;

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATES;
export type TemplateVars = Readonly<Record<string, string | number>>;

/** Signature line under every message (CONTENT §14: "signed — TanEx"). */
export const WHATSAPP_SIGNATURE = `— ${B}`;

/**
 * The message text: template with `{var}` filled in, then the signature on its own line. A
 * placeholder without a value becomes empty rather than showing `{var}` to the customer.
 */
export function renderWhatsAppMessage(templateKey: WhatsAppTemplateKey, vars: TemplateVars, locale: WhatsAppLocale = 'en'): string {
  const template = WHATSAPP_TEMPLATES[templateKey][locale === 'fr' ? 'fr' : 'en'];
  const body = template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
  return `${body}\n${WHATSAPP_SIGNATURE}`;
}

/**
 * The digits wa.me expects (E.164 without '+'), or null when the number isn't valid. Numbers
 * without a country code are read as Cameroonian (6XXXXXXXX → 2376XXXXXXXX).
 */
export function whatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = normalizePhone(phone);
  return e164 ? e164.replace(/^\+/, '') : null;
}

/**
 * `https://wa.me/<digits>?text=<message>`, or null when the phone number is invalid (the
 * caller disables its button and shows a hint).
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  templateKey: WhatsAppTemplateKey,
  vars: TemplateVars,
  locale: WhatsAppLocale = 'en'
): string | null {
  const digits = whatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(renderWhatsAppMessage(templateKey, vars, locale))}`;
}
