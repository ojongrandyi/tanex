// Camera rails (MOTION_3D_SPEC §5): keyframes placed along the Journey's travel (chapter
// numbers, e.g. 2.5 = halfway through In town), interpolated with centripetal Catmull-Rom curves.
// The camera orbits the bike: azimuth/elevation in degrees, zoom as a size factor, FOV in degrees.
// Azimuth 0 = side view of the bike's left side (camera on +X, the bike faces screen-left);
// 90 = front; 180 = right side (the bike faces screen-right); −90 = rear.
// Angles are not wrapped, so the curve never jumps. Views follow the 3D brief's camera table.
import { CatmullRomCurve3, Vector3 } from 'three';

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
 * Chapters 0–1 set in H.3; the rest is the H.2 pacing rail until H.4–H.5 refine those moves. Never more than one
 * camera move at a time (§6): each key holds or moves, nothing overlaps.
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
  { at: 2.15, az: 0, el: 8, zoom: 1.05, fov: 28 }, // 2 · In town: orbit side → three-quarter front → rear
  { at: 2.45, az: 45, el: 12, zoom: 1.05, fov: 28 },
  { at: 2.8, az: -105, el: 26, zoom: 1.1, fov: 28 }, // ends on the top box
  { at: 3.2, az: 0, el: 6, zoom: 0.9, fov: 30 }, // 3 · City to city: side view, then high and wide
  { at: 3.7, az: 15, el: 32, zoom: 0.72, fov: 30 },
  { at: 4.3, az: 25, el: 24, zoom: 0.8, fov: 30 }, // 4 · World (placeholder until the globe, H.5)
  { at: 5.3, az: -60, el: 32, zoom: 0.95, fov: 30 }, // 5 · Label: towards the top box
  { at: 6.2, az: 0, el: 5, zoom: 1, fov: 30 }, // 6 · Contact: parked, side view
  { at: 7.3, az: 0, el: 5, zoom: 1, fov: 30 }, // 7 · FAQ: still
  { at: 8, az: 0, el: 4, zoom: 1.05, fov: 30 }, // 8 · Delivered: side view at the door
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
