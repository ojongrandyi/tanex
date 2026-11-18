// The Shop view's sidebar label and header text, kept apart from SHOP_TEXT so the console's main
// chunk doesn't carry the whole Shop copy (CONTENT §17.8, owner to confirm).
import { consoleText } from '../i18n/consoleText';

export const SHOP_MENU_EN = { menu: 'Shop', description: 'Products, pictures, stock and categories.' } as const;
export const SHOP_MENU = consoleText('shopMenu', SHOP_MENU_EN);
