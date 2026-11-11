// Chapters 6–8 (MOTION_3D_SPEC §6): the bike rides back in and parks beside the contact form
// (6), stays as a dimmed still frame beside the FAQ (7), and rides the last metres to a front door
// above the footer, where the top box opens (8).
//
// These chapters aren't pinned, so their beats follow their own lanes rather than the Journey's
// travel (which depends on how long the FAQ is): the ride-ins run as a lane rises into view, and
// the lane shares decide which state shows. A state shows only while its lanes hold more than half
// of the anchor (`gate`), so two states are never on screen together and the camera can switch
// views (park: the bike's left side, facing the form; door: its right side, as at the start of the
// journey) while nothing is drawn. Everything here is a pure function of lane rectangles, except
// the parked idle, which runs at most IDLE_SECONDS (MOTION §1.3).
import { Group } from 'three';
import type { CameraView } from '../camera';
import { buildDoor, setDoorOpacity, type Door } from '../door';
import { clamp01, lerp, smooth, span } from '../ease';
import type { LaneRect, LaneView } from '../lanes';
import { DOOR_Z } from './hero';

/** Metres the bike rides in to park (6) and to stop at the door (8). */
export const PARK_METRES = 5;
export const DOOR_METRES = 4;
/** Canvas opacity of the still frame beside the FAQ and blog (7). */
export const STILL_DIM = 0.45;
/** The parked idle (breathing lights) runs at most this long. */
export const IDLE_SECONDS = 5;
/** How far (share of the view height) a lane rises into view while its bike rides in. */
export const PARK_REACH = 0.4;
export const DOOR_REACH = 0.45;

export const PARK_VIEW: CameraView = { az: 0, el: 6, zoom: 1, fov: 30 };
export const DOOR_VIEW: CameraView = { az: 180, el: 6, zoom: 0.82, fov: 30 };

/** 0 until a lane group holds half of the anchor, 1 from three quarters: one state at a time. */
export function gate(share: number): number {
  return smooth((share - 0.5) / 0.25);
}

/**
 * How far a lane has risen into view: 0 while its bottom edge is at or below the bottom of the
 * view, 1 once it is `reach` × the view height above it. A missing (hidden) lane counts as risen.
 */
export function riseIn(rect: LaneRect | null, view: LaneView, reach: number): number {
  if (!rect || rect.height <= 0 || rect.width <= 0) return 1;
  const height = Math.max(1, view.bottom - view.top);
  return clamp01((view.bottom - (rect.top + rect.height)) / (reach * height));
}

/** Lane shares of the late chapters (Stage: laneAnchor shares summed per chapter). */
export interface LateShares {
  label: number;
  park: number;
  still: number;
  door: number;
}

export type LateView = 'label' | 'park' | 'door';

export interface LatePhase {
  /** Which view the camera takes (switched only while nothing of the other states is drawn). */
  view: LateView;
  bikeZ: number;
  bikeOpacity: number;
  lid: number;
  /** Opacity of the arrival door. */
  door: number;
  /** Factor on the canvas opacity: the still frame is dimmed. */
  dim: number;
  /** Parked in the contact lane, ready for the idle. */
  parked: boolean;
}

/** `park` and `arrive` are the park and door lanes' riseIn values. */
export function latePhase(shares: LateShares, park: number, arrive: number): LatePhase {
  const atPark = shares.park + shares.still;
  const view: LateView = shares.door > atPark && shares.door > shares.label ? 'door' : shares.label > atPark ? 'label' : 'park';
  const dim = lerp(1, STILL_DIM, smooth(shares.still));
  if (view === 'door') {
    const g = gate(shares.door);
    const r = clamp01(arrive / 0.7);
    return {
      view,
      // Decelerating to a stop at the door, then the box opens.
      bikeZ: 0 - DOOR_METRES * (1 - r) * (1 - r),
      bikeOpacity: g * span(arrive, 0, 0.25),
      lid: g * span(arrive, 0.74, 0.94),
      door: g * span(arrive, 0, 0.2),
      dim,
      parked: false,
    };
  }
  const r = clamp01(park / 0.8);
  return {
    view,
    bikeZ: 0 - PARK_METRES * (1 - r) * (1 - r),
    bikeOpacity: gate(atPark) * span(park, 0, 0.3),
    lid: 0,
    door: 0,
    dim,
    parked: park >= 1 && shares.park >= 0.9,
  };
}

/** The arrival door (chapter 8), in the main scene. */
export class ArrivalScene {
  private readonly doorRig: Door = buildDoor();
  readonly group: Group = this.doorRig.group;

  constructor() {
    this.group.name = 'tanex_arrival_door';
    this.group.position.z = DOOR_Z;
  }

  update(opacity: number): void {
    setDoorOpacity(this.doorRig, opacity);
  }
}

/**
 * The parked idle's clock: it advances only while it runs (parked, motion not paused, no form
 * field focused, tab visible), with frame gaps capped, and stops for good at IDLE_SECONDS.
 */
export class IdleClock {
  private used = 0;
  private last: number | null = null;

  /** Advances to `now` (ms) if `running`; returns the seconds used so far. */
  tick(now: number, running: boolean): number {
    if (running && this.last !== null) this.used = Math.min(IDLE_SECONDS, this.used + Math.min(0.05, (now - this.last) / 1000));
    this.last = running && !this.done ? now : null;
    return this.used;
  }

  get done(): boolean {
    return this.used >= IDLE_SECONDS;
  }
}

/** The idle's light level at `t` seconds: two slow breaths that fade out by IDLE_SECONDS. */
export function idleGlow(t: number): number {
  if (t <= 0 || t >= IDLE_SECONDS) return 0;
  const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2.5);
  return breath * (1 - smooth((t - 3.5) / 1.5));
}
