// Small time-based glides for inner pages (MOTION_3D_SPEC §9): the Track Result vehicle marker
// moves between two polls over 1 s instead of jumping. No motion library: this sits in the
// Track Result chunk. With reduced motion, Save-Data or Pause motion the value jumps.
import { canAnimate, isMotionPaused } from './capabilities';

/** Marker glide between polls (§9: "interpolate the courier marker between polls (1 s)"). */
export const GLIDE_MS = 1000;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Ease in and out (cubic): starts and stops gently, no overshoot. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** The glided value `elapsed` ms after a glide from `from` to `to` started. Exactly `to` at the end. */
export function glideAt(from: number, to: number, elapsed: number, duration = GLIDE_MS): number {
  if (duration <= 0 || elapsed >= duration) return to;
  return from + (to - from) * easeInOutCubic(elapsed / duration);
}

/**
 * Calls `onFrame` once per animation frame with the value gliding from `from` to `to`, ending on
 * exactly `to`. Returns a cancel function. Jumps straight to `to` (one call) when motion is off,
 * when nothing moves, or when there is no requestAnimationFrame.
 */
export function glide(from: number, to: number, onFrame: (value: number) => void, duration = GLIDE_MS): () => void {
  if (from === to || !canAnimate() || isMotionPaused() || typeof window.requestAnimationFrame !== 'function') {
    onFrame(to);
    return () => {};
  }
  let frame = 0;
  let start = -1;
  const step = (now: number) => {
    if (start < 0) start = now;
    const elapsed = now - start;
    onFrame(glideAt(from, to, elapsed, duration));
    frame = elapsed < duration ? window.requestAnimationFrame(step) : 0;
  };
  frame = window.requestAnimationFrame(step);
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  };
}

/** Scroll progress of the page, 0 at the top and 1 at the bottom (0 when it can't scroll). */
export function scrollProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const max = scrollHeight - viewportHeight;
  return max > 0 ? clamp01(scrollY / max) : 0;
}

/**
 * Long pages get the progress bike (§9: Services, Help, blog articles): at least this many
 * viewport heights of content, so short pages don't show a bar that barely moves.
 */
export const LONG_PAGE_SCREENS = 3;

export function isLongPage(scrollHeight: number, viewportHeight: number): boolean {
  return viewportHeight > 0 && scrollHeight >= viewportHeight * LONG_PAGE_SCREENS;
}

/** Hero copy parallax on inner pages: moves this far down while the hero scrolls out (§9: ≤ 40 px). */
export const HERO_PARALLAX_PX = 40;

/** Parallax offset for a hero that ends `heroEnd` px down the page, at scroll position `y`. */
export function parallaxAt(y: number, heroEnd: number, max = HERO_PARALLAX_PX): number {
  if (heroEnd <= 0) return 0;
  return Math.min(1, Math.max(0, y / heroEnd)) * max;
}
