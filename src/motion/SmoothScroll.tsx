import { useEffect } from 'react';
import type Lenis from 'lenis';
import { canSmoothScroll, prefersReducedMotion, whenIdle } from './capabilities';
import { loadGsap, loadedGsap } from './gsap';
import { useMotionPaused } from './PauseMotion';
import './motion.css';

// The one Lenis instance while smooth scrolling is on.
let lenis: Lenis | null = null;

function headerOffset(): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tx-header-h'));
  return Number.isFinite(value) ? value : 72;
}

/**
 * Scrolls to a page section so its top sits under the sticky header. A pinned section is
 * measured by its pin spacer (the pinned element itself may be `position: fixed`). Smooth unless
 * the visitor asked for reduced motion; uses Lenis when it is running.
 */
export function scrollToSection(el: HTMLElement): void {
  const parent = el.parentElement;
  const anchor = parent?.classList.contains('pin-spacer') ? parent : el;
  const top = Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - headerOffset());
  if (lenis) lenis.scrollTo(top);
  else window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// Wheel and touch inside these keep their native scrolling (maps zoom, dialogs scroll).
const keepNative = (node: HTMLElement): boolean =>
  node.classList?.contains('leaflet-container') === true || node.getAttribute?.('role') === 'dialog';

/**
 * Lenis smooth scrolling synced to ScrollTrigger (MOTION_3D_SPEC §3): desktop pointer only,
 * motion allowed and not paused; off for touch and reduced motion. `routeKey` changes on every
 * route change: the new page's triggers are measured again after it renders.
 */
export function SmoothScroll({ routeKey }: { routeKey: string }): null {
  const paused = useMotionPaused();

  useEffect(() => {
    if (!canSmoothScroll()) return;
    let cancelled = false;
    let instance: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;
    const cancelIdle = whenIdle(() => {
      Promise.all([import('lenis'), loadGsap()])
        .then(([{ default: LenisClass }, { gsap, ScrollTrigger }]) => {
          if (cancelled) return;
          const created = new LenisClass({ autoRaf: false, anchors: false, allowNestedScroll: true, prevent: keepNative });
          created.on('scroll', ScrollTrigger.update);
          tick = (time: number) => created.raf(time * 1000);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
          instance = created;
          lenis = created;
        })
        .catch(() => {
          // Native scrolling stays: nothing to undo.
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
      const kit = loadedGsap();
      if (kit && tick) {
        kit.gsap.ticker.remove(tick);
        kit.gsap.ticker.lagSmoothing(500, 33);
      }
      instance?.destroy();
      if (lenis === instance) lenis = null;
    };
  }, [paused]);

  useEffect(() => {
    const kit = loadedGsap();
    if (!kit) return;
    const frame = window.requestAnimationFrame(() => {
      lenis?.resize();
      kit.ScrollTrigger.refresh();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey]);

  return null;
}
