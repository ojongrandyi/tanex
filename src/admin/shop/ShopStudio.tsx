// The console's Shop view (docs/SHOP_SPEC.md §7): Products, Categories, Orders and Settings, each
// shown only to the permissions that use it. Its own lazy chunk, loaded when the view is opened;
// the description editor (TipTap) is a further chunk loaded when a product is opened.
// `open` comes from the console: a link from the staff alert email (#order=TX-ORD-…), the bell or
// a dashboard tile; each new value is applied once.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ProductList } from './ProductList';
import { ProductEditor } from './ProductEditor';
import { CategoriesManager } from './CategoriesManager';
import { OrderList } from './OrderList';
import { OrderPage } from './OrderPage';
import { ShopSettingsPanel } from './ShopSettingsPanel';
import { SHOP_TEXT } from './strings';
import './ShopStudio.css';
import './SquareCropDialog.css';

export type ShopTab = 'products' | 'categories' | 'orders' | 'settings';
export type ShopOpenRequest = { tab: ShopTab; orderId?: string; nonce: number };

const TAB_LABELS: Record<ShopTab, string> = SHOP_TEXT.tabs;

export const ShopStudio: React.FC<{ open?: ShopOpenRequest | null; onOrdersChanged?: () => void }> = ({ open, onOrdersChanged }) => {
  const { can } = useAuth();
  const allowed: ShopTab[] = [
    ...(['shop.view', 'shop.write', 'shop.publish', 'shop.stock', 'shop.categories'] as const).some((k) => can(k)) ? ['products', 'categories'] as ShopTab[] : [],
    ...(can('orders.view') ? ['orders'] as ShopTab[] : []),
    ...(can('shop.settings') ? ['settings'] as ShopTab[] : []),
  ];
  const [tab, setTab] = useState<ShopTab>(() => (open && allowed.includes(open.tab) ? open.tab : allowed[0] ?? 'products'));
  const [openId, setOpenId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(open?.orderId ?? null);
  const [ordersKey, setOrdersKey] = useState(0);

  useEffect(() => {
    if (!open || !allowed.includes(open.tab)) return;
    setTab(open.tab);
    setOpenId(null);
    setOrderId(open.orderId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.nonce]);

  if (openId) return <ProductEditor key={openId} productId={openId} onBack={() => setOpenId(null)} />;
  if (orderId && tab === 'orders') {
    return (
      <div className="tx-shop-studio animate-fade-in">
        <OrderPage key={orderId} orderId={orderId} onBack={() => { setOrderId(null); setOrdersKey((k) => k + 1); }}
          onChanged={() => onOrdersChanged?.()} />
      </div>
    );
  }
  return (
    <div className="tx-shop-studio animate-fade-in">
      {allowed.length > 1 && (
        <div className="tx-shop-tabs tx-shop-tabs--main" role="tablist" aria-label={SHOP_TEXT.menu}>
          {allowed.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tx-shop-tab${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {tab === 'products' && <ProductList onOpen={setOpenId} />}
      {tab === 'categories' && <CategoriesManager />}
      {tab === 'orders' && <OrderList onOpen={setOrderId} refreshKey={ordersKey} />}
      {tab === 'settings' && <ShopSettingsPanel />}
    </div>
  );
};
