// Chapter 0 · Your door (MOTION_3D_SPEC §6): the cream globe turns once (a ≤ 5 s intro: arcs
// draw from Douala to the hubs, the paper plane glides to Europe), then scrolling dives towards
// Buea: the globe grows inside its lane's porthole, Buea comes to the front, an opening widens
// from Buea until the globe is gone, and behind it is a street at a front door where the bike
// pulls up. Scrolling on, the bike rides away and the door is left behind.
//
// The globe is drawn in its own scene with its own camera, over the main scene (bike + door), so
// the opening reveals what is behind it. Every scroll-driven value here is a pure function of the
// Journey travel; the intro is the only time-based part and settles for good after 5 s.
import {
  Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, CustomBlending, OneMinusSrcAlphaFactor,
  ZeroFactor, type Group,
} from 'three';
import { buildGlobe, BUEA, latLonDir, type GlobeRig } from '../globe';
import { buildDoor, setDoorOpacity, type Door } from '../door';
import { clamp01, journeyEase, lerp, smooth, span } from '../ease';

/** Scroll timeline of the chapter, in Journey travel (0 = top of the page, 1 = Services). */
export const HERO_TIMELINE = {
  dive: [0.04, 0.4],
  arcsOut: [0.14, 0.32],
  hole: [0.26, 0.5],
  globeOut: [0.44, 0.52],
  roll: [0.3, 0.56],
  depart: [0.82, 1],
  door: [0.24, 0.34],
  doorOut: [0.86, 1],
  clip: [0.5, 0.64],
} as const;

/** Metres the bike rolls in before stopping at the door, and rides before Services starts. */
export const ROLL_METRES = 1;
export const DEPART_METRES = 0.65;
/** Length of the intro (MOTION §1.3: idle motion stops after 5 s). */
export const INTRO_SECONDS = 5;

/** Where the globe faces at rest (Africa and Europe), degrees. */
const REST = { lat: 16, lon: 14 };
const INTRO_SPIN = 28;
/** Camera distance from the globe centre (radius 1) at rest and at the end of the dive. */
const DIST_REST = 4;
const DIST_DIVE = 1.16;
/** Globe diameter as a share of the lane frame. */
const GLOBE_FILL = 0.86;
const DEG = Math.PI / 180;

/** The door's place along the bike's heading (m): just ahead of the bike's centre when it stops. */
export const DOOR_Z = 0.25;

export interface HeroPhase {
  /** 0 → 1: the dive (journey ease). */
  dive: number;
  /** 0 → 1: the opening around Buea. */
  hole: number;
  /** Globe opacity (arcs and plane: `arcs`). */
  globe: number;
  arcs: number;
  /** Door scene opacity before lane weighting. */
  door: number;
  /** Bike position along its heading (m, 0 = at the door) and whether it is drawn. */
  bikeZ: number;
  bikeShown: boolean;
  /** 1 = the street and bike are clipped to the globe's porthole; opens to 0 once the globe is gone. */
  clip: number;
}

export function heroPhase(travel: number): HeroPhase {
  const T = HERO_TIMELINE;
  const roll = clamp01((travel - T.roll[0]) / (T.roll[1] - T.roll[0]));
  return {
    dive: journeyEase(clamp01((travel - T.dive[0]) / (T.dive[1] - T.dive[0]))),
    hole: span(travel, T.hole[0], T.hole[1]),
    globe: 1 - span(travel, T.globeOut[0], T.globeOut[1]),
    arcs: 1 - span(travel, T.arcsOut[0], T.arcsOut[1]),
    door: span(travel, T.door[0], T.door[1]) * (1 - span(travel, T.doorOut[0], T.doorOut[1])),
    // Decelerating to a stop at the door.
    bikeZ: -ROLL_METRES * (1 - roll) * (1 - roll),
    bikeShown: travel >= T.roll[0] - 0.02,
    clip: 1 - span(travel, T.clip[0], T.clip[1]),
  };
}

/** Distance the bike has covered by `travel` within chapter 0 (m): roll in, park, pull away. */
export function heroDistance(travel: number): number {
  const T = HERO_TIMELINE;
  const roll = clamp01((travel - T.roll[0]) / (T.roll[1] - T.roll[0]));
  const away = clamp01((travel - T.depart[0]) / (T.depart[1] - T.depart[0]));
  return ROLL_METRES * (1 - (1 - roll) * (1 - roll)) + DEPART_METRES * away * away;
}

/** The lane frame the chapter is drawn in (CSS px, relative to the canvas). */
export interface HeroFrame {
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
  dpr: number;
}

export class HeroScene {
  readonly globeScene = new Scene();
  readonly globeCamera = new PerspectiveCamera(20, 1, 0.01, 10);
  private readonly door: Door = buildDoor();
  /** The street at the door: added to the main scene by the Stage. */
  readonly street: Group = this.door.group;
  private readonly rig: GlobeRig;
  private readonly holeDir = new Vector3();
  private readonly basis = new Matrix4();
  private readonly axes = { x: new Vector3(), y: new Vector3(), z: new Vector3() };
  private globeShown = true;
  /**
   * The porthole clip for the main scene: a full-screen pass, drawn after the main scene, that
   * clears everything outside the globe's circle (premultiplied alpha: dst × (1 − a)), so the
   * street and the arriving bike only show inside it until the globe has gone.
   */
  readonly clipScene = new Scene();
  private readonly clipUniforms = {
    uMask: { value: new Vector3() },
    uSoft: { value: 24 },
    uAmount: { value: 0 },
  };
  private clipShown = false;

