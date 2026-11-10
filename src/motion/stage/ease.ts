// Easing helpers for the Stage: every value is a pure function of its input, so the 3D frames
// depend only on scroll position (reversible).

export const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

/** Smoothstep on 0–1. */
export const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** 0 → 1 as `t` goes from `a` to `b`, smoothstepped. */
export const span = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

/** 0 before `a`, eases to 1 over `ramp`, holds, eases back to 0 by `b`. */
export const bump = (t: number, a: number, b: number, ramp: number) => smooth((t - a) / ramp) * smooth((b - t) / ramp);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Cubic Bézier easing (CSS `cubic-bezier(x1, y1, x2, y2)`), solved for x by Newton steps with a
 * bisection fallback.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xAt = (s: number) => ((ax * s + bx) * s + cx) * s;
  const yAt = (s: number) => ((ay * s + by) * s + cy) * s;
  const dxAt = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 6; i++) {
      const err = xAt(s) - t;
      const d = dxAt(s);
      if (Math.abs(err) < 1e-6) return yAt(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 30; i++) {
      const x = xAt(s);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return yAt(s);
  };
}

/** The Journey's one camera ease (MOTION §6: CustomEase "journey" ≈ 0.65, 0, 0.35, 1). */
export const journeyEase = cubicBezier(0.65, 0, 0.35, 1);
