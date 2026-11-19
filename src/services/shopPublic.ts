// Public shop API client (server/routes/publicShop.ts, SHOP_SPEC §14). Every call answers 404 while
// the shop is switched off; the shop pages then show the "page not found" page.
import { fetchApi, handleResponse } from './api';
import type { Locale } from '../i18n/types';
import type { PublicStock, ShopSort } from '../shared/shopPublic';
import type { ShopImageSlotKey } from '../shared/shopImages';
import type { DeliveryMethod, ShopPaymentMethod } from '../shared/shopOrderStatus';

export type ShopImageUrls = Record<ShopImageSlotKey, string>;

export interface ShopPicture {
  urls: ShopImageUrls;
  alt: string;
}

export interface PublicProductCard {
  id: string;
  code: string;
  slug: string;
  path: string;
  name: string;
  short: string;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: PublicStock;
  maxQty: number;
  image: ShopPicture | null;
}

export interface PublicShopCategory {
  slug: string;
  name: string;
  description: string;
  path: string;
  parentSlug: string | null;
  image: ShopImageUrls | null;
  productCount: number;
  paths: Record<Locale, string>;
}

export interface PublicProductList {
  data: PublicProductCard[];
  category: { slug: string; name: string; description: string; paths: Record<Locale, string> } | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicProduct extends PublicProductCard {
  descriptionHtml: string;
  images: ShopPicture[];
  categories: { slug: string; name: string; path: string }[];
  seoTitle: string;
  seoDescription: string;
  paths: Record<Locale, string>;
  related: PublicProductCard[];
}

export interface ProductListParams {
  category?: string;
  q?: string;
  sort?: ShopSort;
  inStock?: boolean;
  page?: number;
}

// ---- Cart and checkout (M.5) ----

export interface CheckedCartLine extends PublicProductCard {
  requested: number;
  qty: number;
  lineTotal: number;
}

export interface CartCheckResult {
  lines: CheckedCartLine[];
  removed: { id: string; name: string | null }[];
  subtotal: number;
  currency: string;
  options: { paymentMethods: ShopPaymentMethod[]; pickupOffices: string[] };
}

export type DeliveryFeeResult =
  | { status: 'NONE'; fee: 0; currency: string }
  | { status: 'QUOTED'; fee: number; currency: string }
  | { status: 'TO_CONFIRM'; fee: null; currency: string };

export interface OrderRequest {
  idempotencyKey: string;
  lines: { id: string; qty: number }[];
  seenPrices: Record<string, number>;
  name: string;
  phone: string;
  sameAsPhone: boolean;
  whatsapp: string;
  email: string;
  locale: Locale;
  deliveryMethod: DeliveryMethod;
  cityId: string | null;
  zoneId: string | null;
  address: string;
  pickupOffice: string | null;
  note: string;
  paymentMethod: ShopPaymentMethod;
  acceptTerms: boolean;
  /** Hidden field; people leave it empty. */
  website: string;
}

export interface PlacedOrder {
  orderNumber: string;
  firstName: string;
  items: { code: string; name: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee: number | null;
  deliveryFeeStatus: 'QUOTED' | 'TO_CONFIRM' | 'NONE';
  total: number;
  currency: string;
  deliveryMethod: DeliveryMethod;
  pickupOffice: string | null;
  paymentMethod: ShopPaymentMethod;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const BASE = '/api/shop';

export const shopPublicApi = {
  categories: async (locale: Locale): Promise<PublicShopCategory[]> =>
    handleResponse<PublicShopCategory[]>(await fetchApi(`${BASE}/categories?locale=${locale}`, { cache: 'no-cache' })),

  async products(locale: Locale, params: ProductListParams = {}): Promise<PublicProductList> {
    const qs = new URLSearchParams({ locale });
    if (params.category) qs.set('category', params.category);
    if (params.q) qs.set('q', params.q);
    if (params.sort) qs.set('sort', params.sort);
    if (params.inStock) qs.set('inStock', '1');
    if (params.page && params.page > 1) qs.set('page', String(params.page));
    // The page fields sit next to `data`, so read the whole body.
    const res = await fetchApi(`${BASE}/products?${qs}`, { cache: 'no-cache' });
    const body = await res.clone().json().catch(() => null);
    const data = await handleResponse<PublicProductCard[]>(res);
    return {
      data,
      category: body?.category ?? null,
      page: body?.page ?? params.page ?? 1,
      pageSize: body?.pageSize ?? 24,
      total: body?.total ?? data.length,
      totalPages: body?.totalPages ?? 1,
    };
  },

  product: async (locale: Locale, slug: string): Promise<PublicProduct> =>
    handleResponse<PublicProduct>(await fetchApi(`${BASE}/products/${encodeURIComponent(slug)}?locale=${locale}`, { cache: 'no-cache' })),

  checkCart: async (locale: Locale, lines: { id: string; qty: number }[]): Promise<CartCheckResult> =>
    handleResponse<CartCheckResult>(await fetchApi(`${BASE}/cart/check`, post({ locale, lines }))),

  deliveryFee: async (req: {
    lines: { id: string; qty: number }[]; deliveryMethod: DeliveryMethod; cityId: string | null; zoneId: string | null;
  }): Promise<DeliveryFeeResult> =>
    handleResponse<DeliveryFeeResult>(await fetchApi(`${BASE}/delivery-fee`, post(req))),

  placeOrder: async (order: OrderRequest): Promise<PlacedOrder> =>
    handleResponse<PlacedOrder>(await fetchApi(`${BASE}/orders`, post(order))),
};
