// Chapter 2 · In town (MOTION_3D_SPEC §6): the bike's product moment on the dark chapter. The
// bike stands centre stage while the camera orbits slowly (side → three-quarter → rear, camera.ts).
// The beats match the DOM chips (journey.ts BEATS, 15% arrive · 70% story in three · 15% leave):
//   1 Picked up   the top box opens to show the parcel, then closes;
//   2 On the way  the wheels turn, the rider glances at the phone holder, where a small map with
//                 a moving dot appears (the camera leans in over the shoulder);
//   3 Delivered   the camera settles behind the top box;
// and as the chapter leaves, the bike rides away from the camera and fades.
// Everything is a pure function of `s`, the pin progress of the chapter (Stage.storyTravel).
import {
  CanvasTexture, CircleGeometry, Color, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3,
  type BufferGeometry, type Object3D,
} from 'three';
import { clamp01, span } from '../ease';

/** Scroll timeline in pin progress (0–1). Beats: 1 = 0.15–0.383, 2 = 0.383–0.617, 3 = 0.617–0.85. */
export const IN_TOWN_TIMELINE = {
  lidOpen: [0.2, 0.28],
  lidClose: [0.37, 0.44],
  wheels: [0.42, 0.62],
  glance: [0.44, 0.64],
  map: [0.42, 0.66],
  dot: [0.46, 0.62],
  lean: [0.4, 0.66],
  rideOut: [0.86, 1],
  fade: [0.9, 1],
} as const;

/** Metres the wheels turn while "on the way" (the bike stays centre stage). */
export const ON_THE_WAY_METRES = 3;
/** Metres the bike rides away as the chapter leaves. */
export const RIDE_OUT_METRES = 9;

export interface InTownPhase {
  /** Lid opening, 0–1. */
  lid: number;
  /** Rider's glance at the phone, 0–1. */
  glance: number;
  /** Phone map shown, 0–1, and the dot's progress along its route, 0–1. */
  map: number;
  dot: number;
  /** Camera leaning in over the shoulder (framing), 0–1. */
  lean: number;
  /** Bike position along its heading (m) and its opacity. */
  bikeZ: number;
  opacity: number;
}

const ramp = (s: number, [a, b]: readonly [number, number]) => span(s, a, b);

export function inTownPhase(s: number): InTownPhase {
  const T = IN_TOWN_TIMELINE;
  const out = clamp01((s - T.rideOut[0]) / (T.rideOut[1] - T.rideOut[0]));
  const bump = (range: readonly [number, number], edge = 0.05) => span(s, range[0], range[0] + edge) * (1 - span(s, range[1] - edge, range[1]));
  return {
    lid: ramp(s, T.lidOpen) * (1 - ramp(s, T.lidClose)),
    glance: bump(T.glance),
    map: bump(T.map, 0.04),
    dot: ramp(s, T.dot),
    lean: bump(T.lean, 0.08),
    // Accelerating away.
    bikeZ: RIDE_OUT_METRES * out * out,
    opacity: 1 - ramp(s, T.fade),
  };
}

/** Distance the wheels have turned by pin progress `s` (m): on the way, then riding out. */
export function inTownDistance(s: number): number {
  const out = clamp01((s - IN_TOWN_TIMELINE.rideOut[0]) / (IN_TOWN_TIMELINE.rideOut[1] - IN_TOWN_TIMELINE.rideOut[0]));
  return ON_THE_WAY_METRES * ramp(s, IN_TOWN_TIMELINE.wheels) + RIDE_OUT_METRES * out * out;
}

/** The framing target while leaning in over the shoulder (bike space, m), and the length framed. */
export const PHONE_FOCUS = { x: 0, y: 0.98, z: 0.1, length: 1.7 } as const;

const MAP = {
  bg: '#F5ECDB', // Cream 200
  street: '#D9C2B5', // Chocolate 200
  route: '#2A1B16', // Chocolate 900
  dot: '#F48800', // Orange 500
} as const;
/** The route on the phone map, in map units (0–1 across, 0–1 down). */
const ROUTE: readonly [number, number][] = [[0.24, 0.84], [0.24, 0.6], [0.58, 0.6], [0.58, 0.34], [0.78, 0.34], [0.78, 0.16]];

/** Point along the map route at `t` (0–1, by length), in map units. */
export function mapRoutePoint(t: number): [number, number] {
  const lengths = ROUTE.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let d = clamp01(t) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] > 0 ? Math.min(1, d / lengths[i]) : 0;
      return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k];
    }
    d -= lengths[i];
  }
  return ROUTE[ROUTE.length - 1];
}

/**
 * The small map on the phone holder (3D brief §5.4): a plane laid over the model's screen, found
 * from the screen mesh itself (its largest face), so it fits the in-house and the commissioned
 * model alike. A dot moves along the route while "on the way".
 */
export class PhoneMap {
  private readonly plane: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly dot: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly size: { w: number; h: number };

  private constructor(plane: Mesh<PlaneGeometry, MeshBasicMaterial>, dot: Mesh<CircleGeometry, MeshBasicMaterial>, size: { w: number; h: number }) {
    this.plane = plane;
    this.dot = dot;
    this.size = size;
  }

