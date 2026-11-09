// Per-page titles and descriptions in English and French (CONTENT §1.1, CONTENT_FR §1.1).
// DOM-free: the server injects them into index.html (server/render/pageMeta.ts) and App.tsx
// sets the same values when the page changes in the browser. Moves into the i18n dictionaries
// with D.3 if that turns out simpler; until then this is the one copy of the meta wording.
import { COMPANY, TAGLINE, TAGLINE_FR } from '../config/brand.js';
import type { Lang, RouteId } from '../router/routes.js';

export interface PageMetaText {
  title: string;
  description: string;
}

/**
 * French pages are indexable since E.8, when every public page body had its French version
 * (#133; they were `noindex` while they still showed English, Decisions log D.1). The server,
 * the sitemap and App.tsx all read it.
 */
export const FRENCH_PAGES_INDEXABLE = true;

const DEFAULT: Record<Lang, PageMetaText> = {
  en: {
    title: `${COMPANY} | Door-to-Door Delivery in Cameroon & Worldwide Shipping`,
    description: `${COMPANY} picks up from your door and delivers across Buea, Limbe and Douala by bike, between cities by truck, and worldwide by air, sea, rail and road, with one tracking ID.`,
  },
  fr: {
    title: `${COMPANY} | Livraison à domicile au Cameroun et expédition dans le monde entier`,
    description: `${COMPANY} récupère vos colis à votre porte et les livre à moto dans Buea, Limbe et Douala, en camion entre les villes, et partout dans le monde par avion, bateau, train et route, avec un seul numéro de suivi.`,
  },
};

/** Open Graph / Twitter title for the home page (CONTENT §1.1 "OG title"). */
export const OG_TITLE: Record<Lang, string> = {
  en: `${COMPANY}: ${TAGLINE}`,
  fr: `${COMPANY} : ${TAGLINE_FR}`,
};

type InnerRoute = Exclude<RouteId, 'home'>;

