// Where the bike appears on screen (MOTION_3D_SPEC §5): each chapter reserves a "lane" beside its
// text. The bike sits in the visible part of the lanes on screen, weighted by how much of each is
// visible and how close it is to the middle of the view, so it glides from one lane to the next
// as the page scrolls and fades out where no lane is visible (FAQ). A pure function of the lane
// rectangles: the same scroll position always gives the same anchor (reversible).

export interface LaneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LaneView {
  /** Visible band of the viewport (below the sticky header), in the same coordinates as the lanes. */
  top: number;
  bottom: number;
}

export interface LaneAnchor {
  /** Screen point the bike is centred on. */
  x: number;
  y: number;
  /** Frame size in px the bike should fill (≈ 80% of it). */
  size: number;
  /** 0 = no lane on screen (hide the bike), 1 = a lane fully visible. */
  weight: number;
  /** Each lane's share of the anchor (input order; they sum to 1 when any lane is visible). */
  shares: number[];
}

/** Aspect allowance: a lane wider than it is tall is sized by its height. */
const SIZE_BY_HEIGHT = 1.35;

export function laneAnchor(lanes: readonly LaneRect[], view: LaneView): LaneAnchor {
  const viewHeight = Math.max(1, view.bottom - view.top);
  const middle = (view.top + view.bottom) / 2;
  let sum = 0;
  let x = 0;
  let y = 0;
  let size = 0;
  let weight = 0;
  const shares = lanes.map(() => 0);
  lanes.forEach((lane, i) => {
    if (lane.width <= 0 || lane.height <= 0) return;
    const top = Math.max(lane.top, view.top);
    const bottom = Math.min(lane.top + lane.height, view.bottom);
    const visible = bottom - top;
    if (visible <= 0) return;
    const seen = Math.min(1, visible / Math.min(lane.height, viewHeight));
    const cy = (top + bottom) / 2;
    const centred = Math.max(0, 1 - Math.abs(cy - middle) / viewHeight);
    const w = seen * seen * (0.25 + centred);
    sum += w;
    x += w * (lane.left + lane.width / 2);
    y += w * cy;
    size += w * Math.min(lane.width, lane.height * SIZE_BY_HEIGHT);
    weight = Math.max(weight, seen);
    shares[i] = w;
  });
  if (sum <= 0) return { x: 0, y: 0, size: 0, weight: 0, shares };
  return { x: x / sum, y: y / sum, size: size / sum, weight, shares: shares.map((w) => w / sum) };
}
