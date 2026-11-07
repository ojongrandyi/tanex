// contact.received, French (CONTENT_FR §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; ref: string }): RenderedEmail {
  return renderEmail('fr', `Nous avons bien reçu votre message (${vars.ref})`, [
    [`Merci, ${vars.name}. Nous vous répondrons dès que possible.`]
  ]);
}
