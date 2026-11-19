// Shop orders list (docs/SHOP_SPEC.md §7.6): tabs New · Confirmed · Ready · Out for delivery ·
// Completed · Cancelled/Returned with counts, search by order number, phone or product ID.
import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatCurrencyAmount } from '../../shared/currency';
import { when } from '../blog/studioUtil';
import { shopOrdersApi, type OrderSummaryRow, type OrderTab } from './shopApi';
import { ORDER_TEXT } from './orderStrings';
import { fill } from './strings';
import type { OrderStatus, PaymentStatus } from '../../shared/shopOrderStatus';

const T = ORDER_TEXT;
const TABS: OrderTab[] = ['ALL', 'NEW', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CLOSED'];

export function orderStatusChip(status: OrderStatus): string {
  switch (status) {
    case 'NEW': return 'tx-iam-chip warn';
    case 'DELIVERED':
    case 'COLLECTED': return 'tx-iam-chip ok';
    case 'CANCELLED':
    case 'RETURNED': return 'tx-iam-chip off';
    default: return 'tx-iam-chip';
  }
}
export function paymentChip(status: PaymentStatus): string {
  return status === 'PAID' ? 'tx-iam-chip ok' : status === 'REFUNDED' ? 'tx-iam-chip off' : 'tx-iam-chip';
}

export const OrderList: React.FC<{ onOpen: (id: string) => void; refreshKey?: number }> = ({ onOpen, refreshKey = 0 }) => {
  const [tab, setTab] = useState<OrderTab>('ALL');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<OrderSummaryRow[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<OrderTab, number>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);
  useEffect(() => {
    let live = true;
    setError(null);
    shopOrdersApi.list(tab, debounced)
      .then((r) => { if (live) { setRows(r.data); setCounts(r.counts); } })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [tab, debounced, refreshKey]);

  const money = (n: number, cur: string) => formatCurrencyAmount(n, cur);
  const where = (o: OrderSummaryRow) =>
    o.deliveryMethod === 'PICKUP' ? fill(T.list.pickup, { office: T.offices[o.pickupOffice ?? ''] ?? o.pickupOffice ?? '' }) : o.cityName ?? '—';

  return (
    <div className="tx-iam">
      <div className="tx-shop-tabs" role="tablist" aria-label={T.tabs.ALL}>
        {TABS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={tab === s} className={`tx-shop-tab${tab === s ? ' is-active' : ''}`} onClick={() => setTab(s)}>
            {T.tabs[s]}{counts[s] ? <span className="tx-shop-tab__count">{counts[s]}</span> : null}
          </button>
        ))}
      </div>
      <div className="tx-iam-toolbar">
        <input type="search" className="tx-iam-input" placeholder={T.list.search} aria-label={T.list.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      <div className="tx-iam-card tx-shop-table-wrap">
        {rows === null ? (
          <p className="tx-iam-muted" role="status">{T.list.loading}</p>
        ) : rows.length === 0 ? (
          <p className="tx-iam-muted">{tab !== 'ALL' || debounced ? T.list.emptyFiltered : T.list.empty}</p>
        ) : (
          <table className="tx-iam-table tx-shop-orders">
            <thead>
              <tr>
                <th scope="col">{T.list.columns.order}</th>
                <th scope="col">{T.list.columns.date}</th>
                <th scope="col">{T.list.columns.customer}</th>
                <th scope="col">{T.list.columns.where}</th>
                <th scope="col" className="tx-shop-num">{T.list.columns.items}</th>
                <th scope="col" className="tx-shop-num">{T.list.columns.total}</th>
                <th scope="col">{T.list.columns.payment}</th>
                <th scope="col">{T.list.columns.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td data-label={T.list.columns.order}>
                    <button type="button" className="tx-shop-link tx-shop-nowrap" onClick={() => onOpen(o.id)}>{o.orderNumber}</button>
                  </td>
                  <td data-label={T.list.columns.date}>{when(o.createdAt)}</td>
                  <td data-label={T.list.columns.customer}>{o.customerName ?? <span className="tx-iam-muted">{T.list.removed}</span>}</td>
                  <td data-label={T.list.columns.where}>{where(o)}</td>
                  <td data-label={T.list.columns.items} className="tx-shop-num">{o.itemCount}</td>
                  <td data-label={T.list.columns.total} className="tx-shop-num">
                    <span className="tx-shop-nowrap">{money(o.total, o.currency)}</span>
                    {o.deliveryFeeStatus === 'TO_CONFIRM' && <span className="tx-iam-chip warn">{T.list.feeToConfirm}</span>}
                  </td>
                  <td data-label={T.list.columns.payment}>
                    <span className="tx-shop-paycell">{T.methods[o.paymentMethod]}</span>
                    <span className={paymentChip(o.paymentStatus)}>{T.payment[o.paymentStatus]}</span>
                  </td>
                  <td data-label={T.list.columns.status}>
                    <span className={orderStatusChip(o.status)}>{T.status[o.status]}</span>
                    {o.deliveryProblem && (
                      <span className="tx-iam-chip danger"><AlertTriangle size={12} aria-hidden="true" /> {T.list.problem}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
