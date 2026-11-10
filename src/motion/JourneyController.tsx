import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type RefObject } from 'react';
import { canAnimate, canUseStage, whenIdle } from './capabilities';
import { useMotionPaused } from './PauseMotion';
import { useGsapContext } from './useGsapContext';

// The Journey controller (MOTION_3D_SPEC §5–§6). It reads the homepage chapters
// (`[data-chapter]`), builds their ScrollTriggers and pins once the motion chunk has loaded, and
// publishes { chapter, progress } for the route rail now and the 3D Stage from H.2. With reduced
// motion or Save-Data nothing loads and the state stays `live: false` (static rail, no pins).

export interface JourneyState {
  /** True while the chapter triggers are running; false means "work it out yourself". */
  live: boolean;
  /** Current chapter number (`data-chapter`, MOTION §6 numbering). */
  chapter: number;
  /** Progress through the current chapter, 0–1 (its pin when pinned). */
  progress: number;
  /** Continuous position in chapter numbers, e.g. 2.5 = halfway from chapter 2 to 3 (route rail). */
  travel: number;
}

const INITIAL: JourneyState = { live: false, chapter: 0, progress: 0, travel: 0 };

export class JourneyStore {
  private state: JourneyState = INITIAL;
  private listeners = new Set<() => void>();

  get = (): JourneyState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set(next: JourneyState): void {
    const s = this.state;
    if (s.live === next.live && s.chapter === next.chapter && s.progress === next.progress && s.travel === next.travel) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  reset(): void {
    this.set(INITIAL);
  }
}

const JourneyContext = createContext<JourneyStore | null>(null);
const noSubscribe = () => () => {};
const initialState = () => INITIAL;

/** The store itself, for per-frame consumers that write styles directly (no re-render). */
export function useJourneyStore(): JourneyStore | null {
  return useContext(JourneyContext);
}

/** { chapter, progress } as React state. Re-renders on every scroll frame: use sparingly. */
export function useJourney(): JourneyState {
  const store = useContext(JourneyContext);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.get ?? initialState, initialState);
}

/** The current chapter number, or -1 while the Journey isn't live. Re-renders on chapter change only. */
export function useJourneyChapter(): number {
  const store = useContext(JourneyContext);
  const read = () => {
    const s = store?.get() ?? INITIAL;
    return s.live ? s.chapter : -1;
  };
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, read, () => -1);
}

type JourneyModule = typeof import('./journey');

interface JourneyControllerProps {
  /** The element that contains the chapter sections. */
  rootRef: RefObject<HTMLElement>;
  children: React.ReactNode;
}

export const JourneyController: React.FC<JourneyControllerProps> = ({ rootRef, children }) => {
  const store = useMemo(() => new JourneyStore(), []);
  const paused = useMotionPaused();
  const motion = canAnimate();
  const [journey, setJourney] = useState<JourneyModule | null>(null);

  useEffect(() => {
    if (!motion) return;
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      import('./journey')
        .then((m) => {
          if (!cancelled) setJourney(m);
        })
        .catch(() => {
          // The static rail and plain sections remain.
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [motion]);

  // Chapters, pins and the rail follow the scrollbar, so they stay on while motion is paused.
  // Pins hold a chapter for its 3D story, so only devices that can run the Stage get them.
  useGsapContext(
    rootRef,
    (kit, scope) => journey?.setupJourney(kit, scope, store, { pin: canUseStage() }),
    [journey, store],
    { enabled: journey !== null },
  );

  // Headline line reveals are time-based: Pause motion turns them off.
  useGsapContext(
    rootRef,
    (kit, scope) => journey?.setupHeadlines(kit, scope),
    [journey],
    { enabled: journey !== null && !paused },
  );

  return <JourneyContext.Provider value={store}>{children}</JourneyContext.Provider>;
};
