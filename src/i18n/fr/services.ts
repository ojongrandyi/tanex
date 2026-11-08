// Français, zone « services » : la page Services (CONTENT_FR §3, §3.6, §3.7). Relecture native #108.
import type { ServicesMessages } from '../en/services';
import type { Translation } from '../types';

const services = {
  hero: {
    eyebrow: 'Nos services',
    titleStart: 'Tous les moyens de transport, sous',
    titleEm: 'un même toit.',
    sub: "Choisissez le mode adapté à votre marchandise et à vos délais. Nous nous occupons de l'itinéraire, des documents et de chaque transfert.",
    quote: 'Demander un devis',
    track: 'Suivre un envoi',
  },
  eyebrows: { services: 'Services', compare: 'Comparer', how: 'Comment ça marche', addons: 'Options' },
  headings: {
    services: 'Six façons de transporter',
    compare: 'Quel service vous convient ?',
    how: "De la réservation jusqu'à la porte",
    addons: 'Des options quand vous en avez besoin',
    nav: 'Services sur cette page',
  },
  labels: { highlights: 'Points forts', goodFor: 'Idéal pour', quote: 'Demander un devis', track: 'Suivre un envoi', bike: 'Réserver une livraison à moto' },
  items: {
    air: {
      name: 'Fret aérien',
      summary: 'Expédition aérienne internationale de documents, colis et marchandises urgentes.',
      h1: 'Enlèvement à votre porte',
      h2: "Documents d'exportation préparés avec vous",
      h3: 'Accompagnement au dédouanement',
      h4: "Suivi de l'enlèvement à la livraison",
      goodFor: "documents, échantillons, pièces détachées, commandes en ligne, colis personnels à l'étranger",
    },
    maritime: {
      name: 'Fret maritime',
      summary: 'Transport maritime en conteneurs complets (FCL) ou groupés (LCL) pour les charges plus volumineuses et plus lourdes.',
      h1: 'FCL et LCL',
      h2: 'Manutention portuaire et documents',
      h3: 'Import et export',
      h4: 'Livraison à la porte après dédouanement',
      goodFor: "stocks d'entreprise, machines, véhicules, déménagements",
    },
    rail: {
      name: 'Fret ferroviaire',
      summary: 'Transport intérieur des marchandises lourdes et en vrac sur les lignes desservies par le rail, complété par la route à chaque extrémité.',
      h1: 'Économique pour les charges lourdes',
      h2: 'Réservé et suivi par notre équipe',
      h3: 'Enlèvement et livraison par la route pour compléter le trajet',
      h4: '',
      goodFor: 'marchandises en vrac, matériaux de construction, produits agricoles',
    },
    road: {
      name: 'Fret routier',
      summary: 'Transport par camion et fourgonnette entre les villes du Cameroun et vers les pays voisins.',
      h1: 'Chargements complets et partiels',
      h2: 'Enlèvement et livraison porte à porte',
      h3: 'Suivi de ville en ville',
      h4: '',
      goodFor: 'meubles, stocks de magasin, palettes, livraisons entre Limbe, Buea, Douala et au-delà',
    },
    warehousing: {
      name: 'Entreposage',
      summary: 'Stockage sécurisé de vos marchandises, avec réception, contrôle des stocks, emballage et expédition.',
      h1: 'Stockage de courte et longue durée',
      h2: "Marchandises contrôlées et enregistrées à l'entrée",
      h3: 'Préparation, emballage et expédition sur demande',
      h4: 'Combinable avec tous nos services de transport',
      goodFor: 'commerçants, vendeurs en ligne, importateurs en attente de livraison',
    },
    local: {
      name: 'Livraison locale (moto)',
      summary: 'Livraison dans la même ville par les livreurs TanEx à Buea, Limbe et Douala, avec suivi en direct.',
      h1: 'Récupéré à votre porte',
      h2: 'Position du livreur en direct',
      h3: 'Preuve de livraison en photo',
      h4: 'Espèces ou Mobile Money',
      goodFor: 'documents, repas, téléphones et petits colis, livraisons de boutiques en ligne',
    },
  },
  compare: {
    caption: 'Nos services comparés',
    service: 'Service',
    bestFor: 'Idéal pour',
    speed: 'Rapidité',
    tracking: 'Suivi',
    rows: {
      local: { name: 'Livraison locale', bestFor: 'Petits objets dans une même ville', speed: 'Le plus rapide, même ville', tracking: 'Position du livreur en direct' },
      road: { name: 'Fret routier', bestFor: 'Gros chargements entre les villes', speed: 'Trajets programmés', tracking: 'Mises à jour de ville en ville' },
      air: { name: 'Fret aérien', bestFor: 'Envois internationaux urgents', speed: "Le plus rapide à l'international", tracking: 'Chaque étape' },
      maritime: { name: 'Fret maritime', bestFor: 'Charges internationales volumineuses ou lourdes', speed: 'Départs programmés', tracking: 'Chaque étape' },
      rail: { name: 'Fret ferroviaire', bestFor: "Marchandises lourdes et en vrac à l'intérieur du pays", speed: 'Départs programmés', tracking: 'Chaque étape' },
      warehousing: { name: 'Entreposage', bestFor: 'Stocker avant la livraison', speed: 'Sans objet', tracking: 'Registre des stocks' },
    },
  },
  how: {
    book: { title: 'Réservez.', body: 'En ligne, sur WhatsApp ou à notre bureau. Vous recevez immédiatement votre numéro de suivi à 8 caractères.' },
    collect: { title: 'Enlèvement.', body: 'Nous récupérons à votre porte, vérifions et étiquetons chaque colis.' },
    move: { title: 'Transport.', body: 'À moto, en camion, par avion, bateau ou train. Chaque transfert est enregistré.' },
    deliver: { title: 'Livraison.', body: 'Livré à la porte, avec une photo et le nom du destinataire comme preuve.' },
  },
  addons: {
    express: { title: 'Express (en ville).', body: 'Enlèvement prioritaire pour les livraisons urgentes dans la même ville.' },
    cod: { title: 'Paiement à la livraison.', body: 'Le livreur encaisse le prix de votre marchandise auprès du destinataire et nous vous le reversons.' },
    code: { title: 'Code de livraison.', body: 'Le destinataire donne un code à 4 chiffres au livreur avant la remise.' },
    packing: { title: 'Emballage.', body: "Nous emballons et protégeons vos objets avant l'expédition." },
  },
  cta: {
    title: 'Prêt à envoyer quelque chose ?',
    body: 'Obtenez un prix clair, ou réservez une livraison à moto en quelques minutes.',
    quote: 'Demander un devis',
    bike: 'Réserver une livraison à moto',
  },
} satisfies Translation<ServicesMessages>;

export default services;
