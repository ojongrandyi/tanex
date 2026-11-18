import React from 'react';
import type { ShopPicture } from '../../services/shopPublic';

// One square shop picture (SHOP_SPEC §6): WebP 300/600/1200 in <picture>, JPEG 600/1200 as the
// fallback, always width/height 1200 so the box never shifts. The box around it (CSS) is square
// with object-fit: cover, so a picture of any shape still lines up with the grid. When the console
// could not encode WebP, the "w" files are JPEG and are used directly.

interface ShopImageProps {
  picture: ShopPicture;
  /** The `sizes` attribute: how wide the picture shows at each screen width. */
  sizes: string;
  /** Loads at once (the first row of the grid, the product page's main picture). */
  eager?: boolean;
  /** fetchpriority="high": only the product page's main picture. */
  priority?: boolean;
  className?: string;
  /** Empty alt for a picture whose name is right next to it (cards, thumbnails). */
  decorative?: boolean;
}

const isWebp = (url: string) => /\.webp$/i.test(url);

export const ShopImage: React.FC<ShopImageProps> = ({ picture, sizes, eager, priority, className, decorative }) => {
  const { urls } = picture;
  const webp = isWebp(urls.w1200);
  const scaled = `${urls.w300} 300w, ${urls.w600} 600w, ${urls.w1200} 1200w`;
  // React 18 doesn't know the fetchPriority prop yet, so pass the raw attribute.
  const high = priority ? { fetchpriority: 'high' } : {};
  return (
    <picture className={className}>
      {webp && <source type="image/webp" srcSet={scaled} sizes={sizes} />}
      <img
        src={urls.j600}
        srcSet={webp ? `${urls.j600} 600w, ${urls.j1200} 1200w` : scaled}
        sizes={sizes}
        width={1200}
        height={1200}
        alt={decorative ? '' : picture.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        {...high}
      />
    </picture>
  );
};
