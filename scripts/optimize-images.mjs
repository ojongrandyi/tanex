// Prepares brand assets and responsive photos from the untouched originals in images/.
// The originals are not kept in git (repo size); copy them back into images/ before running.
// Licence records stay in images/*/SOURCES.md.
// Run with: node scripts/optimize-images.mjs            (everything)
//           node scripts/optimize-images.mjs --brand    (logos, mark, icons and OG image only)
//           node scripts/optimize-images.mjs --icons    (favicon and app icons only)
// Outputs: Public/brand/* (logo, logo-white, mark, icons, OG image) and Public/images/site/* (WebP + JPG per width),
// plus src/data/siteImages.ts (the manifest <ResponsiveImage> reads).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'images');
const BRAND_OUT = path.join(ROOT, 'Public', 'brand');
const PHOTO_OUT = path.join(ROOT, 'Public', 'images', 'site');
const MANIFEST_OUT = path.join(ROOT, 'src', 'data', 'siteImages.ts');

const STEP_WIDTHS = [640, 1024, 1600, 2400];
// Every card/tile photo is cropped to this exact square so rows line up at the same height.
// 340 px is the base size (the smallest card source when the cards were set up); larger squares follow.
const CARD_SIZE = 340;
// Larger square variants for retina screens, emitted only when the source is big enough.
const CARD_STEP_SIZES = [640, 1024, 1400];

