// Public local-delivery API (DISPATCH_SPEC §8, §11; G.6): the active cities and areas, the admin
// price for a trip, and the booking itself. Errors carry `code` (handleResponse).
import { fetchApi, handleResponse } from './api';
import type { SizeClass } from '../shared/localPricing';

export interface PublicArea {
  id: string;
  name: string;
  aliases: string;
  lat: number | null;
  lng: number | null;
}

export interface PublicCity {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  zones: PublicArea[];
}

export type LocalQuote =
  | { priced: true; price: number; currency: string }
  | { priced: false; reason: 'NO_RATE' | 'NO_EXPRESS_RATE' };

export interface BookingPlace {
  zoneId: string | null;
  landmark: string;
  contactName: string;
  contactPhone: string;
  lat?: number;
  lng?: number;
}

export interface BookingRequest {
  cityId: string;
  pickup: BookingPlace;
  dropoff: BookingPlace;
  sizeClass: SizeClass;
  itemDescription: string | null;
  isExpress: boolean;
  payer: 'SENDER' | 'RECIPIENT';
  codAmount: number | null;
  scheduledForTs: number | null;
  email: string | null;
  locale: 'en' | 'fr';
}

export interface BookingResult {
  trackingNumber: string;
  priced: boolean;
  price: number | null;
  currency: string;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const localDeliveryApi = {
  async areas(): Promise<PublicCity[]> {
    return handleResponse<PublicCity[]>(await fetchApi('/api/tariffs/areas'));
  },
  async quote(q: { cityId: string; pickupZoneId: string | null; dropoffZoneId: string | null; sizeClass: SizeClass; isExpress: boolean }): Promise<LocalQuote> {
    return handleResponse<LocalQuote>(await fetchApi('/api/local-delivery/quote', json(q)));
  },
  async book(b: BookingRequest): Promise<BookingResult> {
    return handleResponse<BookingResult>(await fetchApi('/api/local-delivery', json(b)));
  },
};
