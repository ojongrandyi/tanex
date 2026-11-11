// Chapter 3 · City to city (MOTION_3D_SPEC §6): the bike rides up behind a TanEx truck parked on
// the road out of Limbe, the cargo door and the top box open and the parcel is lifted across in
// an arc; both close, the camera pulls back to the road with its pins Limbe · Buea · Douala, and
// the truck drives the route as you scroll, each pin checking off as it passes.
//
// The pins are placed from the real coordinates of the TanEx locations (src/data/gateways.ts),
// stylised: east–west as it is, north–south stretched 3× so Buea (15 km north of Limbe) reads
// against Douala (60 km east). Map east is world −X and north is +Z, so the wide camera, behind
// the start (azimuth −90°), sees the map the right way round: Limbe low, Buea up, Douala right.
// Everything is a pure function of `s`, the pin progress of the chapter (Stage.storyTravel).
import {
  BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, ImageLoader, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, RepeatWrapping, Sprite, SpriteMaterial, SRGBColorSpace, Texture, Vector3, type Material, type Object3D,
} from 'three';
import { TANEX_LOCATIONS } from '../../../data/gateways';
import { clamp01, journeyEase, lerp, smooth, span } from '../ease';
import { Fade } from '../fade';

/** Scroll timeline in pin progress (0–1): 15% arrive, 70% story, 15% leave. */
export const CITY_TIMELINE = {
  arrive: [0, 0.14],
  fadeIn: [0, 0.04],
  doorOpen: [0.15, 0.25],
  lidOpen: [0.17, 0.25],
  arc: [0.26, 0.4],
  lidClose: [0.38, 0.44],
  doorClose: [0.42, 0.5],
  pull: [0.48, 0.62],
  pins: [0.5, 0.6],
  drive: [0.6, 0.85],
} as const;

/** Metres the bike rides in before stopping behind the truck. */
export const ARRIVE_METRES = 6;
/** The truck at rest: its origin (centre of the wheelbase) on the road ahead of the bike. */
export const TRUCK_START_Z = 5.1;
/** Inside the cargo box, just behind the door (truck space, m): where the parcel lands. */
export const CARGO_SPOT = { x: 0.15, y: 0.94, z: -2.3 } as const;
const BOX_SIDE_X = 1.05;
const BOX_CENTRE_Z = -1.015;
const TYRE_RADIUS = 0.39;
const DOOR_OPEN = (100 * Math.PI) / 180;
/** Map scale (m per map unit, one unit = Limbe → Douala east–west) and the north stretch. */
const MAP_SCALE = 26;
const NORTH_STRETCH = 3;
/** Pin and label size on screen (px), whatever the lane size. */
const PIN_PX = 24;
const LABEL_PX = 17;

const COLORS = {
  road: [217, 194, 181], // Chocolate 200
  line: '#2A1B16', // Chocolate 900
  pin: '#2A1B16',
  check: '#FBF6EC', // Cream 100
  arrived: '#F48800', // Orange 500
  label: '#2A1B16',
  labelBg: '#FFFCF7', // Cream 50
  labelEdge: '#D9C2B5',
} as const;

export interface CityPhase {
  /** Bike position along its heading (m, 0 = parked behind the truck) and opacity. */
  bikeZ: number;
  bikeOpacity: number;
  lid: number;
  door: number;
  /** The parcel: in the bike's box, lifted across (`arc` 0–1), or in the truck. */
  parcel: 'bike' | 'arc' | 'truck';
  arc: number;
  /** Camera pull-back to the route (journey ease), pins shown, truck drive (0–1). */
  pull: number;
  pins: number;
  drive: number;
}

export function cityPhase(s: number): CityPhase {
  const T = CITY_TIMELINE;
  const r = clamp01((s - T.arrive[0]) / (T.arrive[1] - T.arrive[0]));
  const arc = clamp01((s - T.arc[0]) / (T.arc[1] - T.arc[0]));
  return {
    // Decelerating to a stop.
    bikeZ: -ARRIVE_METRES * (1 - r) * (1 - r),
    bikeOpacity: span(s, T.fadeIn[0], T.fadeIn[1]),
    lid: span(s, T.lidOpen[0], T.lidOpen[1]) * (1 - span(s, T.lidClose[0], T.lidClose[1])),
    door: span(s, T.doorOpen[0], T.doorOpen[1]) * (1 - span(s, T.doorClose[0], T.doorClose[1])),
    parcel: s < T.arc[0] ? 'bike' : arc < 1 ? 'arc' : 'truck',
    arc: journeyEase(arc),
    pull: journeyEase(clamp01((s - T.pull[0]) / (T.pull[1] - T.pull[0]))),
    pins: span(s, T.pins[0], T.pins[1]),
    drive: span(s, T.drive[0], T.drive[1]),
  };
}

