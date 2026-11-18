// One product in the console (docs/SHOP_SPEC.md §7.2–§7.4): English and French details and
// descriptions (basic TipTap editor, lazy), pictures with the crop step, price and stock, delivery
// size and weight, categories, SEO, and the review actions. A writer's edits to a live product are
// sent as proposed changes; a publisher sees them side by side and approves or rejects them.
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Boxes, History } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { IamDialog } from '../components/IamDialog';
import { SIZE_CLASSES } from '../../shared/localPricing';
import { isValidPrice, type ProductStatus } from '../../shared/shopProduct';
import { formatCurrencyAmount } from '../../shared/currency';
import { when } from '../blog/studioUtil';
import type { DocNode } from '../blog/blogApi';
import { PictureManager, type EditorPicture } from './PictureManager';
import { StockDialog, StockHistory } from './StockDialog';
import { shopApi, type Product, type ProductInput, type ShopApiError, type ShopCategory } from './shopApi';
import { SHOP_TEXT, fill } from './strings';
import { statusChip } from './ProductList';
// The description editor's toolbar and surface styles.
import '../blog/BlogStudio.css';

const RichEditor = lazy(() => import('../blog/editor/RichEditor'));
const T = SHOP_TEXT;
const E = T.editor;
const EMPTY_DOC: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] };

interface Form {
  nameEn: string; nameFr: string; slugEn: string; slugFr: string; shortEn: string; shortFr: string;
  price: string; salePrice: string; lowStockAt: string; maxPerOrder: string; weightKg: string; sortOrder: string;
  sizeClass: string; isFeatured: boolean;
  seoTitleEn: string; seoTitleFr: string; seoDescriptionEn: string; seoDescriptionFr: string;
  categoryIds: string[];
  pictures: EditorPicture[];
}

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

function formFrom(p: Product, overlay?: ProductInput | null): Form {
  const o = overlay ?? {};
  const pick = <K extends keyof ProductInput>(k: K, live: unknown) => (k in o ? o[k] : live);
  const pendingPictures = o.images && p.pending?.images
    ? o.images.map((img) => {
        const m = p.pending!.images!.find((x) => x.id === img.mediaId);
        return m ? { mediaId: m.id, urls: m.urls, altEn: img.altEn ?? '', altFr: img.altFr ?? '' } : null;
      }).filter((x): x is EditorPicture => !!x)
    : null;
  return {
    nameEn: str(pick('nameEn', p.nameEn) as string), nameFr: str(pick('nameFr', p.nameFr) as string | null),
    slugEn: str(pick('slugEn', p.slugEn) as string), slugFr: str(pick('slugFr', p.slugFr) as string),
    shortEn: str(pick('shortEn', p.shortEn) as string | null), shortFr: str(pick('shortFr', p.shortFr) as string | null),
    price: str(pick('price', p.price) as number), salePrice: str(pick('salePrice', p.salePrice) as number | null),
    lowStockAt: str(pick('lowStockAt', p.lowStockAt) as number | null), maxPerOrder: str(pick('maxPerOrder', p.maxPerOrder) as number | null),
    weightKg: str(pick('weightKg', p.weightKg) as number | null), sortOrder: str(pick('sortOrder', p.sortOrder) as number),
    sizeClass: str(pick('sizeClass', p.sizeClass) as string), isFeatured: Boolean(pick('isFeatured', p.isFeatured)),
    seoTitleEn: str(pick('seoTitleEn', p.seoTitleEn) as string | null), seoTitleFr: str(pick('seoTitleFr', p.seoTitleFr) as string | null),
    seoDescriptionEn: str(pick('seoDescriptionEn', p.seoDescriptionEn) as string | null), seoDescriptionFr: str(pick('seoDescriptionFr', p.seoDescriptionFr) as string | null),
    categoryIds: (pick('categoryIds', p.categoryIds) as string[]) ?? [],
    pictures: pendingPictures ?? p.images.map((i) => ({ mediaId: i.mediaId, urls: i.urls, altEn: i.altEn ?? '', altFr: i.altFr ?? '' })),
  };
}

const optInt = (s: string) => (s.trim() === '' ? null : Number(s));
const optText = (s: string) => (s.trim() === '' ? null : s.trim());

