// contact.staff_alert, French (CONTENT_FR §14, à confirmer).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; ref: string; subject: string; url: string }): RenderedEmail {
  return renderEmail('fr', `Nouveau message de ${vars.name} (${vars.ref})`, [
    [`${vars.name} a envoyé un message depuis le site (sujet : ${vars.subject}). Lisez-le et répondez dans la console : `, { url: vars.url }]
  ]);
}
