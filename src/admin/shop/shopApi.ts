// Console shop API client (server/routes/shopAdmin.ts, docs/SHOP_SPEC.md §14). Console-only:
// imported from the lazy Shop chunk, never from public pages. M.2: pictures. M.3: products,
// review, stock and categories.
import { fetchApi, handleResponse } from '../../services/api';
import type { ShopImageSlotKey } from '../../shared/shopImages';
import type { ProductStatus } from '../../shared/shopProduct';
import type { DocNode } from '../blog/blogApi';

const BASE = '/api/admin/shop';

export interface ShopMedia {
  id: string;
  urls: Record<ShopImageSlotKey, string>;
  bytesTotal: number;
  createdAt: number;
}

export interface ProductImage extends ShopMedia { mediaId: string; altEn: string | null; altFr: string | null }

export interface ProductSummary {
  id: string;
  productCode: string;
  nameEn: string;
  nameFr: string | null;
  price: number;
  salePrice: number | null;
  currency: string;
  stockQty: number;
  lowStockAt: number | null;
  status: ProductStatus;
  isFeatured: boolean;
  hasPending: boolean;
  categoryIds: string[];
  thumbnail: string | null;
  updatedAt: number;
}

/** The fields the editor sends (all optional on update). */
export interface ProductInput {
  nameEn?: string; nameFr?: string | null; shortEn?: string | null; shortFr?: string | null;
  slugEn?: string; slugFr?: string;
  descriptionEn?: DocNode | null; descriptionFr?: DocNode | null;
  price?: number; salePrice?: number | null; lowStockAt?: number | null; maxPerOrder?: number | null;
  sizeClass?: string; weightKg?: number | null; isFeatured?: boolean; sortOrder?: number;
  seoTitleEn?: string | null; seoTitleFr?: string | null; seoDescriptionEn?: string | null; seoDescriptionFr?: string | null;
  categoryIds?: string[];
  images?: { mediaId: string; altEn: string | null; altFr: string | null }[];
}

export interface Product extends ProductSummary {
  slugEn: string; slugFr: string; shortEn: string | null; shortFr: string | null;
  descriptionEn: DocNode | null; descriptionFr: DocNode | null;
  maxPerOrder: number | null; sizeClass: string; weightKg: number | null; sortOrder: number;
  seoTitleEn: string | null; seoTitleFr: string | null; seoDescriptionEn: string | null; seoDescriptionFr: string | null;
  images: ProductImage[];
  pending: { changes: ProductInput; images?: ShopMedia[]; by: string | null; at: number | null } | null;
  reviewNote: string | null;
  createdAt: number; createdBy: string | null;
  publishedAt: number | null; publishedBy: string | null; updatedBy: string | null;
}

export interface StockMove {
  id: string; delta: number; reason: string; note: string | null; by: string | null;
  orderNumber: string | null; stockAfter: number; at: number;
}

export interface ShopCategory {
  id: string; parentId: string | null; nameEn: string; nameFr: string; slugEn: string; slugFr: string;
  descriptionEn: string | null; descriptionFr: string | null; image: ShopMedia | null;
  isVisible: boolean; sortOrder: number; productCount: number;
}

export type CategoryInput = Partial<Pick<ShopCategory, 'nameEn' | 'nameFr' | 'slugEn' | 'slugFr' | 'descriptionEn' | 'descriptionFr' | 'parentId' | 'isVisible' | 'sortOrder'>>
  & { imageMediaId?: string | null };

/** Error from the shop API, with the field the server refused and, for publishing, what is missing. */
export interface ShopApiError extends Error { status?: number; code?: string; field?: string; missing?: string[] }

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: method === 'GET' ? 'no-store' : undefined,
  };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetchApi(path, init);
  const copy = res.clone();
  try {
    return await handleResponse<T>(res);
  } catch (err) {
    const body = await copy.json().catch(() => null);
    if (body && err instanceof Error) {
      const e = err as ShopApiError;
      if (typeof body.field === 'string') e.field = body.field;
      if (Array.isArray(body.missing)) e.missing = body.missing;
    }
    throw err;
  }
}

const id = encodeURIComponent;

export const shopApi = {
  /** The five files made by the crop step (squareImage.ts), base64. */
  uploadMedia: (files: Record<ShopImageSlotKey, string>) => call<ShopMedia>(`${BASE}/media`, json('POST', { files })),
  deleteMedia: (mediaId: string) => call<unknown>(`${BASE}/media/${id(mediaId)}`, json('DELETE')),

  async listProducts(q: { status?: string; category?: string; stock?: string; q?: string }): Promise<{ data: ProductSummary[]; lowStockAt: number }> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) params.set(k, v);
    const res = await fetchApi(`${BASE}/products?${params}`, json('GET'));
    const body = await res.clone().json().catch(() => null);
    const data = await handleResponse<ProductSummary[]>(res);
    return { data, lowStockAt: typeof body?.lowStockAt === 'number' ? body.lowStockAt : 3 };
  },
  getProduct: (productId: string) => call<Product>(`${BASE}/products/${id(productId)}`, json('GET')),
  createProduct: (input: ProductInput & { stockQty: number }) => call<Product>(`${BASE}/products`, json('POST', input)),
  async updateProduct(productId: string, input: ProductInput): Promise<{ data: Product; mode: 'saved' | 'proposed' }> {
    const res = await fetchApi(`${BASE}/products/${id(productId)}`, json('PUT', input));
    const copy = res.clone();
    try {
      const data = await handleResponse<Product>(res);
      const body = await copy.json().catch(() => null);
      return { data, mode: body?.mode === 'proposed' ? 'proposed' : 'saved' };
    } catch (err) {
      const body = await copy.json().catch(() => null);
      if (body && err instanceof Error && typeof body.field === 'string') (err as ShopApiError).field = body.field;
      throw err;
    }
  },
  setStatus: (productId: string, status: ProductStatus, note?: string) =>
    call<Product>(`${BASE}/products/${id(productId)}/status`, json('POST', { status, note })),
  approvePending: (productId: string) => call<Product>(`${BASE}/products/${id(productId)}/pending/approve`, json('POST', {})),
  rejectPending: (productId: string, note: string) => call<Product>(`${BASE}/products/${id(productId)}/pending/reject`, json('POST', { note })),
  deleteProduct: (productId: string) => call<unknown>(`${BASE}/products/${id(productId)}`, json('DELETE')),
  adjustStock: (productId: string, body: { mode: 'set' | 'add'; quantity: number; reason: string; note?: string }) =>
    call<Product>(`${BASE}/products/${id(productId)}/stock`, json('POST', body)),
  stockMoves: (productId: string) => call<StockMove[]>(`${BASE}/products/${id(productId)}/stock-moves`, json('GET')),

  listCategories: () => call<ShopCategory[]>(`${BASE}/categories`, json('GET')),
  createCategory: (input: CategoryInput) => call<ShopCategory>(`${BASE}/categories`, json('POST', input)),
  updateCategory: (categoryId: string, input: CategoryInput) => call<ShopCategory>(`${BASE}/categories/${id(categoryId)}`, json('PUT', input)),
  deleteCategory: (categoryId: string) => call<unknown>(`${BASE}/categories/${id(categoryId)}`, json('DELETE')),
  orderCategories: (ids: string[]) => call<unknown>(`${BASE}/categories-order`, json('PUT', { ids })),
};
