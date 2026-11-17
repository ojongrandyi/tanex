// local.delivered, French (CONTENT_FR §14; objet ajouté avec G.8, à confirmer).
import { COMPANY_SHORT } from '../../../src/config/brand.js';
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { id: string; masked: string; time: string; link: string }): RenderedEmail {
  return renderEmail('fr', `Livré : ${vars.id}`, [
    [`Livré : ${vars.id} a été reçu par ${vars.masked} à ${vars.time}. Merci d'avoir choisi ${COMPANY_SHORT}.`],
    ['Détails : ', { url: vars.link }],
  ]);
}
