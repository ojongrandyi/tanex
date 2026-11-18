import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useAreaT } from '../../i18n/I18nProvider';
import type { ShopPicture } from '../../services/shopPublic';
import { ShopImage } from './ShopImage';

// Full-screen picture viewer for the product gallery (SHOP_SPEC §8, §16). A modal dialog: focus
// stays inside, Escape closes, arrow keys and swipes change the picture, a tap (or the zoom button)
// shows the 1200 px picture at twice the size around the point tapped, and moving the pointer then
// pans it. Fetched on the first tap only. The page behind does not scroll while it is open.

const SWIPE_MIN_PX = 40;

interface GalleryViewerProps {
  images: ShopPicture[];
  start: number;
  /** Closes the viewer; the gallery continues from the picture shown last. */
  onClose: (lastIndex: number) => void;
}

export const GalleryViewer: React.FC<GalleryViewerProps> = ({ images, start, onClose }) => {
  const t = useAreaT('shop');
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const total = images.length;
  const indexRef = useRef(index);
  indexRef.current = index;

  const show = (i: number) => {
    setZoom(null);
    setIndex((i + total) % total);
  };

  useEffect(() => {
    closeBtn.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // React passes portal events up to the gallery too; the viewer handles its own keys.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose(indexRef.current);
      return;
    }
    if (e.key === 'ArrowRight' && total > 1) {
      e.preventDefault();
      show(index + 1);
      return;
    }
    if (e.key === 'ArrowLeft' && total > 1) {
      e.preventDefault();
      show(index - 1);
      return;
    }
    if (e.key !== 'Tab' || !dialog.current) return;
    // Keep Tab inside the dialog.
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const pointAt = (el: HTMLElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100)),
    };
  };

  const picture = images[index];
  return createPortal(
    <div
      ref={dialog}
      className="tx-shop-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.pictureOf', { n: index + 1, total })}
      onKeyDown={onKeyDown}
    >
      <div className="tx-shop-viewer__bar">
        <p className="tx-shop-viewer__pos" aria-live="polite">{t('gallery.pictureOf', { n: index + 1, total })}</p>
        <button
          type="button"
          className="tx-shop-viewer__btn"
          onClick={() => setZoom(zoom ? null : { x: 50, y: 50 })}
          aria-label={zoom ? t('gallery.zoomOut') : t('gallery.zoomIn')}
          aria-pressed={zoom !== null}
        >
          {zoom ? <ZoomOut aria-hidden="true" /> : <ZoomIn aria-hidden="true" />}
        </button>
        <button ref={closeBtn} type="button" className="tx-shop-viewer__btn" onClick={() => onClose(index)} aria-label={t('gallery.close')}>
          <X aria-hidden="true" />
        </button>
      </div>

      <div
        className={`tx-shop-viewer__stage${zoom ? ' is-zoomed' : ''}`}
        onClick={(e) => setZoom(zoom ? null : pointAt(e.currentTarget, e.clientX, e.clientY))}
        onMouseMove={(e) => {
          if (zoom) setZoom(pointAt(e.currentTarget, e.clientX, e.clientY));
        }}
        onTouchStart={(e) => {
          touchX.current = zoom ? null : e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const startX = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (startX === null || end === undefined || total < 2) return;
          if (end - startX <= -SWIPE_MIN_PX) show(index + 1);
          else if (end - startX >= SWIPE_MIN_PX) show(index - 1);
        }}
      >
        <div className="tx-shop-viewer__frame" style={zoom ? { transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}>
          <ShopImage key={picture.urls.w1200} picture={picture} eager sizes="(min-width: 1200px) 1200px, 100vw" />
        </div>
      </div>

      {total > 1 && (
        <>
          <button type="button" className="tx-shop-viewer__nav tx-shop-viewer__nav--prev" onClick={() => show(index - 1)} aria-label={t('gallery.previous')}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="tx-shop-viewer__nav tx-shop-viewer__nav--next" onClick={() => show(index + 1)} aria-label={t('gallery.next')}>
            <ChevronRight aria-hidden="true" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
};
