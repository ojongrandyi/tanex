// Shop categories (docs/SHOP_SPEC.md §7.5): one level of sub-categories, English and French names,
// web addresses and descriptions, a square picture (crop step), visible or hidden, reordered with
// Move up / Move down among their siblings. A category with products can't be deleted.
import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { IamDialog } from '../components/IamDialog';
import { SquareCropDialog } from './SquareCropDialog';
import { shopApi, type CategoryInput, type ShopCategory, type ShopMedia } from './shopApi';
import { SHOP_TEXT, fill } from './strings';

const T = SHOP_TEXT.categories;

const CategoryDialog: React.FC<{
  category: ShopCategory | null;
  all: ShopCategory[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ category, all, onClose, onSaved }) => {
  const [f, setF] = useState({
    nameEn: category?.nameEn ?? '', nameFr: category?.nameFr ?? '',
    slugEn: category?.slugEn ?? '', slugFr: category?.slugFr ?? '',
    descriptionEn: category?.descriptionEn ?? '', descriptionFr: category?.descriptionFr ?? '',
    parentId: category?.parentId ?? '', isVisible: category?.isVisible ?? true,
  });
  const [image, setImage] = useState<ShopMedia | null>(category?.image ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChildren = !!category && all.some((c) => c.parentId === category.id);
  const parents = all.filter((c) => !c.parentId && c.id !== category?.id);
  const valid = f.nameEn.trim() !== '' && f.nameFr.trim() !== '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const input: CategoryInput = {
      nameEn: f.nameEn.trim(), nameFr: f.nameFr.trim(),
      descriptionEn: f.descriptionEn.trim() || null, descriptionFr: f.descriptionFr.trim() || null,
      parentId: f.parentId || null, isVisible: f.isVisible, imageMediaId: image?.id ?? null,
    };
    if (f.slugEn.trim()) input.slugEn = f.slugEn.trim();
    if (f.slugFr.trim()) input.slugFr = f.slugFr.trim();
    try {
      if (category) await shopApi.updateCategory(category.id, input);
      else await shopApi.createCategory(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f, v: string | boolean) => setF((cur) => ({ ...cur, [k]: v }));

  // One dialog at a time (both would react to Escape); the form keeps its state meanwhile.
  if (file) return <SquareCropDialog file={file} onUploaded={(m) => { setImage(m); setFile(null); }} onCancel={() => setFile(null)} />;

  return (
    <IamDialog title={category ? T.editCategory : T.newCategory} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field"><span>{T.nameEn} *</span><input type="text" value={f.nameEn} maxLength={80} onChange={(e) => set('nameEn', e.target.value)} required /></label>
          <label className="tx-iam-field" lang="fr"><span>{T.nameFr} *</span><input type="text" value={f.nameFr} maxLength={80} onChange={(e) => set('nameFr', e.target.value)} required /></label>
        </div>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field"><span>{T.slugEn}</span><input type="text" value={f.slugEn} maxLength={80} onChange={(e) => set('slugEn', e.target.value.toLowerCase())} /><small>{T.slugHint}</small></label>
          <label className="tx-iam-field"><span>{T.slugFr}</span><input type="text" value={f.slugFr} maxLength={80} onChange={(e) => set('slugFr', e.target.value.toLowerCase())} /></label>
        </div>
        <label className="tx-iam-field"><span>{T.descriptionEn}</span><textarea rows={2} value={f.descriptionEn} maxLength={400} onChange={(e) => set('descriptionEn', e.target.value)} /></label>
        <label className="tx-iam-field" lang="fr"><span>{T.descriptionFr}</span><textarea rows={2} value={f.descriptionFr} maxLength={400} onChange={(e) => set('descriptionFr', e.target.value)} /></label>
        <label className="tx-iam-field">
          <span>{T.parent}</span>
          <select value={f.parentId} onChange={(e) => set('parentId', e.target.value)} disabled={hasChildren}>
            <option value="">{T.noParent}</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.nameEn}</option>)}
          </select>
        </label>
        <div className="tx-iam-field">
          <span>{T.picture}</span>
          <div className="tx-shop-catimage">
            {image && <img src={image.urls.w300} width={96} height={96} alt="" />}
            <label className="tx-iam-btn small">
              <ImagePlus size={14} aria-hidden="true" /> {image ? T.changePicture : T.addPicture}
              <input type="file" accept="image/*" className="tx-shop-visually-hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            </label>
            {image && <button type="button" className="tx-iam-btn small danger" onClick={() => setImage(null)}>{T.removePicture}</button>}
          </div>
        </div>
        <label className="tx-iam-check"><input type="checkbox" checked={f.isVisible} onChange={(e) => set('isVisible', e.target.checked)} /><span>{T.visible}</span></label>
        {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={!valid || busy}>{T.save}</button>
        </div>
      </form>
    </IamDialog>
  );
};

