// Stock for one product (docs/SHOP_SPEC.md §7.4): set a counted quantity or add/remove some, with a
// reason (a note for "Other"); applies at once, even on a live product. Below it, the stock
// history: every order, cancellation, return and adjustment with who and when.
import React, { useEffect, useState } from 'react';
import { IamDialog } from '../components/IamDialog';
import { STOCK_ADJUST_REASONS } from '../../shared/shopProduct';
import { shopApi, type Product, type StockMove } from './shopApi';
import { SHOP_TEXT, fill } from './strings';
import { when } from '../blog/studioUtil';

const T = SHOP_TEXT.stock;

const reasonText = (m: StockMove) => {
  if (m.reason !== 'ADJUST') return `${T.moves[m.reason] ?? m.reason}${m.orderNumber ? ` ${m.orderNumber}` : ''}`;
  // Adjustments store "REASON" or "REASON: note".
  const [code, ...rest] = (m.note ?? '').split(': ');
  return `${T.reasons[code] ?? T.moves.ADJUST}${rest.length ? `: ${rest.join(': ')}` : ''}`;
};

export const StockHistory: React.FC<{ productId: string; refreshKey: number }> = ({ productId, refreshKey }) => {
  const [moves, setMoves] = useState<StockMove[] | null>(null);
  useEffect(() => {
    let live = true;
    shopApi.stockMoves(productId).then((m) => { if (live) setMoves(m); }).catch(() => { if (live) setMoves([]); });
    return () => { live = false; };
  }, [productId, refreshKey]);
  if (moves === null) return <p className="tx-iam-muted" role="status">…</p>;
  if (moves.length === 0) return <p className="tx-iam-muted">{T.empty}</p>;
  return (
    <div className="tx-shop-table-wrap">
      <table className="tx-iam-table tx-shop-history">
        <thead>
          <tr>
            <th scope="col">{T.columns.when}</th>
            <th scope="col">{T.columns.change}</th>
            <th scope="col">{T.columns.after}</th>
            <th scope="col">{T.columns.reason}</th>
            <th scope="col">{T.columns.by}</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <tr key={m.id}>
              <td data-label={T.columns.when}>{when(m.at)}</td>
              <td data-label={T.columns.change} className={`tx-shop-num ${m.delta < 0 ? 'is-minus' : 'is-plus'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
              <td data-label={T.columns.after} className="tx-shop-num">{m.stockAfter}</td>
              <td data-label={T.columns.reason}>{reasonText(m)}</td>
              <td data-label={T.columns.by}>{m.by ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const StockDialog: React.FC<{
  product: Product;
  onClose: () => void;
  onSaved: (p: Product) => void;
}> = ({ product, onClose, onSaved }) => {
  const [mode, setMode] = useState<'set' | 'add'>('set');
  const [quantity, setQuantity] = useState(String(product.stockQty));
  const [reason, setReason] = useState<string>('COUNTED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number(quantity);
  const valid = quantity.trim() !== '' && Number.isInteger(n) && (mode === 'add' ? n !== 0 : n >= 0) && (reason !== 'OTHER' || note.trim() !== '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await shopApi.adjustStock(product.id, { mode, quantity: n, reason, note: note.trim() || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <IamDialog title={`${T.title}: ${product.nameEn}`} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <p className="tx-iam-sub">{fill(T.current, { n: product.stockQty })}</p>
        <fieldset className="tx-shop-radios">
          <label><input type="radio" name="tx-stock-mode" checked={mode === 'set'} onChange={() => { setMode('set'); setQuantity(String(product.stockQty)); setReason('COUNTED'); }} /> {T.setTo}</label>
          <label><input type="radio" name="tx-stock-mode" checked={mode === 'add'} onChange={() => { setMode('add'); setQuantity(''); setReason('RECEIVED'); }} /> {T.addRemove}</label>
        </fieldset>
        <label className="tx-iam-field">
          <span>{mode === 'set' ? T.newQuantity : T.change}</span>
          <input type="number" inputMode="numeric" step={1} min={mode === 'set' ? 0 : undefined} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>
        <label className="tx-iam-field">
          <span>{T.reason}</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {STOCK_ADJUST_REASONS.map((r) => <option key={r} value={r}>{T.reasons[r]}</option>)}
          </select>
        </label>
        <label className="tx-iam-field">
          <span>{reason === 'OTHER' ? T.noteRequired : T.note}</span>
          <input type="text" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} required={reason === 'OTHER'} />
        </label>
        {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{SHOP_TEXT.actions.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={!valid || busy}>{busy ? SHOP_TEXT.actions.saving : T.save}</button>
        </div>
      </form>
      <h3 className="tx-shop-subhead">{T.historyTitle}</h3>
      <StockHistory productId={product.id} refreshKey={0} />
    </IamDialog>
  );
};
