// PaymentsView copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/paymentsView.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const PAYMENTS_VIEW_TEXT_EN = {
  couldNotLoadPaymentProofs: 'Could not load payment proofs.',
  filterPaymentProofs: 'Filter payment proofs',
  refresh: 'Refresh',
  request: 'Request:',
  received: 'Received',
  rejected: 'Rejected:',
  viewScreenshot: 'View screenshot',
  viewShipment: 'View shipment',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected2: 'Rejected',
  all: 'All',
  noPaymentProofsYet: 'No payment proofs yet',
  noProofsMatch: 'No proofs match',
  proofsCustomersSendFromThe: 'Proofs customers send from the track page will appear here.',
  tryAnotherFilterOrClear: 'Try another filter or clear the search.',
  openTheScreenshotSentFor: (p0: unknown) => `Open the screenshot sent for ${p0}`,
  paymentScreenshot: (p0: unknown) => `Payment screenshot · ${p0}`,
};

export const PAYMENTS_VIEW_TEXT = consoleText('paymentsView', PAYMENTS_VIEW_TEXT_EN);
