// Français, console : petits écrans et panneaux (notifications, preuves de paiement, corbeille,
// messages, paiements). Tracker I.2, à confirmer, relecture native #108.
import type { ConsoleTextAreas, Widen } from '../../../admin/i18n/consoleText';

type W<A extends keyof ConsoleTextAreas> = Widen<ConsoleTextAreas[A]>;

export const adminApp: W<'adminApp'> = {
  dismiss: 'Fermer',
  thisSection: 'Cette section',
  loading: 'Chargement…',
  shipmentUpdated: (tracking: string, status: string) => `Envoi ${tracking} mis à jour : ${status}`,
  updateFailed: (tracking: string, error: string) => `Échec de l'enregistrement de la mise à jour de ${tracking} : ${error}. Modification annulée.`,
  serverRejected: 'le serveur a refusé la demande',
  newProofFor: (tracking: string) => `Nouvelle preuve de paiement – ${tracking}`,
  newProofsCount: (n: number) => `${n} nouvelles preuves de paiement`,
};

export const deleteShipmentModal: W<'deleteShipmentModal'> = {
  cancelEsc: 'Annuler (Échap)',
  deleteConsignment: "Supprimer l'envoi ?",
  areYouSureYouWant: "Voulez-vous vraiment supprimer définitivement l'envoi",
  thisActionCannotBeUndone: ' ? Cette action est irréversible et effacera tout l’historique des étapes associé.',
  cancel: 'Annuler',
  deleteConsignment2: "Supprimer l'envoi",
  waybill: 'LETTRE DE TRANSPORT',
  route: 'TRAJET',
  parties: 'PARTIES',
};

export const newProofsPanel: W<'newProofsPanel'> = {
  couldNotLoadPaymentProofs: 'Impossible de charger les preuves de paiement.',
  newPaymentProofs: 'Nouvelles preuves de paiement',
  toReview: 'à vérifier',
  refreshPaymentProofs: 'Actualiser les preuves de paiement',
  allPayments: 'Tous les paiements →',
  nothingToReview: 'Rien à vérifier',
  proofsOfPaymentCustomersSend: 'Les preuves de paiement envoyées par les clients depuis la page de suivi apparaîtront ici.',
  due: 'Dû',
  sent: 'Envoyé',
  differs: 'différent',
  accountNotRecorded: 'Compte non enregistré',
  ref: 'Réf. :',
  viewAll: 'Tout voir',
  proofsWaitingInPayments: 'preuves en attente dans Paiements →',
  approvedThePaymentIsMarked: 'Approuvée. Le paiement est marqué comme payé.',
  rejected: 'Rejetée :',
  reviewThePaymentProofFor: (p0: unknown) => `Vérifier la preuve de paiement de ${p0}`,
  paymentScreenshot: (p0: unknown) => `Capture du paiement · ${p0}`,
};

export const proofFacts: W<'proofFacts'> = {
  amountDue: 'Montant dû',
  amountSent: 'Montant envoyé',
  differsFromTheAmountDue: 'Différent du montant dû',
  paidTo: 'Payé à',
  payer: 'Payeur',
  reference: 'Référence',
  for: 'Pour',
};

export const proofReviewControls: W<'proofReviewControls'> = {
  approveThisProofAndMark: (p0: unknown) => `Approuver cette preuve et marquer le paiement de ${p0} comme payé ?`,
  couldNotApproveTheProof: "Impossible d'approuver la preuve.",
  tellTheCustomerWhyThe: "Expliquez au client pourquoi la preuve n'a pas été acceptée. Il verra ce message.",
  couldNotRejectTheProof: 'Impossible de rejeter la preuve.',
  addAPaymentConfirmedEvent: 'Ajouter une étape « Paiement confirmé » à l’historique de suivi public',
  approve: 'Approuver',
  reject: 'Rejeter',
  reasonTheCustomerWillSee: 'Motif (visible par le client)',
  eGTheAmountOn: 'ex. : Le montant de la capture ne correspond pas au montant dû.',
  rejectProof: 'Rejeter la preuve',
  cancel: 'Annuler',
};

