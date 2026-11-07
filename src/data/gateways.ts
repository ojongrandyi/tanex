// The TanEx network (docs/CONTENT.md §9, owner to confirm, tracker #105). Two kinds of points:
// - TanEx locations: where TanEx has an office or delivers by bike (Buea, Douala, Limbe).
// - Gateways: trade hubs TanEx ships to from Douala. These are not TanEx-owned facilities.
// Coordinates of the two offices are city-level until the owner confirms the exact pins.
// DOM-free: the server imports getGateway() for contact messages.

export type TransportMode = 'Air' | 'Ocean' | 'Road';

export type GatewayRegion = 'Africa' | 'Europe' | 'Middle East' | 'Asia' | 'Americas';

/** What a TanEx location is for (CONTENT §9 "Role"). */
export type LocationRole = 'head-office' | 'office' | 'bike' | 'gateway';

export interface Gateway {
  code: string;
  /** English display name, e.g. "Paris". */
  name: string;
  /** French display name (CONTENT_FR §9). */
  nameFr: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2; the country name in another language comes from Intl.DisplayNames. */
  iso: string;
  lat: number;
  lng: number;
  timeZone: string;
  modes: TransportMode[];
  region: GatewayRegion;
  /** 'tanex' = TanEx office or delivery city; 'gateway' = trade hub served from Douala. */
  kind: 'tanex' | 'gateway';
  /** TanEx locations only. */
  roles?: LocationRole[];
}

/** Where TanEx operates (CONTENT §9, "TanEx locations"). */
export const TANEX_LOCATIONS: Gateway[] = [
  { code: 'BUE', name: 'Buea (head office)', nameFr: 'Buea (siège)', city: 'Buea', country: 'Cameroon', iso: 'CM', lat: 4.1530, lng: 9.2410, timeZone: 'Africa/Douala', modes: ['Road'], region: 'Africa', kind: 'tanex', roles: ['head-office', 'bike'] },
  { code: 'DLO', name: 'Douala office', nameFr: 'Douala (bureau)', city: 'Douala', country: 'Cameroon', iso: 'CM', lat: 4.0700, lng: 9.7700, timeZone: 'Africa/Douala', modes: ['Road'], region: 'Africa', kind: 'tanex', roles: ['office', 'bike'] },
  { code: 'LMB', name: 'Limbe', nameFr: 'Limbe', city: 'Limbe', country: 'Cameroon', iso: 'CM', lat: 4.0186, lng: 9.2043, timeZone: 'Africa/Douala', modes: ['Road'], region: 'Africa', kind: 'tanex', roles: ['bike'] },
  { code: 'DLA', name: 'Douala gateway (airport and port)', nameFr: "Douala (porte d'entrée aéroport et port)", city: 'Douala', country: 'Cameroon', iso: 'CM', lat: 4.0061, lng: 9.7195, timeZone: 'Africa/Douala', modes: ['Air', 'Ocean', 'Road'], region: 'Africa', kind: 'tanex', roles: ['gateway', 'bike'] },
];

