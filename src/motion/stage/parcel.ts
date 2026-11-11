// The parcel (MOTION_3D_SPEC §4): a cardboard box built in code, with a tape strip and a TanEx
// shipping label on top. It rides in the bike's top box (chapters 2 and 8 show it when the lid
// opens), is lifted across to the truck in chapter 3, and fills the frame in chapter 5, where the
// label's barcode draws, a scan beam passes and the tracking ID types in.
//
// The label is one texture drawn once (brand name, mark, a real Code 128 of the example tracking
// ID, the ID in mono); the chapter 5 reveals are uniforms in its shader (parts of the label shown
// as plain paper until revealed, the beam as emitted light), so scrolling never redraws or
// re-uploads the texture. Colours: Cream 400 kraft, Chocolate 200 tape (the C.1 sprite's parcel),
// Chocolate 950 ink, Orange 500 beam and caret.
import {
  CanvasTexture, Color, Group, ImageLoader, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector4, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { code128B } from './code128';

/** Parcel size in metres: width (x), height (up), length (fwd). Fits the bike's top box. */
export const PARCEL_SIZE = { w: 0.3, h: 0.17, l: 0.25 } as const;
/** The label on the top face (m): its text runs along −Z, the top of the text towards −X. */
export const LABEL_SIZE = { w: 0.2, h: 0.11 } as const;
export const LABEL_CENTRE = { x: 0.085, y: PARCEL_SIZE.h + 0.0014, z: 0 } as const;

const COLORS = {
  kraft: '#E2CFA8', // Cream 400
  tape: '#D9C2B5', // Chocolate 200
  ink: '#1C120E', // Chocolate 950
  paper: '#FFFFFF',
  onInk: '#FBF6EC', // Cream 100
  rule: '#D9C2B5',
  accent: '#F48800', // Orange 500
} as const;

/** Label texture layout (px). */
const TEX = { w: 512, h: 280, pad: 24, head: 56, module: 3, barsTop: 74, barsBottom: 174, idTop: 186, idBottom: 244, idSize: 40 } as const;

export interface ParcelLabel {
  /** Characters of the tracking ID on the label. */
  readonly length: number;
  /**
   * Chapter 5 reveals: bars drawn (0–1, left to right), characters typed (0–length), the scan
   * beam's position down the barcode (0–1) and its strength (0 = off). `full()` shows it all.
   */
  set(bars: number, typed: number, scan: number, beam: number): void;
  full(): void;
}

export interface Parcel {
  group: Group;
  /** Every material, for fading with whatever carries the parcel (stage/fade.ts). */
  materials: Material[];
  label: ParcelLabel;
}

export interface ParcelOptions {
  /** Tracking ID printed and encoded on the label (brand.ts TRACKING_ID_EXAMPLE). */
  id: string;
  /** Brand name in the label header (brand.ts COMPANY). */
  brand: string;
  /** The logo mark file for the header (drawn as supplied, never redrawn), and its pixel size. */
  mark?: { url: string; size: number };
  /** Called when the mark has loaded and the label needs a new frame. */
  onChange?: () => void;
}

/** Builds the parcel; its origin is the centre of its bottom face. */
export function buildParcel(options: ParcelOptions): Parcel {
  const { w, h, l } = PARCEL_SIZE;
  const group = new Group();
  group.name = 'tanex_parcel';
  const kraft = new MeshStandardMaterial({ color: new Color(COLORS.kraft), roughness: 0.85 });
  const tape = new MeshStandardMaterial({ color: new Color(COLORS.tape), roughness: 0.45 });

  const box = new Mesh(new RoundedBoxGeometry(w, h, l, 2, 0.012), kraft);
  box.position.y = h / 2;
  group.add(box);
  // Tape along the length, over the top and down both ends.
  const strip = new Mesh(new PlaneGeometry(0.05, l).rotateX(-Math.PI / 2), tape);
  strip.position.y = h + 0.0012;
  group.add(strip);
  for (const end of [-1, 1]) {
    const drop = new Mesh(new PlaneGeometry(0.05, 0.06), tape);
    drop.position.set(0, h - 0.03, end * (l / 2 + 0.0012));
    if (end < 0) drop.rotation.y = Math.PI;
    group.add(drop);
  }

  const { material, label } = labelMaterial(options);
  const sticker = new Mesh(new PlaneGeometry(LABEL_SIZE.w, LABEL_SIZE.h).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), material);
  sticker.position.set(LABEL_CENTRE.x, LABEL_CENTRE.y, LABEL_CENTRE.z);
  sticker.name = 'parcel_label';
  group.add(sticker);
  return { group, materials: [kraft, tape, material], label };
}

