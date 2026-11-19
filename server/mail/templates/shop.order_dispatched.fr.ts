// shop.order_dispatched, French (CONTENT_FR §17.7, à confirmer #187).
import { renderEmail, type RenderedEmail } from '../layout.js';
import type { ShopOrderDispatchedVars } from './shop.vars.js';

export default function render(v: ShopOrderDispatchedVars): RenderedEmail {
  return renderEmail('fr', `Votre commande ${v.order} est en route`, [
    [`Bonne nouvelle, ${v.name} : votre commande est en route. Numéro de suivi : ${v.id}. Suivez-la ici : `, { url: v.link }],
  ]);
}
