// payment.proof_received, French (CONTENT_FR §14, à confirmer).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { id: string; url: string }): RenderedEmail {
  return renderEmail('fr', `Preuve de paiement reçue pour ${vars.id}`, [
    [`Un client a envoyé une preuve de paiement pour ${vars.id}. Vérifiez-la dans la console, rubrique Paiements : `, { url: vars.url }]
  ]);
}
