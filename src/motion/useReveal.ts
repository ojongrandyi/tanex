import { useEffect, useState, type RefObject } from 'react';
import { canAnimate } from './capabilities';
import { useMotionPaused } from './PauseMotion';
import { useGsapContext } from './useGsapContext';
import './motion.css';

const HIDDEN_Y = 16;

/**
 * Elements matching `selector` whose top is still below the fold: only these are ever hidden.
 * One inside another match is left to its parent (revealing both would fade it twice).
 */
function belowFold(root: HTMLElement, selector: string): HTMLElement[] {
  const fold = window.innerHeight;
  const all = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return all.filter((t) => t.getBoundingClientRect().top > fold && !all.some((o) => o !== t && o.contains(t)));
}

/**
 * Batch reveals (MOTION_3D_SPEC §5, §9): elements marked `data-reveal` fade up as they enter the
 * viewport and fade back when scrolled above it again, so scrolling is reversible. GSAP
 * `ScrollTrigger.batch` after first paint; with `css` (inner pages, which don't load the motion
 * chunk) or if the chunk can't load, CSS transitions toggled by a per-frame scroll check, also
 * reversible, with the same stagger. Nothing is hidden with reduced motion, Save-Data or Pause
 * motion, and content already on screen never blinks. Opacity only (no visibility), so keyboard
 * focus still reaches every link.
 */
export function useReveal(root: RefObject<HTMLElement>, selector = '[data-reveal]', { css = false }: { css?: boolean } = {}): void {
  const paused = useMotionPaused();
  const enabled = canAnimate() && !paused;
  const [failed, setFailed] = useState(false);
  const cssFallback = css || failed;

  useGsapContext(root, ({ gsap, ScrollTrigger }, scope) => {
    const targets = belowFold(scope, selector);
    if (!targets.length) return;
    gsap.set(targets, { opacity: 0, y: HIDDEN_Y });
    ScrollTrigger.batch(targets, {
      start: 'top 88%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08, overwrite: true }),
      onLeaveBack: (batch) => gsap.to(batch, { opacity: 0, y: HIDDEN_Y, duration: 0.3, ease: 'power1.in', overwrite: true }),
    });
    // Pins elsewhere on the page move these triggers: compute them in page order.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }, [selector], { enabled: enabled && !cssFallback, onFail: () => setFailed(true) });

  useEffect(() => {
    const el = root.current;
    if (!cssFallback || !enabled || !el) return;
    const pending = belowFold(el, selector);
    if (!pending.length) return;
    pending.forEach((t) => t.classList.add('tx-reveal'));
    // Same rule as the GSAP version: shown once its top has passed 88% of the viewport, hidden
    // again when it drops back below that line. Checked per frame while scrolling (not with an
    // IntersectionObserver, which never reports an element a fast fling skips over entirely).
    const shown = pending.map(() => false);
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.88;
      const tops = pending.map((t) => t.getBoundingClientRect().top);
      let n = 0;
      tops.forEach((top, i) => {
        const show = top < line;
        if (show === shown[i]) return;
        shown[i] = show;
        const t = pending[i];
        t.style.transitionDelay = show ? `${Math.min(n++, 5) * 80}ms` : '';
        t.classList.toggle('is-in', show);
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      pending.forEach((t) => {
        t.classList.remove('tx-reveal', 'is-in');
        t.style.transitionDelay = '';
      });
    };
  }, [root, selector, cssFallback, enabled]);
}