/** Trade hubs served from Douala (CONTENT §9, "Gateways and lanes"). */
export const GATEWAYS: Gateway[] = [
  { code: 'CDG', name: 'Paris', nameFr: 'Paris', city: 'Paris', country: 'France', iso: 'FR', lat: 49.0097, lng: 2.5479, timeZone: 'Europe/Paris', modes: ['Air', 'Ocean'], region: 'Europe', kind: 'gateway' },
  { code: 'BRU', name: 'Brussels', nameFr: 'Bruxelles', city: 'Brussels', country: 'Belgium', iso: 'BE', lat: 50.9010, lng: 4.4844, timeZone: 'Europe/Brussels', modes: ['Air'], region: 'Europe', kind: 'gateway' },
  { code: 'LHR', name: 'London', nameFr: 'Londres', city: 'London', country: 'United Kingdom', iso: 'GB', lat: 51.4700, lng: -0.4543, timeZone: 'Europe/London', modes: ['Air'], region: 'Europe', kind: 'gateway' },
  { code: 'FRA', name: 'Frankfurt', nameFr: 'Francfort', city: 'Frankfurt', country: 'Germany', iso: 'DE', lat: 50.0379, lng: 8.5622, timeZone: 'Europe/Berlin', modes: ['Air'], region: 'Europe', kind: 'gateway' },
  { code: 'IST', name: 'Istanbul', nameFr: 'Istanbul', city: 'Istanbul', country: 'Türkiye', iso: 'TR', lat: 41.2753, lng: 28.7519, timeZone: 'Europe/Istanbul', modes: ['Air'], region: 'Europe', kind: 'gateway' },
  { code: 'DXB', name: 'Dubai', nameFr: 'Dubaï', city: 'Dubai', country: 'United Arab Emirates', iso: 'AE', lat: 25.2532, lng: 55.3657, timeZone: 'Asia/Dubai', modes: ['Air', 'Ocean'], region: 'Middle East', kind: 'gateway' },
  { code: 'CAN', name: 'Guangzhou', nameFr: 'Canton (Guangzhou)', city: 'Guangzhou', country: 'China', iso: 'CN', lat: 23.3924, lng: 113.2988, timeZone: 'Asia/Shanghai', modes: ['Air', 'Ocean'], region: 'Asia', kind: 'gateway' },
  { code: 'PVG', name: 'Shanghai', nameFr: 'Shanghai', city: 'Shanghai', country: 'China', iso: 'CN', lat: 31.1443, lng: 121.8083, timeZone: 'Asia/Shanghai', modes: ['Air', 'Ocean'], region: 'Asia', kind: 'gateway' },
  { code: 'LOS', name: 'Lagos', nameFr: 'Lagos', city: 'Lagos', country: 'Nigeria', iso: 'NG', lat: 6.5774, lng: 3.3212, timeZone: 'Africa/Lagos', modes: ['Air', 'Road'], region: 'Africa', kind: 'gateway' },
  { code: 'ABJ', name: 'Abidjan', nameFr: 'Abidjan', city: 'Abidjan', country: "Côte d'Ivoire", iso: 'CI', lat: 5.2614, lng: -3.9263, timeZone: 'Africa/Abidjan', modes: ['Air', 'Ocean'], region: 'Africa', kind: 'gateway' },
  { code: 'JNB', name: 'Johannesburg', nameFr: 'Johannesburg', city: 'Johannesburg', country: 'South Africa', iso: 'ZA', lat: -26.1337, lng: 28.2420, timeZone: 'Africa/Johannesburg', modes: ['Air'], region: 'Africa', kind: 'gateway' },
  { code: 'JFK', name: 'New York', nameFr: 'New York', city: 'New York', country: 'United States', iso: 'US', lat: 40.6413, lng: -73.7781, timeZone: 'America/New_York', modes: ['Air', 'Ocean'], region: 'Americas', kind: 'gateway' },
  { code: 'IAH', name: 'Houston', nameFr: 'Houston', city: 'Houston', country: 'United States', iso: 'US', lat: 29.9902, lng: -95.3368, timeZone: 'America/Chicago', modes: ['Air', 'Ocean'], region: 'Americas', kind: 'gateway' },
];

/** Every point on the network map: TanEx locations first, then the gateways. */
export const NETWORK_POINTS: Gateway[] = [...TANEX_LOCATIONS, ...GATEWAYS];

/** The Douala gateway every lane starts from. */
export const HUB_CODE = 'DLA';

// Trade lanes from Douala to every gateway, drawn as great-circle arcs (CONTENT §9).
export const TRADE_LANES: [string, string][] = GATEWAYS.map((g) => [HUB_CODE, g.code]);

export function getGateway(code: string): Gateway | undefined {
  return NETWORK_POINTS.find((g) => g.code === code);
}

/** Display name in a language. */
export function gatewayName(g: Gateway, lang: 'en' | 'fr'): string {
  return lang === 'fr' ? g.nameFr : g.name;
}

// Codes of every point with a direct lane to `code`.
export function getLanePartners(code: string): string[] {
  return TRADE_LANES.flatMap(([a, b]) => (a === code ? [b] : b === code ? [a] : []));
}

// Local wall-clock time at a gateway, e.g. { time: '14:05', offset: 'GMT+1' }.
export function formatGatewayTime(timeZone: string, now: Date = new Date()): { time: string; offset: string } {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  let offset = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' } as Intl.DateTimeFormatOptions).formatToParts(now);
    offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    // Older engines without 'shortOffset' just omit the offset.
  }
  return { time, offset };
}
