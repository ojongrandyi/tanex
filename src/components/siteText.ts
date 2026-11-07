// Public header and footer copy (docs/CONTENT.md §1.2, §1.3). English only until the i18n
// foundation (tracker D.3) moves these into src/i18n/en.ts and fr.ts (French: CONTENT_FR §1.2,
// §1.3); kept in one object so that move is a straight copy. Brand values (name, phone, email,
// addresses, hours) come from src/config/brand.ts / admin Settings, never from here.

/** A link to an App.tsx page, with an optional param (service tier ID, legal section ID). */
export interface SiteLink {
  label: string;
  page: string;
  param?: string;
}

export const SITE_TEXT = {
  skipLink: 'Skip to main content',
  homeLabel: (company: string) => `${company} home`,
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
    // §1.2 menu under Services. Each item opens the Services page at that service (section ids
    // arrive with the Services page rebuild, E.2; until then the page opens at the top).
    servicesMenu: [
      { label: 'Air freight', page: 'services', param: 'air' },
      { label: 'Maritime freight', page: 'services', param: 'maritime' },
      { label: 'Rail freight', page: 'services', param: 'rail' },
      { label: 'Road freight', page: 'services', param: 'road' },
      { label: 'Warehousing', page: 'services', param: 'warehousing' },
      { label: 'Local delivery', page: 'services', param: 'local-delivery' },
    ] as SiteLink[],
    shipMenu: [
      { label: 'Book a shipment', page: 'ship' },
      // 'Book a bike delivery' joins with the local-delivery booking page (G.6).
    ] as SiteLink[],
    allServices: 'All services',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menu: 'Menu',
    submenu: (name: string) => `${name} menu`,
    utilityLabel: 'Contact details',
    open: (hours: string) => `Open ${hours}`,
    cities: 'Buea · Douala',
    needHelp: 'Need help?',
    // Language switch (§1.2 "EN | FR"): visible from C.3, active with D.3 (owner to confirm the hint).
    language: 'Language',
    english: 'EN',
    french: 'FR',
    englishName: 'English',
    frenchName: 'Français',
    frenchSoon: 'French version coming soon',
  },
  footer: {
    description:
      'Bike delivery across town, trucks between cities, and air, sea, rail and road freight to the world, with one tracking ID from the first door to the last.',
    trust: [
      { title: 'Door to world.', body: 'Across town, across Cameroon, across the world.' },
      { title: 'Live tracking.', body: 'Follow your rider on the map in town.' },
      { title: 'Photo proof.', body: 'Every delivery recorded with a photo and a name.' },
      { title: 'English & French.', body: 'Our team serves you in both.' },
    ],
    columns: [
      {
        title: 'Services',
        links: [
          { label: 'Air freight', page: 'services', param: 'air' },
          { label: 'Maritime freight', page: 'services', param: 'maritime' },
          { label: 'Rail freight', page: 'services', param: 'rail' },
          { label: 'Road freight', page: 'services', param: 'road' },
          { label: 'Warehousing', page: 'services', param: 'warehousing' },
          { label: 'Local delivery', page: 'services', param: 'local-delivery' },
        ],
      },
      {
        // 'Blog' joins with the public blog (F.3).
        title: 'Company',
        links: [
          { label: 'About TanEx', page: 'about' },
          { label: 'Our network', page: 'locations' },
          { label: 'Contact', page: 'contact' },
        ],
      },
      {
        // 'Book a bike delivery' joins with the local-delivery booking page (G.6).
        title: 'Support',
        links: [
          { label: 'Track a shipment', page: 'track' },
          { label: 'Help centre', page: 'help' },
          { label: 'Get a Quote', page: 'quote' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Privacy Policy', page: 'legal', param: 'privacy' },
          { label: 'Terms of Service', page: 'legal', param: 'terms' },
          { label: 'Shipping Terms', page: 'legal', param: 'shipping-terms' },
          { label: 'Cookie Policy', page: 'legal', param: 'cookies' },
          { label: 'Accessibility', page: 'legal', param: 'accessibility' },
        ],
      },
    ] as { title: string; links: SiteLink[] }[],
    officesTitle: 'Offices',
    headOffice: 'Buea (head office)',
    call: (phones: string) => `Call ${phones}`,
    open: (hours: string) => `Open ${hours}`,
    social: 'Social media',
    copyright: (year: number, legalName: string) => `© ${year} ${legalName}. All rights reserved.`,
  },
} as const;
