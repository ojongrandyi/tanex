// A product's pictures in the editor (docs/SHOP_SPEC.md §6, §7.2): add several at once (each goes
// through the crop step in turn), reorder, choose the main picture (the first), alt text in both
// languages, remove. The parent saves the list with the product.
import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { MAX_PRODUCT_IMAGES } from '../../shared/shopProduct';
import { SquareCropDialog } from './SquareCropDialog';
import type { ShopMedia } from './shopApi';
import { SHOP_TEXT, fill } from './strings';

const T = SHOP_TEXT.pictures;

export interface EditorPicture { mediaId: string; urls: ShopMedia['urls']; altEn: string; altFr: string }

export const PictureManager: React.FC<{
  pictures: EditorPicture[];
  onChange: (next: EditorPicture[]) => void;
  disabled?: boolean;
  productName: string;
}> = ({ pictures, onChange, disabled, productName }) => {
  const [queue, setQueue] = useState<File[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const room = MAX_PRODUCT_IMAGES - pictures.length;

  const choose = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    setQueue(picked);
    setQueueTotal(picked.length);
    if (inputRef.current) inputRef.current.value = '';
  };
  const nextInQueue = () => setQueue((q) => q.slice(1));
  // Latest list, so pictures uploaded one after another all land (the dialog closes between them).
  const latest = useRef(pictures);
  latest.current = pictures;
  const added = (m: ShopMedia) => {
    onChange([...latest.current, { mediaId: m.id, urls: m.urls, altEn: '', altFr: '' }]);
    nextInQueue();
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pictures.length) return;
    const next = [...pictures];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    onChange(next);
  };
  const update = (i: number, patch: Partial<EditorPicture>) => onChange(pictures.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="tx-shop-pictures">
      <p className="tx-iam-hint">{fill(T.hint, { n: MAX_PRODUCT_IMAGES })}</p>
      {pictures.length > 0 && (
        <ol className="tx-shop-pictures__grid">
          {pictures.map((p, i) => (
            <li key={p.mediaId} className={`tx-shop-picture${i === 0 ? ' is-main' : ''}`}>
              <div className="tx-shop-picture__frame">
                <img src={p.urls.w300} width={300} height={300} alt={p.altEn || productName} loading="lazy" />
                {i === 0 && <span className="tx-shop-picture__badge"><Star size={12} aria-hidden="true" /> {T.main}</span>}
              </div>
              {!disabled && (
                <div className="tx-shop-picture__tools">
                  <button type="button" className="tx-iam-btn small" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`${T.moveLeft}: ${fill(T.picture, { n: i + 1 })}`} title={T.moveLeft}><ArrowLeft size={14} aria-hidden="true" /></button>
                  <button type="button" className="tx-iam-btn small" onClick={() => move(i, i + 1)} disabled={i === pictures.length - 1} aria-label={`${T.moveRight}: ${fill(T.picture, { n: i + 1 })}`} title={T.moveRight}><ArrowRight size={14} aria-hidden="true" /></button>
                  {i > 0 && <button type="button" className="tx-iam-btn small" onClick={() => move(i, 0)}>{T.makeMain}</button>}
                  <button type="button" className="tx-iam-btn small danger" onClick={() => onChange(pictures.filter((_, j) => j !== i))} aria-label={`${T.remove}: ${fill(T.picture, { n: i + 1 })}`} title={T.remove}><Trash2 size={14} aria-hidden="true" /></button>
                </div>
              )}
              <label className="tx-iam-field">
                <span>{T.altEn}</span>
                <input type="text" value={p.altEn} maxLength={200} disabled={disabled} onChange={(e) => update(i, { altEn: e.target.value })} placeholder={productName} />
              </label>
              <label className="tx-iam-field">
                <span>{T.altFr}</span>
                <input type="text" value={p.altFr} maxLength={200} disabled={disabled} onChange={(e) => update(i, { altFr: e.target.value })} lang="fr" />
              </label>
            </li>
          ))}
        </ol>
      )}
      {pictures.length > 0 && <p className="tx-iam-muted tx-shop-pictures__alt">{T.altHint}</p>}
      {!disabled && (
        room > 0 ? (
          <label className="tx-iam-btn tx-shop-pictures__add">
            <ImagePlus size={16} aria-hidden="true" /> {T.add}
            <input ref={inputRef} type="file" accept="image/*" multiple className="tx-shop-visually-hidden" onChange={(e) => choose(e.target.files)} />
          </label>
        ) : (
          <p className="tx-iam-muted">{fill(T.full, { n: MAX_PRODUCT_IMAGES })}</p>
        )
      )}
      {queue[0] && (
        <SquareCropDialog
          key={`${queue[0].name}-${queue.length}`}
          file={queue[0]}
          progress={queueTotal > 1 ? { n: queueTotal - queue.length + 1, total: queueTotal } : undefined}
          onUploaded={added}
          onCancel={nextInQueue}
        />
      )}
    </div>
  );
};
