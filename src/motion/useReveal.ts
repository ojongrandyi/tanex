import { useEffect, useState, type RefObject } from 'react';
import { canAnimate } from './capabilities';
import { useMotionPaused } from './PauseMotion';
import { useGsapContext } from './useGsapContext';
import './motion.css';

const HIDDEN_Y = 16;

/** Elements matching `selector` whose top is still below the fold: only these are ever hidden. */
function belowFold(root: HTMLElement, selector: string): HTMLElement[] {
  const fold = window.innerHeight;
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((t) => t.getBoundingClientRect().top > fold);
}

/**
 * Batch reveals (MOTION_3D_SPEC §5, §9): elements marked `data-reveal` fade up as they enter the
 * viewport and fade back when scrolled above it again, so scrolling is reversible. GSAP
 * `ScrollTrigger.batch` after first paint; if the motion chunk can't load, a CSS + IntersectionObserver
 * fallback (play once). Nothing is hidden with reduced motion, Save-Data or Pause motion, and
 * content already on screen never blinks. Opacity only (no visibility), so keyboard focus still
 * reaches every link.
 */
export function useReveal(root: RefObject<HTMLElement>, selector = '[data-reveal]'): void {
  const paused = useMotionPaused();
  const enabled = canAnimate() && !paused;
  const [cssFallback, setCssFallback] = useState(false);

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
  }, [selector], { enabled: enabled && !cssFallback, onFail: () => setCssFallback(true) });

  useEffect(() => {
    const el = root.current;
    if (!cssFallback || !enabled || !el || typeof IntersectionObserver === 'undefined') return;
    const pending = belowFold(el, selector);
    pending.forEach((t) => t.classList.add('tx-reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    pending.forEach((t) => io.observe(t));
    return () => {
      io.disconnect();
      pending.forEach((t) => t.classList.remove('tx-reveal', 'is-in'));
    };
  }, [root, selector, cssFallback, enabled]);
}