/** Distance the bike's wheels turn by pin progress `s` (m): riding in. */
export function cityDistance(s: number): number {
  const r = clamp01((s - CITY_TIMELINE.arrive[0]) / (CITY_TIMELINE.arrive[1] - CITY_TIMELINE.arrive[0]));
  return ARRIVE_METRES * (1 - (1 - r) * (1 - r));
}

// ---- the route ----

export interface RoutePin {
  code: string;
  /** City name from the locations data (a proper noun, the same in English and French). */
  city: string;
  x: number;
  z: number;
  /** Position along the road (0–1). */
  u: number;
}

export interface RouteLayout {
  /** Road samples, evenly spaced by length. */
  points: Vector3[];
  length: number;
  pins: RoutePin[];
  /** Where the truck starts (Limbe) and stops (just before Douala), along the road (0–1). */
  start: number;
  stop: number;
  /** Bounds of the pins (x, z), for the wide framing. */
  centre: { x: number; z: number };
  span: number;
}

const ROUTE_CODES = ['LMB', 'BUE', 'DLO'] as const;
const LIMBE_ASIDE = 2.8;
const SAMPLES = 400;

/** Builds the stylised road and its pins from the TanEx locations' coordinates. */
export function routeLayout(): RouteLayout {
  const find = (code: string) => {
    const location = TANEX_LOCATIONS.find((l) => l.code === code);
    if (!location) throw new Error(`Location ${code} missing from gateways.ts`);
    return location;
  };
  const [limbe, buea, douala] = ROUTE_CODES.map(find);
  const unit = douala.lng - limbe.lng;
  const place = (l: { lat: number; lng: number }) => ({
    x: -((l.lng - limbe.lng) / unit) * MAP_SCALE,
    z: TRUCK_START_Z + ((NORTH_STRETCH * (l.lat - limbe.lat)) / unit) * MAP_SCALE,
  });
  const L = place(limbe);
  const B = place(buea);
  const D = place(douala);
  const v = (x: number, z: number) => new Vector3(x, 0, z);
  // Bike's approach behind Limbe, straight out of town, a bend up to Buea, a curving descent to
  // Douala, a short run past it (the road fades there).
  const bd = { x: D.x - B.x, z: D.z - B.z };
  const control = [
    v(L.x, -9), v(L.x, L.z), v(L.x, L.z + 5), v(lerp(L.x, B.x, 0.35), lerp(L.z + 5, B.z, 0.65)), v(B.x, B.z),
    v(B.x + bd.x * 0.3, B.z + bd.z * 0.3 + 2.2), v(B.x + bd.x * 0.68, B.z + bd.z * 0.68 + 0.6), v(D.x, D.z),
    v(D.x + bd.x * 0.16, D.z + bd.z * 0.1),
  ];
  const points = sampleCatmullRom(control, SAMPLES);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + points[i].distanceTo(points[i - 1]));
  const length = cumulative[cumulative.length - 1];
  const uOf = (x: number, z: number) => {
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return cumulative[best] / length;
  };
  const pins: RoutePin[] = [limbe, buea, douala].map((l, i) => {
    const p = [L, B, D][i];
    // Limbe's pin stands beside the road (west), so the parked truck doesn't cover it.
    const aside = i === 0 ? LIMBE_ASIDE : 0;
    return { code: l.code, city: l.city, x: p.x + aside, z: p.z, u: uOf(p.x, p.z) };
  });
  const start = pins[0].u;
  // The truck stops with its cab just short of the Douala pin.
  const stop = pins[2].u - 7 / length;
  const xs = pins.map((p) => p.x);
  const zs = pins.map((p) => p.z);
  return {
    points,
    length,
    pins,
    start,
    stop,
    centre: { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 },
    span: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)),
  };
}

