import { useEffect, useLayoutEffect, type ReactElement, type RefObject } from 'react';
import { canAnimate, whenIdle } from './capabilities';
import { loadGsap, loadedGsap } from './gsap';
import { useMotionPaused } from './PauseMotion';
import { parallaxAt } from './glide';
import { useReveal } from './useReveal';
import './motion.css';

// Motion on every page except the Journey (MOTION_3D_SPEC §9). Rendered by App inside the page's
// Suspense boundary, after the page, and remounted on every route change, so its effects run once
// the new page's DOM is committed:
// - Route change: the page fades in over 200 ms (not on the first page view: nothing to change from).
// - Inner pages: the hero headline reveals, the hero copy has a subtle scroll parallax (≤ 40 px),
//   and content blocks fade up in batches as they scroll into view (reversible).
// Inner pages don't need the GSAP motion chunk (52 KB gzip; ≈ 0.9 s of main-thread time at
// Lighthouse's 4× CPU, measured in H.8), so a phone landing on one never downloads it (desktop
// loads it anyway for Lenis smooth scrolling): reveals are CSS transitions toggled by a scroll
// check and the parallax is one transform per frame. The headline reveals line by
// line (SplitText) when GSAP is already in memory (the visitor came from Home, or it was warmed
// on idle after an in-app navigation); otherwise as one block with the same timing.
// The first page view never hides its headline: it is the page's LCP element and has painted
// already. Everything is off with reduced motion or Save-Data; Pause motion stops the
// time-based parts (fade, headline, reveals); the parallax follows the scrollbar and stays.

const ROUTE_FADE_MS = 200;
/**
 * Inner-page blocks that reveal in batches: explicit `data-reveal`, the shared section headers
 * and cards (C.3 components), and the page-specific card groups.
 */
export const INNER_REVEAL = '[data-reveal], .tx-section-header, .tx-card, .tx-help__group, .tx-contact__card';

let firstRouteKey: string | null = null;
let leftFirstRoute = false;

/** True until the visitor has navigated inside the app once. */
function isFirstView(routeKey: string): boolean {
  if (firstRouteKey === null) firstRouteKey = routeKey;
  if (routeKey !== firstRouteKey) leftFirstRoute = true;
  return !leftFirstRoute;
}

/** The page's hero: the section holding its h1. */
function findHero(main: HTMLElement): { hero: HTMLElement; heading: HTMLElement } | null {
  const heading = main.querySelector<HTMLElement>('h1');
  const hero = heading?.closest<HTMLElement>('section');
  return heading && hero ? { hero, heading } : null;
}

interface PageMotionProps {
  mainRef: RefObject<HTMLElement>;
  page: string;
  routeKey: string;
}

export function PageMotion({ mainRef, page, routeKey }: PageMotionProps): ReactElement | null {
  const paused = useMotionPaused();
  const firstView = isFirstView(routeKey);
  const timed = canAnimate() && !paused && !firstView;

  // 200 ms route fade (Web Animations: opacity only, removed when done; no layout effect).
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!timed || !main || typeof main.animate !== 'function') return;
    const fade = main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ROUTE_FADE_MS, easing: 'ease-out' });
    return () => fade.cancel();
    // Once per mount: App remounts this component on every route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After an in-app navigation the visitor is browsing: warm the motion chunk on idle so the next
  // inner page gets the line-by-line headline (never on a landing page view).
  useEffect(() => {
    if (!timed || loadedGsap()) return;
    return whenIdle(() => {
      loadGsap().catch(() => {});
    }, 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return page === 'home' ? null : <InnerPageMotion mainRef={mainRef} headline={timed} />;
}

function InnerPageMotion({ mainRef, headline }: { mainRef: RefObject<HTMLElement>; headline: boolean }): null {
  const motion = canAnimate();

  // Hero headline reveal, set before the first paint of the new page. Line by line (masked,
  // 0.6 s, stagger 0.08 as the Journey's) when GSAP is loaded; the split is undone as soon as it
  // has played, so React finds its own text nodes again. Otherwise one block (motion.css).
  useLayoutEffect(() => {
    const main = mainRef.current;
    const found = main ? findHero(main) : null;
    if (!headline || !found) return;
    const kit = loadedGsap();
    if (kit) {
      const split = kit.SplitText.create(found.heading, { type: 'lines', mask: 'lines', linesClass: 'tx-split-line' });
      const tween = kit.gsap.from(split.lines, {
        yPercent: 110,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        onComplete: () => split.revert(),
      });
      return () => {
        tween.kill();
        split.revert();
      };
    }
    const { heading } = found;
    const done = () => heading.classList.remove('tx-headline-in');
    heading.classList.add('tx-headline-in');
    heading.addEventListener('animationend', done, { once: true });
    return () => {
      heading.removeEventListener('animationend', done);
      done();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hero parallax: follows the scroll position (exactly reversible), one transform per frame.
  useEffect(() => {
    const main = mainRef.current;
    const found = main ? findHero(main) : null;
    const copy = found?.hero.firstElementChild;
    if (!motion || !found || !(copy instanceof HTMLElement)) return;
    let heroEnd = 0;
    let frame = 0;
    const measure = () => {
      heroEnd = found.hero.getBoundingClientRect().bottom + window.scrollY;
    };
    const update = () => {
      frame = 0;
      copy.style.transform = `translate3d(0, ${parallaxAt(window.scrollY, heroEnd).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) window.cancelAnimationFrame(frame);
      copy.style.transform = '';
    };
  }, [mainRef, motion]);

  useReveal(mainRef, INNER_REVEAL, { css: true });

  return null;
}
