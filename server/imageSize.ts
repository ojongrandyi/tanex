// Reads an image's pixel size from its header bytes (PNG, JPEG, WebP, AVIF), so uploads can be
// checked without an image library on the server (BLOG_SPEC §4: `sharp` is not required in
// production). Returns null when the header can't be read; callers then refuse the upload.
import type { ImageType } from './uploads.js';

export interface ImageSize { width: number; height: number }

function pngSize(b: Buffer): ImageSize | null {
  // Signature (8) + IHDR length (4) + "IHDR" (4) + width (4) + height (4).
  if (b.length < 24 || b.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpegSize(b: Buffer): ImageSize | null {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    // Markers without a length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (len < 2) return null;
    // Start-of-frame markers (C0–CF except DHT C4, JPG C8, DAC CC) carry the size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 9 > b.length) return null;
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function webpSize(b: Buffer): ImageSize | null {
  if (b.length < 30) return null;
  const chunk = b.toString('latin1', 12, 16);
  if (chunk === 'VP8 ') {
    // Key frame start code 9d 01 2a, then 14-bit width and height.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
    };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}

interface Box { type: string; start: number; end: number }

/** Child boxes of an ISO BMFF container between start and end. */
function boxes(b: Buffer, start: number, end: number): Box[] {
  const out: Box[] = [];
  let i = start;
  while (i + 8 <= end) {
    let size = b.readUInt32BE(i);
    const type = b.toString('latin1', i + 4, i + 8);
    let header = 8;
    if (size === 1) {
      if (i + 16 > end) break;
      size = Number(b.readBigUInt64BE(i + 8));
      header = 16;
    } else if (size === 0) {
      size = end - i;
    }
    if (size < header || i + size > end) break;
    out.push({ type, start: i + header, end: i + size });
    i += size;
  }
  return out;
}

function avifSize(b: Buffer): ImageSize | null {
  // meta (full box: 4 bytes version/flags) → iprp → ipco → ispe (full box, then width, height).
  const meta = boxes(b, 0, b.length).find((x) => x.type === 'meta');
  if (!meta) return null;
  const iprp = boxes(b, meta.start + 4, meta.end).find((x) => x.type === 'iprp');
  if (!iprp) return null;
  const ipco = boxes(b, iprp.start, iprp.end).find((x) => x.type === 'ipco');
  if (!ipco) return null;
  let best: ImageSize | null = null;
  for (const box of boxes(b, ipco.start, ipco.end)) {
    if (box.type !== 'ispe' || box.end - box.start < 12) continue;
    const size = { width: b.readUInt32BE(box.start + 4), height: b.readUInt32BE(box.start + 8) };
    // An AVIF can hold a thumbnail or alpha plane too; the largest is the image itself.
    if (!best || size.width * size.height > best.width * best.height) best = size;
  }
  return best;
}

/** Pixel size of a WebP/JPEG/PNG/AVIF, or null when its header can't be read. */
export function readImageSize(buf: Buffer, type: ImageType): ImageSize | null {
  let size: ImageSize | null = null;
  try {
    if (type === 'png') size = pngSize(buf);
    else if (type === 'jpeg') size = jpegSize(buf);
    else if (type === 'webp') size = webpSize(buf);
    else if (type === 'avif') size = avifSize(buf);
  } catch {
    return null; // truncated header (RangeError from a read past the end)
  }
  if (!size || !(size.width > 0) || !(size.height > 0)) return null;
  return size;
}
