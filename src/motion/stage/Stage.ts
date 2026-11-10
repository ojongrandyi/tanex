// The Stage (MOTION_3D_SPEC §1–§2, §5, §8): one WebGL renderer, scene and camera for the whole
// homepage, drawn on one canvas that stays on screen while the homepage scrolls. It renders on
// demand only (a Journey update, a resize, the tab becoming visible), never in a loop, and
// everything it draws is a pure function of the Journey travel and the lane positions, so
// scrolling back up gives exactly the frames scrolling down gave.
import {
  CanvasTexture, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, SRGBColorSpace, WebGLRenderer, type Material, type Object3D, type Texture,
} from 'three';
import { loadAssets, readyChapters } from './assets';
import { WHEEL_RADIUS } from './bike';
import { CameraRail, type CameraView } from './camera';
import { laneAnchor, type LaneRect } from './lanes';

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

export interface FrameStats {
  /** Frames rendered. */
  frames: number;
  /** CPU time per rendered frame (pose + camera + render call), most recent last, ≤ 600 kept. */
  ms: number[];
}

const DPR_CAP = { desktop: 1.5, phone: 1.25 } as const;
/** The bike's length used for framing, and how much of the lane frame it fills. */
const BIKE_LENGTH = 2;
const FILL = 0.8;
const LOOK_HEIGHT = 0.78;
/** Riding speed per chapter (0 = parked), in metres per unit of travel × METRES. */
const SPEED = [1, 1.2, 0.5, 1.2, 1, 0.6, 0, 0, 0.5];
const METRES = 6;
const LID_OPEN = (100 * Math.PI) / 180;
const TORSO_TURN = (20 * Math.PI) / 180;

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 0 before `a`, eases to 1 over `ramp`, holds, eases back to 0 by `b`. */
const bump = (t: number, a: number, b: number, ramp: number) => smooth((t - a) / ramp) * smooth((b - t) / ramp);

/** Distance ridden at a travel value (piecewise by chapter speed): drives the wheel spin. */
export function distanceAt(travel: number): number {
  let d = 0;
  for (let c = 0; c < SPEED.length; c++) {
    const span = Math.min(1, Math.max(0, travel - c));
    d += span * SPEED[c];
  }
  return d * METRES;
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
  /** Cream rim light kept behind the bike as seen from the camera: separates it from dark chapters. */
  private readonly rim = new DirectionalLight('#FFE9CC', 2.2);
  private nodes: Record<'bike' | 'front' | 'rear' | 'bars' | 'torso' | 'lid', Object3D | null> = {
    bike: null, front: null, rear: null, bars: null, torso: null, lid: null,
  };
  private lanes: HTMLElement[] = [];
  private ready = new Set<number>();
  private travel = 0;
  private hasTravel = false;
  private frame = 0;
  private size = { w: 0, h: 0 };
  private opacity = -1;
  private shown = false;
  private disposed = false;

  constructor(opts: StageOptions) {
    this.opts = opts;
    this.renderer = new WebGLRenderer({
      canvas: opts.canvas, alpha: true, antialias: !opts.phone, stencil: false, powerPreference: 'default',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.phone ? DPR_CAP.phone : DPR_CAP.desktop));

    this.scene.add(new HemisphereLight('#FFF6EB', '#4A3128', 1.9));
    const sun = new DirectionalLight('#FFFCF7', 2.4);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);
    this.scene.add(this.rim);
    this.scene.add(shadowPlane());

    opts.canvas.addEventListener('webglcontextlost', this.onContextLost);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
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
      this.requestRender();
    }, this.abort.signal);
  }

  /** Journey position (MOTION §6 chapter numbers, continuous). */
  setTravel(travel: number): void {
    this.travel = travel;
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
    if (this.frame) window.cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.opts.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.markPosters(false);
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    this.scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
    });
    materials.forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v && typeof v === 'object' && (v as Texture).isTexture) textures.add(v as Texture);
      });
      m.dispose();
    });
    textures.forEach((t) => t.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ---- internals ----

  /** The lanes of the chapters whose assets are ready (the bike's possible places). */
  private collectLanes(): void {
    this.lanes = Array.from(this.opts.root.querySelectorAll<HTMLElement>('[data-chapter] .tx-ch__lane')).filter((lane) => {
      const chapter = Number(lane.closest<HTMLElement>('[data-chapter]')?.dataset.chapter);
      return this.ready.has(chapter);
    });
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
    if (this.disposed || !this.nodes.bike || !this.hasTravel || document.hidden) return;
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

    const rects: LaneRect[] = this.lanes.map((lane) => lane.getBoundingClientRect());
    const anchor = laneAnchor(rects, { top: headerOffset(), bottom: window.innerHeight });
    const opacity = Math.round(smooth(anchor.weight * 1.6) * 100) / 100;
    if (opacity !== this.opacity) {
      canvas.style.opacity = String(opacity);
      this.opacity = opacity;
    }

    if (opacity > 0) {
      this.pose(this.travel);
      this.aim(anchor.x - rect.left, anchor.y - rect.top, anchor.size, w, h);
      this.renderer.render(this.scene, this.camera);
      this.stats.frames += 1;
      this.stats.ms.push(performance.now() - started);
      if (this.stats.ms.length > 600) this.stats.ms.shift();
    }
    if (!this.shown) {
      this.shown = true;
      this.markPosters(true);
      this.opts.onFirstFrame();
    }
  };

  /** Moving parts as pure functions of travel (placeholder choreography for pacing, H.2). */
  private pose(travel: number): void {
    const { front, rear, bars, torso, lid } = this.nodes;
    const spin = distanceAt(travel) / WHEEL_RADIUS;
    if (front) front.rotation.x = spin;
    if (rear) rear.rotation.x = spin;
    // Services: a gentle weave down the winding road.
    if (bars) bars.rotation.y = 0.16 * Math.sin((travel - 1) * Math.PI * 4) * bump(travel, 1, 2, 0.15);
    // In town: the rider glances at the phone; the box opens to show the parcel, then closes.
    if (torso) torso.rotation.y = TORSO_TURN * bump(travel, 2.5, 2.78, 0.06);
    // Box: open in In town, and again on arrival (stays open at the very end).
    if (lid) lid.rotation.x = -LID_OPEN * Math.max(bump(travel, 2.55, 2.9, 0.08), smooth((travel - 7.7) / 0.25));
  }

  /** Camera on the rail, framed so the bike fills the lane and sits on the anchor point. */
  private aim(ax: number, ay: number, frame: number, w: number, h: number): void {
    const v = this.rail.sample(this.travel, this.view);
    const cam = this.camera;
    const fov = (v.fov * Math.PI) / 180;
    const pxPerMetre = Math.max(1, (FILL * frame * v.zoom) / BIKE_LENGTH);
    const dist = h / (2 * Math.tan(fov / 2) * pxPerMetre);
    const az = (v.az * Math.PI) / 180;
    const el = (v.el * Math.PI) / 180;
    cam.fov = v.fov;
    cam.aspect = w / h;
    cam.near = Math.max(0.05, dist - 4);
    cam.far = dist + 6;
    cam.position.set(dist * Math.cos(el) * Math.cos(az), LOOK_HEIGHT + dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az));
    cam.lookAt(0, LOOK_HEIGHT, 0);
    this.rim.position.set(-cam.position.x, LOOK_HEIGHT + 2.5, -cam.position.z);
    // Shift the projection so the look-at point lands on the anchor instead of the canvas centre.
    cam.setViewOffset(w, h, w / 2 - ax, h / 2 - ay, w, h);
    cam.updateProjectionMatrix();
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
