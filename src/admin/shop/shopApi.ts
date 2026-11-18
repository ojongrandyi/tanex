// Console shop API client (server/routes/shopAdmin.ts, docs/SHOP_SPEC.md §14). Console-only:
// imported from the lazy console chunk, never from public pages. M.2: pictures.
import { fetchApi, handleResponse } from '../../services/api';
import type { ShopImageSlotKey } from '../../shared/shopImages';

const BASE = '/api/admin/shop';

export interface ShopMedia {
  id: string;
  urls: Record<ShopImageSlotKey, string>;
  bytesTotal: number;
  createdAt: number;
}

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
  return handleResponse<T>(await fetchApi(path, init));
}

export const shopApi = {
  /** The five files made by the crop step (squareImage.ts), base64. */
  uploadMedia: (files: Record<ShopImageSlotKey, string>) => call<ShopMedia>(`${BASE}/media`, json('POST', { files })),
  deleteMedia: (id: string) => call<unknown>(`${BASE}/media/${encodeURIComponent(id)}`, json('DELETE')),
};
