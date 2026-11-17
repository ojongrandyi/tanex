// payment.confirmed, French (CONTENT_FR §14).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { id: string; reason: string }): RenderedEmail {
  return renderEmail('fr', `Paiement reçu pour ${vars.id}`, [
    [`Merci. Nous avons confirmé votre paiement pour ${vars.reason}.`],
  ]);
}
