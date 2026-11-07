// World reference hubs for the tracking engine: offline geocoding, route drawing (nearest air or
// ocean hub to an address) and time zones. Pure geography (major airports and ports), not a list
// of places TanEx markets; the marketed network is src/data/gateways.ts (CONTENT §9). Keeping the
// two apart means editing the public network never changes how tracking routes are drawn.
// DOM-free: shared with the server.
import type { TransportMode } from './gateways.js';

export interface RoutingHub {
  code: string;
  city: string;
  country: string;
  iso: string;
  lat: number;
  lng: number;
  timeZone: string;
  modes: TransportMode[];
}

// Each hub's modes are what the place itself handles (an airport is Air, a port is Ocean). This is
// exactly the table the engine used before the TanEx network, so routes, offline geocoding and
// time zones of existing shipments don't change. Adding Douala and African hubs is a separate,
// tested engine change (tracker follow-up).
export const ROUTING_HUBS: RoutingHub[] = [
  { code: 'LHR', city: 'London', country: 'United Kingdom', iso: 'GB', lat: 51.4700, lng: -0.4543, timeZone: 'Europe/London', modes: ['Air', 'Road'] },
  { code: 'RTM', city: 'Rotterdam', country: 'Netherlands', iso: 'NL', lat: 51.9496, lng: 4.1453, timeZone: 'Europe/Amsterdam', modes: ['Ocean', 'Road'] },
  { code: 'FRA', city: 'Frankfurt', country: 'Germany', iso: 'DE', lat: 50.0379, lng: 8.5622, timeZone: 'Europe/Berlin', modes: ['Air', 'Road'] },
  { code: 'DXB', city: 'Dubai', country: 'United Arab Emirates', iso: 'AE', lat: 25.2532, lng: 55.3657, timeZone: 'Asia/Dubai', modes: ['Air', 'Ocean'] },
  { code: 'BOM', city: 'Mumbai', country: 'India', iso: 'IN', lat: 19.0896, lng: 72.8656, timeZone: 'Asia/Kolkata', modes: ['Air', 'Ocean'] },
  { code: 'SIN', city: 'Singapore', country: 'Singapore', iso: 'SG', lat: 1.3644, lng: 103.9915, timeZone: 'Asia/Singapore', modes: ['Air', 'Ocean'] },
  { code: 'HKG', city: 'Hong Kong', country: 'Hong Kong SAR', iso: 'HK', lat: 22.3080, lng: 113.9185, timeZone: 'Asia/Hong_Kong', modes: ['Air', 'Ocean'] },
  { code: 'PVG', city: 'Shanghai', country: 'China', iso: 'CN', lat: 31.1443, lng: 121.8083, timeZone: 'Asia/Shanghai', modes: ['Air', 'Ocean'] },
  { code: 'JFK', city: 'New York', country: 'United States', iso: 'US', lat: 40.6413, lng: -73.7781, timeZone: 'America/New_York', modes: ['Air', 'Road'] },
  { code: 'IAH', city: 'Houston', country: 'United States', iso: 'US', lat: 29.9902, lng: -95.3368, timeZone: 'America/Chicago', modes: ['Air', 'Ocean', 'Road'] },
  { code: 'LAX', city: 'Los Angeles', country: 'United States', iso: 'US', lat: 33.9416, lng: -118.4085, timeZone: 'America/Los_Angeles', modes: ['Air', 'Ocean', 'Road'] },
  { code: 'YYZ', city: 'Toronto', country: 'Canada', iso: 'CA', lat: 43.6777, lng: -79.6248, timeZone: 'America/Toronto', modes: ['Air', 'Road'] },
  { code: 'GRU', city: 'São Paulo', country: 'Brazil', iso: 'BR', lat: -23.4356, lng: -46.4731, timeZone: 'America/Sao_Paulo', modes: ['Air', 'Ocean'] },
  { code: 'SYD', city: 'Sydney', country: 'Australia', iso: 'AU', lat: -33.9399, lng: 151.1753, timeZone: 'Australia/Sydney', modes: ['Air', 'Ocean'] },
  { code: 'NRT', city: 'Tokyo', country: 'Japan', iso: 'JP', lat: 35.7720, lng: 140.3929, timeZone: 'Asia/Tokyo', modes: ['Air', 'Ocean'] },
  { code: 'ICN', city: 'Seoul', country: 'South Korea', iso: 'KR', lat: 37.4602, lng: 126.4407, timeZone: 'Asia/Seoul', modes: ['Air', 'Ocean'] },
  { code: 'ORD', city: 'Chicago', country: 'United States', iso: 'US', lat: 41.9742, lng: -87.9073, timeZone: 'America/Chicago', modes: ['Air', 'Road'] },
  { code: 'MIA', city: 'Miami', country: 'United States', iso: 'US', lat: 25.7959, lng: -80.2870, timeZone: 'America/New_York', modes: ['Air', 'Ocean', 'Road'] },
];

export function getRoutingHub(code: string): RoutingHub | undefined {
  return ROUTING_HUBS.find((h) => h.code === code);
}
