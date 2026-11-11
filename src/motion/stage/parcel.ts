// The parcel (MOTION_3D_SPEC §4): a cardboard box built in code, with a tape strip and a shipping
// label on top. It rides in the bike's top box (chapter 2 shows it when the lid opens) and is
// lifted across to the truck in chapter 3. Colours are the C.1 sprite's parcel colours (Cream 400
// kraft, Chocolate 200 tape). The label is decorative here (bars only); the chapter 5 close-up
// with the tracking ID is H.5.
import { CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Material } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Parcel size in metres: width (x), height (up), length (fwd). Fits the bike's top box. */
export const PARCEL_SIZE = { w: 0.3, h: 0.17, l: 0.25 } as const;

const COLORS = {
  kraft: '#E2CFA8', // Cream 400
  tape: '#D9C2B5', // Chocolate 200
  ink: '#1C120E', // Chocolate 950
} as const;

export interface Parcel {
  group: Group;
  /** Every material, for fading with whatever carries the parcel (stage/fade.ts). */
  materials: Material[];
}

/** Builds the parcel; its origin is the centre of its bottom face. */
export function buildParcel(): Parcel {
  const { w, h, l } = PARCEL_SIZE;
  const group = new Group();
  group.name = 'tanex_parcel';
  const kraft = new MeshStandardMaterial({ color: new Color(COLORS.kraft), roughness: 0.85 });
  const tape = new MeshStandardMaterial({ color: new Color(COLORS.tape), roughness: 0.45 });
  const label = new MeshStandardMaterial({ map: labelTexture(), roughness: 0.6 });

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
  // Label on the top, beside the tape (readable from above, which is how the open box is seen).
  const sticker = new Mesh(new PlaneGeometry(0.09, 0.12).rotateX(-Math.PI / 2), label);
  sticker.position.set(0.075, h + 0.0014, 0.02);
  group.add(sticker);
  return { group, materials: [kraft, tape, label] };
}

/** A white label with a paper-plane mark block and barcode bars (no text). */
function labelTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, 96, 128);
    g.fillStyle = COLORS.ink;
    g.fillRect(10, 12, 48, 6);
    g.globalAlpha = 0.5;
    g.fillRect(10, 24, 32, 4);
    g.globalAlpha = 1;
    // Bars with a fixed, repeatable pattern.
    const widths = [2, 3, 1, 1, 2, 1, 1, 2, 3, 1, 1, 3, 1, 1, 1, 2, 1, 2];
    let x = 10;
    widths.forEach((bw, i) => {
      if (i % 2 === 0) g.fillRect(x, 44, bw * 2, 56);
      x += bw * 2 + 1.5;
    });
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