export const CategoriesManager: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('shop.categories');
  const [rows, setRows] = useState<ShopCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShopCategory | 'new' | null>(null);

  const load = () => shopApi.listCategories().then(setRows).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { load(); }, []);

  const parents = (rows ?? []).filter((c) => !c.parentId);
  const childrenOf = (id: string) => (rows ?? []).filter((c) => c.parentId === id);

  /** Swaps a category with its neighbour among its siblings, then saves the whole order. */
  const move = async (c: ShopCategory, dir: -1 | 1) => {
    if (!rows) return;
    const siblings = c.parentId ? childrenOf(c.parentId) : parents;
    const i = siblings.findIndex((s) => s.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    const swapped = [...siblings];
    [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
    // Full order: parents in order, each followed by its children.
    const parentOrder = c.parentId ? parents : swapped;
    const order = parentOrder.flatMap((p) => [p.id, ...(c.parentId === p.id ? swapped : childrenOf(p.id)).map((k) => k.id)]);
    setError(null);
    try { await shopApi.orderCategories(order); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const remove = async (c: ShopCategory) => {
    if (!window.confirm(fill(T.deleteConfirm, { name: c.nameEn }))) return;
    setError(null);
    try { await shopApi.deleteCategory(c.id); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const row = (c: ShopCategory, siblings: ShopCategory[], i: number, child: boolean) => (
    <li key={c.id} className={`tx-shop-cat${child ? ' is-child' : ''}`}>
      <div className="tx-shop-cat__main">
        <span className="tx-shop-thumb">{c.image ? <img src={c.image.urls.w300} width={48} height={48} alt="" loading="lazy" /> : null}</span>
        <div>
          <strong>{c.nameEn}</strong> <span className="tx-iam-muted" lang="fr">/ {c.nameFr}</span>
          <div className="tx-iam-sub">
            {fill(T.products, { n: c.productCount })}
            {!c.isVisible && <> · <span className="tx-iam-chip off">{T.hidden}</span></>}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="tx-iam-row-actions">
          <button type="button" className="tx-iam-btn small" onClick={() => move(c, -1)} disabled={i === 0} aria-label={`${T.moveUp}: ${c.nameEn}`} title={T.moveUp}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="tx-iam-btn small" onClick={() => move(c, 1)} disabled={i === siblings.length - 1} aria-label={`${T.moveDown}: ${c.nameEn}`} title={T.moveDown}><ArrowDown size={14} aria-hidden="true" /></button>
          <button type="button" className="tx-iam-btn small" onClick={() => setEditing(c)}><Pencil size={14} aria-hidden="true" /> {T.edit}</button>
          <button type="button" className="tx-iam-btn small danger" onClick={() => remove(c)} aria-label={`${T.delete}: ${c.nameEn}`}><Trash2 size={14} aria-hidden="true" /></button>
        </div>
      )}
    </li>
  );

  return (
    <div className="tx-iam">
      {canManage && (
        <div className="tx-iam-toolbar">
          <button type="button" className="tx-iam-btn primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> {T.newCategory}</button>
        </div>
      )}
      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      <div className="tx-iam-card">
        {rows === null ? <p className="tx-iam-muted" role="status">…</p> : rows.length === 0 ? <p className="tx-iam-muted">{T.empty}</p> : (
          <ul className="tx-shop-cats">
            {parents.map((p, i) => (
              <React.Fragment key={p.id}>
                {row(p, parents, i, false)}
                {childrenOf(p.id).map((k, j, arr) => row(k, arr, j, true))}
              </React.Fragment>
            ))}
          </ul>
        )}
      </div>
      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          all={rows ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
};
