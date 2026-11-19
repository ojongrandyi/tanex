// shop.order_staff_alert, English only (CONTENT §17.7, owner to confirm #187): a new shop order,
// to the order email in Shop settings (info@ by default). Every line carries its product ID.
// Reply-To is the customer's email when they gave one (set by the caller).
import { renderEmail, type Block, type RenderedEmail } from '../layout.js';
import type { ShopStaffAlertVars } from './shop.vars.js';

export default function render(v: ShopStaffAlertVars): RenderedEmail {
  const pieces = v.count === 1 ? '1 item' : `${v.count} items`;
  const customer: Block = {
    rows: [
      { label: 'Name', value: v.customer.name },
      { label: 'Phone', value: v.customer.phone },
      { label: 'WhatsApp', value: v.customer.whatsapp },
      ...(v.customer.email ? [{ label: 'Email', value: v.customer.email }] : []),
    ],
  };
  const where: Block[] = v.delivery.method === 'DELIVERY'
    ? [{ heading: 'Delivery' }, {
      rows: [
        { label: 'City', value: v.delivery.city },
        ...(v.delivery.area ? [{ label: 'Area', value: v.delivery.area }] : []),
        { label: 'Address or landmark', value: v.delivery.address },
      ],
    }]
    : [{ heading: `Pickup at ${v.delivery.office}` }];
  const fee = v.feeStatus === 'NONE' ? 'Free (pickup)' : v.fee ?? 'to confirm';

  return renderEmail('en', `New order ${v.order} · ${pieces} · ${v.total}`, [
    { heading: 'Customer' },
    customer,
    ...(v.customer.whatsappUrl ? [['Chat on WhatsApp: ', { url: v.customer.whatsappUrl }]] as Block[] : []),
    ...where,
    { heading: 'Items' },
    { items: v.items },
    {
      rows: [
        { label: 'Subtotal', value: v.subtotal },
        { label: 'Delivery fee', value: fee },
        { label: v.feeStatus === 'TO_CONFIRM' ? 'Total (delivery fee to confirm)' : 'Total', value: v.total, strong: true },
        { label: 'Payment method', value: v.payment },
      ],
    },
    ...(v.note ? [{ heading: 'Customer note' }, [v.note]] as Block[] : []),
    { button: { label: 'Open the order in the console', url: v.url } },
  ]);
}