/** Point and heading on the road at `u` (0–1 by length). */
export function roadAt(layout: RouteLayout, u: number, out = new Vector3()): { point: Vector3; yaw: number } {
  const n = layout.points.length - 1;
  const f = clamp01(u) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = f - i;
  const a = layout.points[i];
  const b = layout.points[i + 1];
  out.set(lerp(a.x, b.x, k), 0, lerp(a.z, b.z, k));
  return { point: out, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** Truck position along the road (0–1) at drive progress `drive`. */
export function truckU(layout: RouteLayout, drive: number): number {
  return lerp(layout.start, layout.stop, drive);
}

/** What the camera frames (world m): the bike and truck, then the whole route. */
export interface Focus {
  x: number;
  y: number;
  z: number;
  length: number;
}

const HANDOFF_FOCUS: Focus = { x: 0, y: 1.2, z: 3.3, length: 7.6 };

export function cityFocus(layout: RouteLayout, pull: number): Focus {
  const wide: Focus = { x: layout.centre.x, y: 0, z: layout.centre.z, length: layout.span + 2 };
  return {
    x: lerp(HANDOFF_FOCUS.x, wide.x, pull),
    y: lerp(HANDOFF_FOCUS.y, wide.y, pull),
    z: lerp(HANDOFF_FOCUS.z, wide.z, pull),
    // Zoom feels even when the framed length changes geometrically.
    length: HANDOFF_FOCUS.length * (wide.length / HANDOFF_FOCUS.length) ** pull,
  };
}

/** State of a pin for truck position `u`: still to come, passed, or the arrival. */
export function pinState(pin: RoutePin, index: number, count: number, u: number, layout: RouteLayout): 'todo' | 'done' | 'arrived' {
  const last = index === count - 1;
  if (last) return u >= layout.stop - 1e-6 ? 'arrived' : 'todo';
  if (index === 0) return u > layout.start + 1.5 / layout.length ? 'done' : 'todo';
  return u >= pin.u ? 'done' : 'todo';
}

// ---- the scene ----

export interface CityInput {
  /** How much chapter 3's lane is the Stage's current lane (0–1). */
  shown: number;
  /** Screen scale at the framing target (px per m). */
  pxPerMetre: number;
}

export class CityScene {
  readonly group = new Group();
  readonly layout = routeLayout();
  private readonly roadMaterial: MeshBasicMaterial;
  private readonly road: Road;
  private reach = -1;
  private from = -1;
  private readonly pinSprites: Sprite[] = [];
  private readonly labels: Sprite[] = [];
  private readonly pinTextures: Record<'todo' | 'done' | 'arrived', CanvasTexture>;
  private readonly shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly onChange: () => void;
  private readonly wordmark: Wordmark;
  private truck: Object3D | null = null;
  private wheels: Object3D[] = [];
  private door: Object3D | null = null;
  private truckFade: Fade | null = null;
  /** The logo decals: always transparent (the logo has transparent edges), faded with the truck. */
  private wordmarkMaterial: Material | null = null;
  private readonly at = new Vector3();

  /** `onChange` is called when something loaded later (the logo) needs a new frame. */
  constructor(wordmark: Wordmark, onChange: () => void) {
    this.wordmark = wordmark;
    this.onChange = onChange;
    this.group.name = 'tanex_city';
    this.roadMaterial = new MeshBasicMaterial({
      map: roadTexture(), vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide,
    });
    this.road = roadGeometry(this.layout);
    const road = new Mesh(this.road.geometry, this.roadMaterial);
    road.position.y = 0.004;
    road.renderOrder = -2;
    this.group.add(road);

    // Pins and their names face the camera (sprites), so they read the same from every angle.
    this.pinTextures = { todo: pinTexture('todo'), done: pinTexture('done'), arrived: pinTexture('arrived') };
    this.layout.pins.forEach((pin) => {
      const marker = new Sprite(new SpriteMaterial({ map: this.pinTextures.todo, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      marker.position.set(pin.x, 0.05, pin.z);
      marker.renderOrder = 3;
      this.pinSprites.push(marker);
      this.group.add(marker);
      // Its bottom edge sits a few pixels above the marker (set per frame, in sprite units).
      const label = new Sprite(new SpriteMaterial({ map: labelTexture(pin.city.toUpperCase()), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      label.position.set(pin.x, 0.05, pin.z);
      label.renderOrder = 4;
      this.labels.push(label);
      this.group.add(label);
    });

    this.shadow = new Mesh(
      new PlaneGeometry(2.9, 7.2).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.position.y = 0.006;
    this.shadow.renderOrder = -1;
    this.group.add(this.shadow);
    this.group.visible = false;
  }

  /** Textures to upload before the first frame (they are swapped in later). */
  get textures(): Texture[] {
    return Object.values(this.pinTextures);
  }

  /** The truck model (brief §6 node names). Its materials become fadeable; the logo is added. */
  attachTruck(truck: Object3D): void {
    this.truck = truck;
    this.wheels = ['wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right']
      .map((n) => truck.getObjectByName(n))
      .filter((o): o is Object3D => !!o);
    this.door = truck.getObjectByName('cargo_door') ?? null;
    const materials = new Set<Material>();
    truck.traverse((o) => {
      const m = (o as Mesh).material;
      (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => materials.add(x));
    });
    this.truckFade = new Fade(materials);
    this.wordmarkMaterial = this.addWordmark(truck);
    this.group.add(truck);
  }

  /** The truck's fade, for the Stage's compile pass (both shader variants). */
  get fades(): Fade[] {
    return this.truckFade ? [this.truckFade] : [];
  }

  /** Where the parcel sits inside the truck (world), for the current truck pose. */
  cargoWorld(out: Vector3): Vector3 {
    out.set(CARGO_SPOT.x, CARGO_SPOT.y, CARGO_SPOT.z);
    if (this.truck) {
      this.truck.updateMatrixWorld();
      this.truck.localToWorld(out);
    } else {
      out.z += TRUCK_START_Z;
    }
    return out;
  }

  get truckYaw(): number {
    return this.truck?.rotation.y ?? 0;
  }

  update({ shown, pxPerMetre }: CityInput, phase: CityPhase): void {
    this.group.visible = shown > 0.002;
    if (!this.group.visible) return;
    const L = this.layout;
    const u = truckU(L, phase.drive);
    const { point, yaw } = roadAt(L, u, this.at);
    if (this.truck) {
      this.truck.position.copy(point);
      this.truck.rotation.y = yaw;
      const spin = ((u - L.start) * L.length) / TYRE_RADIUS;
      this.wheels.forEach((w) => (w.rotation.x = spin));
      if (this.door) this.door.rotation.y = -DOOR_OPEN * phase.door;
      this.truckFade?.set(shown);
      if (this.wordmarkMaterial) this.wordmarkMaterial.opacity = shown;
    }
    this.shadow.visible = !!this.truck;
    this.shadow.position.set(point.x, 0.006, point.z);
    this.shadow.rotation.y = yaw;
    this.shadow.material.opacity = shown;
    this.roadMaterial.opacity = shown;
    // During the hand-off only the stretch around the bike and truck is drawn (it stays in the
    // lane, clear of the text); the rest of the road unrolls as the camera pulls back.
    this.setReach(lerp(L.start * L.length + ROAD_AHEAD, L.length + 4, phase.pull), lerp(0, L.start * L.length - ROAD_BEHIND, phase.pull));

    // Pins and names: a constant size on screen; each pin pops as it checks off.
    const pins = phase.pins * shown;
    const metres = 1 / Math.max(1e-3, pxPerMetre);
    L.pins.forEach((pin, i) => {
      const marker = this.pinSprites[i];
      const label = this.labels[i];
      marker.visible = label.visible = pins > 0.002;
      if (!marker.visible) return;
      const state = pinState(pin, i, L.pins.length, u, L);
      if (marker.material.map !== this.pinTextures[state]) marker.material.map = this.pinTextures[state];
      const passAt = i === 0 ? L.start + 1.5 / L.length : i === L.pins.length - 1 ? L.stop : pin.u;
      const pop = 1 + 0.35 * Math.max(0, 1 - (Math.abs(u - passAt) * L.length) / 2.5) * (phase.drive > 0 ? 1 : 0);
      const size = PIN_PX * pop * metres;
      marker.scale.set(size, size, 1);
      marker.material.opacity = pins;
      const tex = label.material.map!;
      const aspect = (tex.image as HTMLCanvasElement).width / (tex.image as HTMLCanvasElement).height;
      label.scale.set(LABEL_PX * metres * aspect, LABEL_PX * metres, 1);
      label.center.set(0.5, -(PIN_PX / 2 + 3) / LABEL_PX);
      label.material.opacity = pins;
    });
  }

  /** Road drawn from `from` to `metres` along it (m), fading in and out over a few metres. */
  private setReach(metres: number, from: number): void {
    if (Math.abs(metres - this.reach) < 0.01 && Math.abs(from - this.from) < 0.01) return;
    this.reach = metres;
    this.from = from;
    const { along, fade, alpha } = this.road;
    for (let i = 0; i < along.length; i++) {
      const a = fade[i] * smooth((metres - along[i]) / 4) * smooth((along[i] - from) / 3);
      alpha.setW(i * 2, a);
      alpha.setW(i * 2 + 1, a);
    }
    alpha.needsUpdate = true;
  }

  /** The TanEx wordmark on both sides of the cargo box: the logo file itself (brief §6, never redrawn). */
  private addWordmark(truck: Object3D): Material {
    // A transparent pixel until the logo has loaded, so the material is compiled with the rest.
    const map: Texture = new CanvasTexture(canvas(1, 1)[0]);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    const material = new MeshStandardMaterial({ map, transparent: true, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 });
    const parent = truck.getObjectByName('truck_body') ?? truck;
    const width = 2.5;
    const height = (width * this.wordmark.height) / this.wordmark.width;
    [-1, 1].forEach((side) => {
      const decal = new Mesh(new PlaneGeometry(width, height).rotateY(side * Math.PI / 2), material);
      decal.position.set(side * (BOX_SIDE_X + 0.016), 2.2, BOX_CENTRE_Z);
      decal.name = 'truck_wordmark';
      parent.add(decal);
    });
    new ImageLoader().load(this.wordmark.url, (image) => {
      // The placeholder's storage is 1 × 1 and fixed: free it, so the logo gets its own.
      map.dispose();
      map.image = image;
      map.needsUpdate = true;
      this.onChange();
    });
    return material;
  }
}

/** The logo file for the truck's sides (the Stage passes brand.ts's web wordmark). */
export interface Wordmark {
  url: string;
  width: number;
  height: number;
}

// ---- geometry and textures ----

function sampleCatmullRom(control: Vector3[], count: number): Vector3[] {
  // Dense centripetal-like sampling, then resampled by length.
  const dense: Vector3[] = [];
  const pts = [control[0].clone().multiplyScalar(2).sub(control[1]), ...control, control[control.length - 1].clone().multiplyScalar(2).sub(control[control.length - 2])];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push(new Vector3(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0,
        0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      ));
    }
  }
  dense.push(control[control.length - 1].clone());
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) lengths.push(lengths[i - 1] + dense[i].distanceTo(dense[i - 1]));
  const total = lengths[lengths.length - 1];
  const out: Vector3[] = [];
  let j = 0;
  for (let i = 0; i <= count; i++) {
    const d = (i / count) * total;
    while (j < lengths.length - 2 && lengths[j + 1] < d) j++;
    const seg = lengths[j + 1] - lengths[j];
    const k = seg > 0 ? (d - lengths[j]) / seg : 0;
    out.push(new Vector3().lerpVectors(dense[j], dense[j + 1], Math.min(1, Math.max(0, k))));
  }
  return out;
}

const ROAD_WIDTH = 3;
const DASH_PERIOD = 2.4;
/** Road drawn past the truck's start during the hand-off (m): its length and a little more. */
const ROAD_AHEAD = 9;
/** In the wide view the road starts this far behind Limbe (m), clear of the caption. */
const ROAD_BEHIND = 5;

interface Road {
  geometry: BufferGeometry;
  /** Per sample: metres along the road, and the fade at both ends. */
  along: Float32Array;
  fade: Float32Array;
  alpha: BufferAttribute;
}

/** A flat ribbon along the road, faded at both ends (vertex alpha), dashes repeating along it. */
function roadGeometry(layout: RouteLayout): Road {
  const pts = layout.points;
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const col = new Float32Array(n * 2 * 4);
  const alongs = new Float32Array(n);
  const fades = new Float32Array(n);
  let along = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) along += pts[i].distanceTo(pts[i - 1]);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl;
    const nz = tx / tl;
    const fade = Math.max(0, Math.min(1, along / 5, (layout.length - along) / 4));
    alongs[i] = along;
    fades[i] = fade;
    for (let side = 0; side < 2; side++) {
      const k = (i * 2 + side);
      const o = side ? 0.5 : -0.5;
      pos.set([pts[i].x + nx * ROAD_WIDTH * o, 0, pts[i].z + nz * ROAD_WIDTH * o], k * 3);
      uv.set([side, along / DASH_PERIOD], k * 2);
      col.set([1, 1, 1, Math.max(0, fade)], k * 4);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new BufferGeometry();
  const alpha = new BufferAttribute(col, 4);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setAttribute('color', alpha);
  g.setIndex(index);
  g.computeVertexNormals();
  return { geometry: g, along: alongs, fade: fades, alpha };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function roadTexture(): CanvasTexture {
  const [c, g] = canvas(64, 64);
  if (g) {
    const [r, gg, b] = COLORS.road;
    const across = g.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 0)`);
    across.addColorStop(0.1, `rgba(${r}, ${gg}, ${b}, 1)`);
    across.addColorStop(0.9, `rgba(${r}, ${gg}, ${b}, 1)`);
    across.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
    g.fillStyle = across;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = COLORS.line;
    g.fillRect(30.5, 0, 3, 30);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function pinTexture(state: 'todo' | 'done' | 'arrived'): CanvasTexture {
  const [c, g] = canvas(64, 64);
  if (g) {
    const fill = state === 'arrived' ? COLORS.arrived : state === 'done' ? COLORS.pin : COLORS.check;
    if (state === 'arrived') {
      g.strokeStyle = COLORS.arrived;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(32, 32, 29, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = fill;
    g.strokeStyle = COLORS.pin;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(32, 32, state === 'arrived' ? 21 : 24, 0, Math.PI * 2);
    g.fill();
    if (state === 'todo') g.stroke();
    if (state !== 'todo') {
      g.strokeStyle = state === 'arrived' ? COLORS.pin : COLORS.check;
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(21, 33);
      g.lineTo(28.5, 40.5);
      g.lineTo(43, 25);
      g.stroke();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function labelTexture(text: string): CanvasTexture {
  const font = getComputedStyle(document.documentElement).getPropertyValue('--tx-font-mono').trim() || 'ui-monospace, monospace';
  const size = 30;
  const pg = canvas(8, 8)[1];
  const setFont = (g: CanvasRenderingContext2D) => {
    g.font = `600 ${size}px ${font}`;
    if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '3px';
  };
  let width = text.length * size * 0.7;
  if (pg) {
    setFont(pg);
    width = pg.measureText(text).width;
  }
  const padX = 16;
  const h = 50;
  const [c, g] = canvas(Math.ceil(width + padX * 2), h);
  if (g) {
    g.fillStyle = COLORS.labelBg;
    g.strokeStyle = COLORS.labelEdge;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(1, 1, c.width - 2, h - 2, (h - 2) / 2);
    g.fill();
    g.stroke();
    setFont(g);
    g.fillStyle = COLORS.label;
    g.textBaseline = 'middle';
    g.fillText(text, padX, h / 2 + 1);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft contact shadow under the truck (a texture, not a shadow map). */
function shadowTexture(): CanvasTexture {
  const [c, g] = canvas(64, 128);
  if (g) {
    g.translate(32, 64);
    g.scale(1, 2.2);
    const grad = g.createRadialGradient(0, 0, 2, 0, 0, 30);
    grad.addColorStop(0, 'rgba(28, 18, 14, 0.42)');
    grad.addColorStop(0.6, 'rgba(28, 18, 14, 0.18)');
    grad.addColorStop(1, 'rgba(28, 18, 14, 0)');
    g.fillStyle = grad;
    g.fillRect(-32, -30, 64, 60);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
