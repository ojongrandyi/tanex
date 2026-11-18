// Shop products list (docs/SHOP_SPEC.md §7.1): status tabs (with "Needs review": in review, or a
// live product with proposed changes), search by name or product ID, category and stock filters,
// and the "New product" dialog. Stock is amber at or below the low-stock level, red at 0.
import React, { useEffect, useState } from 'react';
import { ImageOff, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { IamDialog } from '../components/IamDialog';
import { PRODUCT_STATUSES, isValidPrice, isValidStock, type ProductStatus } from '../../shared/shopProduct';
import { formatCurrencyAmount } from '../../shared/currency';
import { when } from '../blog/studioUtil';
import { shopApi, type ProductSummary, type ShopCategory } from './shopApi';
import { SHOP_TEXT } from './strings';

const T = SHOP_TEXT;

export function statusChip(status: ProductStatus): string {
  switch (status) {
    case 'PUBLISHED': return 'tx-iam-chip ok';
    case 'IN_REVIEW': return 'tx-iam-chip warn';
    case 'HIDDEN':
    case 'ARCHIVED': return 'tx-iam-chip off';
    default: return 'tx-iam-chip';
  }
}

const NewProductDialog: React.FC<{ onClose: () => void; onCreated: (id: string) => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim() !== '' && isValidPrice(Number(price)) && price.trim() !== '' && isValidStock(Number(stock)) && stock.trim() !== '';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const p = await shopApi.createProduct({ nameEn: name.trim(), price: Number(price), stockQty: Number(stock) });
      onCreated(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  return (
    <IamDialog title={T.newProduct.title} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <label className="tx-iam-field">
          <span>{T.newProduct.name}</span>
          <input type="text" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field">
            <span>{T.newProduct.price}</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
          <label className="tx-iam-field">
            <span>{T.newProduct.stock}</span>
            <input type="number" inputMode="numeric" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} required />
          </label>
        </div>
        {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.newProduct.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={!valid || busy}>{T.newProduct.create}</button>
        </div>
      </form>
    </IamDialog>
  );
};

type StatusTab = 'ALL' | 'NEEDS_REVIEW' | ProductStatus;

export const ProductList: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const { can } = useAuth();
  const canCreate = can('shop.write') || can('shop.publish');
  const [tab, setTab] = useState<StatusTab>('ALL');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<ProductSummary[] | null>(null);
  const [lowStockAt, setLowStockAt] = useState(3);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);
  useEffect(() => {
    shopApi.listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    let live = true;
    setError(null);
    shopApi.listProducts({ status: tab === 'ALL' ? '' : tab, category, stock, q: debounced })
      .then((r) => { if (live) { setRows(r.data); setLowStockAt(r.lowStockAt); } })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [tab, category, stock, debounced]);

  const filtered = tab !== 'ALL' || !!category || !!stock || !!debounced;
  const catName = (id: string) => categories.find((c) => c.id === id)?.nameEn;
  const money = (n: number, cur: string) => formatCurrencyAmount(n, cur);
  const stockClass = (p: ProductSummary) => (p.stockQty === 0 ? 'is-out' : p.stockQty <= (p.lowStockAt ?? lowStockAt) ? 'is-low' : '');
  const tabs: StatusTab[] = ['ALL', 'NEEDS_REVIEW', ...PRODUCT_STATUSES];

  return (
    <div className="tx-iam">
      <div className="tx-shop-tabs" role="tablist" aria-label={T.tabs.products}>
        {tabs.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={tab === s} className={`tx-shop-tab${tab === s ? ' is-active' : ''}`} onClick={() => setTab(s)}>
            {s === 'ALL' ? T.list.all : s === 'NEEDS_REVIEW' ? T.list.needsReview : T.status[s]}
          </button>
        ))}
      </div>
      <div className="tx-iam-toolbar">
        <input type="search" className="tx-iam-input" placeholder={T.list.search} aria-label={T.list.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="tx-iam-input tx-shop-select" aria-label={T.list.category} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{T.list.allCategories}</option>
          <option value="NONE">{T.list.noCategory}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `— ${c.nameEn}` : c.nameEn}</option>)}
        </select>
        <select className="tx-iam-input tx-shop-select" aria-label={T.list.stock} value={stock} onChange={(e) => setStock(e.target.value)}>
          <option value="">{T.list.stock}: {T.list.stockAll}</option>
          <option value="low">{T.list.stock}: {T.list.stockLow}</option>
          <option value="out">{T.list.stockOut}</option>
        </select>
        {canCreate && (
          <button type="button" className="tx-iam-btn primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {T.list.newProduct}
          </button>
        )}
      </div>

      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      <div className="tx-iam-card tx-shop-table-wrap">
        {rows === null ? (
          <p className="tx-iam-muted" role="status">{T.list.loading}</p>
        ) : rows.length === 0 ? (
          <p className="tx-iam-muted">{filtered ? T.list.emptyFiltered : T.list.empty}</p>
        ) : (
          <table className="tx-iam-table tx-shop-products">
            <thead>
              <tr>
                <th scope="col">{T.list.columns.product}</th>
                <th scope="col">{T.list.columns.code}</th>
                <th scope="col">{T.list.columns.price}</th>
                <th scope="col">{T.list.columns.stock}</th>
                <th scope="col">{T.list.columns.status}</th>
                <th scope="col">{T.list.columns.categories}</th>
                <th scope="col">{T.list.columns.updated}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td data-label={T.list.columns.product}>
                    <div className="tx-shop-product-cell">
                      <span className="tx-shop-thumb">
                        {p.thumbnail ? <img src={p.thumbnail} width={48} height={48} alt="" loading="lazy" /> : <ImageOff size={18} aria-hidden="true" />}
                      </span>
                      <button type="button" className="tx-shop-link" onClick={() => onOpen(p.id)}>{p.nameEn}</button>
                      {p.isFeatured && <span className="tx-iam-chip">{T.list.featured}</span>}
                    </div>
                  </td>
                  <td data-label={T.list.columns.code}><code>{p.productCode}</code></td>
                  <td data-label={T.list.columns.price} className="tx-shop-num">
                    {p.salePrice ? <><s className="tx-iam-muted">{money(p.price, p.currency)}</s> {money(p.salePrice, p.currency)}</> : money(p.price, p.currency)}
                  </td>
                  <td data-label={T.list.columns.stock} className={`tx-shop-num tx-shop-stockcell ${stockClass(p)}`}>{p.stockQty}</td>
                  <td data-label={T.list.columns.status}>
                    <span className={statusChip(p.status)}>{T.status[p.status]}</span>
                    {p.hasPending && <span className="tx-iam-chip warn">{T.list.changesWaiting}</span>}
                  </td>
                  <td data-label={T.list.columns.categories}>{p.categoryIds.map(catName).filter(Boolean).join(', ') || '—'}</td>
                  <td data-label={T.list.columns.updated}>{when(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <NewProductDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onOpen(id); }} />}
    </div>
  );
};
