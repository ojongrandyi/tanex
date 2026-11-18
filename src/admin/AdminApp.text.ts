// AdminApp copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/adminApp.ts (same keys, checked by the build).
import { consoleText } from './i18n/consoleText';

export const ADMIN_APP_TEXT_EN = {
  dismiss: 'Dismiss',
  thisSection: 'This section',
  loading: 'Loading…',
  shipmentUpdated: (tracking: string, status: string) => `Shipment ${tracking} updated: ${status}`,
  updateFailed: (tracking: string, error: string) => `Failed to save the update for ${tracking}: ${error}. Reverted.`,
  serverRejected: 'server rejected the request',
  newProofFor: (tracking: string) => `New payment proof – ${tracking}`,
  newProofsCount: (n: number) => `${n} new payment proofs`,
};

export const ADMIN_APP_TEXT = consoleText('adminApp', ADMIN_APP_TEXT_EN);
