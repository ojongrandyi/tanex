// English master, area "common": header, footer, language switch and suggestion, API errors
// (CONTENT §1.2, §1.3, §1.4). In the main bundle. Brand values (name, phones, email, addresses,
// hours) come from src/config/brand.ts and are passed in as {variables}.
import type { PublicErrorCode } from '../../shared/apiErrors';

const errors = {
  BAD_REQUEST: "Some details aren't right. Check them and try again.",
  AUTH_REQUIRED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do this.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: 'This was changed in the meantime. Refresh the page and try again.',
  PAYLOAD_TOO_LARGE: 'The file is too large.',
  UNSUPPORTED_MEDIA_TYPE: "This request couldn't be read. Refresh the page and try again.",
  RATE_LIMITED: 'Too many attempts. Please wait a while and try again.',
  SERVER_ERROR: 'Something went wrong on our side. Please try again.',
  NETWORK: "We couldn't reach our server. Check your connection and try again.",
  MALFORMED_BODY: "This request couldn't be read. Refresh the page and try again.",
  INVALID_TRACKING_ID: 'Tracking IDs start with TX and are 8 characters long, e.g. TX7K2M9P.',
  SHIPMENT_NOT_FOUND: "We couldn't find a shipment with this ID. Check the characters and try again.",
  QUOTE_NOT_FOUND: "We couldn't find a quote with this reference.",
  NO_PAYMENT_REQUEST: 'This shipment has no payment request.',
  NOT_ACCEPTING: 'This payment is no longer waiting for a proof. Refresh the page to see its current status.',
  TOO_MANY_OPEN: 'We already have proofs waiting for review for this payment. Our team will check them first.',
  VALIDATION_FAILED: 'Some details need fixing.',
  MISSING_FIELDS: 'Name and message are required.',
  CONTACT_REQUIRED: 'Please enter an email address or a phone number with its country code.',
  INVALID_EMAIL: 'Please enter a valid email address.',
} satisfies Record<PublicErrorCode, string>;

const common = {
  skipLink: 'Skip to main content',
  homeLabel: '{company} home',
  header: {
    navLabel: 'Main',
    home: 'Home',
    track: 'Track',
    services: 'Services',
    ship: 'Ship',
    network: 'Network',
    about: 'About',
    blog: 'Blog',
    contact: 'Contact',
    quote: 'Get a Quote',
    allServices: 'All services',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menu: 'Menu',
    submenu: '{name} menu',
    utilityLabel: 'Contact details',
    open: 'Open {hours}',
    cities: 'Buea · Douala',
    needHelp: 'Need help?',
  },
  // CONTENT §1.2 Services menu, also the footer's Services column.
  services: {
    air: 'Air freight',
    maritime: 'Maritime freight',
    rail: 'Rail freight',
    road: 'Road freight',
    warehousing: 'Warehousing',
    localDelivery: 'Local delivery',
  },
  ship: {
    bookShipment: 'Book a shipment',
  },
  language: {
    label: 'Language',
    en: 'EN',
    fr: 'FR',
    enName: 'English',
    frName: 'Français',
  },
  // Offered on the English home page to a French browser (I18N_SPEC §3), always shown in the
  // language it suggests: the French text is what visitors see; the English one is its pair.
  suggest: {
    text: 'This site is also available in English.',
    action: 'View the site in English',
    dismiss: 'Close',
  },
  footer: {
    description:
      'Bike delivery across town, trucks between cities, and air, sea, rail and road freight to the world, with one tracking ID from the first door to the last.',
    trust: {
      world: { title: 'Door to world.', body: 'Across town, across Cameroon, across the world.' },
      live: { title: 'Live tracking.', body: 'Follow your rider on the map in town.' },
      photo: { title: 'Photo proof.', body: 'Every delivery recorded with a photo and a name.' },
      languages: { title: 'English & French.', body: 'Our team serves you in both.' },
    },
    columns: {
      services: 'Services',
      company: 'Company',
      support: 'Support',
      legal: 'Legal',
    },
    links: {
      about: 'About TanEx',
      network: 'Our network',
      contact: 'Contact',
      track: 'Track a shipment',
      help: 'Help centre',
      quote: 'Get a Quote',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      shippingTerms: 'Shipping Terms',
      cookies: 'Cookie Policy',
      accessibility: 'Accessibility',
    },
    officesTitle: 'Offices',
    headOffice: 'Buea (head office)',
    call: 'Call',
    open: 'Open {hours}',
    social: 'Social media',
    copyright: '© {year} {legalName}. All rights reserved.',
  },
  // CONTENT §6.2: shown while a tracking lookup runs (outside any page, so it lives in common).
  trackingLoading: {
    locating: 'Locating your shipment…',
    scans: 'Checking the latest scans…',
    route: 'Plotting the route…',
  },
  errors,
};

export default common;
export type CommonMessages = typeof common;
