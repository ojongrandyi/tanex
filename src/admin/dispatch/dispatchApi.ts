// Tariffs and couriers API client (server/routes/tariffs.ts, server/routes/couriers.ts). Console-only:
// imported from the lazy dispatch chunk, never from public pages.
import { fetchApi, handleResponse, type StaffUser } from '../../services/api';
import type { VehicleType } from '../../shared/dispatchStatus';
import type { SizeClass } from '../../shared/localPricing';
import type { DispatchSettings } from '../../shared/dispatchSettings';

export interface DeliveryCity { id: string; name: string; countryIso: string; lat: number | null; lng: number | null; timeZone: string; isActive: boolean }
export interface DeliveryZone { id: string; cityId: string; name: string; aliases: string; lat: number | null; lng: number | null; isActive: boolean; sortOrder: number }
export interface ZoneRateRow { id: string; cityId: string; fromZoneId: string | null; toZoneId: string | null; sizeClass: string; price: number; currency: string; expressSurcharge: number | null }
export interface IntercityRateRow { id: string; fromCityId: string; toCityId: string; maxWeightKg: number; price: number; currency: string }

export interface TariffState {
  cities: DeliveryCity[];
  zones: DeliveryZone[];
  rates: ZoneRateRow[];
  intercity: IntercityRateRow[];
  settings: DispatchSettings;
}

export interface Courier {
  userId: string;
  user: StaffUser;
  vehicleType: VehicleType;
  plateNumber: string | null;
  homeCityId: string | null;
  homeCityName: string | null;
  publicFirstName: string;
  showPhotoPublicly: boolean;
  photoUrl: string | null;
  notes: string | null;
  isOnDuty: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CourierInput {
  displayName?: string;
  phone?: string;
  email?: string;
  locale?: 'en' | 'fr';
  status?: 'ACTIVE' | 'DISABLED';
  vehicleType?: VehicleType;
  plateNumber?: string;
  homeCityId?: string | null;
  publicFirstName?: string;
  showPhotoPublicly?: boolean;
  notes?: string;
  /** Data URL or base64 (create only; use setCourierPhoto afterwards). */
  photo?: string;
}

export type PinInput = { lat: number | null; lng: number | null };

const T = '/api/tariffs';
const C = '/api/couriers';

async function send<R>(method: string, url: string, body?: unknown): Promise<R> {
  const res = await fetchApi(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleResponse<R>(res);
}

export const dispatchApi = {
  tariffs: () => send<TariffState>('GET', T),
  createCity: (input: { name: string } & Partial<PinInput>) => send<TariffState>('POST', `${T}/cities`, input),
  updateCity: (id: string, input: Partial<{ name: string; isActive: boolean } & PinInput>) =>
    send<TariffState>('PATCH', `${T}/cities/${encodeURIComponent(id)}`, input),
  deleteCity: (id: string) => send<TariffState>('DELETE', `${T}/cities/${encodeURIComponent(id)}`),
  createZone: (cityId: string, input: { name: string; aliases?: string } & Partial<PinInput>) =>
    send<TariffState>('POST', `${T}/cities/${encodeURIComponent(cityId)}/zones`, input),
  updateZone: (id: string, input: Partial<{ name: string; aliases: string; isActive: boolean } & PinInput>) =>
    send<TariffState>('PATCH', `${T}/zones/${encodeURIComponent(id)}`, input),
  deleteZone: (id: string) => send<TariffState>('DELETE', `${T}/zones/${encodeURIComponent(id)}`),
  reorderZones: (cityId: string, zoneIds: string[]) =>
    send<TariffState>('PUT', `${T}/cities/${encodeURIComponent(cityId)}/zone-order`, { zoneIds }),
  importSuggested: (cities: string[]) =>
    send<TariffState & { imported: { cities: number; areas: number } }>('POST', `${T}/import-suggested`, { cities }),
  saveRates: (cityId: string, sizeClass: SizeClass, currency: string,
    rates: { fromZoneId: string | null; toZoneId: string | null; price: number; expressSurcharge: number | null }[]) =>
    send<TariffState>('PUT', `${T}/cities/${encodeURIComponent(cityId)}/rates`, { sizeClass, currency, rates }),
  saveIntercity: (fromCityId: string, toCityId: string, currency: string, bands: { maxWeightKg: number; price: number }[]) =>
    send<TariffState>('PUT', `${T}/intercity`, { fromCityId, toCityId, currency, bands }),
  saveSettings: (settings: DispatchSettings) => send<TariffState>('PUT', `${T}/settings`, settings),

  /** Active cities only (the public booking list), for the courier form's home city. */
  activeCities: () => send<{ id: string; name: string }[]>('GET', `${T}/areas`),
  couriers: () => send<Courier[]>('GET', C),
  createCourier: (input: CourierInput) =>
    send<{ courier: Courier; user: StaffUser; tempPassword: string }>('POST', C, input),
  updateCourier: (id: string, input: CourierInput) => send<Courier>('PATCH', `${C}/${encodeURIComponent(id)}`, input),
  setCourierPhoto: (id: string, image: string) => send<Courier>('POST', `${C}/${encodeURIComponent(id)}/photo`, { image }),
  removeCourierPhoto: (id: string) => send<Courier>('DELETE', `${C}/${encodeURIComponent(id)}/photo`),
  resetCourierPassword: (id: string) =>
    send<{ courier: Courier; user: StaffUser; tempPassword: string }>('POST', `${C}/${encodeURIComponent(id)}/reset-password`, {}),
};
