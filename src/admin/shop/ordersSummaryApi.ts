// The shop orders numbers for the console shell (badge, bell, dashboard tiles), kept out of the
// lazy Shop chunk: GET /api/admin/shop/orders-summary (orders.view, no customer data).
import { fetchApi, handleResponse } from '../../services/api';

export interface ShopOrdersSummary {
  newOrders: number;
  feeToConfirm: number;
  ready: number;
  outForDelivery: number;
  deliveryProblems: number;
  unpaidCompleted: number;
  lowStock: number;
  latestNewAt: number | null;
}

export async function fetchShopOrdersSummary(): Promise<ShopOrdersSummary> {
  const res = await fetchApi('/api/admin/shop/orders-summary', { credentials: 'include', cache: 'no-store' });
  return handleResponse<ShopOrdersSummary>(res);
}

/** #order=TX-ORD-123456 from the staff alert email's button, or null. */
export function orderFromHash(hash: string): string | null {
  const m = /^#order=(TX-ORD-\d{6})$/i.exec(hash);
  return m ? m[1].toUpperCase() : null;
}
