// The Blog view's sidebar label and header text, kept apart from BLOG_TEXT so the console's main
// chunk doesn't carry the whole studio copy (CONTENT §10.4).
import { consoleText } from '../i18n/consoleText';

export const BLOG_MENU_EN = { menu: 'Blog', description: 'Write, review and publish articles.' } as const;
export const BLOG_MENU = consoleText('blogMenu', BLOG_MENU_EN);
