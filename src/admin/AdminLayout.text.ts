// Console layout copy: sidebar, top bar, view headers (console, tracker I.2). English master; the
// French is in src/i18n/fr/console/adminLayout.ts (same keys, checked by the build).
import { consoleText } from './i18n/consoleText';
import type { AdminViewType } from './views';

type ViewMeta = { title: string; category: string; description: string };

export const ADMIN_LAYOUT_TEXT_EN = {
  operationsConsole: 'Operations Console',
  closeMenu: 'Close menu',
  openMenu: 'Open menu',
  sections: { operations: 'OPERATIONS', commercial: 'COMMERCIAL', system: 'SYSTEM' },
  dashboard: 'Dashboard',
  shipments: 'Shipments',
  newShipment: 'New Shipment',
  scanner: 'Scanner',
  quoteRequests: 'Quote Requests',
  messages: 'Messages',
  payments: 'Payments',
  documents: 'Documents',
  settings: 'Settings',
  switchToPublicCustomerView: 'Switch to public customer view',
  viewPublicWebsite: 'View Public Website',
  searchTrackingQuoteIdCustomer: 'Search tracking, quote ID, customer...',
  clearSearchQuery: 'Clear search query',
  keyboardShortcutCtrlKOr: 'Keyboard shortcut: Ctrl+K or ⌘K',
  operationalAlerts: 'Operational Alerts',
  unreadItems: 'unread items',
  newBadge: (n: number) => `${n} NEW`,
  toReview: (n: number) => `${n} to review`,
  newProofs: (n: number) => (n === 1 ? 'New payment proof' : 'New payment proofs'),
  proofsWaiting: (n: number) => (n === 1 ? '1 proof of payment is waiting for review.' : `${n} proofs of payment are waiting for review.`),
  allCorridorsOperatingNominally: 'All corridors operating nominally',
  documentCenter: 'Document Center',
  views: {
    'operations-center': { title: 'Dashboard', category: 'Fleet Operations', description: 'Overview of active shipments, inbound quotes, and milestone checkpoints.' },
    'all-shipments': { title: 'Shipments', category: 'Fleet Operations', description: 'Master list of all shipments.' },
    'create-shipment': { title: 'New Shipment', category: 'Fleet Operations', description: 'Book a new shipment and generate documentation.' },
    'tracking-events': { title: 'Scanner', category: 'Fleet Operations', description: 'Log milestone events and update statuses.' },
    'quote-requests': { title: 'Quote Requests', category: 'Commercial Tariffs', description: 'Review and certify customer quote requests.' },
    'messages': { title: 'Messages', category: 'Commercial Tariffs', description: 'Messages sent from the Contact page.' },
    'payments': { title: 'Payments', category: 'Commercial Tariffs', description: 'Proofs of payment sent from the track page.' },
    'dispatch': { title: 'Dispatch', category: 'Delivery', description: 'Delivery jobs, couriers on the map, assigning and prices.' },
    'tariffs': { title: 'Tariffs', category: 'Delivery', description: 'Delivery cities, areas, rates and average speeds.' },
    'couriers': { title: 'Couriers', category: 'Delivery', description: 'Riders and drivers: accounts, vehicles and photos.' },
    'cash': { title: 'Cash & Mobile Money', category: 'Delivery', description: 'Courier balances, handovers and mobile money to confirm, daily report.' },
    'document-center': { title: 'Documents', category: 'Compliance & Governance', description: 'Bills of Lading, Proof of Delivery, and shipping labels.' },
    'blog': { title: 'Blog', category: 'Content', description: 'Write, review and publish articles.' },
    'settings': { title: 'Settings', category: 'Compliance & Governance', description: 'Carrier configuration and system preferences.' },
    'users': { title: 'Users', category: 'Administration', description: 'Staff accounts, their roles and sign-in.' },
    'roles': { title: 'Roles', category: 'Administration', description: 'Roles and the permissions they grant.' },
    'audit': { title: 'Audit log', category: 'Administration', description: 'Who changed what, and when.' },
    'account': { title: 'My account', category: 'Account', description: 'Your name, language and password.' },
  } as Record<AdminViewType, ViewMeta>,
};

export const ADMIN_LAYOUT_TEXT = consoleText('adminLayout', ADMIN_LAYOUT_TEXT_EN);