function labelMaterial({ id, brand, mark, onChange }: ParcelOptions): { material: MeshStandardMaterial; label: ParcelLabel } {
  const c = document.createElement('canvas');
  c.width = TEX.w;
  c.height = TEX.h;
  const g = c.getContext('2d');
  const modules = code128B(id);
  const font = getComputedStyle(document.documentElement).getPropertyValue('--tx-font-mono').trim() || 'ui-monospace, monospace';
  const spaced = (ctx: CanvasRenderingContext2D, px: string) => {
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = px;
  };
  // Right edge of each typed prefix of the ID (px), for the typing reveal.
  const edges: number[] = [TEX.pad];
  const barsRight = TEX.pad + modules.length * TEX.module;

  const draw = (markImage?: HTMLImageElement) => {
    if (!g) return;
    g.fillStyle = COLORS.paper;
    g.fillRect(0, 0, TEX.w, TEX.h);
    g.fillStyle = COLORS.ink;
    g.fillRect(0, 0, TEX.w, TEX.head);
    g.font = `700 26px ${font}`;
    spaced(g, '5px');
    g.fillStyle = COLORS.onInk;
    g.textBaseline = 'middle';
    g.fillText(brand.toUpperCase(), TEX.pad, TEX.head / 2 + 1);
    if (markImage) {
      const size = 36;
      g.drawImage(markImage, TEX.w - TEX.pad - size, (TEX.head - size) / 2, size, size);
    }
    g.fillStyle = COLORS.ink;
    for (let i = 0; i < modules.length; i++) {
      if (modules[i] === '1') g.fillRect(TEX.pad + i * TEX.module, TEX.barsTop, TEX.module, TEX.barsBottom - TEX.barsTop);
    }
    g.font = `600 ${TEX.idSize}px ${font}`;
    spaced(g, '6px');
    g.fillText(id, TEX.pad, (TEX.idTop + TEX.idBottom) / 2 + 2);
    g.fillStyle = COLORS.rule;
    g.fillRect(TEX.pad, TEX.h - 26, TEX.w - TEX.pad * 2, 2);
  };
  draw();
  if (g) {
    g.font = `600 ${TEX.idSize}px ${font}`;
    spaced(g, '6px');
    for (let k = 1; k <= id.length; k++) edges.push(TEX.pad + g.measureText(id.slice(0, k)).width);
  } else {
    for (let k = 1; k <= id.length; k++) edges.push(TEX.pad + k * TEX.idSize * 0.75);
  }

  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  if (mark) {
    new ImageLoader().load(mark.url, (image) => {
      draw(image);
      map.needsUpdate = true;
      onChange?.();
    });
  }

  // Texture px → uv (the canvas is flipped: v = 1 at its top).
  const u = (x: number) => x / TEX.w;
  const v = (y: number) => 1 - y / TEX.h;
  const uniforms = {
    uBarsBox: { value: new Vector4(u(TEX.pad), v(TEX.barsBottom), u(barsRight), v(TEX.barsTop)) },
    uBarsEdge: { value: 2 },
    uTypeBox: { value: new Vector4(u(TEX.pad) - 0.004, v(TEX.idBottom), u(edges[edges.length - 1] + 24), v(TEX.idTop)) },
    uTypeEdge: { value: 2 },
    uCaret: { value: 0 },
    uScanY: { value: 0 },
    uBeam: { value: 0 },
    uAccent: { value: new Color(COLORS.accent) },
  };
  const material = new MeshStandardMaterial({ map, roughness: 0.6 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec4 uBarsBox;
uniform float uBarsEdge;
uniform vec4 uTypeBox;
uniform float uTypeEdge;
uniform float uCaret;
uniform float uScanY;
uniform float uBeam;
uniform vec3 uAccent;
float txInBox(vec2 p, vec4 b) { return step(b.x, p.x) * step(p.x, b.z) * step(b.y, p.y) * step(p.y, b.w); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  // Not yet drawn (bars) or typed (ID): plain paper. The caret follows the last typed character.
  float txBars = txInBox(vMapUv, uBarsBox) * step(uBarsEdge, vMapUv.x);
  float txId = txInBox(vMapUv, uTypeBox);
  sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(1.0), max(txBars, txId * step(uTypeEdge, vMapUv.x)));
  float txCaret = txId * uCaret * step(uTypeEdge + 0.006, vMapUv.x) * step(vMapUv.x, uTypeEdge + 0.014);
  sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uAccent, txCaret);
  diffuseColor *= sampledDiffuseColor;
#endif`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_MAP
  // The scan beam: a thin line across the barcode with a soft glow around it.
  float txAcross = step(uBarsBox.x - 0.02, vMapUv.x) * step(vMapUv.x, uBarsBox.z + 0.02);
  float txD = (vMapUv.y - uScanY) / 0.012;
  totalEmissiveRadiance += uAccent * uBeam * txAcross * (2.4 * exp(-txD * txD) + 0.3 * exp(-txD * txD * 0.03));
#endif`,
      );
  };
  material.customProgramCacheKey = () => 'tx-parcel-label';

  const length = id.length;
  const label: ParcelLabel = {
    length,
    set(bars, typed, scan, beam) {
      const b = Math.min(1, Math.max(0, bars));
      uniforms.uBarsEdge.value = b >= 1 ? 2 : u(TEX.pad) + (u(barsRight) - u(TEX.pad)) * b;
      const k = Math.min(length, Math.max(0, Math.floor(typed + 1e-6)));
      uniforms.uTypeEdge.value = k >= length ? 2 : k === 0 ? u(TEX.pad) - 0.002 : u(edges[k]);
      uniforms.uCaret.value = typed > 0 && k < length ? 1 : 0;
      uniforms.uScanY.value = v(TEX.barsTop) + (v(TEX.barsBottom) - v(TEX.barsTop)) * scan;
      uniforms.uBeam.value = beam;
    },
    full() {
      this.set(1, length, 0, 0);
    },
  };
  return { material, label };
}
