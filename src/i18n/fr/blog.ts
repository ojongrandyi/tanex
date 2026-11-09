// Français, zone « blog » : la page « bientôt disponible » de /fr/blog (CONTENT_FR §13).
import type { BlogMessages } from '../en/blog';
import type { Translation } from '../types';

const blog = {
  eyebrow: 'Blog',
  title: 'Articles bientôt disponibles',
  sub: "Nous préparons des actualités, des guides et des conseils d'expédition de l'équipe {company}. Revenez bientôt.",
  track: 'Suivre un envoi',
  contact: 'Nous contacter',
} satisfies Translation<BlogMessages>;

export default blog;
