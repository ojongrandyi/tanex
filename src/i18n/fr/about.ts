// Français, zone « about » : la page À propos (CONTENT_FR §4, §3.6, §4.1, §12). Relecture native #108.
import type { AboutMessages } from '../en/about';
import type { Translation } from '../types';

const about = {
  hero: {
    eyebrow: 'À propos de TanEx',
    title: "De notre porte à Buea jusqu'à la vôtre, où qu'elle soit.",
    sub: 'TanEx est une entreprise de livraison et de logistique basée à Buea, avec un bureau à Douala. Nous transportons les colis en ville à moto, entre les villes en camion, et du Cameroun vers le monde entier par avion, bateau, train et route.',
    slogan: '{slogan}.',
  },
  approach: {
    eyebrow: 'Notre approche',
    title: 'Notre façon de travailler',
    id: { title: 'Un seul numéro de suivi.', body: 'De la première à la dernière porte.' },
    couriers: { title: 'Des livreurs identifiés.', body: 'Chaque livraison a un livreur ou un chauffeur TanEx qui en répond.' },
    proof: { title: 'Des preuves, pas des promesses.', body: 'Une photo et un nom à chaque livraison.' },
    languages: { title: 'Deux langues.', body: 'Nous vous servons en anglais et en français.' },
  },
  leadership: {
    eyebrow: 'Direction',
    role: 'Directeur général',
    alt: 'Le directeur général de TanEx au bureau TanEx de Buea',
    altNamed: '{name}, directeur général de TanEx, au bureau TanEx de Buea',
  },
  team: {
    eyebrow: 'Notre équipe',
    body: "L'équipe TanEx porte le marron et l'orange que vous verrez à votre porte.",
  },
  offices: {
    eyebrow: 'Où nous trouver',
    buea: 'Buea, siège',
    douala: 'Douala',
    hours: 'Ouvert de {hours}',
    contact: 'Nous contacter',
  },
  cta: {
    title: 'Prêt à envoyer quelque chose ?',
    body: 'Obtenez un prix clair, ou réservez une livraison à moto en quelques minutes.',
    quote: 'Demander un devis',
    bike: 'Réserver une livraison à moto',
  },
} satisfies Translation<AboutMessages>;

export default about;
