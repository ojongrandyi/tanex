// French console text (tracker I.2): one lazy chunk, loaded only when the console is in French.
// Every area has the same shape as its English master (ConsoleTranslation, checked by the build).
// To confirm with the owner; native review #108.
import type { ConsoleTranslation } from '../../../admin/i18n/consoleText';
import { auth, iam, mail } from './auth';
import { blogMenu, cash, dispatchMenu } from './delivery';
import { dispatch } from './dispatch';
import { board } from './board';
import { blog } from './blog';
import {
  adminApp, deleteShipmentModal, messagesView, newProofsPanel, paymentsView, proofFacts, proofReviewControls,
  proofViewer, recentlyDeletedModal,
} from './screensSmall';
import { adminLayout, operationsCenter, paymentRequestEditor, shipmentControlModal, shipmentImagesPanel, shipmentPaymentPanel } from './screensPanels';
import { allShipmentsView, editShipmentModal } from './screensShipments';
import { quoteRequestsView, settingsView } from './screensDesk';
import { trackingEventsView } from './trackingEventsView';
import { createShipmentView } from './createShipmentView';
import { documentCenterView } from './documentCenterView';

const fr: ConsoleTranslation = {
  auth, iam, mail, blogMenu, dispatchMenu, cash, dispatch, board, blog,
  adminApp, adminLayout, deleteShipmentModal, editShipmentModal, newProofsPanel, paymentRequestEditor, proofFacts,
  proofReviewControls, proofViewer, recentlyDeletedModal, shipmentControlModal, shipmentImagesPanel,
  shipmentPaymentPanel, allShipmentsView, createShipmentView, messagesView, operationsCenter, paymentsView,
  quoteRequestsView, settingsView, trackingEventsView, documentCenterView,
};

export default fr;
