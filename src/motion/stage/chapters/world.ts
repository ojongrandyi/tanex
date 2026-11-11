// Chapter 4 · World (MOTION_3D_SPEC §6): the camera rises from the road to orbit and the globe
// returns, close over Douala at first; the parcel drops onto the paper plane waiting at the Douala
// gateway, the plane flies its arc to a world hub while the other lanes from Douala draw, and the
// globe turns to follow it. Then the chapter releases into the real network map below (DOM).
//
// The lanes are the site's own list (src/data/gateways.ts TRADE_LANES, the same lanes the map
// draws). Like the hero's globe, this one is drawn in its own scene and camera over the main scene,
// held inside the chapter's lane by the porthole. Everything is a pure function of `s`, the pin
// progress of the chapter (Stage.storyTravel).
import { BoxGeometry, CatmullRomCurve3, Matrix4, Mesh, PerspectiveCamera, Scene, Vector3, type Object3D } from 'three';
import { GATEWAYS, HUB_CODE, TANEX_LOCATIONS, TRADE_LANES } from '../../../data/gateways';
import { buildGlobe, flatMaterial, type GlobeRig } from '../globe';
import { clamp01, journeyEase, lerp, smooth, span } from '../ease';

/** Scroll timeline in pin progress (0–1): 15% arrive, 70% story, 15% leave. */
export const WORLD_TIMELINE = {
  fadeIn: [0, 0.1],
  rise: [0, 0.34],
  board: [0.14, 0.3],
  turn: [0.3, 0.72],
  flight: [0.32, 0.8],
  lanes: [0.36, 0.84],
} as const;

/** The hub the plane flies to: Paris, the first of the listed gateways. */
export const WORLD_HUB = 'CDG';
/** Hubs the lanes go to: every gateway served from Douala (the map's lanes). */
export const WORLD_HUBS: readonly string[] = TRADE_LANES.filter(([from]) => from === HUB_CODE).map(([, to]) => to);

/** Camera distance from the globe centre (radius 1): close over Douala, then orbit. */
const DIST_LOW = 1.7;
const DIST_ORBIT = 3.6;
/** Distance at which the globe fills GLOBE_FILL of the lane (the lens is fixed from it). */
const DIST_FRAME = 4;
const GLOBE_FILL = 0.86;
const PLANE_SCALE = 0.085;
const DEG = Math.PI / 180;

export interface WorldPhase {
  /** Globe opacity (before the lane gate). */
  globe: number;
  /** 0 → 1: the camera rising to orbit (journey ease). */
  rise: number;
  /** 0 → 1: the parcel dropping onto the plane. */
  board: number;
  /** 0 → 1: the globe turning from Douala to follow the flight. */
  turn: number;
  /** 0 → 1: the plane along its arc. */
  flight: number;
  /** 0 → 1: the other lanes drawing, one after another. */
  lanes: number;
}

export function worldPhase(s: number): WorldPhase {
  const T = WORLD_TIMELINE;
  const ramp = (r: readonly [number, number]) => clamp01((s - r[0]) / (r[1] - r[0]));
  return {
    globe: span(s, T.fadeIn[0], T.fadeIn[1]),
    rise: journeyEase(ramp(T.rise)),
    board: smooth(ramp(T.board)),
    turn: journeyEase(ramp(T.turn)),
    flight: journeyEase(ramp(T.flight)),
    lanes: ramp(T.lanes),
  };
}

/** How much of each lane is drawn at lanes progress `t` (index `i` of `n`, staggered). */
export function laneDrawn(t: number, i: number, n: number): number {
  const stagger = 0.6;
  const start = n > 1 ? (i / (n - 1)) * stagger : 0;
  return smooth(clamp01((t - start) / (1 - stagger)));
}

/** The lane frame the globe is drawn in (CSS px, relative to the canvas). */
export interface WorldFrame {
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
  dpr: number;
}

