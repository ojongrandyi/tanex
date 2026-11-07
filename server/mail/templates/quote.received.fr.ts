// quote.received, French (CONTENT_FR §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; ref: string; url: string }): RenderedEmail {
  return renderEmail('fr', `Nous avons bien reçu votre demande de devis ${vars.ref}`, [
    [`Merci, ${vars.name}. Notre équipe étudie votre demande et vous enverra un prix. Consultez-la à tout moment : `, { url: vars.url }]
  ]);
}