/** Only the fields that differ from `base`, in the API's shape. */
function changes(form: Form, base: Form): ProductInput {
  const out: ProductInput = {};
  const diff = (k: keyof Form) => JSON.stringify(form[k]) !== JSON.stringify(base[k]);
  if (diff('nameEn')) out.nameEn = form.nameEn.trim();
  if (diff('nameFr')) out.nameFr = optText(form.nameFr);
  if (diff('slugEn') && form.slugEn.trim()) out.slugEn = form.slugEn.trim();
  if (diff('slugFr') && form.slugFr.trim()) out.slugFr = form.slugFr.trim();
  if (diff('shortEn')) out.shortEn = optText(form.shortEn);
  if (diff('shortFr')) out.shortFr = optText(form.shortFr);
  if (diff('price')) out.price = Number(form.price);
  if (diff('salePrice')) out.salePrice = optInt(form.salePrice);
  if (diff('lowStockAt')) out.lowStockAt = optInt(form.lowStockAt);
  if (diff('maxPerOrder')) out.maxPerOrder = optInt(form.maxPerOrder);
  if (diff('weightKg')) out.weightKg = form.weightKg.trim() === '' ? null : Number(form.weightKg.replace(',', '.'));
  if (diff('sortOrder')) out.sortOrder = Number(form.sortOrder || 0);
  if (diff('sizeClass')) out.sizeClass = form.sizeClass;
  if (diff('isFeatured')) out.isFeatured = form.isFeatured;
  if (diff('seoTitleEn')) out.seoTitleEn = optText(form.seoTitleEn);
  if (diff('seoTitleFr')) out.seoTitleFr = optText(form.seoTitleFr);
  if (diff('seoDescriptionEn')) out.seoDescriptionEn = optText(form.seoDescriptionEn);
  if (diff('seoDescriptionFr')) out.seoDescriptionFr = optText(form.seoDescriptionFr);
  if (diff('categoryIds')) out.categoryIds = form.categoryIds;
  if (diff('pictures')) out.images = form.pictures.map((p) => ({ mediaId: p.mediaId, altEn: optText(p.altEn), altFr: optText(p.altFr) }));
  return out;
}

/** Client-side checks before saving; the server checks again. */
function formProblem(f: Form): { field: keyof Form; message: string } | null {
  if (!f.nameEn.trim()) return { field: 'nameEn', message: 'The English name is required.' };
  if (!isValidPrice(Number(f.price)) || f.price.trim() === '') return { field: 'price', message: 'Enter a price in whole FCFA (1 or more).' };
  if (f.salePrice.trim() !== '') {
    const s = Number(f.salePrice);
    if (!isValidPrice(s)) return { field: 'salePrice', message: 'Enter a sale price in whole FCFA, or leave it empty.' };
    if (s >= Number(f.price)) return { field: 'salePrice', message: T.notices.salePrice };
  }
  return null;
}

// ---- Note dialog (send back / reject) ----

const NoteDialog: React.FC<{ title: string; button: string; onClose: () => void; onSubmit: (note: string) => Promise<void> }> = ({ title, button, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <IamDialog title={title} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        setBusy(true);
        try { await onSubmit(note.trim()); } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
      }}>
        <label className="tx-iam-field">
          <span>{T.review.note}</span>
          <textarea value={note} maxLength={500} rows={4} onChange={(e) => setNote(e.target.value)} required />
        </label>
        {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.actions.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy || !note.trim()}>{button}</button>
        </div>
      </form>
    </IamDialog>
  );
};

// ---- Proposed changes, side by side (publisher) ----

const LABELS: Record<string, string> = {
  nameEn: `${E.name} (EN)`, nameFr: `${E.name} (FR)`, slugEn: `${E.webAddress} (EN)`, slugFr: `${E.webAddress} (FR)`,
  shortEn: `${E.short} (EN)`, shortFr: `${E.short} (FR)`, descriptionEn: `${E.description} (EN)`, descriptionFr: `${E.description} (FR)`,
  price: E.price, salePrice: E.salePrice, lowStockAt: E.lowStock, maxPerOrder: E.maxPerOrder, sizeClass: E.size, weightKg: E.weight,
  isFeatured: E.featured, sortOrder: E.sortOrder, seoTitleEn: `${E.seoTitle} (EN)`, seoTitleFr: `${E.seoTitle} (FR)`,
  seoDescriptionEn: `${E.seoDescription} (EN)`, seoDescriptionFr: `${E.seoDescription} (FR)`,
  categoryIds: E.sections.categories, images: E.sections.pictures,
};

