// shop.order_dispatched, English (CONTENT §17.7, owner to confirm #187): sent when the order goes
// to dispatch (M.7), with the job's tracking ID.
import { renderEmail, type RenderedEmail } from '../layout.js';
import type { ShopOrderDispatchedVars } from './shop.vars.js';

export default function render(v: ShopOrderDispatchedVars): RenderedEmail {
  return renderEmail('en', `Your order ${v.order} is on its way`, [
    [`Good news, ${v.name}: your order is on its way. Tracking ID: ${v.id}. Follow it here: `, { url: v.link }],
  ]);
}
