// booking.confirmed, French (CONTENT_FR §14; objet ajouté avec G.8, à confirmer).
import { COMPANY_SHORT } from '../../../src/config/brand.js';
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; id: string; link: string }): RenderedEmail {
  return renderEmail('fr', `Votre réservation ${COMPANY_SHORT} ${vars.id} est confirmée`, [
    [`Bonjour ${vars.name}, votre réservation ${COMPANY_SHORT} est confirmée. Numéro de suivi : ${vars.id}. Suivez-la ici : `, { url: vars.link }],
  ]);
}
