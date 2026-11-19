// shop.order_received, French (CONTENT_FR §17.7, à confirmer #187, relecture native #108).
import { renderEmail, type Block, type RenderedEmail } from '../layout.js';
import type { ShopOrderReceivedVars, ShopPaymentKey } from './shop.vars.js';

const METHODS: Record<ShopPaymentKey, { label: string; help: string }> = {
  CASH_ON_DELIVERY: { label: 'Paiement à la livraison', help: 'Payez le livreur à la réception de votre commande.' },
  MTN_MOMO: { label: 'MTN MoMo', help: '' },
  ORANGE_MONEY: { label: 'Orange Money', help: '' },
  PAY_AT_OFFICE: { label: 'Paiement en agence', help: 'Payez au retrait de votre commande.' },
};

export default function render(v: ShopOrderReceivedVars): RenderedEmail {
  const m = METHODS[v.payment];
  const fee = v.feeStatus === 'NONE' ? 'Gratuite (retrait)' : v.fee ?? 'Nous vous confirmerons les frais de livraison';
  const pay: Block = v.payNumber
    ? [`Payez par ${m.label} au ${v.payNumber} après notre confirmation, avec ${v.order} comme référence. Nous ne vous demanderons jamais votre code PIN.`]
    : [`${m.label} : ${m.help}`];

  return renderEmail('fr', `Nous avons bien reçu votre commande ${v.order}`, [
    [`Merci, ${v.name}. Nous avons bien reçu votre commande et vous appellerons au ${v.phone} pour la confirmer.`],
    [`Numéro de commande : ${v.order}`],
    { heading: 'Votre commande' },
    { items: v.items },
    {
      rows: [
        { label: 'Sous-total', value: v.subtotal },
        { label: 'Livraison', value: fee },
        { label: v.feeStatus === 'TO_CONFIRM' ? 'Total (frais de livraison à confirmer)' : 'Total', value: v.total, strong: true },
      ],
    },
    { heading: 'Comment allez-vous payer ?' },
    pay,
    ['Retours et remboursements : ', { url: v.returnsUrl }],
  ]);
}
