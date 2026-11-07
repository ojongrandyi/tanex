// Français, zone « notFound » : la page 404 (CONTENT_FR §1.1a).
import type { NotFoundMessages } from '../en/notFound';
import type { Translation } from '../types';

const notFound = {
  eyebrow: 'Erreur 404',
  title: 'Page introuvable',
  sub: "La page que vous cherchez n'existe pas ou a été déplacée. Vérifiez l'adresse ou utilisez l'un des liens ci-dessous.",
  home: "Retour à l'accueil",
  track: 'Suivre un envoi',
  needHelp: "Besoin d'aide ?",
  contact: 'Contactez-nous',
} satisfies Translation<NotFoundMessages>;

export default notFound;
