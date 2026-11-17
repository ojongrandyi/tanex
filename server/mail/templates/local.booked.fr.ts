// local.booked, French (CONTENT_FR §14; added with G.6, owner to confirm).
import { renderEmail, type RenderedEmail } from '../layout.js';

export default function render(vars: { name: string; id: string; link: string }): RenderedEmail {
  return renderEmail('fr', `Nous avons bien reçu votre réservation de livraison ${vars.id}`, [
    [`Merci, ${vars.name}. Votre numéro de suivi est ${vars.id}. Suivez votre livraison ici : `, { url: vars.link }],
  ]);
}
