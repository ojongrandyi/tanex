// French for the payment registry's own English text (src/shared/paymentMethods.ts and the proof
// checks in src/shared/paymentProof.ts): method names, field labels, notes, link buttons, network
// warnings and validation messages. The registry stays English because the server and the console
// use it; customer pages translate its text here (CONTENT §6.7, §6.8, §6.10 / CONTENT_FR §6.7–§6.10).
// scripts/i18n.test.ts checks that every registry string has an entry. Brand and product names
// (PayPal, Zelle, IBAN…) are not translated.
import type { Locale } from './types';

const FR: Record<string, string> = {
  // Method names
  'MTN Mobile Money': 'MTN Mobile Money',
  'Orange Money': 'Orange Money',
  'Cash on delivery': 'Paiement à la livraison',
  'PayPal': 'PayPal',
  'Bitcoin (BTC)': 'Bitcoin (BTC)',
  'USDT (Tether)': 'USDT (Tether)',
  'Ethereum (ETH)': 'Ethereum (ETH)',
  'Zelle': 'Zelle',
  'Cash App': 'Cash App',
  'Venmo': 'Venmo',
  'Apple Pay / Apple Cash': 'Apple Pay / Apple Cash',
  'Google Pay': 'Google Pay',
  'US bank transfer (ACH / wire)': 'Virement bancaire américain (ACH / wire)',
  'UK bank transfer (Faster Payments)': 'Virement bancaire britannique (Faster Payments)',
  'International wire (SWIFT / IBAN)': 'Virement international (SWIFT / IBAN)',
  'Wise': 'Wise',
  'Revolut': 'Revolut',
  'Card payment link': 'Lien de paiement par carte',
  'Western Union': 'Western Union',
  'MoneyGram': 'MoneyGram',
  // Field labels
  'Account name': 'Nom du compte',
  'MoMo number': 'Numéro MoMo',
  'Orange Money number': 'Numéro Orange Money',
  'Merchant code': 'Code marchand',
  'PayPal email': 'E-mail PayPal',
  'PayPal.Me link': 'Lien PayPal.Me',
  'Network': 'Réseau',
  'Wallet address': 'Adresse du portefeuille',
  'Zelle email': 'E-mail Zelle',
  'Zelle phone (US)': 'Téléphone Zelle (États-Unis)',
  'Recipient name': 'Nom du bénéficiaire',
  '$Cashtag': '$Cashtag',
  'Name': 'Nom',
  'Venmo username': "Nom d'utilisateur Venmo",
  'Phone': 'Téléphone',
  'Email': 'E-mail',
  'Bank': 'Banque',
  'Routing number': 'Numéro de routage',
  'Account number': 'Numéro de compte',
  'Account type': 'Type de compte',
  'Bank address': 'Adresse de la banque',
  'Sort code': 'Sort code',
  'Beneficiary': 'Bénéficiaire',
  'IBAN': 'IBAN',
  'SWIFT/BIC': 'SWIFT/BIC',
  'Bank country': 'Pays de la banque',
  'Wise email': 'E-mail Wise',
  'Wisetag': 'Wisetag',
  'Revtag': 'Revtag',
  'Checkout link': 'Lien de paiement',
  'Provider (e.g. Stripe, Square)': 'Prestataire (ex. Stripe, Square)',
  'Receiver full name': 'Nom complet du bénéficiaire',
  'Country': 'Pays',
  'City': 'Ville',
  // Link buttons
  'Open PayPal': 'Ouvrir PayPal',
  'Open Cash App': 'Ouvrir Cash App',
  'Open Venmo': 'Ouvrir Venmo',
  'Pay by card': 'Payer par carte',
  // Notes
  'Enter the transaction ID from your confirmation SMS.': "Saisissez l'ID de transaction de votre SMS de confirmation.",
  'Pay the rider in cash when your parcel arrives. Ask for your receipt reference.': "Payez le livreur en espèces à l'arrivée de votre colis. Demandez la référence de votre reçu.",
  'After sending, enter the MTCN (money transfer control number) as your payment reference.': "Après l'envoi, saisissez le MTCN (numéro de contrôle du transfert) comme référence de paiement.",
  'After sending, enter the MoneyGram reference number as your payment reference.': "Après l'envoi, saisissez le numéro de référence MoneyGram comme référence de paiement.",
  // Proof checks (src/shared/paymentProof.ts)
  'Choose the account you paid to.': 'Choisissez le compte sur lequel vous avez payé.',
  'Enter the name the payment was sent from.': "Saisissez le nom de l'expéditeur du paiement.",
  'Enter the amount you sent.': 'Saisissez le montant envoyé.',
};

/** The registry's English text in the page language (unknown text is returned unchanged). */
export function paymentTerm(text: string, locale: Locale): string {
  if (locale !== 'fr' || !text) return text;
  if (FR[text] !== undefined) return FR[text];
  // Variable messages
  const crypto = /^Send only (.+) on the (.+) network\. Funds sent on another network can be lost\.$/.exec(text);
  if (crypto) return `Envoyez uniquement des ${crypto[1]} sur le réseau ${crypto[2]}. Les fonds envoyés sur un autre réseau peuvent être perdus.`;
  const refLen = /^Keep the reference under (\d+) characters\.$/.exec(text);
  if (refLen) return `La référence doit faire moins de ${refLen[1]} caractères.`;
  return text;
}

/** Every English string with a French entry (tests). */
export const PAYMENT_TERMS_FR = FR;