export const proofViewer: W<'proofViewer'> = {
  close: 'Fermer',
};

export const recentlyDeletedModal: W<'recentlyDeletedModal'> = {
  serverRejected: 'le serveur a refusé la demande',
  restoredBackInYourShipments: (p0: unknown) => `${p0} restauré — de retour dans vos envois.`,
  failedToRestore: (p0: unknown, p1: unknown) => `Échec de la restauration de ${p0} : ${p1}`,
  permanentlyDeleted: (p0: unknown) => `${p0} supprimé définitivement.`,
  failedToPermanentlyDelete: (p0: unknown, p1: unknown) => `Échec de la suppression définitive de ${p0} : ${p1}`,
  recentlyDeleted: 'Supprimés récemment',
  deletedShipmentsAreKeptHere: 'Les envois supprimés sont conservés ici et peuvent être restaurés à tout moment — rien n’est supprimé définitivement sans votre choix.',
  closeEsc: 'Fermer (Échap)',
  loading: 'Chargement…',
  nothingInTheTrash: 'La corbeille est vide',
  deletedShipmentsWillShowUp: 'Les envois supprimés apparaîtront ici.',
  permanentlyDeleteThisCannotBe: 'Supprimer définitivement ? Cette action est irréversible.',
  cancel: 'Annuler',
  permanentlyDelete: 'Supprimer définitivement',
  deleting: 'Suppression…',
  yesDeleteForever: 'Oui, supprimer définitivement',
  restoring: 'Restauration…',
  restore: 'Restaurer',
};

export const messagesView: W<'messagesView'> = {
  serverError: 'erreur du serveur',
  couldNotLoadMessages: 'Impossible de charger les messages.',
  couldNotUpdate: (p0: unknown, p1: unknown) => `Impossible de mettre à jour ${p0} : ${p1}`,
  filterMessages: 'Filtrer les messages',
  refresh: 'Actualiser',
  replyByEmail: 'Répondre par e-mail',
  callBack: 'Rappeler',
  markResolved: 'Marquer comme traité',
  reopen: 'Rouvrir',
  markUnread: 'Marquer comme non lu',
  all: 'Tous',
  new: 'Nouveaux',
  read: 'Lus',
  resolved: 'Traités',
  noMessagesYet: "Aucun message pour l'instant",
  noMessagesMatch: 'Aucun message ne correspond',
  messagesFromTheContactPage: "Les messages de la page Contact et les demandes de rappel de l'accueil apparaîtront ici.",
  tryAnotherFilterOrClear: 'Essayez un autre filtre ou effacez la recherche.',
};

export const paymentsView: W<'paymentsView'> = {
  couldNotLoadPaymentProofs: 'Impossible de charger les preuves de paiement.',
  filterPaymentProofs: 'Filtrer les preuves de paiement',
  refresh: 'Actualiser',
  request: 'Demande :',
  received: 'Reçue',
  rejected: 'Rejetée :',
  viewScreenshot: 'Voir la capture',
  viewShipment: "Voir l'envoi",
  submitted: 'Envoyées',
  approved: 'Approuvées',
  rejected2: 'Rejetées',
  all: 'Toutes',
  noPaymentProofsYet: "Aucune preuve de paiement pour l'instant",
  noProofsMatch: 'Aucune preuve ne correspond',
  proofsCustomersSendFromThe: 'Les preuves envoyées par les clients depuis la page de suivi apparaîtront ici.',
  tryAnotherFilterOrClear: 'Essayez un autre filtre ou effacez la recherche.',
  openTheScreenshotSentFor: (p0: unknown) => `Ouvrir la capture envoyée pour ${p0}`,
  paymentScreenshot: (p0: unknown) => `Capture du paiement · ${p0}`,
};