fs.mkdirSync(BRAND_OUT, { recursive: true });
fs.mkdirSync(PHOTO_OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Logo: the supplied logo (images/queenscargo.png, 2030x775) is NOT transparent. It is an RGB PNG
// with a light-grey/white checkerboard (about RGB 230-255, neutral) baked into the pixels, so the
// background is keyed out here:
//  1. Light, neutral pixels connected to the canvas edge are removed (flood fill), so light
//     pixels inside the artwork (highlights on the globe and parcel) are never touched. The thin
//     white outlines around the letters are the same colour as the checkerboard's white squares
//     and touch it, so they go with the background.
//  2. Enclosed pockets of checkerboard (letter counters such as the inside of the O) and leftover
//     bits of the white outline are removed too; they are told apart from highlights by size, by
//     the two checkerboard tones, by not being ringed by red, or by lying wholly within a few px
//     of removed background (pinched-off outline tips).
//  3. A narrow band along every cut edge is un-blended from white (colour-to-alpha), so the
//     anti-aliased rims of the red and black parts keep a smooth edge with no pink or grey fringe.
// Red pixels and the black wordmark are only touched in that edge band.
// ---------------------------------------------------------------------------------------------
const LOGO_SRC = 'queenscargo.png';
const BG_MIN = 222;        // a background pixel's darkest channel is at least this light...
const BG_SPREAD = 18;      // ...and its channels differ by less than this (neutral grey/white)
const EDGE_BAND = 2;       // px along cut edges that are un-blended from white
const POCKET_MIN = 150;    // enclosed light areas at least this big may be checkerboard pockets
const FRINGE_LIGHT = 180;  // edge pixels lighter than this fade out completely by BG_MIN
const SLIVER = 3;          // kept light regions lying wholly this close to removed background are outline remnants
const RIM_RED = 30;       // a pocket's rim pixel counts as red from this redness (pink anti-aliasing included)

const isBackgroundLike = (r, g, b) => Math.min(r, g, b) >= BG_MIN && Math.max(r, g, b) - Math.min(r, g, b) < BG_SPREAD;

async function loadTransparentLogo(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;
  const bgLike = new Uint8Array(N);
  for (let p = 0; p < N; p++) bgLike[p] = isBackgroundLike(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) ? 1 : 0;

  // Connected light regions (4-neighbour). Each region is cleared if it touches the edge or looks
  // like a checkerboard pocket (big enough and containing both tones of the pattern).
  const removed = new Uint8Array(N);
  const kept = [];
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  for (let start = 0; start < N; start++) {
    if (!bgLike[start] || seen[start]) continue;
    const region = [];
    let top = 0, touchesEdge = false, darkTone = 0, lightTone = 0, rimRed = 0, rim = 0;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top];
      region.push(p);
      const x = p % W, y = (p - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesEdge = true;
      const lo = Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
      if (lo < 246) darkTone++; else lightTone++;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q < 0) continue;
        if (bgLike[q]) { if (!seen[q]) { seen[q] = 1; stack[top++] = q; } continue; }
        rim++;
        if (redness(data[q * 4], data[q * 4 + 1], data[q * 4 + 2]) >= RIM_RED) rimRed++;
      }
    }
    const pocket = region.length >= POCKET_MIN && darkTone >= region.length * 0.1 && lightTone >= region.length * 0.1;
    // Leftover bits of the white letter outline sit between black/grey parts; highlights on the
    // globe, parcel and crown are ringed by red and stay.
    const outlineBit = rimRed < rim * 0.5;
    if (touchesEdge || pocket || outlineBit) for (const p of region) removed[p] = 1;
    else kept.push(region);
  }

  // Distance (in px, 8-neighbour) from the nearest removed pixel, up to maxD (255 = further).
  const distanceFromRemoved = (maxD) => {
    const dist = new Uint8Array(N).fill(255);
    let frontier = [];
    for (let p = 0; p < N; p++) if (removed[p]) { dist[p] = 0; frontier.push(p); }
    for (let d = 1; d <= maxD; d++) {
      const next = [];
      for (const p of frontier) {
        const x = p % W, y = (p - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (dist[q] === 255) { dist[q] = d; next.push(q); }
        }
      }
      frontier = next;
    }
    return dist;
  };

  // Pinched-off tips of the white outline (e.g. where it tapers between the crown and its band)
  // are ringed by red but lie wholly within SLIVER px of removed background; highlights do not.
  const near = distanceFromRemoved(SLIVER);
  for (const region of kept) if (region.every((p) => near[p] <= SLIVER)) for (const p of region) removed[p] = 1;

  const dist = distanceFromRemoved(EDGE_BAND);

  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (removed[p]) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; continue; }
    if (dist[p] > EDGE_BAND) continue;
    // Colour-to-alpha against white: the least alpha that explains the pixel as artwork over white.
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let a = (255 - Math.min(r, g, b)) / 255;
    // Light neutral rim pixels are checkerboard blended into the edge: fade them out fully.
    const lo = Math.min(r, g, b);
    if (Math.max(r, g, b) - lo < BG_SPREAD && lo > FRINGE_LIGHT) a *= (BG_MIN - lo) / (BG_MIN - FRINGE_LIGHT);
    if (a <= 0.01) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; continue; }
    if (a < 1) {
      const unblend = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a)));
      data[i] = unblend(r); data[i + 1] = unblend(g); data[i + 2] = unblend(b);
      data[i + 3] = Math.round(a * 255);
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// Crops to the artwork's bounding box (every pixel with alpha > 0).
async function trimTransparent(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] === 0) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return sharp(pngBuffer).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).png().toBuffer();
}

// How strongly a pixel reads as the logo's red (0 = neutral grey/black/white).
const redness = (r, g, b) => r - Math.max(g, b);
const RED_MIN = 60;

