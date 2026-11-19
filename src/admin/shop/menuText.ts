// The Shop view's sidebar label and header text, plus the new-orders badge, the bell item and the
// dashboard's shop tiles (M.7). Kept apart from SHOP_TEXT so the console's main chunk doesn't carry
// the whole Shop copy (CONTENT §17.8, owner to confirm).
import { consoleText } from '../i18n/consoleText';

export const SHOP_MENU_EN = {
  menu: 'Shop',
  description: 'Products, pictures, stock, categories and orders.',
  newBadge: (n: number) => `${n} new`,
  newOrdersLabel: (n: number) => (n === 1 ? '1 new shop order' : `${n} new shop orders`),
  bellTitle: (n: number) => (n === 1 ? '1 new shop order' : `${n} new shop orders`),
  bellBody: 'Call the customer to confirm the order and the delivery fee.',
  dashboard: {
    title: 'Shop orders',
    newOrders: 'New orders',
    feeToConfirm: (n: number) => (n === 1 ? '1 with a fee to confirm' : `${n} with a fee to confirm`),
    allFeesSet: 'Every delivery fee is set',
    ready: 'Ready to send',
    readyHint: 'Packed, waiting for dispatch or pickup',
    out: 'Out for delivery',
    problems: (n: number) => (n === 1 ? '1 with a delivery problem' : `${n} with a delivery problem`),
    noProblems: 'No delivery problems',
    unpaid: 'Completed, unpaid',
    unpaidHint: 'Delivered or collected, payment not recorded',
    lowStock: 'Low stock',
    lowStockHint: 'Published products at or below the low-stock level',
  },
};
export const SHOP_MENU = consoleText('shopMenu', SHOP_MENU_EN);
