// Shop pictures (docs/SHOP_SPEC.md §6): every product and category picture is a square stored in
// the same five files, made in the browser (the crop step) and checked byte for byte by the server
// (POST /api/admin/shop/media), so a wrong size can never reach the shop. Also the crop geometry,
// kept here (DOM-free) so it can be tested. No image library runs on the server (docs/update.md).

export type ShopImageFormat = 'webp' | 'jpeg';

export interface ShopImageSlot {
  /** Width and height in pixels (always square). */
  size: number;
  /** WebP slots fall back to JPEG when the browser can't encode WebP. */
  formats: readonly ShopImageFormat[];
  maxBytes: number;
}

export const SHOP_IMAGE_SLOTS = {
  w1200: { size: 1200, formats: ['webp', 'jpeg'], maxBytes: 700 * 1024 },
  w600: { size: 600, formats: ['webp', 'jpeg'], maxBytes: 250 * 1024 },
  w300: { size: 300, formats: ['webp', 'jpeg'], maxBytes: 90 * 1024 },
  j1200: { size: 1200, formats: ['jpeg'], maxBytes: 800 * 1024 },
  j600: { size: 600, formats: ['jpeg'], maxBytes: 280 * 1024 },
} as const satisfies Record<string, ShopImageSlot>;

export type ShopImageSlotKey = keyof typeof SHOP_IMAGE_SLOTS;
export const SHOP_IMAGE_SLOT_KEYS = Object.keys(SHOP_IMAGE_SLOTS) as ShopImageSlotKey[];

/** Output edge of the largest file. */
export const SHOP_IMAGE_SIZE = 1200;
/** Below this many source pixels across the crop, the photo is refused (too small). */
export const SHOP_IMAGE_MIN_SOURCE = 400;
/** Before processing, in the browser. */
export const SHOP_IMAGE_MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const SHOP_IMAGE_QUALITY = 0.85;

/** Background for "Fit whole picture" and for flattening transparent PNGs. */
export const SHOP_IMAGE_BACKGROUNDS = {
  white: '#FFFFFF',
  cream: '#FFFCF7', // Cream 50 (--tx-cream-50, BRAND_GUIDE)
} as const;
export type ShopImageBackground = keyof typeof SHOP_IMAGE_BACKGROUNDS;

// ---- Crop geometry ----

export type CropMode = 'fill' | 'fit';

export interface CropState {
  mode: CropMode;
  /** Quarter turns clockwise (0–3), applied to the source before cropping. */
  rotation: 0 | 1 | 2 | 3;
  /** Fill only: 1 = the largest square that fits; up to MAX_ZOOM = closer. */
  zoom: number;
  /** Fill only: centre of the square, as a fraction (0–1) of the rotated source. */
  cx: number;
  cy: number;
  background: ShopImageBackground;
}

export const MAX_ZOOM = 4;

/** Width and height after the quarter turns. */
export function rotatedSize(w: number, h: number, rotation: number): { w: number; h: number } {
  return rotation % 2 === 1 ? { w: h, h: w } : { w, h };
}

/** Nearly square photos fill the frame; any other shape starts as "fit whole picture" (§6). */
export function initialCrop(w: number, h: number): CropState {
  const ratio = w / h;
  const nearSquare = ratio >= 0.9 && ratio <= 1.1;
  return { mode: nearSquare ? 'fill' : 'fit', rotation: 0, zoom: 1, cx: 0.5, cy: 0.5, background: 'white' };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keeps zoom in range and the fill square inside the (rotated) source. */
export function clampCrop(c: CropState, w: number, h: number): CropState {
  const { w: rw, h: rh } = rotatedSize(w, h, c.rotation);
  const zoom = clamp(Number.isFinite(c.zoom) ? c.zoom : 1, 1, MAX_ZOOM);
  const side = Math.min(rw, rh) / zoom;
  const hx = side / 2 / rw;
  const hy = side / 2 / rh;
  return { ...c, zoom, cx: clamp(c.cx, hx, 1 - hx), cy: clamp(c.cy, hy, 1 - hy) };
}

export interface DrawPlan {
  /** Source rectangle in the rotated source, in source pixels. */
  sx: number; sy: number; sw: number; sh: number;
  /** Where it goes in the square output of edge `size`. */
  dx: number; dy: number; dw: number; dh: number;
}

/** Where to take the picture from and where to draw it, for an output square of edge `size`. */
export function drawPlan(c: CropState, w: number, h: number, size: number): DrawPlan {
  const { w: rw, h: rh } = rotatedSize(w, h, c.rotation);
  if (c.mode === 'fit') {
    const scale = size / Math.max(rw, rh);
    const dw = rw * scale;
    const dh = rh * scale;
    return { sx: 0, sy: 0, sw: rw, sh: rh, dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh };
  }
  const cc = clampCrop(c, w, h);
  const side = Math.min(rw, rh) / cc.zoom;
  return { sx: cc.cx * rw - side / 2, sy: cc.cy * rh - side / 2, sw: side, sh: side, dx: 0, dy: 0, dw: size, dh: size };
}

/** Moves the fill square by a drag of (dx, dy) pixels on a preview of edge `previewSize`. */
export function panCrop(c: CropState, w: number, h: number, dx: number, dy: number, previewSize: number): CropState {
  if (c.mode !== 'fill') return c;
  const { w: rw, h: rh } = rotatedSize(w, h, c.rotation);
  const side = Math.min(rw, rh) / clamp(c.zoom, 1, MAX_ZOOM);
  const perPreviewPx = side / previewSize; // source pixels per preview pixel
  // Dragging the picture right shows more of its left side, so the centre moves left.
  return clampCrop({ ...c, cx: c.cx - (dx * perPreviewPx) / rw, cy: c.cy - (dy * perPreviewPx) / rh }, w, h);
}

export type SourceQuality = 'ok' | 'soft' | 'too_small';

/** How many real source pixels end up across the 1200 px square. */
export function sourceQuality(c: CropState, w: number, h: number): SourceQuality {
  const plan = drawPlan(c, w, h, SHOP_IMAGE_SIZE);
  const across = c.mode === 'fit' ? Math.max(plan.sw, plan.sh) : plan.sw;
  if (across < SHOP_IMAGE_MIN_SOURCE) return 'too_small';
  if (across < SHOP_IMAGE_SIZE) return 'soft';
  return 'ok';
}
