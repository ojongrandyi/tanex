// The console's Shop view (docs/SHOP_SPEC.md §7): Products and Categories. Its own lazy chunk,
// loaded when the view is opened; the description editor (TipTap) is a further chunk loaded when a
// product is opened. Orders and shop settings join in M.7.
import React, { useState } from 'react';
import { ProductList } from './ProductList';
import { ProductEditor } from './ProductEditor';
import { CategoriesManager } from './CategoriesManager';
import { SHOP_TEXT } from './strings';
import './ShopStudio.css';
import './SquareCropDialog.css';

type Tab = 'products' | 'categories';

export const ShopStudio: React.FC = () => {
  const [tab, setTab] = useState<Tab>('products');
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) return <ProductEditor key={openId} productId={openId} onBack={() => setOpenId(null)} />;
  return (
    <div className="tx-shop-studio animate-fade-in">
      <div className="tx-shop-tabs tx-shop-tabs--main" role="tablist" aria-label={SHOP_TEXT.menu}>
        {(['products', 'categories'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tx-shop-tab${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
            {SHOP_TEXT.tabs[t]}
          </button>
        ))}
      </div>
      {tab === 'products' && <ProductList onOpen={setOpenId} />}
      {tab === 'categories' && <CategoriesManager />}
    </div>
  );
};
