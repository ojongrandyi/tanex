// shop.order_cancelled, English (CONTENT §17.7, owner to confirm #187): sent when staff cancel the
// order (M.7); the reason is the one staff gave.
import { renderEmail, type RenderedEmail } from '../layout.js';
import type { ShopOrderCancelledVars } from './shop.vars.js';

export default function render(v: ShopOrderCancelledVars): RenderedEmail {
  return renderEmail('en', `Your order ${v.order} has been cancelled`, [
    [`Your order ${v.order} has been cancelled. Reason: ${v.reason}.`],
    ['If you have already paid, we will refund you as our Returns & Refunds policy explains.'],
    [`Questions? ${v.email} · ${v.phone}`],
  ]);
}