  constructor() {
    this.rig = buildGlobe();
    this.globeScene.add(this.rig.group);
    this.street.position.z = DOOR_Z;
    const clip = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        uniforms: this.clipUniforms,
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform vec3 uMask;
          uniform float uSoft;
          uniform float uAmount;
          void main() {
            float d = distance(gl_FragCoord.xy, uMask.xy);
            gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(uMask.z - uSoft, uMask.z, d) * uAmount);
          }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: ZeroFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
      }),
    );
    clip.frustumCulled = false;
    this.clipScene.add(clip);
  }

  /** True while the globe pass has anything to draw. */
  get drawsGlobe(): boolean {
    return this.globeShown;
  }

  /** True while the main scene must be clipped to the porthole. */
  get drawsClip(): boolean {
    return this.clipShown;
  }

  /**
   * Poses the chapter for `travel`. `intro` is seconds since the intro started (≥ INTRO_SECONDS
   * once settled), `presence` how much the hero lane is the bike's current lane (0–1).
   */
  update(travel: number, intro: number, frame: HeroFrame, presence: number, departed: number): HeroPhase {
    const phase = heroPhase(travel);
    this.updateGlobe(phase, intro, frame);
    const c = this.clipUniforms;
    this.clipShown = phase.clip > 0.002 && phase.bikeShown && frame.size > 0;
    if (this.clipShown) {
      const radius = (GLOBE_FILL * frame.size) / 2;
      const mask = radius * lerp(1.3, 1.15, phase.dive);
      // Opens softly: the circle widens while the clip fades.
      c.uMask.value.set(frame.x * frame.dpr, (frame.height - frame.y) * frame.dpr, mask * (1 + 0.5 * (1 - phase.clip)) * frame.dpr);
      c.uSoft.value = 24 * frame.dpr;
      c.uAmount.value = phase.clip;
    }
    // The street: fades in behind the opening, slides back as the bike pulls away, and goes with
    // the hero lane.
    setDoorOpacity(this.door, phase.door * smooth(presence * 1.4));
    this.street.position.z = DOOR_Z - departed;
    return phase;
  }

  private updateGlobe(phase: HeroPhase, intro: number, frame: HeroFrame): void {
    const { rig, globeCamera: cam } = this;
    const u = rig.uniforms;
    this.globeShown = phase.globe > 0.002 && frame.size > 0;
    rig.group.visible = this.globeShown;
    if (!this.globeShown) return;

    // Intro: a slow turn that settles, arcs drawing one after another, the plane gliding.
    const settle = clamp01(intro / INTRO_SECONDS);
    const spin = INTRO_SPIN * (1 - (1 - settle) ** 3);
    const lat = lerp(REST.lat, BUEA.lat, phase.dive);
    const lon = lerp(REST.lon - INTRO_SPIN + spin, BUEA.lon, phase.dive);
    rig.group.rotation.set(lat * DEG, -lon * DEG, 0, 'XYZ');
    rig.group.updateMatrixWorld(true);
    u.uHoleDir.value.copy(latLonDir(BUEA.lat, BUEA.lon, this.holeDir).transformDirection(rig.group.matrixWorld));

    rig.arcs.forEach((arc, i) => {
      const drawn = smooth(clamp01((intro - 0.4 - 0.22 * i) / 1.4));
      arc.mesh.visible = drawn > 0;
      arc.mesh.geometry.setDrawRange(0, Math.floor(drawn * arc.segments) * arc.radial * 6);
    });
    const flight = smooth(clamp01((intro - 0.9) / 3.4));
    rig.plane.visible = flight > 0;
    if (flight > 0) this.placePlane(flight);

    // The dive: a fixed lens, the camera closing in on the surface.
    const radius = (GLOBE_FILL * frame.size) / 2;
    const dist = DIST_REST * (DIST_DIVE / DIST_REST) ** phase.dive;
    const pxPerTan = radius / Math.tan(Math.asin(1 / DIST_REST));
    const w = frame.width;
    const h = frame.height;
    cam.fov = (2 * Math.atan(h / 2 / pxPerTan)) / DEG;
    cam.aspect = w / h;
    // Near plane in front of the highest arc (radius ≤ 1.2), far plane behind the globe.
    cam.near = Math.max(0.005, dist - 1.25);
    cam.far = dist + 1.2;
    cam.position.set(0, 0, dist);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(w, h, w / 2 - frame.x, h / 2 - frame.y, w, h);
    cam.updateProjectionMatrix();

    // The porthole: room for the arcs at rest, then it tightens to just over the lane's width.
    const dpr = frame.dpr;
    const mask = radius * lerp(1.3, 1.15, phase.dive);
    u.uPxPerUnit.value = pxPerTan * dpr;
    u.uMask.value.set(frame.x * dpr, (h - frame.y) * dpr, mask * dpr);
    u.uMaskSoft.value = 1.5 * dpr;
    // The opening is sized to the part of the globe inside the porthole (a few degrees once the
    // camera is close), so its edge visibly sweeps out from Buea to the rim.
    const beta = Math.atan(mask / pxPerTan);
    const reach = dist * Math.sin(beta);
    const cap = reach >= 1 ? Math.acos(1 / dist) : Math.asin(reach) - beta;
    const soft = Math.max(0.002, cap * 0.18);
    u.uHole.value.set(lerp(-2 * soft, cap * 1.25 + soft, phase.hole), soft);
    u.uOpacity.value = phase.globe;
    u.uArcOpacity.value = phase.arcs;
  }

  private placePlane(t: number): void {
    const { plane, planePath } = this.rig;
    const p = planePath.getPointAt(t);
    const { x, y, z } = this.axes;
    z.copy(planePath.getTangentAt(t)).normalize();
    y.copy(p).normalize();
    x.crossVectors(y, z).normalize();
    y.crossVectors(z, x).normalize();
    this.basis.makeBasis(x, y, z);
    plane.quaternion.setFromRotationMatrix(this.basis);
    plane.position.copy(p);
  }
}
