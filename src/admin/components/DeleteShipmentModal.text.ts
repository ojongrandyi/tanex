// DeleteShipmentModal copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/deleteShipmentModal.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const DELETE_SHIPMENT_MODAL_TEXT_EN = {
  cancelEsc: 'Cancel (Esc)',
  deleteConsignment: 'Delete Consignment?',
  areYouSureYouWant: 'Are you sure you want to permanently delete consignment',
  thisActionCannotBeUndone: '? This action cannot be undone and will purge all associated milestone logs.',
  cancel: 'Cancel',
  deleteConsignment2: 'Delete Consignment',
  waybill: 'WAYBILL',
  route: 'ROUTE',
  parties: 'PARTIES',
};

export const DELETE_SHIPMENT_MODAL_TEXT = consoleText('deleteShipmentModal', DELETE_SHIPMENT_MODAL_TEXT_EN);
