// Camera rails (MOTION_3D_SPEC §5): keyframes placed along the Journey's travel (chapter
// numbers, e.g. 2.5 = halfway through In town), interpolated with centripetal Catmull-Rom curves.
// The camera orbits the bike: azimuth/elevation in degrees, zoom as a size factor, FOV in degrees.
// Azimuth 0 = side view of the bike's left side (camera on +X, the bike faces screen-left);
// 90 = front; 180 = right side (the bike faces screen-right); −90 = rear.
// Angles are not wrapped, so the curve never jumps. Views follow the 3D brief's camera table.
import { CatmullRomCurve3, Vector3 } from 'three';
import { LABEL_VIEW } from './chapters/label';

export interface CameraKey {
  /** Journey travel where this view is reached. */
  at: number;
  az: number;
  el: number;
  zoom: number;
  fov: number;
}

export interface CameraView {
  az: number;
  el: number;
  zoom: number;
  fov: number;
}

/**
 * Chapters 0–1 set in H.3, 2–3 in H.4, 4–5 in H.5 (6–8 take their views from their lanes). Never more
 * than one camera move at a time (§6): each key holds or moves, nothing overlaps.
 *
 * In the pinned story chapters 2 and 3 the rail is sampled at the chapter's pin progress
 * (Stage.storyTravel: 2.5 = halfway through In town's pin), so the keys line up with the DOM beats.
 */
export const CAMERA_KEYS: readonly CameraKey[] = [
  // 0 · Your door (H.3): side view of the bike's right side, so it pulls up left to right; a
  // little wider than the lane so the door and the roll-in stay inside it.
  { at: 0, az: 180, el: 5, zoom: 0.8, fov: 30 },
  { at: 0.8, az: 180, el: 6, zoom: 0.82, fov: 30 },
  // 1 · Services (H.3): high three-quarter over the road beside the intro; on the band the Stage
  // blends to a low side view (Stage BAND_VIEW); ends turning to a front view.
  { at: 1.15, az: 152, el: 34, zoom: 0.95, fov: 30 },
  { at: 1.6, az: 165, el: 26, zoom: 0.95, fov: 30 },
  { at: 1.9, az: 95, el: 16, zoom: 1, fov: 30 },
  // 2 · In town (H.4): one slow orbit across the story, side → three-quarter rear (into the open
  // box) → over the shoulder (the phone map; the Stage also leans in) → behind the top box; as the
  // bike rides away, on round to the three-quarter view chapter 3 opens on.
  { at: 2, az: 22, el: 8, zoom: 1, fov: 28 },
  { at: 2.15, az: 0, el: 9, zoom: 1.02, fov: 28 },
  { at: 2.32, az: -38, el: 28, zoom: 1.12, fov: 28 },
  { at: 2.55, az: -58, el: 36, zoom: 1, fov: 28 },
  { at: 2.8, az: -100, el: 15, zoom: 1.04, fov: 28 },
  { at: 3, az: -124, el: 11, zoom: 1, fov: 30 },
  // 3 · City to city (H.4): a rear three-quarter while the bike rides up behind the truck and
  // hands the parcel over, then pulls back and up over the route (the Stage widens the framing).
  { at: 3.14, az: -126, el: 11, zoom: 1, fov: 30 },
  { at: 3.48, az: -128, el: 12, zoom: 1, fov: 30 },
  { at: 3.62, az: -92, el: 50, zoom: 0.94, fov: 30 },
  { at: 4, az: -92, el: 50, zoom: 0.94, fov: 30 },
  // 4 · World (H.5): the globe has its own pass and camera, and the main scene is empty, so the
  // camera holds over the route while it fades, then turns to the label view out of sight.
  { at: 4.3, az: -92, el: 50, zoom: 0.94, fov: 30 },
  { at: 4.75, ...LABEL_VIEW },
  // 5 · Label (H.5): the camera holds; the parcel turns (chapters/label.ts).
  { at: 6, ...LABEL_VIEW },
  // 6–8 (H.5): the views follow the lanes, not the rail (Stage: chapters/arrival.ts PARK_VIEW, DOOR_VIEW).
  { at: 8, ...LABEL_VIEW },
];

export class CameraRail {
  private readonly ats: number[];
  private readonly orbit: CatmullRomCurve3;
  private readonly lens: CatmullRomCurve3;
  private readonly a = new Vector3();
  private readonly b = new Vector3();

  constructor(keys: readonly CameraKey[] = CAMERA_KEYS) {
    if (keys.length < 2) throw new Error('A camera rail needs at least two keys');
    this.ats = keys.map((k) => k.at);
    this.orbit = new CatmullRomCurve3(keys.map((k) => new Vector3(k.az, k.el, k.zoom)), false, 'centripetal');
    this.lens = new CatmullRomCurve3(keys.map((k) => new Vector3(k.fov, 0, 0)), false, 'centripetal');
  }

  /** The view at a Journey travel value (clamped to the rail's ends). */
  sample(travel: number, out: CameraView = { az: 0, el: 0, zoom: 1, fov: 30 }): CameraView {
    const ats = this.ats;
    const last = ats.length - 1;
    let t: number;
    if (travel <= ats[0]) t = 0;
    else if (travel >= ats[last]) t = 1;
    else {
      let k = 0;
      while (k < last - 1 && travel > ats[k + 1]) k++;
      const u = (travel - ats[k]) / (ats[k + 1] - ats[k]);
      // getPoint(t) maps t linearly onto the control points: segment k, weight u.
      t = (k + u) / last;
    }
    this.orbit.getPoint(t, this.a);
    this.lens.getPoint(t, this.b);
    out.az = this.a.x;
    out.el = this.a.y;
    out.zoom = this.a.z;
    out.fov = this.b.x;
    return out;
  }
}
