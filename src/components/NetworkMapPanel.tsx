import React, { useCallback, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { HomeNetworkMap } from './HomeNetworkMap';
import { Link } from '../router/Link';
import { HUB_CODE, NETWORK_POINTS, formatGatewayTime, gatewayName, getGateway, type Gateway, type TransportMode } from '../data/gateways';
import { useNow } from '../utils/useNow';
import type { Locale } from '../i18n/types';
import './NetworkMapPanel.css';

// The network map with its selected-place card and place picker (CONTENT §2.5, §5): used on the
// homepage's world chapter and on the Network page. Labels come from the page's dictionary.

export interface NetworkMapLabels {
  mapLabel: string;
  choose: string;
  localTime: string;
  contact: string;
  modes: Record<TransportMode, string>;
}

interface NetworkMapPanelProps {
  locale: Locale;
  labels: NetworkMapLabels;
  onNavigate: (page: string, param?: string) => void;
  /** Controlled selection (optional); defaults to the Douala gateway. */
  activeCode?: string;
  onSelect?: (code: string) => void;
  className?: string;
  /** Draw the lanes once when the map is revealed (homepage World chapter, MOTION §6). */
  drawLanes?: boolean;
}

/** Country name in the page language, from the ISO code (falls back to the English name). */
export function useCountryName(locale: Locale): (iso: string, fallback: string) => string {
  return useMemo(() => {
    try {
      const names = new Intl.DisplayNames([locale], { type: 'region' });
      return (iso: string, fallback: string) => names.of(iso) ?? fallback;
    } catch {
      return (_iso: string, fallback: string) => fallback;
    }
  }, [locale]);
}

export const NetworkMapPanel: React.FC<NetworkMapPanelProps> = ({ locale, labels, onNavigate, activeCode, onSelect, className = '', drawLanes = false }) => {
  const [ownCode, setOwnCode] = useState(HUB_CODE);
  const code = activeCode ?? ownCode;
  const select = onSelect ?? setOwnCode;
  const active = getGateway(code) ?? getGateway(HUB_CODE)!;
  const now = useNow();
  const time = formatGatewayTime(active.timeZone, now);
  const countryName = useCountryName(locale);
  const pointTitle = useCallback((g: Gateway) => `${gatewayName(g, locale)}, ${countryName(g.iso, g.country)}`, [locale, countryName]);

  return (
    <div className={`tx-netpanel ${className}`.trim()}>
      <HomeNetworkMap activeCode={code} onSelectGateway={select} label={labels.mapLabel} pointTitle={pointTitle} drawLanes={drawLanes} />
      <div className="tx-netpanel__card">
        <label className="tx-netpanel__pick">
          <span>{labels.choose}</span>
          <select value={code} onChange={(e) => select(e.target.value)}>
            {NETWORK_POINTS.map((g) => <option key={g.code} value={g.code}>{g.code} · {gatewayName(g, locale)}</option>)}
          </select>
        </label>
        <div aria-live="polite">
          <p className="tx-netpanel__name"><span className="tx-netpanel__mono">{active.code}</span> {gatewayName(active, locale)}</p>
          <p className="tx-netpanel__meta">{countryName(active.iso, active.country)} · {active.modes.map((m) => labels.modes[m]).join(' · ')}</p>
          <p className="tx-netpanel__meta">{labels.localTime}: <span className="tx-netpanel__mono">{time.time}</span> {time.offset}</p>
          {active.kind === 'gateway' && (
            <Link page="contact" param={active.code} onNavigate={onNavigate} className="tx-link">{labels.contact}<ArrowRight aria-hidden="true" /></Link>
          )}
        </div>
      </div>
    </div>
  );
};
