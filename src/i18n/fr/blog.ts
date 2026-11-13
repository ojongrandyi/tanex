// Français, zone « blog » (CONTENT_FR §15) : index, catégories et articles du blog public
// (tâche F.3). Libellés à confirmer, relecture native en attente.
import type { BlogMessages } from '../en/blog';
import type { Translation } from '../types';

const blog = {
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
    categories: 'Catégories',
    latest: 'Dernier article',
    pagination: 'Pages du blog',
    pageOf: 'Page {n} sur {total}',
    loadError: "Nous n'avons pas pu charger les articles. Veuillez réessayer.",
    retry: 'Réessayer',
    rss: 'Flux RSS',
    track: 'Suivre un envoi',
  },
  category: {
    back: 'Tous les articles',
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
    shareOn: 'Partager sur {network}',
    back: 'Retour au blog',
    previous: 'Article précédent',
    next: 'Article suivant',
    moreArticles: "Plus d'articles",
    tags: 'Mots-clés',
    notFoundTitle: 'Article introuvable',
    notFoundBody: "Cet article n'existe pas ou n'est plus publié.",
    loadError: "Nous n'avons pas pu charger cet article. Veuillez réessayer.",
  },
} satisfies Translation<BlogMessages>;

export default blog;
