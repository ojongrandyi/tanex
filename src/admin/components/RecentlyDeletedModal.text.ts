// RecentlyDeletedModal copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/recentlyDeletedModal.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const RECENTLY_DELETED_MODAL_TEXT_EN = {
  serverRejected: 'server rejected the request',
  restoredBackInYourShipments: (p0: unknown) => `${p0} restored — back in your Shipments Ledger.`,
  failedToRestore: (p0: unknown, p1: unknown) => `Failed to restore ${p0}: ${p1}`,
  permanentlyDeleted: (p0: unknown) => `${p0} permanently deleted.`,
  failedToPermanentlyDelete: (p0: unknown, p1: unknown) => `Failed to permanently delete ${p0}: ${p1}`,
  recentlyDeleted: 'Recently Deleted',
  deletedShipmentsAreKeptHere: 'Deleted shipments are kept here and can be restored at any time — nothing is permanently removed unless you choose to.',
  closeEsc: 'Close (Esc)',
  loading: 'Loading…',
  nothingInTheTrash: 'Nothing in the trash',
  deletedShipmentsWillShowUp: 'Deleted shipments will show up here.',
  permanentlyDeleteThisCannotBe: 'Permanently delete? This cannot be undone.',
  cancel: 'Cancel',
  permanentlyDelete: 'Permanently delete',
  deleting: 'Deleting…',
  yesDeleteForever: 'Yes, delete forever',
  restoring: 'Restoring…',
  restore: 'Restore',
};

export const RECENTLY_DELETED_MODAL_TEXT = consoleText('recentlyDeletedModal', RECENTLY_DELETED_MODAL_TEXT_EN);
