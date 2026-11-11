// Chapter 5 · Smart labels (MOTION_3D_SPEC §6): the parcel fills the frame and turns until its
// label faces the camera, the camera closes in on the label, the barcode bars draw, a scan beam
// passes down them and the tracking ID types in; then the three capability tiles reveal (DOM,
// journey.ts TILE_STEPS, timed after the typing). Everything is a pure function of `s`, the pin
// progress of the chapter (Stage.storyTravel), and of the camera view.
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CameraView } from '../camera';
import { clamp01, journeyEase, lerp, span } from '../ease';
import { LABEL_CENTRE, PARCEL_SIZE } from '../parcel';
import type { Focus } from './cityToCity';

/** Scroll timeline in pin progress (0–1): 15% arrive, 70% story, 15% leave. */
export const LABEL_TIMELINE = {
  fadeIn: [0, 0.1],
  turn: [0.1, 0.36],
  zoom: [0.28, 0.46],
  bars: [0.42, 0.54],
  scan: [0.54, 0.66],
  type: [0.66, 0.8],
} as const;

/** The camera on the parcel: a three-quarter view from above. */
export const LABEL_VIEW: CameraView = { az: -58, el: 22, zoom: 1, fov: 30 };
/** Where the parcel floats (its centre, world m) while the bike is out of the scene. */
const CENTRE = { x: 0, y: 0.78, z: 0 } as const;
/** Framed length (m): the whole parcel, then the label. */
const FRAME_PARCEL = 0.5;
const FRAME_LABEL = 0.27;
/** The parcel's pose before it turns: upright, turned a little (yaw drifts while it arrives). */
const START_YAW = -0.75;

export interface LabelPhase {
  opacity: number;
  /** 0 → 1: the parcel turning its label to the camera (journey ease). */
  turn: number;
  /** 0 → 1: the camera closing in on the label (journey ease). */
  zoom: number;
  /** Bars drawn (0–1), characters typed (0–count), scan position (0–1) and beam strength (0–1). */
  bars: number;
  typed: number;
  scan: number;
  beam: number;
}

export function labelPhase(s: number, characters: number): LabelPhase {
  const T = LABEL_TIMELINE;
  const ramp = (r: readonly [number, number]) => clamp01((s - r[0]) / (r[1] - r[0]));
  const scan = ramp(T.scan);
  return {
    opacity: span(s, T.fadeIn[0], T.fadeIn[1]),
    turn: journeyEase(ramp(T.turn)),
    zoom: journeyEase(ramp(T.zoom)),
    bars: ramp(T.bars),
    typed: ramp(T.type) * characters,
    scan,
    beam: span(scan, 0, 0.12) * (1 - span(scan, 0.88, 1)),
  };
}

export interface LabelPose {
  position: Vector3;
  quaternion: Quaternion;
  focus: Focus;
}

/**
 * The parcel's pose and the camera framing for the phase, seen from `view`: upright at first,
 * then turned so the label's normal points at the camera with its text level on screen.
 */
export class LabelRig {
  readonly pose: LabelPose = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    focus: { x: CENTRE.x, y: CENTRE.y, z: CENTRE.z, length: FRAME_PARCEL },
  };
  private readonly start = new Quaternion();
  private readonly end = new Quaternion();
  private readonly basis = new Matrix4();
  private readonly toCam = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly down = new Vector3();
  private readonly left = new Vector3();
  private readonly v = new Vector3();

  /**
   * `minLength` is the shortest framed length (m) at which the parcel's top face still fits the
   * lane's height (Stage: short lane bands on phones); the close-up never goes tighter, and when
   * it is held back it centres the whole face instead of the label.
   */
  update(phase: LabelPhase, view: CameraView, s: number, minLength = 0): LabelPose {
    const az = (view.az * Math.PI) / 180;
    const el = (view.el * Math.PI) / 180;
    // Camera axes for this view (as the Stage's camera, looking at the target from az/el).
    this.toCam.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    this.right.set(0, 1, 0).cross(this.toCam).normalize();
    this.up.copy(this.toCam).cross(this.right).normalize();
    // Label space: text along −Z, its top towards −X, its face +Y (parcel.ts). Mapped to the
    // camera's right, up and towards-camera: X → −up, Y → towards camera, Z → −right.
    this.basis.makeBasis(this.down.copy(this.up).negate(), this.toCam, this.left.copy(this.right).negate());
    this.end.setFromRotationMatrix(this.basis);
    this.start.setFromAxisAngle(this.v.set(0, 1, 0), START_YAW + 0.35 * span(s, 0, LABEL_TIMELINE.turn[0]));
    const q = this.pose.quaternion.slerpQuaternions(this.start, this.end, phase.turn);

    // Turn about the parcel's centre: origin = centre − q · (0, h/2, 0).
    const p = this.pose.position.set(0, PARCEL_SIZE.h / 2, 0).applyQuaternion(q);
    p.set(CENTRE.x - p.x, CENTRE.y - p.y, CENTRE.z - p.z);

    // Frame the parcel, then close in on the label (on the whole top face where the lane is short).
    const close = Math.max(FRAME_LABEL, minLength);
    const onFace = clamp01((minLength - FRAME_LABEL) / 0.06);
    const target = this.v
      .set(lerp(LABEL_CENTRE.x, 0, onFace), LABEL_CENTRE.y, LABEL_CENTRE.z)
      .applyQuaternion(q)
      .add(p);
    const f = this.pose.focus;
    f.x = lerp(CENTRE.x, target.x, phase.zoom);
    f.y = lerp(CENTRE.y, target.y, phase.zoom);
    f.z = lerp(CENTRE.z, target.z, phase.zoom);
    const open = Math.max(FRAME_PARCEL, minLength);
    f.length = open * (close / open) ** phase.zoom;
    return this.pose;
  }
}
