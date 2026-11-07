// The public route table (I18N_SPEC §2). One entry per page, with its English and French path.
// DOM-free: the server imports it to decide which paths answer 200 with index.html.
// No imports, so the server's NodeNext build can load it as-is.
//
// Page components and per-page meta stay in App.tsx for now; the table only knows URLs.
// French paths resolve to the same pages, rendered in English until the i18n layer (task D.3).

export type Lang = 'en' | 'fr';

export type RouteId =
  | 'home'
  | 'services'
  | 'local-delivery'
  | 'track'
  | 'quote'
  | 'ship'
  | 'about'
  | 'contact'
  | 'help'
  | 'locations'
  | 'legal'
  | 'blog';

export interface RouteDef {
  id: RouteId;
  en: string;
  fr: string;
  /** Takes one optional sub-path segment: /track/TX7K2M9P, /services/air, /legal/privacy. */
  param?: boolean;
  /**
   * false while the page doesn't exist yet: the paths are reserved (for the language switch
   * and the server) but answer 404. Local delivery booking goes live with G.6, the blog with F.3.
   */
  live?: boolean;
}

export const ROUTES: readonly RouteDef[] = [
  { id: 'home', en: '/', fr: '/fr/' },
  { id: 'services', en: '/services', fr: '/fr/services', param: true },
  { id: 'local-delivery', en: '/local-delivery', fr: '/fr/livraison-locale', live: false },
  { id: 'track', en: '/track', fr: '/fr/suivi', param: true },
  { id: 'quote', en: '/quote', fr: '/fr/devis', param: true },
  { id: 'ship', en: '/ship', fr: '/fr/expedier' },
  { id: 'about', en: '/about', fr: '/fr/a-propos' },
  { id: 'contact', en: '/contact', fr: '/fr/contact' },
  { id: 'help', en: '/help', fr: '/fr/aide' },
  { id: 'locations', en: '/locations', fr: '/fr/reseau' },
  { id: 'legal', en: '/legal', fr: '/fr/mentions-legales', param: true },
  { id: 'blog', en: '/blog', fr: '/fr/blog', param: true, live: false },
];

export interface RouteMatch {
  id: RouteId;
  lang: Lang;
  /** Decoded sub-path segment, when the route takes one and the URL has one. */
  param?: string;
  /** The canonical path for this match (what pagePath builds). Differs only by a trailing slash, /fr or /index.html. */
  canonical: string;
}

// One path segment: tracking IDs (TX7K2M9P, TX7K2M9P-01), quote IDs (QR-2026-00001), tier and
// policy ids, blog slugs. Anything else is not a page.
const PARAM_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,99}$/;

function routePath(route: RouteDef, lang: Lang): string {
  return lang === 'fr' ? route.fr : route.en;
}

/** Path for a route id (and optional sub-path segment) in a language. */
export function buildPath(id: RouteId, param?: string, lang: Lang = 'en'): string {
  const route = ROUTES.find((r) => r.id === id);
  if (!route) return lang === 'fr' ? '/fr/' : '/';
  const base = routePath(route, lang);
  if (!param || !route.param) return base;
  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(param)}`;
}

/**
 * Path for one of App.tsx's page names, as `onNavigate(page, param)` uses them. Only some pages
 * carry their parameter in the URL: a quote's service preselection and a contact gateway code
 * are in-page state, as they were with hash routes.
 */
export function pagePath(page: string, param?: string, lang: Lang = 'en'): string {
  switch (page) {
    case 'track-result':
      return buildPath('track', param, lang);
    case 'quote-result':
      return buildPath('quote', param, lang);
    case 'services':
    case 'legal':
    case 'blog':
      return buildPath(page, param, lang);
    default: {
      const route = ROUTES.find((r) => r.id === page);
      return route ? routePath(route, lang) : buildPath('home', undefined, lang);
    }
  }
}

/** The page at a pathname, or null (unknown path, or a route that isn't live yet). */
export function matchPath(pathname: string): RouteMatch | null {
  if (pathname === '/' || pathname === '/index.html') {
    return { id: 'home', lang: 'en', canonical: '/' };
  }
  if (pathname === '/fr' || pathname === '/fr/') {
    return { id: 'home', lang: 'fr', canonical: '/fr/' };
  }
  const trimmed = pathname.replace(/\/+$/, '');
  for (const route of ROUTES) {
    if (route.id === 'home' || route.live === false) continue;
    for (const lang of ['en', 'fr'] as const) {
      const base = routePath(route, lang);
      if (trimmed === base) return { id: route.id, lang, canonical: base };
      if (!route.param || !trimmed.startsWith(`${base}/`)) continue;
      const rest = trimmed.slice(base.length + 1);
      let param: string;
      try {
        param = decodeURIComponent(rest);
      } catch {
        return null;
      }
      if (!PARAM_RE.test(param)) return null;
      return { id: route.id, lang, param, canonical: buildPath(route.id, param, lang) };
    }
  }
  return null;
}

/**
 * Path form of a legacy hash URL (`#/track/TX7K2M9P` → `/track/TX7K2M9P`), or null when the
 * hash isn't a page link. `#/admin` is left alone (the caller decides: localhost keeps it).
 */
export function legacyHashToPath(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const [page = '', sub] = hash.slice(2).split(/[?#]/)[0].split('/');
  if (page === '') return '/';
  if (page === 'admin') return null;
  if (page === 'track' || page === 'quote') {
    return sub ? pagePath(`${page}-result`, safeDecode(sub)) : pagePath(page);
  }
  const route = ROUTES.find((r) => r.id === page && r.id !== 'home' && r.live !== false);
  if (!route) return '/';
  return route.param && sub ? buildPath(route.id, safeDecode(sub)) : route.en;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Language of any path, known or not: the /fr/ tree is French (so is its 404 page). */
export function langOfPath(pathname: string): Lang {
  return pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en';
}

/**
 * The same page in the other language, for the language switch (I18N_SPEC §2). Keeps the
 * sub-path segment (tracking ID, quote ID, service tier, policy tab). An unknown path maps to
 * the other language's home page.
 */
export function alternatePath(pathname: string, target: Lang): string {
  const match = matchPath(pathname);
  if (!match) return buildPath('home', undefined, target);
  return buildPath(match.id, match.param, target);
}
