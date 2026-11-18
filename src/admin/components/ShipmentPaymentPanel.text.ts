// ShipmentPaymentPanel copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/shipmentPaymentPanel.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const SHIPMENT_PAYMENT_PANEL_TEXT_EN = {
  confirmStatus: {
    mark_paid: 'Mark this payment as received (for example cash at the counter)? The customer will see it as paid.',
    cancel: 'Cancel this payment request? The customer will no longer be asked to pay.',
    reopen: 'Reopen this payment request? The customer will be asked to pay again.',
  },
  couldNotLoadThePayment: 'Could not load the payment request.',
  deleteThisPaymentRequestAnd: 'Delete this payment request and its accounts? The customer will no longer see it.',
  paymentRequest: 'Payment request',
  shownToTheCustomerOn: 'Shown to the customer on the track page. Saved on its own, separately from Save Changes.',
  loading: 'Loading…',
  tryAgain: 'Try again',
  cancel: 'Cancel',
  due: 'Due',
  paid: 'Paid',
  cancelRequest: 'Cancel request',
  markPaid: 'Mark paid',
  reopen: 'Reopen',
  delete: 'Delete',
  edit: 'Edit',
  noPaymentRequestForThis: 'No payment request for this shipment.',
  addPaymentRequest: 'Add payment request',
  somePaymentDetailsNeedFixing: 'Some payment details need fixing.',
  paymentRequestSaved: 'Payment request saved.',
  paymentRequestAddedTheCustomer: 'Payment request added. The customer can now see it on the track page.',
  couldNotSaveThePayment: 'Could not save the payment request.',
  markedAsPaid: 'Marked as paid.',
  paymentRequestCancelled: 'Payment request cancelled.',
  paymentRequestReopened: 'Payment request reopened.',
  couldNotChangeTheStatus: 'Could not change the status.',
  paymentRequestDeleted: 'Payment request deleted.',
  couldNotDeleteThePayment: 'Could not delete the payment request.',
  savePaymentRequest: 'Save payment request',
};

export const SHIPMENT_PAYMENT_PANEL_TEXT = consoleText('shipmentPaymentPanel', SHIPMENT_PAYMENT_PANEL_TEXT_EN);
