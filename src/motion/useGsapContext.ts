import { useEffect, useRef, type DependencyList, type RefObject } from 'react';
import { whenIdle } from './capabilities';
import { loadGsap, type GsapKit } from './gsap';

export type GsapSetup = (kit: GsapKit, scope: HTMLElement) => void | (() => void);

interface Options {
  /** Skip loading and setup entirely (reduced motion, nothing to animate). */
  enabled?: boolean;
  /** Called when the motion chunk can't be loaded, so the caller can fall back to CSS. */
  onFail?: () => void;
}

/**
 * Runs `setup` inside a `gsap.context()` scoped to `scope` once GSAP has loaded (after first
 * paint). Every tween, ScrollTrigger and SplitText made in it is reverted when the component
 * unmounts or `deps` change, so a route change leaves no pins, inline styles or listeners behind.
 * `setup` may return a cleanup function for anything the context doesn't own (event listeners).
 */
export function useGsapContext(
  scope: RefObject<HTMLElement>,
  setup: GsapSetup,
  deps: DependencyList,
  { enabled = true, onFail }: Options = {},
): void {
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let revert: (() => void) | null = null;
    const cancelIdle = whenIdle(() => {
      loadGsap()
        .then((kit) => {
          const el = scope.current;
          if (cancelled || !el) return;
          const ctx = kit.gsap.context(() => setupRef.current(kit, el), el);
          revert = () => ctx.revert();
        })
        .catch(() => {
          if (!cancelled) failRef.current?.();
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
      revert?.();
    };
  }, [enabled, scope, ...deps]);
}