export class WorldScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(20, 1, 0.01, 10);
  private readonly rig: GlobeRig;
  private readonly parcel: Mesh;
  private readonly parcelOpacity = { value: 0 };
  private readonly planeArc: number;
  private readonly others: number[] = [];
  private readonly basis = new Matrix4();
  private readonly axes = { x: new Vector3(), y: new Vector3(), z: new Vector3() };
  /** Where the globe faces at the start (Douala) and after the turn (between Douala and the hub). */
  private readonly from: { lat: number; lon: number };
  private readonly to: { lat: number; lon: number };
  private shown = false;

  constructor() {
    this.rig = buildGlobe({ hubs: WORLD_HUBS, planeHub: WORLD_HUB });
    this.rig.group.name = 'tanex_world_globe';
    this.scene.add(this.rig.group);
    this.rig.plane.scale.setScalar(PLANE_SCALE);
    this.planeArc = this.rig.arcs.findIndex((a) => a.code === WORLD_HUB);
    this.rig.arcs.forEach((_, i) => {
      if (i !== this.planeArc) this.others.push(i);
    });

    // The parcel on the plane's back, in plane units (the plane is one unit long).
    this.parcel = new Mesh(new BoxGeometry(0.3, 0.2, 0.26), flatMaterial(this.rig.uniforms, '#E2CFA8', 1, { arcOpacity: this.parcelOpacity }));
    this.parcel.name = 'world_parcel';
    this.parcel.renderOrder = 4;
    this.rig.plane.add(this.parcel);

    const hub = [...TANEX_LOCATIONS, ...GATEWAYS].find((g) => g.code === HUB_CODE);
    const dest = GATEWAYS.find((g) => g.code === WORLD_HUB);
    this.from = { lat: hub?.lat ?? 4.0061, lon: hub?.lng ?? 9.7195 };
    // Face a point a third of the way to the hub, a little south, so Douala and the hub both stay on the face.
    this.to = { lat: lerp(this.from.lat, dest?.lat ?? 49, 0.42) - 4, lon: lerp(this.from.lon, dest?.lng ?? 2.5, 0.42) + 6 };
    this.rig.group.visible = false;
  }

  /** The globe group (hidden until the chapter shows it; the Stage compiles it up front). */
  get root(): Object3D {
    return this.rig.group;
  }

  /** True while the world pass has anything to draw. */
  get drawsGlobe(): boolean {
    return this.shown;
  }

  /** Poses the chapter for pin progress `s`; `presence` is how much the world lane is the lane (0–1). */
  update(s: number, frame: WorldFrame, presence: number): WorldPhase {
    const phase = worldPhase(s);
    const { rig, camera: cam } = this;
    const u = rig.uniforms;
    const opacity = phase.globe * presence;
    this.shown = opacity > 0.002 && frame.size > 0;
    rig.group.visible = this.shown;
    if (!this.shown) return phase;

    const lat = lerp(this.from.lat, this.to.lat, phase.turn);
    const lon = lerp(this.from.lon, this.to.lon, phase.turn);
    rig.group.rotation.set(lat * DEG, -lon * DEG, 0, 'XYZ');
    rig.group.updateMatrixWorld(true);

    // Lanes: the plane's own lane draws behind it; the others draw one after another.
    this.rig.arcs.forEach((arc, i) => {
      const drawn = i === this.planeArc ? phase.flight : laneDrawn(phase.lanes, this.others.indexOf(i), this.others.length);
      arc.mesh.visible = drawn > 0;
      arc.mesh.geometry.setDrawRange(0, Math.floor(drawn * arc.segments) * arc.radial * 6);
    });

    // The plane waits at Douala, the parcel drops onto it, then they fly.
    rig.plane.visible = true;
    this.placePlane(rig.planePath, Math.max(0.0005, phase.flight));
    this.parcel.position.set(0, lerp(1.4, 0.17, phase.board), -0.14);
    this.parcel.rotation.set(0, lerp(0.9, 0, phase.board), 0);
    this.parcelOpacity.value = smooth(phase.board * 2.5);
    this.parcel.visible = phase.board > 0;

    // The lens is fixed (the globe fills the lane at DIST_FRAME); the camera rises along the view axis.
    const radius = (GLOBE_FILL * frame.size) / 2;
    const dist = DIST_LOW * (DIST_ORBIT / DIST_LOW) ** phase.rise;
    const pxPerTan = radius / Math.tan(Math.asin(1 / DIST_FRAME));
    const { width: w, height: h, dpr } = frame;
    cam.fov = (2 * Math.atan(h / 2 / pxPerTan)) / DEG;
    cam.aspect = w / h;
    cam.near = Math.max(0.005, dist - 1.25);
    cam.far = dist + 1.2;
    cam.position.set(0, 0, dist);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(w, h, w / 2 - frame.x, h / 2 - frame.y, w, h);
    cam.updateProjectionMatrix();

    // Porthole: room for the arcs around the globe, inside the lane.
    u.uPxPerUnit.value = pxPerTan * dpr;
    u.uMask.value.set(frame.x * dpr, (h - frame.y) * dpr, radius * 1.3 * dpr);
    u.uMaskSoft.value = 1.5 * dpr;
    u.uHole.value.set(-1, 0.1);
    u.uOpacity.value = opacity;
    u.uArcOpacity.value = 1;
    return phase;
  }

  private placePlane(path: CatmullRomCurve3, t: number): void {
    const plane = this.rig.plane;
    const p = path.getPointAt(t);
    const { x, y, z } = this.axes;
    z.copy(path.getTangentAt(t)).normalize();
    y.copy(p).normalize();
    x.crossVectors(y, z).normalize();
    y.crossVectors(z, x).normalize();
    this.basis.makeBasis(x, y, z);
    plane.quaternion.setFromRotationMatrix(this.basis);
    plane.position.copy(p);
  }
}

