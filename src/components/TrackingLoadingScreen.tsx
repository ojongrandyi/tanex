import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';
import './TrackingLoadingScreen.css';

interface TrackingLoadingScreenProps {
  query: string;
}

// CONTENT §6.2: rotating lines while the lookup runs (common dictionary: this screen sits outside
// the pages, so it can't wait for a page area).
const LOADING_KEYS = ['trackingLoading.locating', 'trackingLoading.scans', 'trackingLoading.route'] as const;
const LINE_MS = 1400;

export const TrackingLoadingScreen: React.FC<TrackingLoadingScreenProps> = ({ query }) => {
  const t = useT();
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLineIndex((i) => (i + 1) % LOADING_KEYS.length), LINE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="ngf-tracking-loading-shell">
      <div className="tracking-loading-card">
        <div className="tracking-loading-radar">
          <div className="tl-radar-ring tl-ring-1" />
          <div className="tl-radar-ring tl-ring-2" />
          <div className="tl-radar-icon-badge">
            <Truck size={26} />
          </div>
        </div>

        <h2 className="tracking-loading-title" role="status" aria-live="polite">
          {t(LOADING_KEYS[lineIndex])}
        </h2>
        {query && (
          <p className="tracking-loading-sub">
            <span className="tl-query-code font-mono">{query}</span>
          </p>
        )}

        <div className="tracking-loading-bar-track">
          <div className="tracking-loading-bar-fill" />
        </div>
      </div>
    </section>
  );
};
