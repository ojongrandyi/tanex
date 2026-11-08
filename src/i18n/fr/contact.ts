// Français, zone « contact » : la page Contact (CONTENT_FR §8.3, §8.4, §8.6). Relecture native #108.
import type { ContactMessages } from '../en/contact';
import type { Translation } from '../types';

const contact = {
  hero: {
    title: 'Parlez à TanEx',
    sub: 'Une question, un devis ou un envoi qui demande de l\'attention : un vrai coordinateur vous répondra.',
  },
  channels: {
    label: 'Comment nous joindre',
    phone: 'Téléphone',
    whatsapp: 'WhatsApp',
    email: 'E-mail',
  },
  offices: {
    title: 'Nos bureaux',
    buea: 'Buea, siège',
    douala: 'Douala',
    hoursTitle: "Horaires d'ouverture",
    directions: 'Itinéraire',
    directionsFor: 'Itinéraire : {office} (ouvre Google Maps)',
  },
  form: {
    title: 'Envoyez-nous un message',
    name: 'Nom',
    email: 'E-mail',
    phone: 'Téléphone',
    optional: '(facultatif)',
    topic: 'Sujet',
    topicPlaceholder: 'Choisissez un sujet',
    topics: { quote: 'Devis', shipment: 'Envoi en cours', billing: 'Facturation', partnership: 'Partenariat', other: 'Autre' },
    tracking: 'Numéro de suivi',
    trackingHint: 'Par exemple {example}',
    gateway: "Porte d'entrée",
    gatewayNone: "Aucune porte d'entrée",
    message: 'Message',
    submit: 'Envoyer le message',
    sending: 'Envoi…',
    errorRequired: 'Indiquez votre nom, votre e-mail, le sujet et votre message.',
    errorEmail: 'Saisissez une adresse e-mail valide.',
    errorSend: "Nous n'avons pas pu envoyer votre message. Réessayez, ou écrivez-nous à {email}.",
  },
  success: {
    title: 'Message reçu.',
    body: 'Votre référence est {ref}. Nous répondrons à {email} dès que possible.',
    again: 'Envoyer un autre message',
    track: 'Suivre un envoi',
  },
  desk: {
    title: 'Bureau des opérations TanEx.',
    body: 'Pour un envoi en cours, indiquez votre numéro de suivi pour une aide plus rapide.',
  },
  faq: { title: 'Réponses rapides', more: "Plus de réponses dans le Centre d'aide" },
} satisfies Translation<ContactMessages>;

export default contact;
