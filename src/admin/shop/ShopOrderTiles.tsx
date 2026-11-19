// Dashboard tiles for shop orders (SHOP_SPEC §7.6, M.7): new orders (with fees to confirm), ready
// to send, out for delivery (with delivery problems), completed but unpaid, low stock. Each opens the
// Shop view's Orders tab (low stock: the Products tab). Uses the dashboard's KPI card styles (OperationsCenter.css).
import React from 'react';
import { AlertTriangle, Boxes, PackageCheck, ShoppingBag, Truck, Wallet } from 'lucide-react';
import type { ShopOrdersSummary } from './ordersSummaryApi';
import { SHOP_MENU } from './menuText';

export const ShopOrderTiles: React.FC<{ summary: ShopOrdersSummary; onOpen: () => void; onOpenProducts?: () => void }> = ({ summary: s, onOpen, onOpenProducts }) => {
  const D = SHOP_MENU.dashboard;
  const tiles = [
    { key: 'new', icon: <ShoppingBag size={15} />, label: D.newOrders, value: s.newOrders,
      sub: s.feeToConfirm > 0 ? D.feeToConfirm(s.feeToConfirm) : D.allFeesSet, alert: s.newOrders > 0 },
    { key: 'ready', icon: <PackageCheck size={15} />, label: D.ready, value: s.ready, sub: D.readyHint, alert: false },
    { key: 'out', icon: s.deliveryProblems > 0 ? <AlertTriangle size={15} /> : <Truck size={15} />, label: D.out, value: s.outForDelivery,
      sub: s.deliveryProblems > 0 ? D.problems(s.deliveryProblems) : D.noProblems, alert: s.deliveryProblems > 0 },
    { key: 'unpaid', icon: <Wallet size={15} />, label: D.unpaid, value: s.unpaidCompleted, sub: D.unpaidHint, alert: false },
    { key: 'stock', icon: <Boxes size={15} />, label: D.lowStock, value: s.lowStock, sub: D.lowStockHint, alert: s.lowStock > 0, products: true },
  ];
  return (
    <section className="tx-shop-tiles" aria-label={D.title}>
      <h2 className="ops-section-title">{D.title}</h2>
      <div className="ops-kpi-row tx-shop-tiles__row">
        {tiles.map((t) => (
          <button key={t.key} type="button" className={`ops-kpi-card tx-shop-tile${t.alert ? ' is-alert' : ''}`} onClick={t.products && onOpenProducts ? onOpenProducts : onOpen}>
            <div className="ops-card-header">
              <div className="ops-circle-icon accent">{t.icon}</div>
              <span className="ops-card-label">{t.label}</span>
            </div>
            <strong className="ops-card-number">{t.value}</strong>
            <span className="ops-card-subtext">{t.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
