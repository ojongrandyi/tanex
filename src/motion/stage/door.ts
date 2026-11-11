// A front door in Buea (MOTION_3D_SPEC §6, chapters 0 and 8): a soft-edged wall, frame, panelled
// door, step and a warm lamp. The journey starts at one (chapter 0, the bike pulls up) and ends at
// one (chapter 8, the parcel is delivered), so both chapters build the same door from here.
// Door space: the wall runs along Z at x = WALL_X and faces −X (the camera side at azimuth 180);
// the door is centred on z = 0. Materials blend (few, small meshes), faded with `setDoorOpacity`.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  SphereGeometry, SRGBColorSpace, type Material,
} from 'three';
import { smooth } from './ease';

const WALL_X = 1.25;
const COLORS = {
  wall: '#38241D', // Chocolate 800
  frame: '#4A3128', // Chocolate 700
  door: '#5F4034', // Chocolate 600
  knob: '#EDDFC4', // Cream 300
  lamp: '#FFE9CC', // Orange 100
} as const;

export interface Door {
  group: Group;
  /** Every material, each with `userData.baseOpacity` when it is not fully opaque at rest. */
  materials: Material[];
}

/** Builds the door (hidden until its chapter shows it). */
export function buildDoor(): Door {
  const group = new Group();
  group.name = 'tanex_door';
  const materials: Material[] = [];
  const standard = (hex: string, extra: Partial<MeshStandardMaterial> = {}) => {
    const m = new MeshStandardMaterial({ color: new Color(hex), roughness: 0.9, metalness: 0, transparent: true, ...extra });
    materials.push(m);
    return m;
  };
  const box = (w: number, h: number, d: number, hex: string, x: number, y: number, z: number, extra?: Partial<MeshStandardMaterial>) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), standard(hex, extra));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // Wall: faces the camera side (−X), edges fade into the page.
  const wall = new Mesh(
    new PlaneGeometry(5.4, 3.1).rotateY(-Math.PI / 2),
    standard('#FFFFFF', { map: fadeTexture(COLORS.wall), depthWrite: false, roughness: 1 }),
  );
  (wall.material as Material).userData.baseOpacity = 0.85;
  wall.position.set(WALL_X, 1.55, 0);
  wall.renderOrder = -3;
  group.add(wall);

  // Frame, door, panels, knob, step (sizes in metres, the wall runs along Z).
  box(0.1, 2.3, 1.16, COLORS.frame, WALL_X - 0.04, 1.15, 0);
  box(0.06, 2.12, 0.96, COLORS.door, WALL_X - 0.1, 1.08, 0);
  box(0.02, 0.62, 0.7, COLORS.frame, WALL_X - 0.135, 1.62, 0);
  box(0.02, 0.84, 0.7, COLORS.frame, WALL_X - 0.135, 0.66, 0);
  const knob = new Mesh(new SphereGeometry(0.035, 12, 8), standard(COLORS.knob, { roughness: 0.4, metalness: 0.3 }));
  knob.position.set(WALL_X - 0.16, 1.05, -0.36);
  group.add(knob);
  box(0.5, 0.14, 1.5, COLORS.frame, WALL_X - 0.3, 0.07, 0);

  // Lamp beside the door, with a soft warm glow.
  box(0.08, 0.26, 0.16, COLORS.frame, WALL_X - 0.05, 2.42, 0.78);
  box(0.02, 0.18, 0.1, COLORS.lamp, WALL_X - 0.1, 2.42, 0.78, { emissive: new Color(COLORS.lamp), emissiveIntensity: 1.6 });
  const glow = new Mesh(
    new PlaneGeometry(1.1, 1.1).rotateY(-Math.PI / 2),
    new MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
  );
  glow.material.userData.baseOpacity = 0.55;
  materials.push(glow.material);
  glow.position.set(WALL_X - 0.12, 2.42, 0.78);
  glow.renderOrder = 1;
  group.add(glow);
  group.visible = false;
  return { group, materials };
}

/** Shows the door at `opacity` (0 hides it). */
export function setDoorOpacity(door: Door, opacity: number): void {
  door.group.visible = opacity > 0.002;
  door.materials.forEach((m) => {
    m.opacity = opacity * ((m.userData.baseOpacity as number | undefined) ?? 1);
  });
}

/** A flat colour whose alpha fades towards the sides and the top (the wall melts into the page). */
function fadeTexture(hex: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const img = g.createImageData(c.width, c.height);
    const col = new Color(hex);
    const [r, gg, b] = [col.r, col.g, col.b].map((v) => Math.round(linearToSrgb(v) * 255));
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const u = x / (c.width - 1);
        const v = y / (c.height - 1); // 0 = top
        const side = smooth(Math.min(u, 1 - u) / 0.42);
        const top = smooth(v / 0.5);
        const i = (y * c.width + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = Math.round(255 * side * top);
      }
    }
    g.putImageData(img, 0, 0);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 233, 204, 0.9)');
    grad.addColorStop(0.35, 'rgba(255, 213, 160, 0.3)');
    grad.addColorStop(1, 'rgba(255, 213, 160, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}
