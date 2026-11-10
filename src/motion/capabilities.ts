// What this device and visitor allow (MOTION_3D_SPEC §1.6, §8, §10). No motion library here:
// this file is in the main bundle and decides whether the motion chunk is loaded at all.

const PAUSE_KEY = 'tx_motion_paused';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
}

export function prefersReducedMotion(): boolean {
  return matches('(prefers-reduced-motion: reduce)');
}

function saveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Motion is allowed at all: no reduced-motion request and no Save-Data. */
export function canAnimate(): boolean {
  return typeof window !== 'undefined' && !prefersReducedMotion() && !saveData();
}

/** Lenis smooth scrolling: desktop pointer only, motion allowed and not paused (§3). */
export function canSmoothScroll(): boolean {
  return canAnimate() && !isMotionPaused() && matches('(hover: hover) and (pointer: fine)') && window.innerWidth >= 1024;
}

// Software renderers and old mobile GPUs that can't hold the Stage's frame budget.
const LOW_POWER_GPU = /swiftshader|llvmpipe|softpipe|software|basic render|mali-[34]\d\d|adreno \(tm\) [23]\d\d|powervr sgx/i;
let stageVerdict: boolean | null = null;

/**
 * The 3D Stage can run (§1.6): WebGL2 without a major performance caveat, deviceMemory ≥ 4 GB
 * and hardwareConcurrency ≥ 4 where the browser reports them, not a known low-power GPU, and a
 * viewport at least 360 px wide. The GPU probe runs once per page load.
 */
export function canUseStage(): boolean {
  if (!canAnimate() || window.innerWidth < 360) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency < 4) return false;
  if (stageVerdict !== null) return stageVerdict;
  stageVerdict = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      stageVerdict = !LOW_POWER_GPU.test(renderer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    stageVerdict = false;
  }
  return stageVerdict;
}

// ---- Pause motion (§10): remembered per browser in tx_motion_paused ----

let paused: boolean | null = null;
const pauseListeners = new Set<() => void>();

export function isMotionPaused(): boolean {
  if (paused === null) {
    try {
      paused = window.localStorage.getItem(PAUSE_KEY) === '1';
    } catch {
      paused = false;
    }
  }
  return paused;
}

export function setMotionPaused(value: boolean): void {
  paused = value;
  try {
    if (value) window.localStorage.setItem(PAUSE_KEY, '1');
    else window.localStorage.removeItem(PAUSE_KEY);
  } catch {
    // Storage blocked: the choice still holds for this page view.
  }
  pauseListeners.forEach((listener) => listener());
}

export function subscribeMotionPaused(listener: () => void): () => void {
  pauseListeners.add(listener);
  return () => {
    pauseListeners.delete(listener);
  };
}

/**
 * Runs `callback` once the page has finished loading (so after LCP) and the browser is idle:
 * for the heavy 3D chunk, which must never compete with the first paint (MOTION §2).
 */
export function afterLoadIdle(callback: () => void, timeout = 3000): () => void {
  let cancelIdle: () => void = () => {};
  let cancelled = false;
  const go = () => {
    if (!cancelled) cancelIdle = whenIdle(callback, timeout);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', go);
    cancelIdle();
  };
}

/** Runs `callback` when the browser is idle (after first paint), at the latest after `timeout` ms. */
export function whenIdle(callback: () => void, timeout = 1500): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 200);
  return () => window.clearTimeout(id);
}
