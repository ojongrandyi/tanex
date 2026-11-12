// Chapter 0 · Your door (MOTION_3D_SPEC §6): the cream globe turns continuously while the hero is
// in view (a slow full turn every 20 s; each turn the arcs draw from Douala to the hubs and the paper
// plane glides to Europe; held by Pause motion), then scrolling dives towards
// Buea: the globe grows inside its lane's porthole, Buea comes to the front, an opening widens
// from Buea until the globe is gone, and behind it is a street at a front door where the bike
// pulls up. Scrolling on, the bike rides away and the door is left behind.
//
// The globe is drawn in its own scene with its own camera, over the main scene (bike + door), so
// the opening reveals what is behind it. Every scroll-driven value here is a pure function of the
// Journey travel; the spin is the only time-based part and slows to a stop through the dive.
import {
  Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, CustomBlending, OneMinusSrcAlphaFactor,
  ZeroFactor, ImageLoader, SRGBColorSpace, Texture, Group, CatmullRomCurve3, DoubleSide, TubeGeometry,
} from 'three';
import { buildGlobe, BUEA, flatMaterial, latLonDir, type GlobeRig } from '../globe';
import { paperPlaneGeometry } from '../paperPlane';
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
/**
 * One full turn of the globe, seconds. Each turn the arcs draw out from Douala as it comes round,
 * the plane glides to Europe, and both fade as Douala turns away (owner request, 2026-11-12).
 */
export const SPIN_CYCLE_SECONDS = 20;
/** Where the spin starts on load: Douala just behind the rim, so the arcs draw in within a second. */
export const SPIN_START_SECONDS = 0.12 * SPIN_CYCLE_SECONDS;
/** Cycle position (0–1) shown when motion is paused: Douala in front, arcs drawn, plane landed. */
const SPIN_REST = 0.45;
/** Cycle position at which the globe faces REST. */
const SPIN_FRONT = 0.4;

/** Where the globe faces at rest (Africa and Europe), degrees. */
const REST = { lat: 16, lon: 14 };
/** Camera distance from the globe centre (radius 1) at rest and at the end of the dive. */
const DIST_REST = 4;
const DIST_DIVE = 1.16;
/** Globe diameter as a share of the lane frame. */
const GLOBE_FILL = 0.86;
/** Logo width as a share of the globe's diameter, seen face on. */
const LOGO_SHARE = 0.46;
/**
 * Where the logo is printed on the globe, on open sea so it never sits under the continents: the
 * equatorial Atlantic between South America and the Gulf of Guinea, and the central Pacific, so a
 * print is in view for most of each turn.
 */
const LOGO_AT = [{ lat: 2, lon: -24 }, { lat: 2, lon: -150 }] as const;
/**
 * The orbiting paper plane: a decorative loop round the globe (not a route), so something moves
 * whichever side faces the reader. Radius in globe radii, seconds per loop, the orbit's tilt
 * (radians about X, then Z) and the trail length (share of a loop).
 */
