// Public shop API client (server/routes/publicShop.ts, SHOP_SPEC §14). Every call answers 404 while
// the shop is switched off; the shop pages then show the "page not found" page.
import { fetchApi, handleResponse } from './api';
import type { Locale } from '../i18n/types';
import type { PublicStock, ShopSort } from '../shared/shopPublic';
import type { ShopImageSlotKey } from '../shared/shopImages';

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
};
