// Français, zone « legal » : le cadre de la page Mentions légales (CONTENT_FR §13).
import type { LegalMessages } from '../en/legal';
import type { Translation } from '../types';

const legal = {
  title: 'Mentions légales',
  navLabel: 'Pages juridiques',
  updated: 'Dernière mise à jour : {date}',
} satisfies Translation<LegalMessages>;

export default legal;
