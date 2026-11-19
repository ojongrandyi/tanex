// Variables of the four shop order emails (SHOP_SPEC §12, CONTENT §17.7 / CONTENT_FR §17.7).
// Amounts arrive formatted with their currency; every visitor-typed value is already cleaned
// (one line, capped) by server/shop/orderEmails.ts.
import type { EmailItem } from '../layout.js';

export type FeeStatus = 'QUOTED' | 'TO_CONFIRM' | 'NONE';

export interface ShopOrderTotals {
  items: EmailItem[];
  subtotal: string;
  /** Formatted fee; null while it is to be confirmed. */
  fee: string | null;
  feeStatus: FeeStatus;
  total: string;
}

export interface ShopStaffAlertVars extends ShopOrderTotals {
  order: string;
  /** Number of pieces (sum of quantities). */
  count: number;
  customer: { name: string; phone: string; whatsapp: string; whatsappUrl: string | null; email: string | null };
  delivery:
    | { method: 'DELIVERY'; city: string; area: string | null; address: string }
    | { method: 'PICKUP'; office: string };
  payment: string;
  note: string | null;
  url: string;
}

export type ShopPaymentKey = 'CASH_ON_DELIVERY' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'PAY_AT_OFFICE';

export interface ShopOrderReceivedVars extends ShopOrderTotals {
  name: string;
  phone: string;
  order: string;
  payment: ShopPaymentKey;
  /** Formatted mobile money number for MTN MoMo / Orange Money, else null. */
  payNumber: string | null;
  returnsUrl: string;
}

export interface ShopOrderDispatchedVars {
  name: string;
  order: string;
  id: string;
  link: string;
}

export interface ShopOrderCancelledVars {
  order: string;
  reason: string;
  email: string;
  phone: string;
}