const ORBIT = { radius: 1.13, seconds: 9, tiltX: -0.42, tiltZ: 0.3, trail: 0.16 } as const;
/** Tube segments per loop of the orbit trail; the tube holds two loops so the trail never wraps. */
const ORBIT_SEGMENTS = 160;
const ORBIT_RADIAL = 4;
/** Orange 500 (BRAND_GUIDE §3), as on the globe's arcs and plane. */
const ORANGE = '#F48800';
/** Share of the dive over which the logo fades out. */
const LOGO_OUT_DIVE = 0.3;
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
  /** The orbiting plane and its trail (world space: it does not turn with the globe). */
  private readonly orbit: { group: Group; plane: Mesh; trail: Mesh; opacity: { value: number } };
  private globeShown = true;
  private logoLoaded = false;
  /** Buea's longitude (unwrapped) the current dive turns to; re-chosen while the dive is at 0. */
  private diveLon: number | null = null;
  /** How fast the spin clock should run (0–1), from the last pose: full at the top, 0 at Buea. */
  spinRate = 1;
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

  /**
   * `logo` is the wordmark file shown on the globe's sea; `onChange` asks for a frame once it has
   * loaded. Until then (or if it fails) the globe is drawn without it.
   */
  constructor(logo?: { url: string; width: number; height: number }, onChange: () => void = () => {}) {
    let logoMap: Texture | undefined;
    if (logo) {
      // Empty until the file arrives: the shader skips it while uLogoOpacity is 0.
      logoMap = new Texture();
      logoMap.colorSpace = SRGBColorSpace;
      const map = logoMap;
      new ImageLoader().load(logo.url, (image) => {
        map.image = image;
        map.needsUpdate = true;
        this.logoLoaded = true;
        onChange();
      });
    }
    this.rig = buildGlobe(logoMap && logo ? { logo: { map: logoMap, aspect: logo.width / logo.height, width: LOGO_SHARE, at: LOGO_AT } } : {});
    this.rig.logoOpacity.value = 0;
    this.globeScene.add(this.rig.group);
    this.orbit = this.buildOrbit();
    this.globeScene.add(this.orbit.group);
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
   * Poses the chapter for `travel`. `spin` is seconds of globe spin (null = still rest pose, for
   * Pause motion), `presence` how much the hero lane is the bike's current lane (0–1).
   */
  update(travel: number, spin: number | null, frame: HeroFrame, presence: number, departed: number): HeroPhase {
    const phase = heroPhase(travel);
    this.updateGlobe(phase, spin, frame);
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

  private updateGlobe(phase: HeroPhase, spin: number | null, frame: HeroFrame): void {
    const { rig, globeCamera: cam } = this;
    const u = rig.uniforms;
    this.globeShown = phase.globe > 0.002 && frame.size > 0;
    rig.group.visible = this.globeShown;
    if (!this.globeShown) return;

    // The spin: a steady full turn per cycle. Each time Douala comes round the arcs draw out one
    // after another and the plane glides to Europe; both fade as Douala turns away. `spin` is not
    // wrapped, so the longitude is continuous. The globe keeps turning into the dive (the Stage
    // slows it with `spinRate`) and blends towards the copy of Buea nearest to where the spin was
    // when the dive began: that target is held for the whole dive, so the blend never jumps.
    const turns = spin === null ? SPIN_REST : spin / SPIN_CYCLE_SECONDS;
    const cycle = ((turns % 1) + 1) % 1;
    const spinLon = REST.lon + 360 * (turns - SPIN_FRONT);
    if (phase.dive <= 0 || this.diveLon === null) this.diveLon = BUEA.lon + 360 * Math.round((spinLon - BUEA.lon) / 360);
    // Full speed at the top; slower as the dive deepens; held still after one extra turn while
    // the reader lingers part-way, so the rest of the dive never whirls round several turns.
    const drift = Math.abs(spinLon - this.diveLon);
    this.spinRate = (1 - phase.dive) * clamp01((360 - drift) / 180);
    const lat = lerp(REST.lat, BUEA.lat, phase.dive);
    const lon = lerp(spinLon, this.diveLon, phase.dive);
    rig.group.rotation.set(lat * DEG, -lon * DEG, 0, 'XYZ');
    rig.group.updateMatrixWorld(true);
    u.uHoleDir.value.copy(latLonDir(BUEA.lat, BUEA.lon, this.holeDir).transformDirection(rig.group.matrixWorld));

    rig.arcs.forEach((arc, i) => {
      const drawn = smooth(clamp01((cycle - 0.18 - 0.025 * i) / 0.12));
      arc.mesh.visible = drawn > 0;
      arc.mesh.geometry.setDrawRange(0, Math.floor(drawn * arc.segments) * arc.radial * 6);
    });
    const flight = smooth(clamp01((cycle - 0.2) / 0.25));
    const routes = 1 - smooth(clamp01((cycle - 0.6) / 0.12));
    rig.plane.visible = flight > 0 && routes > 0;
    if (rig.plane.visible) this.placePlane(flight);

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
    u.uArcOpacity.value = phase.arcs * routes;
    this.placeOrbit(spin, phase.arcs);
    // The logo leaves early in the dive, before the camera closes in and it would fill the lane.
    rig.logoOpacity.value = this.logoLoaded ? 1 - smooth(phase.dive / LOGO_OUT_DIVE) : 0;
  }

  /** The orbit's plane and trail, sharing the globe's porthole, opening and fade. */
  private buildOrbit(): HeroScene['orbit'] {
    const group = new Group();
    group.name = 'tanex_orbit';
    group.rotation.set(ORBIT.tiltX, 0, ORBIT.tiltZ, 'XZY');
    const opacity = { value: 1 };
    const points: Vector3[] = [];
    for (let i = 0; i <= 2 * ORBIT_SEGMENTS; i++) {
      const a = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      points.push(new Vector3(Math.sin(a) * ORBIT.radius, 0, Math.cos(a) * ORBIT.radius));
    }
    const trailMaterial = flatMaterial(this.rig.uniforms, ORANGE, 0, { arcOpacity: opacity });
    trailMaterial.depthWrite = false;
    const trail = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(points), 2 * ORBIT_SEGMENTS, 0.0032, ORBIT_RADIAL, false),
      trailMaterial,
    );
    trail.name = 'orbit_trail';
    trail.renderOrder = 1;
    const plane = new Mesh(paperPlaneGeometry(), flatMaterial(this.rig.uniforms, ORANGE, 1, { side: DoubleSide, arcOpacity: opacity }));
    plane.name = 'orbit_plane';
    plane.scale.setScalar(0.07);
    plane.renderOrder = 3;
    group.add(trail, plane);
    return { group, plane, trail, opacity };
  }

  /** Loop position from the spin clock (a still pose with Pause motion), fading with the arcs. */
  private placeOrbit(spin: number | null, fade: number): void {
    const { plane, trail, opacity, group } = this.orbit;
    opacity.value = fade;
    group.visible = fade > 0.002;
    if (!group.visible) return;
    const loop = spin === null ? 0.3 : (((spin / ORBIT.seconds) % 1) + 1) % 1;
    const a = loop * Math.PI * 2;
    // Second loop of the tube, so the trail behind the plane never runs off the start.
    const head = Math.floor((1 + loop) * ORBIT_SEGMENTS);
    const length = Math.floor(ORBIT.trail * ORBIT_SEGMENTS);
    trail.geometry.setDrawRange((head - length) * ORBIT_RADIAL * 6, length * ORBIT_RADIAL * 6);
    const { x, y, z } = this.axes;
    plane.position.set(Math.sin(a) * ORBIT.radius, 0, Math.cos(a) * ORBIT.radius);
    z.set(Math.cos(a), 0, -Math.sin(a));
    y.copy(plane.position).normalize();
    x.crossVectors(y, z).normalize();
    y.crossVectors(z, x).normalize();
    this.basis.makeBasis(x, y, z);
    plane.quaternion.setFromRotationMatrix(this.basis);
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
