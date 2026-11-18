// Browser side of the square picture pipeline (docs/SHOP_SPEC.md §6): draws the chosen crop on a
// canvas and encodes the five files the server accepts (src/shared/shopImages.ts). Console-only,
// in the lazy console chunk. Redrawing on a canvas drops EXIF data, including GPS.
import {
  SHOP_IMAGE_BACKGROUNDS, SHOP_IMAGE_QUALITY, SHOP_IMAGE_SIZE, drawPlan,
  type CropState, type ShopImageSlotKey,
} from '../../shared/shopImages';
import { blobToBase64, canvasToBlob } from '../../services/imageCompress';

export type ImageSource = CanvasImageSource & { width: number; height: number };

function newCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** The source turned by the crop's quarter turns (a copy only when it is turned). */
export function rotateSource(src: ImageSource, rotation: number): ImageSource {
  const r = ((rotation % 4) + 4) % 4;
  if (r === 0) return src;
  const c = document.createElement('canvas');
  c.width = r % 2 ? src.height : src.width;
  c.height = r % 2 ? src.width : src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((r * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/**
 * Draws the crop into a square of `size` px on the chosen background. `rotated` is the source
 * already turned (rotateSource); the plan works in its coordinates.
 */
export function drawSquare(rotated: ImageSource, crop: CropState, srcW: number, srcH: number, size: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = target ?? newCanvas(size);
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = SHOP_IMAGE_BACKGROUNDS[crop.background];
  ctx.fillRect(0, 0, size, size);
  const p = drawPlan(crop, srcW, srcH, size);
  ctx.drawImage(rotated, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  return canvas;
}

/** Halves a square canvas (each step halves, which keeps small copies sharp). */
function half(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = newCanvas(src.width / 2);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export class SquareImageError extends Error {}

async function encode(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg'): Promise<{ blob: Blob; webp: boolean }> {
  const blob = await canvasToBlob(canvas, type, SHOP_IMAGE_QUALITY);
  // Browsers that can't encode WebP return PNG; the WebP slots then take JPEG (SHOP_SPEC §6).
  if (blob && blob.type === type) return { blob, webp: type === 'image/webp' };
  if (type === 'image/webp') return encode(canvas, 'image/jpeg');
  throw new SquareImageError('This browser could not prepare the picture. Try another browser.');
}

export interface SquareFiles {
  files: Record<ShopImageSlotKey, string>;
  webp: boolean;
  bytes: number;
  /** A small preview (object URL of the 300 px file); revoke it when done. */
  previewUrl: string;
}

/** Renders the crop at 1200 px and encodes 1200/600/300 WebP (or JPEG) and 1200/600 JPEG. */
export async function makeSquareFiles(src: ImageSource, crop: CropState): Promise<SquareFiles> {
  const rotated = rotateSource(src, crop.rotation);
  const c1200 = drawSquare(rotated, crop, src.width, src.height, SHOP_IMAGE_SIZE);
  const c600 = half(c1200);
  const c300 = half(c600);
  const [w1200, w600, w300, j1200, j600] = await Promise.all([
    encode(c1200, 'image/webp'), encode(c600, 'image/webp'), encode(c300, 'image/webp'),
    encode(c1200, 'image/jpeg'), encode(c600, 'image/jpeg'),
  ]);
  const blobs = { w1200: w1200.blob, w600: w600.blob, w300: w300.blob, j1200: j1200.blob, j600: j600.blob };
  const files = {} as Record<ShopImageSlotKey, string>;
  let bytes = 0;
  for (const [k, b] of Object.entries(blobs) as [ShopImageSlotKey, Blob][]) {
    files[k] = await blobToBase64(b);
    bytes += b.size;
  }
  return { files, webp: w1200.webp, bytes, previewUrl: URL.createObjectURL(w300.blob) };
}
