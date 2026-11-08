// Français, zone « track » : page Suivi, écran de chargement, fenêtre d'assistance
// (CONTENT_FR §6.1, §6.2, §6.4, §6.5, §6.12). Relecture native #108.
import type { TrackMessages } from '../en/track';
import type { Translation } from '../types';

const track = {
  page: {
    eyebrow: 'Suivi',
    title: 'Suivre votre envoi',
    sub: 'Saisissez votre numéro de suivi TanEx à 8 caractères pour voir où se trouve votre envoi en ce moment.',
    tabsLabel: 'Mode de suivi',
    tabOne: 'Un numéro',
    tabSeveral: 'Suivre plusieurs envois',
    inputLabel: 'Numéro de suivi',
    placeholder: 'ex. {example}',
    clear: 'Effacer',
    button: 'Suivre',
    batchLabel: 'Saisissez jusqu\'à 10 numéros de suivi, un par ligne.',
    recent: 'Suivis récemment',
    invalid: 'Les numéros de suivi commencent par TX et comptent 8 caractères, ex. {example}.',
    notFoundStart: "Nous n'avons trouvé aucun envoi avec le numéro {id}. Vérifiez les caractères et réessayez, ou",
    notFoundLink: 'contactez-nous',
    notFoundEnd: 'et nous le retrouverons pour vous.',
  },
  find: {
    title: 'Où trouver votre numéro',
    booking: { title: 'Confirmation de réservation.', body: "Dans l'e-mail ou le message WhatsApp envoyé lors de la réservation." },
    waybill: { title: 'Lettre de transport / étiquette.', body: "Imprimé en haut de votre lettre de transport et sur l'étiquette de chaque colis." },
    coordinator: { title: 'Votre coordinateur.', body: "Tout coordinateur TanEx peut le retrouver à partir de votre nom, d'une référence ou de votre numéro de téléphone." },
  },
  help: {
    title: "Besoin d'aide pour un envoi en cours ?",
    body: 'Notre équipe est là pour vous aider.',
    button: "Contacter l'assistance",
  },
  batch: {
    title: 'Suivre plusieurs envois',
    close: 'Fermer',
    filterLabel: 'Afficher',
    all: 'Tous ({n})',
    count: '{label} ({n})',
    delayedOrHeld: '{delayed} / {held} ({n})',
    notFound: "Nous n'avons trouvé aucun envoi avec le numéro {id}. Vérifiez les caractères et réessayez.",
    origin: 'Origine',
    destination: 'Destination',
    lastSeen: 'Dernier passage',
    eta: 'Livraison estimée',
    open: 'Ouvrir le suivi',
    found: '{n} sur {m} trouvés',
  },
  support: {
    title: 'Comment pouvons-nous vous aider pour cet envoi ?',
    close: 'Fermer',
    tracking: 'Numéro de suivi',
    issue: 'Type de problème',
    issues: { delay: 'Retard', address: "Changement d'adresse", damage: 'Dommage', customs: 'Question de douane', other: 'Autre' },
    message: 'Message',
    name: 'Nom',
    email: 'E-mail',
    cancel: 'Annuler',
    submit: 'Ouvrir un ticket',
    sending: 'Ouverture…',
    success: 'Ticket {ticket} ouvert pour {id}. Nous répondrons à {email} rapidement.',
    successNoId: 'Ticket {ticket} ouvert. Nous répondrons à {email} rapidement.',
    error: "Nous n'avons pas pu envoyer votre demande. Veuillez réessayer.",
  },
} satisfies Translation<TrackMessages>;

export default track;
