import React, { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';

// The route rail (MOTION_3D_SPEC §7, CONTENT §2.10): the light, always-on version of the Journey.
// Desktop: a dashed vertical route on the right edge with one real link per chapter; the current
// chapter carries the bike. Mobile: a slim top progress bar with the bike icon. Static in this
// phase (no scrubbing); phase H animates the bike along the line. Works without the 3D Stage and
// with reduced motion (links jump without smooth scrolling then).

export interface RailChapter {
  /** Element id of the chapter section (also the link's #fragment). */
  id: string;
  label: string;
}

interface RouteRailProps {
  chapters: RailChapter[];
  label: string;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export const RouteRail: React.FC<RouteRailProps> = ({ chapters, label }) => {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);

  // Current chapter: the last one whose top has passed 40% of the viewport height.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let index = 0;
      chapters.forEach((c, i) => {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top <= line) index = i;
      });
      setCurrent(index);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
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
    };
  }, [chapters]);

  const go = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    // Move focus to the chapter so keyboard and screen-reader users land there too.
    el.focus({ preventScroll: true });
    window.history.replaceState(null, '', `#${id}`);
  };

  const pct = `${(4 + progress * 92).toFixed(1)}%`;

  return (
    <>
      <nav className="tx-rail" aria-label={label}>
        <ol className="tx-rail__list">
          {chapters.map((c, i) => (
            <li key={c.id} className="tx-rail__item">
              <a
                href={`#${c.id}`}
                onClick={go(c.id)}
                className={`tx-rail__dot${i < current ? ' is-done' : ''}${i === current ? ' is-current' : ''}`}
                aria-current={i === current ? 'location' : undefined}
              >
                {i === current && <Bike className="tx-rail__bike" aria-hidden="true" />}
                <span className="tx-rail__label">{c.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="tx-rail-progress" aria-hidden="true">
        <i style={{ width: pct }} />
        <b style={{ left: pct }}><Bike /></b>
      </div>
    </>
  );
};