const PAGES: Record<InnerRoute, Record<Lang, PageMetaText>> = {
  track: {
    en: { title: `Track a Shipment | ${COMPANY}`, description: `Enter your 8-character ${COMPANY} tracking ID to see where your parcel is, including live rider location for in-town deliveries.` },
    fr: { title: `Suivre un envoi | ${COMPANY}`, description: `Saisissez votre numéro de suivi ${COMPANY} à 8 caractères pour voir où se trouve votre colis, avec la position du livreur en direct pour les livraisons en ville.` },
  },
  services: {
    en: { title: `Logistics Services | ${COMPANY}`, description: 'Air, maritime, rail and road freight, warehousing, and same-city bike delivery in Buea, Limbe and Douala.' },
    fr: { title: `Nos services logistiques | ${COMPANY}`, description: 'Fret aérien, maritime, ferroviaire et routier, entreposage, et livraison à moto dans Buea, Limbe et Douala.' },
  },
  'local-delivery': {
    en: { title: `Bike Delivery in Buea, Limbe & Douala | ${COMPANY}`, description: `Book a ${COMPANY} rider to collect and deliver across town, and follow the delivery live.` },
    fr: { title: `Livraison à moto à Buea, Limbe et Douala | ${COMPANY}`, description: `Réservez un livreur ${COMPANY} pour récupérer et livrer en ville, et suivez la livraison en direct.` },
  },
  quote: {
    en: { title: `Get a Quote | ${COMPANY}`, description: "Tell us what you're sending and where. Our team will send you a clear price." },
    fr: { title: `Demander un devis | ${COMPANY}`, description: 'Dites-nous ce que vous envoyez et où. Notre équipe vous enverra un prix clair.' },
  },
  ship: {
    en: { title: `Book a Shipment | ${COMPANY}`, description: 'Book a collection, add every piece and get your tracking ID straight away.' },
    fr: { title: `Réserver un envoi | ${COMPANY}`, description: 'Réservez un enlèvement, ajoutez chaque colis et obtenez votre numéro de suivi immédiatement.' },
  },
  about: {
    en: { title: `About ${COMPANY}`, description: `Who we are, how we work, and the team behind ${COMPANY} in Buea.` },
    fr: { title: `À propos de ${COMPANY}`, description: `Qui nous sommes, notre façon de travailler et l'équipe ${COMPANY} à Buea.` },
  },
  locations: {
    en: { title: `Our Network | ${COMPANY}`, description: "From our base in Buea and the gateway of Douala to the world's main trade hubs." },
    fr: { title: `Notre réseau | ${COMPANY}`, description: "De notre base à Buea et de la porte d'entrée de Douala jusqu'aux grands carrefours commerciaux du monde." },
  },
  help: {
    en: { title: `Help Centre | ${COMPANY}`, description: 'Answers on tracking, bike delivery, booking, customs, payments and documents.' },
    fr: { title: `Centre d'aide | ${COMPANY}`, description: 'Réponses sur le suivi, la livraison à moto, la réservation, la douane, les paiements et les documents.' },
  },
  contact: {
    en: { title: `Contact Us | ${COMPANY}`, description: `Talk to the ${COMPANY} team in Buea by email, phone or WhatsApp.` },
    fr: { title: `Nous contacter | ${COMPANY}`, description: `Contactez l'équipe ${COMPANY} à Buea par e-mail, téléphone ou WhatsApp.` },
  },
  legal: {
    en: { title: `Policies | ${COMPANY}`, description: 'Privacy, terms of service, shipping terms, cookies and accessibility.' },
    fr: { title: `Politiques | ${COMPANY}`, description: "Confidentialité, conditions d'utilisation, conditions d'expédition, cookies et accessibilité." },
  },
  blog: {
    en: { title: `Blog | ${COMPANY}`, description: `News, guides and shipping tips from the ${COMPANY} team.` },
    fr: { title: `Blog | ${COMPANY}`, description: `Actualités, guides et conseils d'expédition de l'équipe ${COMPANY}.` },
  },
  careers: {
    en: { title: `Careers | ${COMPANY}`, description: `Work with ${COMPANY} in Buea, Limbe and Douala: riders, drivers, operations and office. Send us your CV.` },
    fr: { title: `Carrières | ${COMPANY}`, description: `Travaillez avec ${COMPANY} à Buea, Limbe et Douala : livreurs, chauffeurs, opérations et bureau. Envoyez-nous votre CV.` },
  },
  csr: {
    en: { title: `CSR Policy | ${COMPANY}`, description: `How ${COMPANY} works safely, fairly and responsibly: road safety, fair work, honest service, the environment and the local community.` },
    fr: { title: `Politique RSE | ${COMPANY}`, description: `Comment ${COMPANY} travaille de façon sûre, juste et responsable : sécurité routière, travail équitable, service honnête, environnement et communauté locale.` },
  },
};

/** CONTENT §1.1a; the French title is built from the CONTENT_FR §1.1a heading (owner to confirm). */
export const NOT_FOUND_TITLE: Record<Lang, string> = {
  en: `Page Not Found | ${COMPANY}`,
  fr: `Page introuvable | ${COMPANY}`,
};

/** First breadcrumb (CONTENT §1.2 drawer `Home`, CONTENT_FR §1.2 `Accueil`). */
export const HOME_LABEL: Record<Lang, string> = { en: 'Home', fr: 'Accueil' };

export function pageMetaText(id: RouteId, lang: Lang = 'en'): PageMetaText {
  return id === 'home' ? DEFAULT[lang] : PAGES[id][lang];
}

/** Short page name for breadcrumbs: the title without the trailing "| TanEx". */
export function pageName(id: RouteId, lang: Lang = 'en'): string {
  if (id === 'home') return HOME_LABEL[lang];
  return pageMetaText(id, lang).title.replace(/\s*\|\s*[^|]*$/, '');
}

/**
 * Legal sub-pages with content of their own (src/data/legalDocs.ts ids). `privacy` is what
 * /legal shows, so /legal/privacy points its canonical at /legal; any other tab falls back there too.
 */
export const LEGAL_TABS = ['terms', 'shipping-terms', 'cookies', 'accessibility'] as const;
