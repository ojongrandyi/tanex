// ProofReviewControls copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/proofReviewControls.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const PROOF_REVIEW_CONTROLS_TEXT_EN = {
  approveThisProofAndMark: (p0: unknown) => `Approve this proof and mark the payment for ${p0} as paid?`,
  couldNotApproveTheProof: 'Could not approve the proof.',
  tellTheCustomerWhyThe: 'Tell the customer why the proof was not accepted. They will see this.',
  couldNotRejectTheProof: 'Could not reject the proof.',
  addAPaymentConfirmedEvent: 'Add a “Payment confirmed” event to the public tracking timeline',
  approve: 'Approve',
  reject: 'Reject',
  reasonTheCustomerWillSee: 'Reason (the customer will see this)',
  eGTheAmountOn: 'e.g. The amount on the screenshot does not match the amount due.',
  rejectProof: 'Reject proof',
  cancel: 'Cancel',
};

export const PROOF_REVIEW_CONTROLS_TEXT = consoleText('proofReviewControls', PROOF_REVIEW_CONTROLS_TEXT_EN);
