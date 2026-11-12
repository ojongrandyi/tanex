import React, { useEffect, useRef, useState } from 'react';
import { Bike } from 'lucide-react';
import { isLongPage, scrollProgress } from './glide';
import './PageProgress.css';

// The small bike as a scroll-progress indicator on long inner pages (MOTION_3D_SPEC §9): the
// route rail's light version, shared site-wide. Wide screens: a thin route on the right edge
// with the bike riding down it; narrower screens: a slim bar under the header. It follows the
// scrollbar only (no time-based motion), so it stays on with reduced motion and Pause motion.
// Decorative: the page's own headings carry the structure (aria-hidden).

/** Pages that can be long enough to need it (§9: Services, Help, blog articles; the reading pages). */
const LONG_PAGES: ReadonlySet<string> = new Set(['services', 'help', 'legal', 'about', 'locations', 'careers', 'csr', 'blog-article']);

export function hasPageProgress(page: string): boolean {
  return LONG_PAGES.has(page);
}

export const PageProgress: React.FC<{ page: string }> = ({ page }) => {
  const [long, setLong] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const enabled = hasPageProgress(page);

  // Is the page long enough? Re-checked when the page or the window changes size.
  useEffect(() => {
    if (!enabled) {
      setLong(false);
      return;
    }
    const measure = () => setLong(isLongPage(document.documentElement.scrollHeight, window.innerHeight));
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled]);

  // Position: transforms written once per frame while scrolling (no React render per frame).
  useEffect(() => {
    const root = rootRef.current;
    if (!long || !root) return;
    const fill = root.querySelector<HTMLElement>('.tx-progress__fill');
    const bike = root.querySelector<HTMLElement>('.tx-progress__bike');
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = scrollProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
      // The track's length along its axis (vertical on wide screens, horizontal below).
      const vertical = root.offsetHeight > root.offsetWidth;
      const length = vertical ? root.offsetHeight : root.offsetWidth;
      if (fill) fill.style.transform = vertical ? `scaleY(${p.toFixed(4)})` : `scaleX(${p.toFixed(4)})`;
      if (bike) bike.style.transform = vertical
        ? `translate(-50%, ${(p * length).toFixed(1)}px) translateY(-50%)`
        : `translate(${(p * length).toFixed(1)}px, -50%) translateX(-50%)`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [long]);

  if (!enabled || !long) return null;
  return (
    <div className="tx-progress" ref={rootRef} aria-hidden="true">
      <i className="tx-progress__fill" />
      <b className="tx-progress__bike"><Bike /></b>
    </div>
  );
};
