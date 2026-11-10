// The Stage (MOTION_3D_SPEC §1–§2, §5, §8): one WebGL renderer for the whole homepage, drawn on
// one canvas that stays on screen while the homepage scrolls. It renders on demand only (a
// Journey update, a resize, the tab becoming visible, and the hero's ≤ 5 s intro), never in an
// endless loop, and everything scroll-driven is a pure function of the Journey state and the lane
// positions, so scrolling back up gives exactly the frames scrolling down gave.
//
// Two passes: the main scene (bike, the door of chapter 0, the road of chapter 1) with a camera
// that orbits the bike and frames it in the current lane; then, in chapter 0, the globe in its
// own scene on top, so the opening it dives through reveals the street behind (chapters/hero.ts).
import {
  CanvasTexture, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, NeutralToneMapping, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, type BufferGeometry, type Material, type Object3D,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { isMotionPaused, subscribeMotionPaused } from '../capabilities';
import { loadAssets, readyChapters } from './assets';
import { WHEEL_RADIUS } from './bike';
import { CameraRail, type CameraView } from './camera';
import { bump, lerp, smooth } from './ease';
import { laneAnchor, type LaneRect } from './lanes';
import { HeroScene, heroDistance, INTRO_SECONDS, ROLL_METRES } from './chapters/hero';
import { bandFrame, rideProgress, ServicesScene } from './chapters/services';

export interface StageOptions {
  canvas: HTMLCanvasElement;
  /** The homepage element holding the `[data-chapter]` sections and their `.tx-ch__lane`s. */
  root: HTMLElement;
  /** Phone: lower pixel ratio, no antialiasing. */
  phone: boolean;
  /** The first frame is on the canvas: posters of the ready chapters have been handed over. */
  onFirstFrame: () => void;
  /** WebGL context lost: posters are back; the owner should dispose the Stage. */
  onLost: () => void;
}

/** What the Stage reads from the Journey (JourneyController's state). */
export interface StageJourney {
  /** Continuous position in chapter numbers. */
  travel: number;
  /** Current chapter and the progress through it (its pin when pinned). */
  chapter: number;
  progress: number;
}

export interface FrameStats {
  /** Frames rendered. */
  frames: number;
  /** CPU time per rendered frame (pose + camera + render calls), most recent last, ≤ 600 kept. */
  ms: number[];
}

const DPR_CAP = { desktop: 1.5, phone: 1.25 } as const;
/** The bike's length used for framing, and how much of the lane frame it fills. */
const BIKE_LENGTH = 2;
const FILL = 0.8;
const LOOK_HEIGHT = 0.78;
/** Riding speed per chapter from Services on (0 = parked), in metres per unit of travel × METRES. */
const SPEED = [0, 1.2, 0.5, 1.2, 1, 0.6, 0, 0, 0.5];
const METRES = 6;
const LID_OPEN = (100 * Math.PI) / 180;
const TORSO_TURN = (20 * Math.PI) / 180;
/** Key light offset at camera azimuth 0; it turns with the camera so the visible side is lit. */
const SUN = { x: 3, y: 6, z: 4 };
/** Camera on the Services band: a low side view, the bike riding left to right. */
const BAND_VIEW: CameraView = { az: 180, el: 12, zoom: 1.08, fov: 30 };

/** Distance ridden at a travel value: drives the wheel spin and the scenery that moves past. */
export function distanceAt(travel: number): number {
  let d = heroDistance(Math.min(travel, 1));
  for (let c = 1; c < SPEED.length; c++) {
    const part = Math.min(1, Math.max(0, travel - c));
    d += part * SPEED[c] * METRES;
  }
  return d;
}

interface Lane {
  el: HTMLElement;
  chapter: number;
  /** The Services road band between the card rows (the bike rides across it). */
  band: boolean;
}

export class Stage {
  readonly stats: FrameStats = { frames: 0, ms: [] };

  private readonly opts: StageOptions;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 100);
  private readonly rail = new CameraRail();
  private readonly view: CameraView = { az: 0, el: 0, zoom: 1, fov: 30 };
  private readonly abort = new AbortController();
  private readonly sun = new DirectionalLight('#FFFCF7', 2.2);
  /** Cream rim light kept behind the bike as seen from the camera: separates it from dark chapters. */
  private readonly rim = new DirectionalLight('#FFE9CC', 2.2);
  private readonly shadow: Mesh;
  private readonly hero = new HeroScene();
  private readonly services = new ServicesScene();
  private nodes: Record<'bike' | 'front' | 'rear' | 'bars' | 'torso' | 'lid', Object3D | null> = {
    bike: null, front: null, rear: null, bars: null, torso: null, lid: null,
  };
  private lanes: Lane[] = [];
  private ready = new Set<number>();
  private journey: StageJourney = { travel: 0, chapter: 0, progress: 0 };
  private hasTravel = false;
  /** Shaders compiled and linked: drawing may start. */
  private compiled = false;
  private frame = 0;
  private size = { w: 0, h: 0 };
  private opacity = -1;
  private shown = false;
  private disposed = false;
  /** When the hero intro started (ms), or null until the globe is first seen. */
  private introStart: number | null = null;
  private readonly unsubscribePause: () => void;
  private readonly environment: Texture;

  constructor(opts: StageOptions) {
    this.opts = opts;
    this.renderer = new WebGLRenderer({
      canvas: opts.canvas, alpha: true, antialias: !opts.phone, stencil: false, powerPreference: 'default',
    });
    this.renderer.setClearColor(0x000000, 0);
    // Realistic materials (paint, chrome, glass) need reflections: a soft studio environment,
    // generated once in code (no image download). Neutral tone mapping keeps brand colours true.
    this.renderer.toneMapping = NeutralToneMapping;
    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.phone ? DPR_CAP.phone : DPR_CAP.desktop));

    this.scene.add(new HemisphereLight('#FFF6EB', '#4A3128', 1.1));
    this.sun.position.set(SUN.x, SUN.y, SUN.z);
    this.scene.add(this.sun);
    this.scene.add(this.rim);
    this.shadow = shadowPlane();
    this.scene.add(this.shadow);
    this.scene.add(this.hero.street);
    this.scene.add(this.services.group);

    opts.canvas.addEventListener('webglcontextlost', this.onContextLost);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.unsubscribePause = subscribeMotionPaused(() => this.requestRender());
  }

  /** Loads the chapter assets (bike first) and renders as soon as the bike is in. */
  async load(): Promise<void> {
    const loaded = new Set<string>();
    await loadAssets((asset, object) => {
      if (this.disposed) return;
      this.scene.add(object);
      loaded.add(asset.id);
      if (asset.id === 'bike') {
        const find = (name: string) => object.getObjectByName(name) ?? null;
        this.nodes = {
          bike: find('tanex_bike') ?? object,
          front: find('front_wheel'),
          rear: find('rear_wheel'),
          bars: find('handlebar'),
          torso: find('rider_torso'),
          lid: find('box_lid'),
        };
      }
      this.ready = readyChapters(loaded);
      this.collectLanes();
    }, this.abort.signal);
    if (this.disposed) return;
    await this.compileShaders();
    if (this.disposed) return;
    this.compiled = true;
    this.requestRender();
  }

  /** Journey position (MOTION §6 chapter numbers, continuous). */
  setTravel(travel: number): void {
    this.setJourney({ travel, chapter: Math.floor(travel), progress: travel - Math.floor(travel) });
  }

  setJourney(journey: StageJourney): void {
    this.journey = { travel: journey.travel, chapter: journey.chapter, progress: journey.progress };
    this.hasTravel = true;
    this.requestRender();
  }

  requestRender(): void {
    if (!this.frame && !this.disposed) this.frame = window.requestAnimationFrame(this.draw);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.unsubscribePause();
    if (this.frame) window.cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.opts.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.markPosters(false);
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    const free = (o: Object3D) => {
      const drawable = o as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      if (!drawable.geometry) return;
      drawable.geometry.dispose();
      const list = drawable.material ? (Array.isArray(drawable.material) ? drawable.material : [drawable.material]) : [];
      list.forEach((m) => materials.add(m));
    };
    this.scene.traverse(free);
    this.hero.globeScene.traverse(free);
    this.hero.clipScene.traverse(free);
    materials.forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v && typeof v === 'object' && (v as Texture).isTexture) textures.add(v as Texture);
      });
      m.dispose();
    });
    textures.forEach((t) => t.dispose());
    this.environment.dispose();
    this.scene.clear();
    this.hero.globeScene.clear();
    this.hero.clipScene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ---- internals ----

  /**
   * Compiles every material's shaders (hidden chapter objects included) and waits until the GPU
   * has linked them, so no scroll frame ever stalls on a shader. Drawing starts after this.
   */
  private async compileShaders(): Promise<void> {
    const hidden = [this.hero.street, this.services.group].filter((o) => !o.visible);
    hidden.forEach((o) => (o.visible = true));
    // compileAsync compiles synchronously (visibility matters only now), then waits for linking.
    const jobs = [
      this.renderer.compileAsync(this.scene, this.camera),
      this.renderer.compileAsync(this.hero.globeScene, this.hero.globeCamera),
      this.renderer.compileAsync(this.hero.clipScene, this.hero.globeCamera),
    ];
    hidden.forEach((o) => (o.visible = false));
    // Upload the chapter textures now too (a first upload inside a scroll frame is a stall).
    [this.scene, this.hero.globeScene].forEach((scene) =>
      scene.traverse((o) => {
        const material = (o as Mesh).material as Material | undefined;
        if (!material || Array.isArray(material)) return;
        Object.values(material).forEach((v) => {
          if (v && typeof v === 'object' && (v as Texture).isTexture) this.renderer.initTexture(v as Texture);
        });
      }),
    );
    await Promise.all(jobs);
    if (!this.disposed) this.warmUp();
  }

  /**
   * Draws every object once into a 1 × 1 scissored corner, then clears: uploads the vertex data
   * of objects that start hidden (the bike waits behind the globe in chapter 0), so their first
   * real frame doesn't stall the scroll. The canvas is still transparent at this point.
   */
  private warmUp(): void {
    const r = this.renderer;
    const restore: (() => void)[] = [];
    const reveal = (root: Object3D) =>
      root.traverse((o) => {
        const { visible, frustumCulled } = o;
        o.visible = true;
        o.frustumCulled = false;
        restore.push(() => {
          o.visible = visible;
          o.frustumCulled = frustumCulled;
        });
      });
    reveal(this.scene);
    reveal(this.hero.globeScene);
    r.setScissorTest(true);
    r.setScissor(0, 0, 1, 1);
    r.render(this.scene, this.camera);
    r.render(this.hero.globeScene, this.hero.globeCamera);
    r.setScissorTest(false);
    r.clear();
    restore.forEach((undo) => undo());
  }

  /** The lanes of the chapters whose assets are ready (the bike's possible places). */
  private collectLanes(): void {
    this.lanes = Array.from(this.opts.root.querySelectorAll<HTMLElement>('[data-chapter] .tx-ch__lane'))
      .map((el) => ({
        el,
        chapter: Number(el.closest<HTMLElement>('[data-chapter]')?.dataset.chapter),
        band: el.dataset.lane === 'band',
      }))
      .filter((lane) => this.ready.has(lane.chapter));
  }

  /** Posters of ready chapters fade out while the Stage draws (CSS: `[data-stage="on"]`). */
  private markPosters(on: boolean): void {
    this.opts.root.querySelectorAll<HTMLElement>('[data-chapter]').forEach((section) => {
      if (on && this.ready.has(Number(section.dataset.chapter))) section.dataset.stage = 'on';
      else if (section.dataset.stage !== undefined) delete section.dataset.stage;
    });
  }

  private readonly draw = () => {
    this.frame = 0;
    if (this.disposed || !this.compiled || !this.nodes.bike || !this.hasTravel || document.hidden) return;
    const started = performance.now();
    const canvas = this.opts.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.width === 0) return;

    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w !== this.size.w || h !== this.size.h) {
      this.renderer.setSize(w, h, false);
      this.size = { w, h };
    }

    const { travel, chapter, progress } = this.journey;
    const ride = rideProgress(chapter, progress);
    const raw = this.lanes.map((lane) => lane.el.getBoundingClientRect());
    const rects: LaneRect[] = raw.map((r, i) => (this.lanes[i].band ? bandFrame(r, ride) : r));
    const view = { top: headerOffset(), bottom: window.innerHeight };
    const anchor = laneAnchor(rects, view);
    let heroShare = 0;
    let servicesShare = 0;
    let bandShare = 0;
    let band: DOMRect | null = null;
    anchor.shares.forEach((share, i) => {
      const lane = this.lanes[i];
      if (lane.chapter === 0) heroShare += share;
      if (lane.chapter === 1) servicesShare += share;
      if (lane.band) {
        bandShare += share;
        band = raw[i];
      }
    });
    const opacity = Math.round(smooth(anchor.weight * 1.6) * 100) / 100;
    if (opacity !== this.opacity) {
      canvas.style.opacity = String(opacity);
      this.opacity = opacity;
    }

    let animating = false;
    if (opacity > 0) {
      const ax = anchor.x - rect.left;
      const ay = anchor.y - rect.top;
      const pxPerMetre = this.aim(ax, ay, anchor.size, w, h, bandShare);

      // Chapter 1: the road, kept on the band while the bike crosses it.
      const bandRect = band as DOMRect | null;
      const along = bandRect ? (anchor.x - (bandRect.left + bandRect.width / 2)) / pxPerMetre : 0;
      const distance = distanceAt(travel);
      const { yaw } = this.services.update({ distance, band: bandShare, presence: servicesShare, ride, along, travel });

      // Chapter 0: the globe in the hero lane, then the door.
      const heroLane = this.lanes.findIndex((lane) => lane.chapter === 0);
      // The globe fits inside the hero lane (its smaller side), unlike the bike, which may overhang.
      const heroAnchor = heroLane >= 0 ? laneAnchor([rects[heroLane]], view) : null;
      const intro = this.introSeconds(heroAnchor !== null && heroAnchor.weight > 0.25 && travel < 0.3);
      const phase = this.hero.update(
        travel,
        intro,
        heroAnchor
          ? { x: heroAnchor.x - rect.left, y: heroAnchor.y - rect.top, size: Math.min(rects[heroLane].width, rects[heroLane].height), width: w, height: h, dpr: this.renderer.getPixelRatio() }
          : { x: 0, y: 0, size: 0, width: w, height: h, dpr: 1 },
        travel < 1.5 ? Math.max(heroShare, travel < 0.6 ? 1 : 0) : 0,
        Math.max(0, distance - ROLL_METRES),
      );
      animating = this.hero.drawsGlobe && this.introStart !== null && intro < INTRO_SECONDS;

      this.pose(travel, travel < 1 ? phase.bikeZ : 0, travel < 1 ? phase.bikeShown : true, yaw, bandShare);
      this.renderer.render(this.scene, this.camera);
      if (this.hero.drawsClip || this.hero.drawsGlobe) {
        this.renderer.autoClear = false;
        if (this.hero.drawsClip) this.renderer.render(this.hero.clipScene, this.hero.globeCamera);
        if (this.hero.drawsGlobe) {
          this.renderer.clearDepth();
          this.renderer.render(this.hero.globeScene, this.hero.globeCamera);
        }
        this.renderer.autoClear = true;
      }
      this.stats.frames += 1;
      this.stats.ms.push(performance.now() - started);
      if (this.stats.ms.length > 600) this.stats.ms.shift();
    }
    if (!this.shown) {
      this.shown = true;
      this.markPosters(true);
      this.opts.onFirstFrame();
    }
    if (animating) this.requestRender();
  };

  /**
   * Seconds into the hero intro (MOTION §1.3: ≤ 5 s, then still). It starts the first time the
   * globe is seen near the top of the page; Pause motion, or arriving lower down, skips it.
   */
  private introSeconds(visibleAtTop: boolean): number {
    if (isMotionPaused()) return INTRO_SECONDS;
    if (this.introStart === null) {
      if (!visibleAtTop) return this.journey.travel >= 0.3 ? INTRO_SECONDS : 0;
      this.introStart = performance.now();
    }
    return Math.min(INTRO_SECONDS, (performance.now() - this.introStart) / 1000);
  }

  /** Moving parts as pure functions of travel. */
  private pose(travel: number, bikeZ: number, shown: boolean, yaw: number, band: number): void {
    const { bike, front, rear, bars, torso, lid } = this.nodes;
    if (bike) {
      bike.visible = shown;
      bike.position.z = bikeZ;
      bike.rotation.y = yaw;
    }
    this.shadow.visible = shown;
    this.shadow.position.z = bikeZ;
    this.shadow.rotation.y = yaw;
    const spin = distanceAt(travel) / WHEEL_RADIUS;
    if (front) front.rotation.x = spin;
    if (rear) rear.rotation.x = spin;
    // Services, beside the intro: a gentle weave down the road (straight across the band).
    if (bars) bars.rotation.y = 0.16 * Math.sin((travel - 1) * Math.PI * 4) * bump(travel, 1, 2, 0.15) * (1 - smooth(band));
    // In town: the rider glances at the phone; the box opens to show the parcel, then closes.
    if (torso) torso.rotation.y = TORSO_TURN * bump(travel, 2.5, 2.78, 0.06);
    // Box: open in In town, and again on arrival (stays open at the very end).
    if (lid) lid.rotation.x = -LID_OPEN * Math.max(bump(travel, 2.55, 2.9, 0.08), smooth((travel - 7.7) / 0.25));
  }

  /**
   * Camera on the rail (blended to the band view while the band is the lane), framed so the bike
   * fills the lane and sits on the anchor point. Returns the scale at the bike, px per metre.
   */
  private aim(ax: number, ay: number, frame: number, w: number, h: number, band: number): number {
    const v = this.rail.sample(this.journey.travel, this.view);
    if (band > 0) {
      const b = smooth(band);
      v.az = lerp(v.az, BAND_VIEW.az, b);
      v.el = lerp(v.el, BAND_VIEW.el, b);
      v.zoom = lerp(v.zoom, BAND_VIEW.zoom, b);
      v.fov = lerp(v.fov, BAND_VIEW.fov, b);
    }
    const cam = this.camera;
    const fov = (v.fov * Math.PI) / 180;
    const pxPerMetre = Math.max(1, (FILL * frame * v.zoom) / BIKE_LENGTH);
    const dist = h / (2 * Math.tan(fov / 2) * pxPerMetre);
    const az = (v.az * Math.PI) / 180;
    const el = (v.el * Math.PI) / 180;
    cam.fov = v.fov;
    cam.aspect = w / h;
    cam.near = Math.max(0.05, dist - 6);
    cam.far = dist + 24;
    cam.position.set(dist * Math.cos(el) * Math.cos(az), LOOK_HEIGHT + dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az));
    cam.lookAt(0, LOOK_HEIGHT, 0);
    const c = Math.cos(az);
    const s = Math.sin(az);
    this.sun.position.set(SUN.x * c - SUN.z * s, SUN.y, SUN.x * s + SUN.z * c);
    this.rim.position.set(-cam.position.x, LOOK_HEIGHT + 2.5, -cam.position.z);
    // Shift the projection so the look-at point lands on the anchor instead of the canvas centre.
    cam.setViewOffset(w, h, w / 2 - ax, h / 2 - ay, w, h);
    cam.updateProjectionMatrix();
    return pxPerMetre;
  }

  private readonly onResize = () => {
    this.collectLanes();
    this.requestRender();
  };

  private readonly onVisibility = () => {
    if (!document.hidden) this.requestRender();
  };

  private readonly onContextLost = () => {
    // Posters come straight back; the owner disposes the Stage (no restore attempt, MOTION §8).
    this.markPosters(false);
    this.opts.canvas.style.opacity = '0';
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.opts.onLost();
  };
}

function headerOffset(): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tx-header-h'));
  return Number.isFinite(value) ? value : 72;
}

/** Soft blurred contact shadow under the bike (a texture, not a real-time shadow map). */
function shadowPlane(): Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.translate(128, 64);
    g.scale(1, 0.5);
    const grad = g.createRadialGradient(0, 0, 4, 0, 0, 124);
    grad.addColorStop(0, 'rgba(28, 18, 14, 0.55)');
    grad.addColorStop(0.55, 'rgba(28, 18, 14, 0.22)');
    grad.addColorStop(1, 'rgba(28, 18, 14, 0)');
    g.fillStyle = grad;
    g.fillRect(-128, -128, 256, 256);
  }
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  const plane = new Mesh(
    // 2.6 m along the bike (Z), 1.1 m across; the texture's ellipse is wide along its u axis.
    new PlaneGeometry(2.6, 1.1).rotateX(-Math.PI / 2).rotateY(Math.PI / 2),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  plane.position.y = 0.004;
  plane.renderOrder = -1;
  return plane;
}
