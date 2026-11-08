// Prepares brand assets and responsive photos from the untouched originals in images/.
// The photo originals are not kept in git (repo size); copy them back into images/ before running.
// Licence records stay in images/*/SOURCES.md.
// Run with: node scripts/optimize-images.mjs            (everything)
//           node scripts/optimize-images.mjs --brand    (logos, wordmarks, mark, icons and OG image only)
//           node scripts/optimize-images.mjs --icons    (favicon and app icons only)
//           node scripts/optimize-images.mjs --only about-md   (just these photos, merged into the manifest)
// Outputs: Public/brand/* (logos, wordmarks, mark, icons, OG image) and Public/images/site/* (WebP + JPG
// per width), plus src/data/siteImages.ts (the manifest <ResponsiveImage> reads).
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
// Logo (BRAND_GUIDE §6). Source: images/tanex files/logo.png, 1080x1080 RGB on plain white, NOT
// transparent. The artwork (about 540x200 px in the middle of the canvas) is "Tan" in black, "Ex"
// in orange, an orange paper plane with three speed lines, and the tagline in dark grey below.
// The logo contains no white artwork, so every white area is background:
//  1. Light pixels connected to the canvas edge are background (flood fill). Enclosed light
//     regions (letter counters: a, e, o, D, R...) are found the same way and removed too.
//  2. Pixels within EDGE_BAND px of removed background get a soft alpha ramp: alpha follows how
//     far the pixel is from white, and its colour is un-blended from white, so anti-aliased rims
//     keep their true black/orange colour and show no white halo on dark surfaces.
//  3. The opaque artwork is split into connected parts. Specks smaller than SPECK_MAX px (the
//     source has a stray dot under "World") are dropped; the rest are sorted into wordmark,
//     tagline and mark (plane + speed lines) by position.
// ---------------------------------------------------------------------------------------------
const LOGO_SRC = 'tanex files/logo.png';
const LIGHT_MIN = 235;   // a pixel whose darkest channel is at least this light can be background
const BG_WHITE = 250;    // ...and from this light it is fully transparent
const INK_FLOOR = 24;    // darkest channel of the solid inks (black ~9, orange's blue ~4-16): fully opaque
const EDGE_BAND = 3;     // px along cut edges that get the soft alpha ramp
const SPECK_MAX = 40;    // opaque parts smaller than this are stray specks (smallest real glyph: ~150 px)
const CORE_ALPHA = 90;   // alpha from which a pixel seeds a part (fainter rims join the nearest part)
// Measured on the 1080x1080 source: rows 580-605 are empty between the wordmark and the tagline;
// the "x" starts at column 580, the speed lines at 662 and the plane at 679.
const TAGLINE_TOP = 592;
const MARK_LEFT = 655;
const PLANE_LEFT = 675;   // the plane alone, without the speed lines (16 px favicon)
const CREAM = { r: 0xfb, g: 0xf6, b: 0xec };   // Cream, BRAND_GUIDE §2
const CHOCOLATE_950 = '#1C120E';              // darkest brand surface, BRAND_GUIDE §2

const lightness = (data, i) => Math.min(data[i], data[i + 1], data[i + 2]);

// 8-neighbour distance (px) from the nearest set pixel of `mask`, up to maxD (255 = further).
function distanceFrom(mask, W, H, maxD) {
  const N = W * H;
  const dist = new Uint8Array(N).fill(255);
  let frontier = [];
  for (let p = 0; p < N; p++) if (mask[p]) { dist[p] = 0; frontier.push(p); }
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
}

