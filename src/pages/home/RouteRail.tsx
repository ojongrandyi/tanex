import React, { useEffect, useRef, useState } from 'react';
import { Bike } from 'lucide-react';
import { useJourneyChapter, useJourneyStore } from '../../motion/JourneyController';
import { PauseMotionButton } from '../../motion/PauseMotion';
import { scrollToSection } from '../../motion/SmoothScroll';

// The route rail (MOTION_3D_SPEC §7, CONTENT §2.10): the light, always-on version of the Journey.
// Desktop: a dashed vertical route on the right edge with one real link per chapter. Mobile: a
// slim top progress bar with the bike icon. Two modes:
// - Static (reduced motion, Save-Data, before the motion chunk loads): the current chapter's dot
//   carries the bike, worked out from the section positions.
// - Travelling (the JourneyController is live): the bike rides the line continuously with the
//   scroll position, exactly reversible; the dots stay links.

export interface RailChapter {
  /** Element id of the chapter section (also the link's #fragment). */
  id: string;
  label: string;
}

interface RouteRailProps {
  chapters: RailChapter[];
  label: string;
  motionLabels: { pause: string; play: string };
}

/** Chapter numbers (`data-chapter`) of the rail's sections, in rail order. */
function chapterNumbers(chapters: RailChapter[]): number[] {
  return chapters.map((c) => Number(document.getElementById(c.id)?.dataset.chapter ?? Number.NaN));
}

/** Journey travel (in chapter numbers) → position along the rail (in dot indexes). */
function railPosition(travel: number, numbers: number[]): number {
  if (travel <= numbers[0]) return 0;
  for (let k = 0; k < numbers.length - 1; k++) {
    if (travel <= numbers[k + 1]) return k + (travel - numbers[k]) / (numbers[k + 1] - numbers[k]);
  }
  return numbers.length - 1;
}

const barPercent = (fraction: number) => `${(4 + fraction * 92).toFixed(2)}%`;

export const RouteRail: React.FC<RouteRailProps> = ({ chapters, label, motionLabels }) => {
  const store = useJourneyStore();
  const liveChapter = useJourneyChapter();
  const live = liveChapter >= 0;

  const [staticCurrent, setStaticCurrent] = useState(0);
  const [staticProgress, setStaticProgress] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const travellerRef = useRef<HTMLSpanElement>(null);
  const barFillRef = useRef<HTMLElement>(null);
  const barBikeRef = useRef<HTMLElement>(null);

  // Static mode: the last chapter whose top has passed 40% of the viewport height.
  useEffect(() => {
    if (live) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let index = 0;
      chapters.forEach((c, i) => {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top <= line) index = i;
      });
      setStaticCurrent(index);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setStaticProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
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
  }, [chapters, live]);

  // Travelling mode: styles written directly on every Journey update (no React render per frame).
  useEffect(() => {
    if (!store || !live) return;
    const apply = () => {
      const state = store.get();
      if (!state.live) return;
      const numbers = chapterNumbers(chapters);
      if (numbers.length < 2 || numbers.some(Number.isNaN)) return;
      const pos = railPosition(state.travel, numbers);
      const list = listRef.current;
      const bike = travellerRef.current;
      // Desktop rail (offsetParent is null while it's hidden by the media query).
      if (list && bike && list.offsetParent) {
        const items = list.children;
        const center = (k: number) => {
          const li = items[k] as HTMLElement;
          return list.offsetTop + li.offsetTop + li.offsetHeight / 2;
        };
        const k = Math.min(Math.floor(pos), items.length - 1);
        const y = k < items.length - 1 ? center(k) + (pos - k) * (center(k + 1) - center(k)) : center(k);
        bike.style.transform = `translate(-50%, -50%) translateY(${y.toFixed(1)}px)`;
      }
      const pct = barPercent(pos / (numbers.length - 1));
      if (barFillRef.current) barFillRef.current.style.width = pct;
      if (barBikeRef.current) barBikeRef.current.style.left = pct;
    };
    apply();
    const unsubscribe = store.subscribe(apply);
    window.addEventListener('resize', apply);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', apply);
    };
  }, [store, live, chapters]);

  // Live: the rail dot of the current chapter (chapters without a dot, like the FAQ, keep the one before).
  let current = staticCurrent;
  if (live) {
    const numbers = chapterNumbers(chapters);
    current = 0;
    numbers.forEach((n, i) => {
      if (n <= liveChapter) current = i;
    });
  }

  const go = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToSection(el);
    // Move focus to the chapter so keyboard and screen-reader users land there too.
    el.focus({ preventScroll: true });
    window.history.replaceState(null, '', `#${id}`);
  };

  const staticPct = barPercent(staticProgress);

  return (
    <>
      <nav className={`tx-rail${live ? ' tx-rail--travel' : ''}`} aria-label={label}>
        <div className="tx-rail__track">
          <ol className="tx-rail__list" ref={listRef}>
            {chapters.map((c, i) => (
              <li key={c.id} className="tx-rail__item">
                <a
                  href={`#${c.id}`}
                  onClick={go(c.id)}
                  className={`tx-rail__dot${i < current ? ' is-done' : ''}${i === current ? ' is-current' : ''}`}
                  aria-current={i === current ? 'location' : undefined}
                >
                  {!live && i === current && <Bike className="tx-rail__bike" aria-hidden="true" />}
                  <span className="tx-rail__label">{c.label}</span>
                </a>
              </li>
            ))}
          </ol>
          {live && (
            <span className="tx-rail__traveller" ref={travellerRef} aria-hidden="true">
              <Bike />
            </span>
          )}
        </div>
        <PauseMotionButton labels={motionLabels} className="tx-rail__pause" compact />
      </nav>
      <div className="tx-rail-progress" aria-hidden="true">
        <i ref={barFillRef} style={live ? undefined : { width: staticPct }} />
        <b ref={barBikeRef} style={live ? undefined : { left: staticPct }}><Bike /></b>
      </div>
    </>
  );
};
