import React, { Suspense, lazy, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, ShoppingCart } from 'lucide-react';
import { useAreaT } from '../../i18n/I18nProvider';
import type { ShopPicture } from '../../services/shopPublic';
import { ShopImage } from './ShopImage';

// Product gallery (SHOP_SPEC §8): the main square picture with thumbnails, previous/next buttons,
// arrow keys and a swipe on phones. A tap on the picture opens the full-screen viewer, whose code
// is fetched on that first tap (GalleryViewer.tsx).

const GalleryViewer = lazy(() => import('./GalleryViewer').then((m) => ({ default: m.GalleryViewer })));

const SWIPE_MIN_PX = 40;

export const ProductGallery: React.FC<{ images: ShopPicture[]; name: string }> = ({ images, name }) => {
  const t = useAreaT('shop');
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const total = images.length;

  if (total === 0) {
    return (
      <div className="tx-shop-gallery">
        <div className="tx-shop-gallery__main tx-shop-gallery__main--empty" role="img" aria-label={name}>
          <ShoppingCart aria-hidden="true" />
        </div>
      </div>
    );
  }

  const show = (i: number) => setIndex((i + total) % total);
  const current = images[Math.min(index, total - 1)];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (total < 2) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      show(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      show(index - 1);
    }
  };

  return (
    <div
      className="tx-shop-gallery"
      role="group"
      aria-roledescription="carousel"
      aria-label={t('gallery.label')}
      onKeyDown={onKeyDown}
    >
      <div
        className="tx-shop-gallery__main"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined || total < 2) return;
          if (end - start <= -SWIPE_MIN_PX) show(index + 1);
          else if (end - start >= SWIPE_MIN_PX) show(index - 1);
        }}
      >
        <button
          ref={opener}
          type="button"
          className="tx-shop-gallery__open"
          onClick={() => setViewer(true)}
          aria-label={`${t('gallery.fullScreen')}: ${t('gallery.pictureOf', { n: index + 1, total })}`}
        >
          <ShopImage
            key={current.urls.w1200}
            picture={current}
            eager
            priority={index === 0}
            sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
          />
          <span className="tx-shop-gallery__zoom" aria-hidden="true"><Maximize2 /></span>
        </button>
        {total > 1 && (
          <>
            <button type="button" className="tx-shop-gallery__nav tx-shop-gallery__nav--prev" onClick={() => show(index - 1)} aria-label={t('gallery.previous')}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="tx-shop-gallery__nav tx-shop-gallery__nav--next" onClick={() => show(index + 1)} aria-label={t('gallery.next')}>
              <ChevronRight aria-hidden="true" />
            </button>
            <p className="tx-shop-gallery__pos" aria-live="polite">{t('gallery.pictureOf', { n: index + 1, total })}</p>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className="tx-shop-gallery__thumbs">
          {images.map((img, i) => (
            <li key={img.urls.w300}>
              <button
                type="button"
                className={`tx-shop-gallery__thumb${i === index ? ' is-current' : ''}`}
                aria-current={i === index ? 'true' : undefined}
                aria-label={t('gallery.pictureOf', { n: i + 1, total })}
                onClick={() => show(i)}
              >
                <ShopImage picture={img} decorative sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewer && (
        <Suspense fallback={null}>
          <GalleryViewer
            images={images}
            start={index}
            onClose={(last) => {
              setViewer(false);
              setIndex(last);
              opener.current?.focus();
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
