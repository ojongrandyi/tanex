// NewProofsPanel copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/newProofsPanel.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const NEW_PROOFS_PANEL_TEXT_EN = {
  couldNotLoadPaymentProofs: 'Could not load payment proofs.',
  newPaymentProofs: 'New payment proofs',
  toReview: 'to review',
  refreshPaymentProofs: 'Refresh payment proofs',
  allPayments: 'All Payments →',
  nothingToReview: 'Nothing to review',
  proofsOfPaymentCustomersSend: 'Proofs of payment customers send from the track page will appear here.',
  due: 'Due',
  sent: 'Sent',
  differs: 'differs',
  accountNotRecorded: 'Account not recorded',
  ref: 'Ref:',
  viewAll: 'View all',
  proofsWaitingInPayments: 'proofs waiting in Payments →',
  approvedThePaymentIsMarked: 'Approved. The payment is marked as paid.',
  rejected: 'Rejected:',
  reviewThePaymentProofFor: (p0: unknown) => `Review the payment proof for ${p0}`,
  paymentScreenshot: (p0: unknown) => `Payment screenshot · ${p0}`,
};

export const NEW_PROOFS_PANEL_TEXT = consoleText('newProofsPanel', NEW_PROOFS_PANEL_TEXT_EN);
