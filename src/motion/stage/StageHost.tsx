import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { afterLoadIdle, canAnimate, canUseStage } from '../capabilities';
import { useJourneyStore } from '../JourneyController';
import type { Stage } from './Stage';

// Mounts the 3D Stage on the homepage (MOTION_3D_SPEC §5, §8). On devices that can run it, the
// canvas element is in the page from the start (empty, transparent, no layout effect); the 3D
// chunk loads after the page has loaded, on idle. The chapter posters stay until the Stage has
// drawn its first frame, then cross-fade. If the chunk fails or the WebGL context is lost, the
// posters stay or come back. Leaving the homepage disposes everything.

const PHONE_MAX = 760;

interface StageHostProps {
  /** The homepage element holding the chapters. */
  rootRef: RefObject<HTMLElement>;
}

export const StageHost: React.FC<StageHostProps> = ({ rootRef }) => {
  const store = useJourneyStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Cheap check at render; the WebGL probe (canUseStage) waits until after load, off the first paint.
  const [enabled] = useState(() => canAnimate());
  const [state, setState] = useState<'waiting' | 'ready' | 'off'>('waiting');

  useEffect(() => {
    if (!enabled || !store) return;
    let stage: Stage | null = null;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
      stage?.dispose();
      stage = null;
    };

    const cancelWait = afterLoadIdle(() => {
      if (!canUseStage()) {
        setState('off');
        return;
      }
      import('./Stage')
        .then(async ({ Stage: StageClass }) => {
          const canvas = canvasRef.current;
          const root = rootRef.current;
          if (cancelled || !canvas || !root) return;
          stage = new StageClass({
            canvas,
            root,
            phone: window.innerWidth <= PHONE_MAX || window.matchMedia?.('(pointer: coarse)').matches === true,
            onFirstFrame: () => {
              if (!cancelled) setState('ready');
            },
            onLost: () => {
              stop();
              if (!cancelled) setState('off');
            },
          });
          if (new URLSearchParams(window.location.search).has('stage-stats')) {
            (window as Window & { __txStage?: Stage['stats'] }).__txStage = stage.stats;
          }
          const push = () => {
            const s = store.get();
            if (s.live) stage?.setTravel(s.travel);
          };
          unsubscribe = store.subscribe(push);
          push();
          await stage.load();
        })
        .catch(() => {
          stop();
          if (!cancelled) setState('off');
        });
    });

    return () => {
      cancelled = true;
      cancelWait();
      stop();
    };
  }, [enabled, store, rootRef]);

  if (!enabled || state === 'off') return null;
  return (
    <div className={`tx-stage${state === 'ready' ? ' is-ready' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className="tx-stage__canvas" />
    </div>
  );
};