  /** Attaches the map to the screen's parent; null if the model has no usable screen. */
  static attach(screen: Object3D | null): PhoneMap | null {
    const mesh = screen as (Object3D & { geometry?: BufferGeometry }) | null;
    if (!mesh?.geometry || !mesh.parent) return null;
    mesh.updateMatrix();
    const frame = screenFrame(mesh.geometry, mesh.matrix);
    if (!frame) return null;
    const material = new MeshBasicMaterial({ map: mapTexture(), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    const plane = new Mesh(new PlaneGeometry(frame.w, frame.h), material);
    plane.name = 'phone_map';
    plane.matrixAutoUpdate = false;
    plane.matrix.copy(frame.matrix);
    plane.renderOrder = 2;
    const dot = new Mesh(
      new CircleGeometry(Math.min(frame.w, frame.h) * 0.07, 16),
      new MeshBasicMaterial({ color: new Color(MAP.dot), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    );
    dot.position.z = 0.0004;
    dot.renderOrder = 3;
    plane.add(dot);
    plane.visible = false;
    mesh.parent.add(plane);
    return new PhoneMap(plane, dot, { w: frame.w, h: frame.h });
  }

  get object(): Object3D {
    return this.plane;
  }

  update(shown: number, progress: number): void {
    this.plane.visible = shown > 0.002;
    if (!this.plane.visible) return;
    this.plane.material.opacity = shown;
    this.dot.material.opacity = shown;
    const [u, v] = mapRoutePoint(progress);
    this.dot.position.x = (u - 0.5) * this.size.w;
    this.dot.position.y = (0.5 - v) * this.size.h;
  }
}

/**
 * The screen's face as a frame in its parent's space: centre just in front of the face that
 * looks up and back (towards the rider), axes along the face (y = the screen's long side, tipped
 * upwards), size of the face. Null if the geometry has no clear largest face.
 */
function screenFrame(geometry: BufferGeometry, local: Matrix4): { matrix: Matrix4; w: number; h: number } | null {
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count < 3) return null;
  const index = geometry.getIndex();
  const tri = (i: number) => (index ? index.getX(i) : i);
  const count = index ? index.count : pos.count;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  let best = 0;
  const n = new Vector3();
  const points: Vector3[] = [];
  for (let i = 0; i < pos.count; i++) points.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(local));
  for (let i = 0; i + 2 < count; i += 3) {
    a.copy(points[tri(i)]);
    b.copy(points[tri(i + 1)]);
    c.copy(points[tri(i + 2)]);
    n.subVectors(c, b).cross(a.sub(b));
    const area = n.length();
    // Prefer the face looking backwards (−Z, towards the rider) and up.
    n.normalize();
    if (n.z > 0) n.negate();
    if (area > best * 1.0001) {
      best = area;
      normal.copy(n);
    }
  }
  if (best <= 0) return null;
  const up = new Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize();
  if (up.lengthSq() < 1e-6) return null;
  const right = new Vector3().crossVectors(up, normal).normalize();
  let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity, maxN = -Infinity;
  const centre = new Vector3();
  points.forEach((p) => centre.add(p));
  centre.divideScalar(points.length);
  const d = new Vector3();
  points.forEach((p) => {
    d.subVectors(p, centre);
    const r = d.dot(right);
    const u = d.dot(up);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    maxN = Math.max(maxN, d.dot(normal));
  });
  const origin = centre.clone()
    .addScaledVector(right, (minR + maxR) / 2)
    .addScaledVector(up, (minU + maxU) / 2)
    .addScaledVector(normal, maxN + 0.0008);
  const matrix = new Matrix4().makeBasis(right, up, normal).setPosition(origin);
  // A small inset, so the map sits inside the screen's bezel.
  return { matrix, w: (maxR - minR) * 0.94, h: (maxU - minU) * 0.95 };
}

function mapTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 176;
  const g = c.getContext('2d');
  if (g) {
    const W = c.width;
    const H = c.height;
    g.fillStyle = MAP.bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = MAP.street;
    g.lineWidth = 5;
    g.lineCap = 'round';
    // A small grid of streets.
    [[0, 0.3, 1, 0.22], [0, 0.6, 1, 0.6], [0, 0.86, 1, 0.8], [0.24, 0, 0.24, 1], [0.58, 0, 0.6, 1], [0.86, 0, 0.78, 1]]
      .forEach(([x1, y1, x2, y2]) => {
        g.beginPath();
        g.moveTo(x1 * W, y1 * H);
        g.lineTo(x2 * W, y2 * H);
        g.stroke();
      });
    g.strokeStyle = MAP.route;
    g.lineWidth = 3.5;
    g.lineJoin = 'round';
    g.beginPath();
    ROUTE.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
    g.stroke();
    // Start (hollow) and destination (filled) markers.
    const [sx, sy] = ROUTE[0];
    const [ex, ey] = ROUTE[ROUTE.length - 1];
    g.fillStyle = MAP.bg;
    g.beginPath();
    g.arc(sx * W, sy * H, 5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = MAP.route;
    g.beginPath();
    g.arc(ex * W, ey * H, 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