// Reversed logo for dark surfaces: every non-red pixel becomes white; red stays red.
async function toWhiteVersion(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (redness(data[i], data[i + 1], data[i + 2]) < RED_MIN) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Icon mark: the red globe that stands in for the apostrophe of QUEEN'S, with its orbit arrow and
// parcel, centred on a transparent square. Measured on the 2030x775 original: everything inside the
// globe circle and the parcel outline is kept, plus the red orbit arrow inside MARK; the black N and S
// beside it and the red CARGO below are dropped. Edges of the red parts fade softly.
const GLOBE = { cx: 1620, cy: 295, r: 150 };
// The parcel's outline (its bottom tip dips between CARGO's letters; the S starts just right of it).
const PARCEL = [[1622, 322], [1772, 322], [1772, 428], [1696, 462], [1624, 432]];
const CARGO_TOP = 448; // red below this, outside the globe and parcel, belongs to CARGO
const MARK = { left: 1440, top: 140, width: 492, height: 322 }; // stops above CARGO

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

async function cropMark(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).extract(MARK).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const sx = MARK.left + x, sy = MARK.top + y;
    if (Math.hypot(sx - GLOBE.cx, sy - GLOBE.cy) <= GLOBE.r) continue;
    if (insidePolygon(sx, sy, PARCEL)) continue;
    if (sy >= CARGO_TOP) { data[i + 3] = 0; continue; }
    const red = redness(data[i], data[i + 1], data[i + 2]);
    if (red < RED_MIN) data[i + 3] = 0;
    else if (red < RED_MIN + 40) data[i + 3] = Math.round(data[i + 3] * (red - RED_MIN) / 40); // soft edge
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function buildSquareMark(transparent) {
  const mark = await trimTransparent(await cropMark(transparent));
  const markMeta = await sharp(mark).metadata();
  const side = Math.max(markMeta.width, markMeta.height);
  return sharp(mark)
    .extend({
      top: Math.floor((side - markMeta.height) / 2), bottom: Math.ceil((side - markMeta.height) / 2),
      left: Math.floor((side - markMeta.width) / 2), right: Math.ceil((side - markMeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();
}

// Browser, home-screen and PWA icons, all rendered straight from the square mark at their exact
// size (never resized from another icon). `inset` is the share of the canvas the mark may fill.
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const ICONS = [
  // Tab icons sit on a white rounded tile so the red mark stays visible on dark browser tabs.
  { file: 'favicon-16.png', size: 16, inset: 1, bg: '#ffffff', tile: true },  // browser tab (standard DPI)
  { file: 'favicon-32.png', size: 32, inset: 0.94, bg: '#ffffff', tile: true }, // browser tab (retina), taskbar
  { file: 'icon-192.png', size: 192, inset: 0.92, bg: CLEAR },        // Android home screen, manifest
  { file: 'favicon.png', size: 512, inset: 0.92, bg: CLEAR },         // manifest, install splash
  { file: 'icon-maskable-512.png', size: 512, inset: 0.64, bg: '#ffffff' }, // Android adaptive: fits the 80% safe circle
  { file: 'apple-touch-icon.png', size: 180, inset: 0.76, bg: '#ffffff' },  // iOS fills transparency with black, so white
];

async function buildIcons(squareMark) {
  for (const { file, size, inset, bg, tile } of ICONS) {
    const inner = Math.round(size * inset);
    const edge = size - inner;
    let icon = sharp(squareMark)
      .resize(inner, inner, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' })
      .extend({ top: Math.floor(edge / 2), bottom: Math.ceil(edge / 2), left: Math.floor(edge / 2), right: Math.ceil(edge / 2), background: CLEAR });
    if (tile) {
      const r = Math.round(size * 0.22);
      const card = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/></svg>`);
      icon = sharp(card).composite([{ input: await icon.png().toBuffer() }]);
    } else if (bg !== CLEAR) {
      icon = sharp(await icon.png().toBuffer()).flatten({ background: bg });
    }
    // Full-colour PNG for the tiny sizes: palette quantising visibly bands 16/32 px edges.
    const png = size <= 32 ? { compressionLevel: 9 } : { palette: true, quality: 95, effort: 10, compressionLevel: 9 };
    await icon.png(png).toFile(path.join(BRAND_OUT, file));
  }
}

const LOGO_PNG = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };
const OG_BACKGROUND = '#181818'; // --ngf-ink-950, the dark hero/footer surface
const OG_LOGO_WIDTH = 900;

async function buildBrand() {
  const transparent = await loadTransparentLogo(path.join(SRC, LOGO_SRC));
  const trimmed = await trimTransparent(transparent);
  await sharp(trimmed).png(LOGO_PNG).toFile(path.join(BRAND_OUT, 'logo.png'));

  const white = await toWhiteVersion(trimmed);
  await sharp(white).png(LOGO_PNG).toFile(path.join(BRAND_OUT, 'logo-white.png'));

  const squareMark = await buildSquareMark(transparent);
  await sharp(squareMark).png(LOGO_PNG).toFile(path.join(BRAND_OUT, 'mark.png'));
  await buildIcons(squareMark);

  // OG image 1200x630: reversed logo centred on the brand Ink. Never upscaled.
  const { width: logoW } = await sharp(white).metadata();
  const ogLogo = await sharp(white).resize({ width: Math.min(OG_LOGO_WIDTH, logoW), kernel: 'lanczos3' }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: OG_BACKGROUND } })
    .composite([{ input: ogLogo, gravity: 'centre' }])
    .flatten({ background: OG_BACKGROUND })
    .jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(BRAND_OUT, 'og-image.jpg'));
}

// ---------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------
// kind 'card' = fixed CARD_SIZE square (plus 640 when the source allows it).
// kind 'hero' = keeps the given aspect ratio, widths from STEP_WIDTHS up to the source width (or `maxWidth`);
// `widths` limits a hero to the step widths its page actually uses.
// free-stock/* are full-resolution Pexels originals (see images/free-stock/SOURCES.md); each hero
// slot has its own photo. Outputs stay capped at STEP_WIDTHS / CARD_STEP_SIZES.
const PHOTOS = [
  { name: 'hero-home', src: 'free-stock/hero-home.jpg', kind: 'hero', aspect: 16 / 9 },
  // Phones only (below 768px): 1290 px covers a 430 px-wide screen at 3x, so larger portrait files are never needed.
  { name: 'hero-home-mobile', src: 'free-stock/hero-home-mobile.jpg', kind: 'hero', aspect: 9 / 16, maxWidth: 1290 },
  { name: 'track-hero', src: 'free-stock/track-hero.jpg', kind: 'hero', aspect: 2 / 1 },
  { name: 'locations-hero', src: 'free-stock/locations-hero.jpg', kind: 'hero', aspect: 2 / 1 },
  // Wide strip behind the Home callback banner.
  { name: 'callback-banner', src: 'free-stock/callback-banner.jpg', kind: 'hero', aspect: 3 / 1 },
  { name: 'services-hero', src: 'free-stock/services-hero.jpg', kind: 'hero', aspect: 12 / 5 },
  { name: 'about-hero', src: 'free-stock/about-hero.jpg', kind: 'hero', aspect: 12 / 5 },
  // About has its own photos so nothing on that page repeats another page's image.
  { name: 'about-compliance', src: 'free-stock/about-compliance.jpg', kind: 'hero', aspect: 3 / 1 },
  // CSS background heroes (ShipPage.css, PublicQuoteResultPage.css) reference the 1024 and 1600 widths.
  // Rippled sea compresses poorly; it sits under a dark overlay, so lower quality keeps 1600w under 250 KB.
  { name: 'ship-hero', src: 'free-stock/ship-hero.jpg', kind: 'hero', aspect: 16 / 9, quality: { webp: 66, jpeg: 70 }, maxWidth: 1600, widths: [1024, 1600] },
  { name: 'quote-result-hero', src: 'free-stock/quote-result-hero.jpg', kind: 'hero', aspect: 16 / 9, maxWidth: 1600, widths: [1024, 1600] },
  { name: 'service-priority-express', src: 'free-stock/service-priority-express.jpg', kind: 'card' },
  { name: 'service-freight-linehaul', src: 'free-stock/service-freight-linehaul.jpg', kind: 'card' },
  { name: 'service-vehicle-transport', src: 'free-cc0/service-vehicle-transport.webp', kind: 'card' },
  { name: 'service-secure-vault', src: 'free-cc0/service-secure-vault.webp', kind: 'card' },
  { name: 'industry-healthcare', src: 'free-stock/industry-healthcare.jpg', kind: 'card' },
  { name: 'industry-technology', src: 'free-cc0/industry-technology.webp', kind: 'card' },
  { name: 'industry-automotive', src: 'free-stock/industry-automotive.jpg', kind: 'card' },
  { name: 'industry-ecommerce', src: 'free-stock/industry-ecommerce.jpg', kind: 'card' },
  { name: 'track-result-vehicle', src: 'free-stock/track-result-vehicle.jpg', kind: 'card' },
  { name: 'about-operations', src: 'free-pexels/about-operations.jpg', kind: 'card' },
  { name: 'about-story', src: 'free-stock/about-story.jpg', kind: 'card' },
  // Shown as a 72 px thumbnail: crop tight on the face.
  { name: 'about-team', src: 'free-pexels/about-team.jpg', kind: 'card', crop: { left: 950, top: 80, width: 900, height: 900 } },
];

// `position` picks which part of the source a cover crop keeps (sharp: 'centre', 'top', 'bottom', ...).
// `quality` overrides the encoder quality for photos that would otherwise exceed the size budget.
async function writeVariants(pipelineFactory, name, width, height, position = 'centre', quality = { webp: 78, jpeg: 80 }) {
  const base = path.join(PHOTO_OUT, `${name}-${width}`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).webp({ quality: quality.webp }).toFile(`${base}.webp`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).flatten({ background: '#ffffff' })
    .jpeg({ quality: quality.jpeg, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
}

async function buildPhotos() {
  const manifest = {};
  for (const p of PHOTOS) {
    const srcPath = path.join(SRC, p.src);
    const factory = () => (p.crop ? sharp(srcPath).extract(p.crop) : sharp(srcPath));
    const meta = await factory().metadata();
    const srcW = p.crop ? p.crop.width : meta.width;
    const srcH = p.crop ? p.crop.height : meta.height;
    const variants = [];

    if (p.kind === 'card') {
      const maxSquare = Math.min(srcW, srcH);
      // Never upscale: a source smaller than CARD_SIZE is output at its own size. Every card is
      // still a 1:1 square, so CSS renders them all at the same height.
      const base = Math.min(CARD_SIZE, maxSquare);
      const sizes = [base, ...CARD_STEP_SIZES.filter(s => s <= maxSquare)];
      for (const s of sizes) {
        await writeVariants(factory, p.name, s, s);
        variants.push(s);
      }
      manifest[p.name] = { width: base, height: base, widths: variants };
    } else {
      // Largest crop of the requested aspect that fits the source, served at no more than the
      // largest step width (UHD originals are source files only), then the step widths below it.
      const cropW = Math.min(srcW, Math.floor(srcH * p.aspect));
      const maxW = Math.min(cropW, p.maxWidth ?? STEP_WIDTHS[STEP_WIDTHS.length - 1]);
      const widths = (p.widths ?? STEP_WIDTHS).filter(w => w <= maxW);
      if (!widths.includes(maxW) && (widths.length === 0 || maxW - widths[widths.length - 1] > 200)) widths.push(maxW);
      for (const w of widths) {
        await writeVariants(factory, p.name, w, Math.round(w / p.aspect), p.position, p.quality);
        variants.push(w);
      }
      manifest[p.name] = { width: maxW, height: Math.round(maxW / p.aspect), widths: variants };
    }
  }
  return manifest;
}

function writeManifest(manifest) {
  const body = Object.entries(manifest)
    .map(([k, v]) => `  '${k}': { width: ${v.width}, height: ${v.height}, widths: [${v.widths.join(', ')}] },`)
    .join('\n');
  const ts = `// Generated by scripts/optimize-images.mjs. Do not edit by hand; re-run the script instead.
// Each entry lists the widths available as /images/site/<name>-<width>.webp and .jpg.
export interface SiteImageInfo {
  width: number;
  height: number;
  widths: number[];
}

export const SITE_IMAGES = {
${body}
} satisfies Record<string, SiteImageInfo>;

export type SiteImageName = keyof typeof SITE_IMAGES;
`;
  fs.writeFileSync(MANIFEST_OUT, ts);
}

// --icons rebuilds only the icon set, leaving the logos, OG image and photos untouched.
if (process.argv.includes('--icons')) {
  await buildIcons(await buildSquareMark(await loadTransparentLogo(path.join(SRC, LOGO_SRC))));
  console.log('Icons done.');
} else if (process.argv.includes('--brand')) {
  // --brand rebuilds logos, mark, icons and the OG image, leaving the photos untouched.
  await buildBrand();
  console.log('Brand done.');
} else {
  await buildBrand();
  const manifest = await buildPhotos();
  writeManifest(manifest);
  console.log('Done.');
}
