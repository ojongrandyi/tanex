// shop.order_received, English (CONTENT §17.7, owner to confirm #187): to the customer when they
// gave an email. Items with product IDs and pictures, totals, payment text as the order-placed
// page (CONTENT §17.6; no account name yet, #189), Returns & Refunds link.
import { renderEmail, type Block, type RenderedEmail } from '../layout.js';
import type { ShopOrderReceivedVars, ShopPaymentKey } from './shop.vars.js';

const METHODS: Record<ShopPaymentKey, { label: string; help: string }> = {
  CASH_ON_DELIVERY: { label: 'Cash on delivery', help: 'Pay the rider when your order arrives.' },
  MTN_MOMO: { label: 'MTN MoMo', help: '' },
  ORANGE_MONEY: { label: 'Orange Money', help: '' },
  PAY_AT_OFFICE: { label: 'Pay at the office', help: 'Pay when you collect your order.' },
};

export default function render(v: ShopOrderReceivedVars): RenderedEmail {
  const m = METHODS[v.payment];
  const fee = v.feeStatus === 'NONE' ? 'Free (pickup)' : v.fee ?? "We'll confirm the delivery fee";
  const pay: Block = v.payNumber
    ? [`Pay by ${m.label} to ${v.payNumber} after we confirm your order, with ${v.order} as the reference. We will never ask for your PIN.`]
    : [`${m.label}: ${m.help}`];

  return renderEmail('en', `We've received your order ${v.order}`, [
    [`Thank you, ${v.name}. We've received your order and will call you on ${v.phone} to confirm it.`],
    [`Order number: ${v.order}`],
    { heading: 'Your order' },
    { items: v.items },
    {
      rows: [
        { label: 'Subtotal', value: v.subtotal },
        { label: 'Delivery', value: fee },
        { label: v.feeStatus === 'TO_CONFIRM' ? 'Total (delivery fee to confirm)' : 'Total', value: v.total, strong: true },
      ],
    },
    { heading: 'How will you pay?' },
    pay,
    ['Returns & Refunds: ', { url: v.returnsUrl }],
  ]);
}