// Steps 1-2: returns RGBA pixels with the white keyed out.
async function keyOutWhite(input) {
  const { data: rgb, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;
  const light = new Uint8Array(N);
  for (let p = 0; p < N; p++) light[p] = lightness(rgb, p * 3) >= LIGHT_MIN ? 1 : 0;

  // Flood fill every light region (4-neighbour); edge-connected = background, enclosed = counter.
  const removed = new Uint8Array(N);
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  let counters = 0;
  for (let start = 0; start < N; start++) {
    if (!light[start] || seen[start]) continue;
    const region = [];
    let top = 0, touchesEdge = false;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top];
      region.push(p);
      const x = p % W, y = (p - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesEdge = true;
      if (x > 0 && light[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < W - 1 && light[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && light[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[top++] = p - W; }
      if (y < H - 1 && light[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[top++] = p + W; }
    }
    if (!touchesEdge) counters++;
    for (const p of region) removed[p] = 1;
  }

  const band = distanceFrom(removed, W, H, EDGE_BAND);
  const out = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) {
    const s = p * 3, o = p * 4;
    let r = rgb[s], g = rgb[s + 1], b = rgb[s + 2];
    let a = 1;
    if (band[p] <= EDGE_BAND) {
      // Soft ramp: fully transparent from BG_WHITE, fully opaque at INK_FLOOR, then un-blend from white.
      a = Math.max(0, Math.min(1, (BG_WHITE - lightness(rgb, s)) / (BG_WHITE - INK_FLOOR)));
      if (a <= 0.004) continue; // stays transparent
      const unblend = (c) => Math.max(0, Math.min(255, Math.round(255 - (255 - c) / a)));
      r = unblend(r); g = unblend(g); b = unblend(b);
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(a * 255);
  }
  console.log(`  logo: ${W}x${H}, ${counters} enclosed counters keyed out`);
  return { data: out, W, H };
}

// Step 3: labels the opaque parts. Core pixels (alpha >= CORE_ALPHA) form 8-connected parts; fainter
// rim pixels join the nearest part. Returns the label per pixel (0 = none) and each part's box.
function labelParts({ data, W, H }) {
  const N = W * H;
  const label = new Int32Array(N);
  const parts = [null];
  for (let start = 0; start < N; start++) {
    if (label[start] || data[start * 4 + 3] < CORE_ALPHA) continue;
    const id = parts.length;
    const part = { id, n: 0, x0: W, y0: H, x1: -1, y1: -1 };
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % W, y = (p - x) / W;
      part.n++;
      part.x0 = Math.min(part.x0, x); part.x1 = Math.max(part.x1, x);
      part.y0 = Math.min(part.y0, y); part.y1 = Math.max(part.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!label[q] && data[q * 4 + 3] >= CORE_ALPHA) { label[q] = id; stack.push(q); }
      }
    }
    parts.push(part);
  }
  // Rim pixels: breadth-first from the labelled parts through any non-transparent pixel.
  let frontier = [];
  for (let p = 0; p < N; p++) if (label[p]) frontier.push(p);
  while (frontier.length) {
    const next = [];
    for (const p of frontier) {
      const x = p % W, y = (p - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!label[q] && data[q * 4 + 3] > 0) { label[q] = label[p]; next.push(q); }
      }
    }
    frontier = next;
  }
  return { label, parts };
}

// Copy of the image keeping only the pixels whose part passes `keep`; everything else transparent.
function selectParts(img, { label, parts }, keep) {
  const out = Buffer.alloc(img.data.length);
  for (let p = 0; p < img.W * img.H; p++) {
    const part = parts[label[p]];
    if (part && keep(part)) img.data.copy(out, p * 4, p * 4, p * 4 + 4);
  }
  return sharp(out, { raw: { width: img.W, height: img.H, channels: 4 } }).png().toBuffer();
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

// Reversed logo for dark surfaces: neutral (black/grey) pixels become cream; the orange keeps its
// colour. Pixels part-way between are mixed by their saturation.
async function toCreamVersion(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    const w = Math.max(0, Math.min(1, (chroma - 40) / 80)); // 1 = orange, 0 = neutral
    data[i] = Math.round(w * data[i] + (1 - w) * CREAM.r);
    data[i + 1] = Math.round(w * data[i + 1] + (1 - w) * CREAM.g);
    data[i + 2] = Math.round(w * data[i + 2] + (1 - w) * CREAM.b);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// Pads to a square, centred, on transparent.
async function toSquare(pngBuffer) {
  const { width, height } = await sharp(pngBuffer).metadata();
  const side = Math.max(width, height);
  return sharp(pngBuffer).extend({
    top: Math.floor((side - height) / 2), bottom: Math.ceil((side - height) / 2),
    left: Math.floor((side - width) / 2), right: Math.ceil((side - width) / 2),
    background: CLEAR,
  }).png().toBuffer();
}

// Resizes the flat-colour mark to `side` px. Shrinking is a plain Lanczos resize. The plane is only
// ~149 px wide in the source, so icons larger than that (until the owner supplies a vector original,
// tracker #101) are enlarged smoothly and the alpha edge is then re-sharpened to a ~1 px ramp, which
// keeps the flat triangles and bars crisp instead of blurry. Logos are never enlarged.
async function resizeMark(squareMark, side) {
  const { width } = await sharp(squareMark).metadata();
  if (side <= width) return sharp(squareMark).resize(side, side, { kernel: 'lanczos3' }).png().toBuffer();
  const scale = side / width;
  const { data, info } = await sharp(squareMark).resize(side, side, { kernel: 'cubic' })
    .raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i] / 255;
    data[i] = Math.round(255 * Math.max(0, Math.min(1, (a - 0.5) * scale + 0.5)));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Browser, home-screen and PWA icons, all rendered straight from the square mark at their exact
// size. `inset` is the share of the canvas the mark may fill; `bg` fills the whole square.
const ICONS = [
  // At 16 px the three speed lines blur into a smudge, so that size shows the plane alone.
  { file: 'favicon-16.png', size: 16, inset: 1, plane: true }, // browser tab (standard DPI)
  { file: 'favicon-32.png', size: 32, inset: 1 },             // browser tab (retina), taskbar
  { file: 'icon-192.png', size: 192, inset: 0.9 },            // Android home screen, manifest
  { file: 'favicon.png', size: 512, inset: 0.9 },             // manifest, install splash
  // Android adaptive icon: the plane sits well inside the 80% safe circle.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.56, bg: CHOCOLATE_950 },
  // iOS fills transparency with black, so the tile is Chocolate 950.
  { file: 'apple-touch-icon.png', size: 180, inset: 0.7, bg: CHOCOLATE_950 },
];

async function buildIcons({ squareMark, squarePlane }) {
  for (const { file, size, inset, bg, plane } of ICONS) {
    const inner = Math.round(size * inset);
    const edge = size - inner;
    let icon = sharp(await resizeMark(plane ? squarePlane : squareMark, inner))
      .extend({ top: Math.floor(edge / 2), bottom: Math.ceil(edge / 2), left: Math.floor(edge / 2), right: Math.ceil(edge / 2), background: CLEAR });
    if (bg) icon = sharp(await icon.png().toBuffer()).flatten({ background: bg });
    // Full-colour PNG for the tiny sizes: palette quantising visibly bands 16/32 px edges.
    const png = size <= 32 ? { compressionLevel: 9 } : { palette: true, quality: 95, effort: 10, compressionLevel: 9 };
    await icon.png(png).toFile(path.join(BRAND_OUT, file));
  }
}

const LOGO_PNG = { palette: true, quality: 95, effort: 10, compressionLevel: 9 };
// Header/footer WebP height: 2x the tallest CSS height the wordmark is shown at (footer, 56 px).
const WORDMARK_WEB_HEIGHT = 112;
const OG_SIZE = { width: 1200, height: 630 };

async function writeSized(buffer, file, options) {
  const out = path.join(BRAND_OUT, file);
  const img = sharp(buffer);
  await (file.endsWith('.webp') ? img.webp(options) : img.png(options)).toFile(out);
  const { width, height } = await sharp(out).metadata();
  console.log(`  ${file.padEnd(30)} ${width}x${height}`);
}

async function loadLogoParts() {
  const img = await keyOutWhite(path.join(SRC, LOGO_SRC));
  const parts = labelParts(img);
  const real = (p) => p.n >= SPECK_MAX;
  const dropped = parts.parts.slice(1).filter((p) => !real(p));
  if (dropped.length) console.log(`  dropped ${dropped.length} speck(s): ${dropped.map((p) => `${p.n}px at ${p.x0},${p.y0}`).join('; ')}`);
  const lockup = await trimTransparent(await selectParts(img, parts, real));
  const wordmark = await trimTransparent(await selectParts(img, parts, (p) => real(p) && p.y1 < TAGLINE_TOP));
  const mark = await trimTransparent(await selectParts(img, parts, (p) => real(p) && p.y1 < TAGLINE_TOP && p.x0 >= MARK_LEFT));
  const plane = await trimTransparent(await selectParts(img, parts, (p) => real(p) && p.y1 < TAGLINE_TOP && p.x0 >= PLANE_LEFT));
  return { lockup, wordmark, squareMark: await toSquare(mark), squarePlane: await toSquare(plane) };
}

async function buildBrand() {
  const { lockup, wordmark, squareMark, squarePlane } = await loadLogoParts();

  await writeSized(lockup, 'logo.png', LOGO_PNG);
  const lockupCream = await toCreamVersion(lockup);
  await writeSized(lockupCream, 'logo-white.png', LOGO_PNG);

  await writeSized(wordmark, 'logo-wordmark.png', LOGO_PNG);
  const wordmarkCream = await toCreamVersion(wordmark);
  await writeSized(wordmarkCream, 'logo-wordmark-white.png', LOGO_PNG);
  const webH = Math.min(WORDMARK_WEB_HEIGHT, (await sharp(wordmark).metadata()).height);
  for (const [buf, file] of [[wordmark, 'logo-wordmark-web.webp'], [wordmarkCream, 'logo-wordmark-white-web.webp']]) {
    const small = await sharp(buf).resize({ height: webH, kernel: 'lanczos3' }).png().toBuffer();
    await writeSized(small, file, { quality: 92, alphaQuality: 100, effort: 6 });
  }

  await writeSized(squareMark, 'mark.png', LOGO_PNG);
  await buildIcons({ squareMark, squarePlane });

  // OG image 1200x630: cream lockup centred on Chocolate 950 at its own size (never enlarged).
  const { width: lw, height: lh } = await sharp(lockupCream).metadata();
  const fit = Math.min(1, (OG_SIZE.width * 0.7) / lw, (OG_SIZE.height * 0.6) / lh);
  const ogLogo = fit < 1 ? await sharp(lockupCream).resize({ width: Math.round(lw * fit), kernel: 'lanczos3' }).png().toBuffer() : lockupCream;
  await sharp({ create: { ...OG_SIZE, channels: 4, background: CHOCOLATE_950 } })
    .composite([{ input: ogLogo, gravity: 'centre' }])
    .flatten({ background: CHOCOLATE_950 })
    .jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(BRAND_OUT, 'og-image.jpg'));
  console.log(`  og-image.jpg                   1200x630 (logo ${Math.round(lw * fit)} px wide)`);
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
  // TanEx owner photos (images/tanex files/, committed). About page leadership slot, 4:5 portrait
  // kept from the top so the face and the TanEx wall sign stay in frame (CONTENT §4, §12).
  { name: 'about-md', src: 'tanex files/Managing Director.png', kind: 'hero', aspect: 4 / 5, position: 'top', quality: { webp: 80, jpeg: 82 }, widths: [400, 640, 810] },
];

// `position` picks which part of the source a cover crop keeps (sharp: 'centre', 'top', 'bottom', ...).
// `quality` overrides the encoder quality for photos that would otherwise exceed the size budget.
async function writeVariants(pipelineFactory, name, width, height, position = 'centre', quality = { webp: 78, jpeg: 80 }) {
  const base = path.join(PHOTO_OUT, `${name}-${width}`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).webp({ quality: quality.webp }).toFile(`${base}.webp`);
  await pipelineFactory().resize(width, height, { fit: 'cover', position }).flatten({ background: '#ffffff' })
    .jpeg({ quality: quality.jpeg, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
}

async function buildPhotos(only = null) {
  const manifest = {};
  for (const p of PHOTOS.filter((x) => !only || only.includes(x.name))) {
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
  await buildIcons(await loadLogoParts());
  console.log('Icons done.');
} else if (process.argv.includes('--only')) {
  // --only <name>[,<name>] rebuilds just those photos and merges them into the existing manifest,
  // for when the other photo originals aren't on this machine (they aren't kept in git).
  const names = (process.argv[process.argv.indexOf('--only') + 1] || '').split(',').filter(Boolean);
  const unknown = names.filter((n) => !PHOTOS.some((x) => x.name === n));
  if (!names.length || unknown.length) throw new Error('Unknown or missing photo name(s): ' + (unknown.join(', ') || '(none)'));
  const existing = {};
  const re = /^  '([^']+)': \{ width: (\d+), height: (\d+), widths: \[([^\]]*)\] \},\r?$/gm;
  for (const m of fs.readFileSync(MANIFEST_OUT, 'utf8').matchAll(re)) {
    existing[m[1]] = { width: +m[2], height: +m[3], widths: m[4].split(',').map((v) => +v.trim()) };
  }
  writeManifest({ ...existing, ...(await buildPhotos(names)) });
  console.log('Done: ' + names.join(', '));
} else if (process.argv.includes('--brand')) {
  // --brand rebuilds logos, wordmarks, mark, icons and the OG image, leaving the photos untouched.
  await buildBrand();
  console.log('Brand done.');
} else {
  await buildBrand();
  const manifest = await buildPhotos();
  writeManifest(manifest);
  console.log('Done.');
}
