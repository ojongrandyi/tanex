import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../services/api';
import { compressImage, ImageCompressError } from '../../services/imageCompress';
import { AdminShipmentImage } from '../../types/shipment';
import { legacyPhotoUrls } from '../../shared/legacyPhotos';
import './ShipmentImagesPanel.css';
import { SHIPMENT_IMAGES_PANEL_TEXT as TXT } from './ShipmentImagesPanel.text';

// Same limits as server/routes/shipmentImages.ts.
const MAX_IMAGES = 20;
const MAX_CAPTION = 120;

interface PendingImage {
  key: string;
  file: File;
  previewUrl: string;
  caption: string;
  isPublic: boolean;
  busy: boolean;
  error?: string;
}

interface ShipmentImagesPanelProps {
  trackingNumber: string;
  /** Older photo URLs on the record (photos_json): shown read-only, never edited here. */
  legacyPhotos?: string[];
}

/**
 * Package images for one shipment (docs/update.md B.3). Every change is saved straight away
 * through the images API, independently of any surrounding form's Save button.
 */
export const ShipmentImagesPanel: React.FC<ShipmentImagesPanelProps> = ({ trackingNumber, legacyPhotos }) => {
  const legacy = legacyPhotoUrls(legacyPhotos);
  const [images, setImages] = useState<AdminShipmentImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingImage[]>([]);
  pendingRef.current = pending;
  // Bumped by "Try again" after a failed load (update I.6).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    api.getShipmentImages(trackingNumber)
      .then((list) => { if (!cancelled) { setImages(list); setLoadError(''); } })
      .catch((err) => { if (!cancelled) setLoadError(err.message || TXT.couldNotLoadImages); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trackingNumber, reloadKey]);

  // Release the local previews when the panel closes.
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const applyList = (list: AdminShipmentImage[], text: string) => {
    setImages(list);
    setCaptionDrafts({});
    setMessage({ text });
  };

  const fail = (err: any, fallback: string) => setMessage({ text: err?.message || fallback, error: true });

  const addFiles = (files: FileList | File[]) => {
    const room = MAX_IMAGES - images.length - pending.length;
    const list = Array.from(files);
    if (room <= 0) {
      setMessage({ text: TXT.maxImages(MAX_IMAGES), error: true });
      return;
    }
    const accepted = list.slice(0, room).map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      isPublic: true,
      busy: false,
    }));
    setPending((prev) => [...prev, ...accepted]);
    setMessage(list.length > room
      ? { text: TXT.onlyMore(room, MAX_IMAGES), error: true }
      : { text: TXT.readyToUpload(accepted.length) });
  };

  const updatePending = (key: string, patch: Partial<PendingImage>) =>
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removePending = (key: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const uploadOne = async (item: PendingImage) => {
    const caption = item.caption.trim();
    if (!caption) {
      updatePending(item.key, { error: TXT.captionMissing });
      return;
    }
    updatePending(item.key, { busy: true, error: undefined });
    try {
      const compressed = await compressImage(item.file);
      const list = await api.uploadShipmentImage(trackingNumber, {
        base64: compressed.base64,
        caption,
        isPublic: item.isPublic,
        width: compressed.width,
        height: compressed.height,
      });
      removePending(item.key);
      applyList(list, TXT.uploaded(caption));
    } catch (err: any) {
      updatePending(item.key, {
        busy: false,
        error: err instanceof ImageCompressError ? err.message : (err?.message || TXT.uploadFailed),
      });
    }
  };

  const uploadAll = async () => {
    for (const item of pendingRef.current) {
      if (!item.busy) await uploadOne(item);
    }
  };

  const saveCaption = async (image: AdminShipmentImage) => {
    const draft = captionDrafts[image.id];
    if (draft === undefined) return;
    const caption = draft.trim();
    if (caption === image.caption) {
      setCaptionDrafts(({ [image.id]: _, ...rest }) => rest);
      return;
    }
    if (!caption) {
      setCaptionDrafts(({ [image.id]: _, ...rest }) => rest);
      setMessage({ text: TXT.captionKept, error: true });
      return;
    }
    setBusyId(image.id);
    try {
      applyList(await api.updateShipmentImage(trackingNumber, image.id, { caption }), TXT.captionSaved);
    } catch (err) {
      fail(err, TXT.captionSaveFailed);
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisibility = async (image: AdminShipmentImage) => {
    setBusyId(image.id);
    try {
      const list = await api.updateShipmentImage(trackingNumber, image.id, { isPublic: !image.isPublic });
      applyList(list, image.isPublic ? TXT.nowHidden(image.caption) : TXT.nowShown(image.caption));
    } catch (err) {
      fail(err, TXT.visibilityFailed);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const ids = images.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusyId(images[index].id);
    try {
      applyList(await api.reorderShipmentImages(trackingNumber, ids), TXT.orderSaved);
    } catch (err) {
      fail(err, TXT.orderFailed);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (image: AdminShipmentImage) => {
    if (!window.confirm(TXT.deleteTheImageThisCannot(image.caption))) return;
    setBusyId(image.id);
    try {
      applyList(await api.deleteShipmentImage(trackingNumber, image.id), TXT.deleted(image.caption));
    } catch (err) {
      fail(err, TXT.deleteFailed);
    } finally {
      setBusyId(null);
    }
  };

  // This panel sits inside the Edit Shipment form: Enter must never submit that form.
  const stopEnter = (e: React.KeyboardEvent<HTMLInputElement>, action?: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action?.();
    }
  };

  const total = images.length + pending.length;
  const readyCount = pending.filter((p) => !p.busy).length;

  return (
    <section className="tx-images-panel" aria-labelledby={`tx-images-${trackingNumber}`}>
      <div className="tx-images-head">
        <h4 id={`tx-images-${trackingNumber}`}>{TXT.packageImages}</h4>
        <span className="tx-images-count">{images.length} / {MAX_IMAGES}</span>
      </div>
      <p className="tx-images-hint">
        {TXT.savedAsSoonAsYou}
      </p>

      <div
        className={`tx-images-drop${dragOver ? ' is-over' : ''}${total >= MAX_IMAGES ? ' is-full' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={20} aria-hidden="true" />
        <span>{TXT.dragPhotosHereOr}</span>
        <button type="button" className="tx-images-btn" onClick={() => fileInputRef.current?.click()} disabled={total >= MAX_IMAGES}>
          {TXT.chooseFiles}
        </button>
        <span className="tx-images-drop-note">{TXT.jpgPngWebpOrHeic}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {pending.length > 0 && (
        <div className="tx-images-pending">
          {pending.map((p) => (
            <div className="tx-images-pending-row" key={p.key}>
              <img src={p.previewUrl} alt="" width={64} height={64} />
              <div className="tx-images-pending-fields">
                <label className="tx-images-label" htmlFor={`cap-${p.key}`}>{TXT.captionRequired}</label>
                <input
                  id={`cap-${p.key}`}
                  type="text"
                  value={p.caption}
                  maxLength={MAX_CAPTION}
                  placeholder={TXT.eGIphone15Sealed}
                  onChange={(e) => updatePending(p.key, { caption: e.target.value, error: undefined })}
                  onKeyDown={(e) => stopEnter(e, () => uploadOne(p))}
                  disabled={p.busy}
                  aria-invalid={!!p.error}
                />
                <label className="tx-images-check">
                  <input type="checkbox" checked={p.isPublic} onChange={(e) => updatePending(p.key, { isPublic: e.target.checked })} disabled={p.busy} />
                  <span>{TXT.showOnTheTrackPage}</span>
                </label>
                {p.error && <p className="tx-images-error">{p.error}</p>}
              </div>
              <div className="tx-images-pending-actions">
                <button type="button" className="tx-images-btn primary" onClick={() => uploadOne(p)} disabled={p.busy}>
                  {p.busy ? <Loader2 size={14} className="tx-images-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                  <span>{p.busy ? TXT.uploading : TXT.upload}</span>
                </button>
                <button type="button" className="tx-images-icon-btn" onClick={() => removePending(p.key)} disabled={p.busy} aria-label={TXT.removeThisFile}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
          {readyCount > 1 && (
            <button type="button" className="tx-images-btn primary tx-images-upload-all" onClick={uploadAll}>
              <Upload size={14} aria-hidden="true" />
              <span>{TXT.uploadAll}{readyCount})</span>
            </button>
          )}
        </div>
      )}

      <p className={`tx-images-status${message?.error ? ' is-error' : ''}`} role="status" aria-live="polite">
        {message?.text}
      </p>

      {loading ? (
        <p className="tx-images-empty">{TXT.loadingImages}</p>
      ) : loadError ? (
        <div className="tx-load-error" role="alert">
          <p className="tx-images-error">{loadError}</p>
          <button type="button" className="tx-load-retry" onClick={() => setReloadKey((k) => k + 1)}>{TXT.tryAgain}</button>
        </div>
      ) : images.length === 0 ? (
        <p className="tx-images-empty">{TXT.noImagesYet}</p>
      ) : (
        <ul className="tx-images-grid">
          {images.map((image, index) => {
            const busy = busyId === image.id;
            return (
              <li key={image.id} className={`tx-images-card${image.isPublic ? '' : ' is-hidden'}`}>
                <div className="tx-images-thumb">
                  <img
                    src={image.adminUrl}
                    alt={image.caption}
                    width={image.width ?? 160}
                    height={image.height ?? 120}
                    loading="lazy"
                  />
                  {!image.isPublic && <span className="tx-images-badge">{TXT.hidden}</span>}
                </div>
                <label className="tx-images-label" htmlFor={`cap-${image.id}`}>{TXT.caption}</label>
                <input
                  id={`cap-${image.id}`}
                  type="text"
                  value={captionDrafts[image.id] ?? image.caption}
                  maxLength={MAX_CAPTION}
                  onChange={(e) => setCaptionDrafts((d) => ({ ...d, [image.id]: e.target.value }))}
                  onBlur={() => saveCaption(image)}
                  onKeyDown={(e) => stopEnter(e, () => (e.target as HTMLInputElement).blur())}
                  disabled={busy}
                />
                <div className="tx-images-card-actions">
                  <button type="button" className="tx-images-icon-btn" onClick={() => toggleVisibility(image)} disabled={busy}
                    aria-label={image.isPublic ? TXT.hideFromTheTrackPage(image.caption) : TXT.showOnTheTrackPage2(image.caption)}
                    title={image.isPublic ? TXT.visibleOnTheTrackPage : TXT.hiddenFromTheTrackPage}>
                    {image.isPublic ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                  </button>
                  <button type="button" className="tx-images-icon-btn" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={TXT.moveEarlier(image.caption)}>
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="tx-images-icon-btn" onClick={() => move(index, 1)} disabled={busy || index === images.length - 1} aria-label={TXT.moveLater(image.caption)}>
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button type="button" className="tx-images-icon-btn danger" onClick={() => remove(image)} disabled={busy} aria-label={TXT.delete(image.caption)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                  {busy && <Loader2 size={14} className="tx-images-spin" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {legacy.length > 0 && (
        <div className="tx-images-legacy">
          <h5>{TXT.earlierPhotosReadOnly}</h5>
          <p className="tx-images-hint">{TXT.savedOnThisShipmentBefore}</p>
          <ul className="tx-images-grid">
            {legacy.map((url, i) => (
              <li key={`${i}-${url.slice(0, 80)}`} className="tx-images-card">
                <div className="tx-images-thumb">
                  <img src={url} alt={TXT.shipmentPhoto2(i + 1)} width={160} height={120} loading="lazy" />
                </div>
                <p className="tx-images-legacy-label">{TXT.shipmentPhoto} {i + 1}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
