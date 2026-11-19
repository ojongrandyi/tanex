// shop.order_cancelled, French (CONTENT_FR §17.7, à confirmer #187).
import { renderEmail, type RenderedEmail } from '../layout.js';
import type { ShopOrderCancelledVars } from './shop.vars.js';

export default function render(v: ShopOrderCancelledVars): RenderedEmail {
  return renderEmail('fr', `Votre commande ${v.order} a été annulée`, [
    [`Votre commande ${v.order} a été annulée. Motif : ${v.reason}.`],
    ['Si vous avez déjà payé, nous vous rembourserons comme le prévoit notre politique de Retours et remboursements.'],
    [`Des questions ? ${v.email} · ${v.phone}`],
  ]);
}