const PendingReview: React.FC<{ product: Product; categories: ShopCategory[] }> = ({ product, categories }) => {
  const c = product.pending!.changes;
  const money = (n: unknown) => (typeof n === 'number' ? formatCurrencyAmount(n, product.currency) : '—');
  const cat = (ids: string[]) => ids.map((id) => categories.find((x) => x.id === id)?.nameEn ?? '?').join(', ') || '—';
  const show = (k: string, v: unknown): string => {
    if (k === 'price' || k === 'salePrice') return money(v);
    if (k === 'descriptionEn' || k === 'descriptionFr') return T.review.descriptionChanged;
    if (k === 'categoryIds') return cat(v as string[]);
    if (k === 'images') return fill(T.review.picturesChanged, { n: (v as unknown[]).length });
    if (k === 'isFeatured') return v ? 'Yes' : 'No';
    if (k === 'sizeClass') return E.sizes[String(v)] ?? String(v);
    return v === null || v === undefined || v === '' ? '—' : String(v);
  };
  const live: Record<string, unknown> = { ...product, images: product.images };
  return (
    <div className="tx-shop-table-wrap">
      <table className="tx-iam-table tx-shop-diff">
        <thead><tr><th scope="col">{T.review.field}</th><th scope="col">{T.review.now}</th><th scope="col">{T.review.proposed}</th></tr></thead>
        <tbody>
          {Object.entries(c).map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{LABELS[k] ?? k}</th>
              <td>{k.startsWith('description') ? '' : k === 'images' ? product.images.length : show(k, live[k])}</td>
              <td className="tx-shop-diff__new">{show(k, v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {product.pending!.images && (
        <ul className="tx-shop-diff__pictures" aria-label={T.review.proposed}>
          {product.pending!.images.map((m) => <li key={m.id}><img src={m.urls.w300} width={300} height={300} alt="" /></li>)}
        </ul>
      )}
    </div>
  );
};

// ---- Editor ----

export const ProductEditor: React.FC<{ productId: string; onBack: () => void }> = ({ productId, onBack }) => {
  const { can } = useAuth();
  const isPublisher = can('shop.publish');
  const canWrite = isPublisher || can('shop.write');
  const canStock = can('shop.stock');

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<Form | null>(null);
  const [descEn, setDescEn] = useState<DocNode | null>(null);
  const [descFr, setDescFr] = useState<DocNode | null>(null);
  const descBase = useRef<{ en: string | null; fr: string | null }>({ en: null, fr: null });
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string; field?: string } | null>(null);
  const [dialog, setDialog] = useState<null | 'stock' | 'sendBack' | 'reject'>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  /** Load (or reload after a save) and reset the form. Writers keep editing their own proposal. */
  const load = useCallback((p: Product) => {
    setProduct(p);
    const overlay = !isPublisher && p.pending ? p.pending.changes : null;
    const f = formFrom(p, overlay);
    setForm(f);
    setBase(f);
    const en = overlay && 'descriptionEn' in overlay ? (overlay.descriptionEn as DocNode | null) : p.descriptionEn;
    const fr = overlay && 'descriptionFr' in overlay ? (overlay.descriptionFr as DocNode | null) : p.descriptionFr;
    setDescEn(en);
    setDescFr(fr);
    descBase.current = { en: null, fr: null }; // set from the editors' first report
    setEditorKey((k) => k + 1);
  }, [isPublisher]);

  useEffect(() => {
    let live = true;
    Promise.all([shopApi.getProduct(productId), shopApi.listCategories()])
      .then(([p, cats]) => { if (live) { setCategories(cats); load(p); } })
      .catch((e) => { if (live) setNotice({ kind: 'error', text: e instanceof Error ? e.message : T.notices.loadFailed }); });
    return () => { live = false; };
  }, [productId, load]);

  const descChanged = (lang: 'en' | 'fr') => {
    const now = JSON.stringify(lang === 'en' ? descEn : descFr);
    const b = descBase.current[lang];
    return b !== null && now !== b;
  };
  const pendingInput = useMemo(() => {
    if (!form || !base) return {};
    const input = changes(form, base);
    if (descChanged('en')) input.descriptionEn = descEn;
    if (descChanged('fr')) input.descriptionFr = descFr;
    return input;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, base, descEn, descFr]);
  const dirty = Object.keys(pendingInput).length > 0;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!product || !form || !base) {
    return (
      <div className="tx-shop-editor">
        <button type="button" className="tx-iam-btn" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> {E.back}</button>
        {notice ? <div className="tx-iam-notice error" role="alert">{notice.text}</div> : <p className="tx-iam-muted" role="status">{T.list.loading}</p>}
      </div>
    );
  }

  const status: ProductStatus = product.status;
  const archived = status === 'ARCHIVED';
  const editable = canWrite && !archived;
  const proposes = !isPublisher && (status === 'PUBLISHED' || status === 'HIDDEN');
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const back = () => {
    if (dirty && !window.confirm(T.notices.leave)) return;
    onBack();
  };

  const fail = (err: unknown) => {
    const e = err as ShopApiError;
    const missing = e.missing?.map((m) => T.fieldNames[m] ?? m).join(', ');
    setNotice({ kind: 'error', text: missing ? fill(T.notices.missing, { fields: missing }) : (e.message || String(err)), field: e.field });
  };

  /** Saves pending edits; returns false when nothing could be saved. */
  const save = async (): Promise<boolean> => {
    if (!dirty) return true;
    const problem = formProblem(form);
    if (problem) { setNotice({ kind: 'error', text: problem.message, field: problem.field }); return false; }
    setBusy(true);
    setNotice(null);
    try {
      const r = await shopApi.updateProduct(product.id, pendingInput);
      load(r.data);
      setNotice({ kind: 'ok', text: r.mode === 'proposed' ? T.notices.proposed : T.notices.saved });
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (to: ProductStatus, note?: string) => {
    if (!(await save())) return;
    setBusy(true);
    try {
      load(await shopApi.setStatus(product.id, to, note));
      setNotice({ kind: 'ok', text: `${T.status[to]}.` });
      setDialog(null);
    } catch (err) {
      fail(err);
      if (note) throw err;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(T.notices.deleteConfirm)) return;
    setBusy(true);
    try { await shopApi.deleteProduct(product.id); onBack(); } catch (err) { fail(err); setBusy(false); }
  };

  const decide = async (approve: boolean, note?: string) => {
    setBusy(true);
    try {
      load(approve ? await shopApi.approvePending(product.id) : await shopApi.rejectPending(product.id, note!));
      setNotice({ kind: 'ok', text: approve ? T.actions.approve : T.actions.reject });
      setDialog(null);
    } catch (err) {
      fail(err);
      if (note) throw err;
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (k: string) => notice?.kind === 'error' && notice.field === k;
  const invalid = (k: string) => (fieldError(k) ? { 'aria-invalid': true as const } : {});
  const parents = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const saveLabel = proposes ? T.actions.proposeChanges : status === 'DRAFT' ? T.actions.save : T.actions.saveChanges;
  const money = (n: number) => formatCurrencyAmount(n, product.currency);

  return (
    <div className="tx-shop-editor animate-fade-in">
      <div className="tx-shop-editor__head">
        <button type="button" className="tx-iam-btn" onClick={back}><ArrowLeft size={16} aria-hidden="true" /> {E.back}</button>
        <div className="tx-shop-editor__title">
          <h2>{product.nameEn}</h2>
          <p className="tx-iam-sub">
            {E.productId}: <code>{product.productCode}</code> · <span className={statusChip(status)}>{T.status[status]}</span>
            {product.pending && <> · <span className="tx-iam-chip warn">{T.list.changesWaiting}</span></>}
          </p>
          <p className="tx-iam-muted tx-shop-editor__meta">
            {product.createdBy && fill(E.created, { when: when(product.createdAt), who: product.createdBy })}
            {product.publishedAt && product.publishedBy && <> · {fill(E.published, { when: when(product.publishedAt), who: product.publishedBy })}</>}
          </p>
        </div>
      </div>

      {archived && <div className="tx-iam-notice" role="status">{T.notices.archived}</div>}
      {product.reviewNote && (
        <div className="tx-iam-notice error" role="status">
          {fill(product.pending || status === 'DRAFT' ? T.notices.sentBack : T.notices.rejected, { note: product.reviewNote })}
        </div>
      )}
      {product.pending && (isPublisher ? (
        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-pending">
          <h3 id="tx-shop-pending">{T.review.title}</h3>
          <p className="tx-iam-sub">{fill(T.notices.pending, { who: product.pending.by ?? '—', when: when(product.pending.at) })}</p>
          <PendingReview product={product} categories={categories} />
          <div className="tx-iam-row-actions">
            <button type="button" className="tx-iam-btn primary" disabled={busy || dirty} onClick={() => decide(true)}>{T.actions.approve}</button>
            <button type="button" className="tx-iam-btn danger" disabled={busy} onClick={() => setDialog('reject')}>{T.actions.reject}</button>
          </div>
        </section>
      ) : (
        <div className="tx-iam-notice" role="status">{T.notices.pendingYours}</div>
      ))}

      <fieldset className="tx-shop-fields" disabled={!editable || busy}>
        {/* Details, both languages side by side */}
        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-details">
          <h3 id="tx-shop-details">{E.sections.details}</h3>
          <div className="tx-shop-langs">
            {(['en', 'fr'] as const).map((lang) => {
              const L = lang === 'en' ? 'En' : 'Fr';
              return (
                <div key={lang} className="tx-shop-lang" lang={lang}>
                  <h4>{lang === 'en' ? E.english : E.french}</h4>
                  <label className="tx-iam-field">
                    <span>{E.name}{lang === 'en' ? ' *' : ''}</span>
                    <input type="text" value={form[`name${L}`]} maxLength={150} onChange={(e) => set(`name${L}`, e.target.value)} {...invalid(`name${L}`)} required={lang === 'en'} />
                  </label>
                  <label className="tx-iam-field">
                    <span>{E.webAddress}</span>
                    <div className="tx-shop-slug">
                      <span className="tx-iam-muted">{lang === 'en' ? '/shop/' : '/fr/boutique/'}</span>
                      <input type="text" value={form[`slug${L}`]} maxLength={80} onChange={(e) => set(`slug${L}`, e.target.value.toLowerCase())} {...invalid(`slug${L}`)} />
                    </div>
                  </label>
                  <label className="tx-iam-field">
                    <span>{E.short}</span>
                    <textarea rows={2} value={form[`short${L}`]} maxLength={300} onChange={(e) => set(`short${L}`, e.target.value)} {...invalid(`short${L}`)} />
                    {lang === 'en' && <small>{E.shortHint}</small>}
                  </label>
                  <div className="tx-iam-field">
                    <span id={`tx-shop-desc-${lang}`}>{E.description}</span>
                    <Suspense fallback={<p className="tx-iam-muted" role="status">…</p>}>
                      <RichEditor
                        key={`${editorKey}-${lang}`}
                        basic
                        placeholder={E.descriptionPlaceholder}
                        content={(lang === 'en' ? descEn : descFr) ?? EMPTY_DOC}
                        editable={editable}
                        onChange={(doc) => {
                          const json = JSON.stringify(doc);
                          if (descBase.current[lang] === null) descBase.current[lang] = json;
                          (lang === 'en' ? setDescEn : setDescFr)(doc);
                        }}
                      />
                    </Suspense>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-pictures">
          <h3 id="tx-shop-pictures">{E.sections.pictures}</h3>
          <PictureManager pictures={form.pictures} onChange={(p) => set('pictures', p)} disabled={!editable || busy} productName={form.nameEn} />
        </section>

        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-price">
          <h3 id="tx-shop-price">{E.sections.price}</h3>
          <div className="tx-shop-grid">
            <label className="tx-iam-field">
              <span>{E.price} *</span>
              <input type="number" inputMode="numeric" min={1} step={1} value={form.price} onChange={(e) => set('price', e.target.value)} {...invalid('price')} required />
              {isValidPrice(Number(form.price)) && <small>{money(Number(form.price))}</small>}
            </label>
            <label className="tx-iam-field">
              <span>{E.salePrice}</span>
              <input type="number" inputMode="numeric" min={1} step={1} value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} {...invalid('salePrice')} />
            </label>
            <label className="tx-iam-field">
              <span>{E.lowStock}</span>
              <input type="number" inputMode="numeric" min={0} step={1} value={form.lowStockAt} onChange={(e) => set('lowStockAt', e.target.value)} {...invalid('lowStockAt')} />
              <small>{E.lowStockHint}</small>
            </label>
            <label className="tx-iam-field">
              <span>{E.maxPerOrder}</span>
              <input type="number" inputMode="numeric" min={1} step={1} value={form.maxPerOrder} onChange={(e) => set('maxPerOrder', e.target.value)} {...invalid('maxPerOrder')} />
              <small>{E.maxPerOrderHint}</small>
            </label>
          </div>
          <div className="tx-shop-stock">
            <p><strong>{E.stockNow}:</strong> <span className="tx-shop-num">{product.stockQty}</span></p>
            {canStock && (
              <button type="button" className="tx-iam-btn" onClick={() => setDialog('stock')} disabled={busy}>
                <Boxes size={16} aria-hidden="true" /> {E.adjustStock}
              </button>
            )}
            <button type="button" className="tx-iam-btn" aria-expanded={showHistory} onClick={() => setShowHistory((s) => !s)}>
              <History size={16} aria-hidden="true" /> {E.stockHistory}
            </button>
          </div>
          {showHistory && <StockHistory productId={product.id} refreshKey={historyKey} />}
        </section>

        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-delivery">
          <h3 id="tx-shop-delivery">{E.sections.delivery}</h3>
          <div className="tx-shop-grid">
            <fieldset className="tx-shop-radios">
              <legend>{E.size}</legend>
              {SIZE_CLASSES.map((s) => (
                <label key={s}><input type="radio" name="tx-shop-size" checked={form.sizeClass === s} onChange={() => set('sizeClass', s)} /> {E.sizes[s]}</label>
              ))}
              <small className="tx-iam-hint">{E.sizeHint}</small>
            </fieldset>
            <label className="tx-iam-field">
              <span>{E.weight}</span>
              <input type="number" inputMode="decimal" min={0} step="0.001" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} {...invalid('weightKg')} />
              <small>{E.weightHint}</small>
            </label>
          </div>
        </section>

        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-cats">
          <h3 id="tx-shop-cats">{E.sections.categories}</h3>
          {categories.length === 0 ? <p className="tx-iam-muted">{E.noCategories}</p> : (
            <ul className="tx-shop-catpick">
              {parents.map((c) => (
                <li key={c.id}>
                  <label className="tx-iam-check">
                    <input type="checkbox" checked={form.categoryIds.includes(c.id)}
                      onChange={(e) => set('categoryIds', e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((x) => x !== c.id))} />
                    <span>{c.nameEn}{!c.isVisible && <span className="tx-iam-muted"> ({T.categories.hidden})</span>}</span>
                  </label>
                  {childrenOf(c.id).length > 0 && (
                    <ul>
                      {childrenOf(c.id).map((k) => (
                        <li key={k.id}>
                          <label className="tx-iam-check">
                            <input type="checkbox" checked={form.categoryIds.includes(k.id)}
                              onChange={(e) => set('categoryIds', e.target.checked ? [...form.categoryIds, k.id] : form.categoryIds.filter((x) => x !== k.id))} />
                            <span>{k.nameEn}{!k.isVisible && <span className="tx-iam-muted"> ({T.categories.hidden})</span>}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          <label className="tx-iam-check">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />
            <span>{E.featured}</span>
          </label>
        </section>

        <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-seo">
          <h3 id="tx-shop-seo">{E.sections.seo}</h3>
          <p className="tx-iam-hint">{E.seoHint}</p>
          <div className="tx-shop-langs">
            {(['En', 'Fr'] as const).map((L) => (
              <div key={L} className="tx-shop-lang" lang={L.toLowerCase()}>
                <h4>{L === 'En' ? E.english : E.french}</h4>
                <label className="tx-iam-field">
                  <span>{E.seoTitle}</span>
                  <input type="text" value={form[`seoTitle${L}`]} maxLength={120} onChange={(e) => set(`seoTitle${L}`, e.target.value)}
                    placeholder={L === 'En' ? form.nameEn : form.nameFr} />
                </label>
                <label className="tx-iam-field">
                  <span>{E.seoDescription}</span>
                  <textarea rows={2} value={form[`seoDescription${L}`]} maxLength={300} onChange={(e) => set(`seoDescription${L}`, e.target.value)}
                    placeholder={L === 'En' ? form.shortEn : form.shortFr} />
                </label>
                <div className="tx-shop-serp" aria-hidden="true">
                  <span className="tx-shop-serp__title">{(form[`seoTitle${L}`] || (L === 'En' ? form.nameEn : form.nameFr) || '—')} | TanEx</span>
                  <span className="tx-shop-serp__url">tanexsarl.com{L === 'En' ? '/shop/' : '/fr/boutique/'}{form[`slug${L}`]}</span>
                  <span className="tx-shop-serp__desc">{form[`seoDescription${L}`] || (L === 'En' ? form.shortEn : form.shortFr)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </fieldset>

      {/* Sticky action bar */}
      <div className="tx-shop-actionbar" role="region" aria-label={T.menu}>
        <div className="tx-shop-actionbar__msg" aria-live="polite">
          {notice ? <span className={notice.kind === 'error' ? 'is-error' : 'is-ok'}>{notice.text}</span>
            : dirty ? <span>{T.notices.unsaved}</span> : null}
        </div>
        <div className="tx-shop-actionbar__buttons">
          {editable && (
            <button type="button" className="tx-iam-btn primary" disabled={busy || !dirty} onClick={() => save()}>
              {busy ? T.actions.saving : saveLabel}
            </button>
          )}
          {status === 'DRAFT' && canWrite && !isPublisher && (
            <button type="button" className="tx-iam-btn" disabled={busy} onClick={() => changeStatus('IN_REVIEW')}>{T.actions.submit}</button>
          )}
          {isPublisher && (status === 'DRAFT' || status === 'IN_REVIEW') && (
            <button type="button" className="tx-iam-btn primary" disabled={busy} onClick={() => changeStatus('PUBLISHED')}>{T.actions.publish}</button>
          )}
          {isPublisher && status === 'IN_REVIEW' && (
            <button type="button" className="tx-iam-btn" disabled={busy} onClick={() => setDialog('sendBack')}>{T.actions.sendBack}</button>
          )}
          {isPublisher && status === 'PUBLISHED' && (
            <button type="button" className="tx-iam-btn" disabled={busy} onClick={() => changeStatus('HIDDEN')}>{T.actions.hide}</button>
          )}
          {isPublisher && status === 'HIDDEN' && (
            <button type="button" className="tx-iam-btn primary" disabled={busy} onClick={() => changeStatus('PUBLISHED')}>{T.actions.unhide}</button>
          )}
          {isPublisher && (status === 'PUBLISHED' || status === 'HIDDEN') && (
            <button type="button" className="tx-iam-btn danger" disabled={busy} onClick={() => changeStatus('ARCHIVED')}>{T.actions.archive}</button>
          )}
          {isPublisher && archived && (
            <button type="button" className="tx-iam-btn" disabled={busy} onClick={() => changeStatus('HIDDEN')}>{T.actions.restore}</button>
          )}
          {canWrite && (status === 'DRAFT' || status === 'IN_REVIEW') && (
            <button type="button" className="tx-iam-btn danger" disabled={busy} onClick={remove}>{T.actions.deleteDraft}</button>
          )}
        </div>
      </div>

      {dialog === 'stock' && (
        <StockDialog product={product} onClose={() => setDialog(null)} onSaved={(p) => {
          setProduct((cur) => (cur ? { ...cur, stockQty: p.stockQty } : p));
          setHistoryKey((k) => k + 1);
          setDialog(null);
          setNotice({ kind: 'ok', text: T.notices.saved });
        }} />
      )}
      {dialog === 'sendBack' && (
        <NoteDialog title={T.review.sendBackTitle} button={T.review.send} onClose={() => setDialog(null)} onSubmit={(note) => changeStatus('DRAFT', note)} />
      )}
      {dialog === 'reject' && (
        <NoteDialog title={T.review.rejectTitle} button={T.review.rejectButton} onClose={() => setDialog(null)} onSubmit={(note) => decide(false, note)} />
      )}
    </div>
  );
};
