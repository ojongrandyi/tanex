// ProofFacts copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/proofFacts.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const PROOF_FACTS_TEXT_EN = {
  amountDue: 'Amount due',
  amountSent: 'Amount sent',
  differsFromTheAmountDue: 'Differs from the amount due',
  paidTo: 'Paid to',
  payer: 'Payer',
  reference: 'Reference',
  for: 'For',
};

export const PROOF_FACTS_TEXT = consoleText('proofFacts', PROOF_FACTS_TEXT_EN);
