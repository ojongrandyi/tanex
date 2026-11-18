// Crop step for shop pictures (docs/SHOP_SPEC.md §6): a square frame with Fill (drag + zoom) or
// Fit whole picture (on white or cream), quarter turns, a size warning, then the five square files
// are made in the browser and uploaded. The product editor (M.3) opens one dialog per chosen file.
// Keyboard: arrow keys move the picture, + and − zoom, inside the preview.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IamDialog } from '../components/IamDialog';
import { loadImage, looksLikeImage } from '../../services/imageCompress';
import {
  MAX_ZOOM, SHOP_IMAGE_MAX_INPUT_BYTES, clampCrop, initialCrop, panCrop, rotatedSize, sourceQuality,
  type CropState, type ShopImageBackground,
} from '../../shared/shopImages';
import { drawSquare, makeSquareFiles, rotateSource, type ImageSource } from './squareImage';
import { shopApi, type ShopMedia } from './shopApi';
import { SHOP_TEXT } from './strings';
import './SquareCropDialog.css';

const T = SHOP_TEXT.crop;
const PREVIEW = 300; // CSS pixels
const KEY_STEP = 12;

export const SquareCropDialog: React.FC<{
  file: File;
  onUploaded: (media: ShopMedia) => void;
  onCancel: () => void;
}> = ({ file, onUploaded, onCancel }) => {
  const [src, setSrc] = useState<ImageSource | null>(null);
  const [crop, setCrop] = useState<CropState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'preparing' | 'uploading'>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Load the file once.
  useEffect(() => {
    let cancelled = false;
    if (!looksLikeImage(file)) { setError(T.notImage); return; }
    if (file.size > SHOP_IMAGE_MAX_INPUT_BYTES) { setError(T.tooLarge); return; }
    loadImage(file)
      .then((img) => {
        if (cancelled) return;
        setSrc(img);
        setCrop(initialCrop(img.width, img.height));
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message || T.notImage); });
    return () => { cancelled = true; };
  }, [file]);

  const rotated = useMemo(() => (src && crop ? rotateSource(src, crop.rotation) : null), [src, crop?.rotation]);

  // Redraw the preview whenever the crop changes (sharp on high-density screens).
  useEffect(() => {
    if (!src || !crop || !rotated || !canvasRef.current) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    drawSquare(rotated, crop, src.width, src.height, Math.round(PREVIEW * dpr), canvasRef.current);
  }, [src, crop, rotated]);

  const quality = src && crop ? sourceQuality(crop, src.width, src.height) : 'ok';
  const update = useCallback((next: (c: CropState) => CropState) => {
    setCrop((c) => (c && src ? clampCrop(next(c), src.width, src.height) : c));
  }, [src]);

  const move = (dx: number, dy: number) => {
    if (!src) return;
    // The preview can be narrower than PREVIEW on a phone; drag by what is really on screen.
    const shown = canvasRef.current?.clientWidth || PREVIEW;
    setCrop((c) => (c ? panCrop(c, src.width, src.height, dx, dy, shown) : c));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (crop?.mode !== 'fill') return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    move(dx, dy);
  };
  const endDrag = () => { drag.current = null; };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!crop) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP],
    };
    if (moves[e.key] && crop.mode === 'fill') { e.preventDefault(); move(...moves[e.key]); }
    else if ((e.key === '+' || e.key === '=') && crop.mode === 'fill') { e.preventDefault(); update((c) => ({ ...c, zoom: c.zoom + 0.1 })); }
    else if (e.key === '-' && crop.mode === 'fill') { e.preventDefault(); update((c) => ({ ...c, zoom: c.zoom - 0.1 })); }
  };

  const save = async (useCrop: CropState) => {
    if (!src || busy) return;
    if (sourceQuality(useCrop, src.width, src.height) === 'too_small') { setError(T.tooSmall); return; }
    setError(null);
    try {
      setBusy('preparing');
      const made = await makeSquareFiles(src, useCrop);
      URL.revokeObjectURL(made.previewUrl);
      setBusy('uploading');
      const media = await shopApi.uploadMedia(made.files);
      onUploaded(media);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : T.failed);
      setBusy(null);
    }
  };

  const dims = src && crop ? rotatedSize(src.width, src.height, crop.rotation) : null;

  return (
    <IamDialog title={T.title} onClose={busy ? () => {} : onCancel}>
      <div className="tx-shop-crop">
        <div className="tx-shop-crop__stage">
          <canvas
            ref={canvasRef}
            className={`tx-shop-crop__preview${crop?.mode === 'fill' ? ' is-draggable' : ''}`}
            style={{ width: PREVIEW }}
            role="img"
            aria-label={T.previewLabel}
            tabIndex={crop?.mode === 'fill' ? 0 : -1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
          />
          {!src && !error && <p className="tx-iam-muted">{T.preparing}</p>}
        </div>

        {crop && src && (
          <div className="tx-shop-crop__controls">
            <fieldset className="tx-shop-crop__group">
              <legend>{T.shape}</legend>
              <label><input type="radio" name="tx-crop-mode" checked={crop.mode === 'fill'} onChange={() => update((c) => ({ ...c, mode: 'fill' }))} /> {T.fill}</label>
              <label><input type="radio" name="tx-crop-mode" checked={crop.mode === 'fit'} onChange={() => update((c) => ({ ...c, mode: 'fit' }))} /> {T.fit}</label>
            </fieldset>

            {crop.mode === 'fill' ? (
              <label className="tx-shop-crop__zoom">
                <span>{T.zoom}</span>
                <input
                  type="range" min={1} max={MAX_ZOOM} step={0.05} value={crop.zoom}
                  onChange={(e) => update((c) => ({ ...c, zoom: Number(e.target.value) }))}
                />
              </label>
            ) : null}

            <fieldset className="tx-shop-crop__group">
              <legend>{T.background}</legend>
              {(['white', 'cream'] as ShopImageBackground[]).map((bg) => (
                <label key={bg}>
                  <input type="radio" name="tx-crop-bg" checked={crop.background === bg} onChange={() => update((c) => ({ ...c, background: bg }))} />
                  <span className={`tx-shop-crop__swatch is-${bg}`} aria-hidden="true" /> {bg === 'white' ? T.white : T.cream}
                </label>
              ))}
            </fieldset>

            <button type="button" className="tx-iam-btn small" onClick={() => update((c) => ({ ...c, rotation: ((c.rotation + 1) % 4) as CropState['rotation'] }))}>
              {T.rotate}
            </button>

            {crop.mode === 'fill' && <p className="tx-iam-hint">{T.dragHint}</p>}
            {dims && <p className="tx-iam-muted tx-shop-crop__dims">{dims.w} × {dims.h} px</p>}
          </div>
        )}
      </div>

      {quality === 'soft' && !error && <p className="tx-iam-notice" role="status">{T.soft}</p>}
      {quality === 'too_small' && <p className="tx-iam-notice error" role="alert">{T.tooSmall}</p>}
      {error && <p className="tx-iam-notice error" role="alert">{error}</p>}

      <div className="tx-iam-dialog-actions">
        <button type="button" className="tx-iam-btn" onClick={onCancel} disabled={!!busy}>{T.cancel}</button>
        <button
          type="button" className="tx-iam-btn"
          disabled={!src || !!busy}
          onClick={() => src && save(initialCrop(src.width, src.height))}
        >
          {T.skip}
        </button>
        <button
          type="button" className="tx-iam-btn primary"
          disabled={!crop || !!busy || quality === 'too_small'}
          onClick={() => crop && save(crop)}
        >
          {busy === 'preparing' ? T.preparing : busy === 'uploading' ? T.uploading : T.use}
        </button>
      </div>
    </IamDialog>
  );
};
