import React, { useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { canAnimate, isMotionPaused, setMotionPaused, subscribeMotionPaused } from './capabilities';

/** The visitor's Pause motion choice (MOTION_3D_SPEC §10), shared by every component. */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribeMotionPaused, isMotionPaused, () => false);
}

interface PauseMotionButtonProps {
  labels: { pause: string; play: string };
  className?: string;
  /** Icon only (the name stays available to screen readers and as a tooltip). */
  compact?: boolean;
}

/**
 * Pause motion (§10): stops time-based motion (reveals, smooth scrolling and, from H.2, the
 * Stage's idle loop); scroll-linked updates keep following the scrollbar. Hidden when the
 * visitor's settings already turn motion off, since there is nothing to pause then.
 */
export const PauseMotionButton: React.FC<PauseMotionButtonProps> = ({ labels, className, compact = false }) => {
  const paused = useMotionPaused();
  if (!canAnimate()) return null;
  const text = paused ? labels.play : labels.pause;
  return (
    <button
      type="button"
      className={`tx-motion-toggle${compact ? ' tx-motion-toggle--compact' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => setMotionPaused(!paused)}
      title={compact ? text : undefined}
    >
      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      <span className={compact ? 'tx-visually-hidden' : undefined}>{text}</span>
    </button>
  );
};
