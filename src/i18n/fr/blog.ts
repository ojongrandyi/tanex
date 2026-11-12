// Français, zone « blog » (CONTENT_FR §15). La page « bientôt disponible » de /fr/blog jusqu'à F.3,
// puis les libellés du blog public (`index`, `article`), ajoutés avec F.2 (à confirmer).
import type { BlogMessages } from '../en/blog';
import type { Translation } from '../types';

const blog = {
  eyebrow: 'Blog',
  title: 'Articles bientôt disponibles',
  sub: "Nous préparons des actualités, des guides et des conseils d'expédition de l'équipe {company}. Revenez bientôt.",
  track: 'Suivre un envoi',
  contact: 'Nous contacter',
  index: {
    eyebrow: 'Blog {company}',
    title: "Actualités, guides et conseils d'expédition",
    sub: "Des conseils pratiques pour envoyer des colis au Cameroun et à l'étranger, et les actualités de l'équipe {company}.",
    all: 'Tous',
    empty: 'Nos premiers articles arrivent bientôt.',
    readMore: 'Lire la suite',
    minRead: '{n} min de lecture',
    newer: 'Plus récents',
    older: 'Plus anciens',
  },
  article: {
    by: 'Par {author}',
    minRead: '{n} min de lecture',
    share: 'Partager',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    x: 'X',
    copyLink: 'Copier le lien',
    linkCopied: 'Lien copié',
    related: 'Articles similaires',
    readTranslation: 'Lire en anglais',
    ctaText: "Besoin d'envoyer quelque chose ?",
    ctaButton: 'Demander un devis',
  },
} satisfies Translation<BlogMessages>;

export default blog;
