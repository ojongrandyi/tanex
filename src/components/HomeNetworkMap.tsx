import React, { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { destroyMap, fitWorldView, useLeaflet, type Leaflet } from '../utils/leaflet';
import { greatCircleSegments } from '../utils/greatCircle';
import { NETWORK_POINTS, TRADE_LANES, getGateway, type Gateway } from '../data/gateways';
import 'leaflet/dist/leaflet.css';
import './HomeNetworkMap.css';
import { BRAND_COLORS } from '../config/brand';

// Homepage network map (CONTENT §2.5, §9): TanEx locations (orange, ringed) and the gateways
// served from Douala (cream), joined by dashed trade lanes. Dark basemap to sit in the chocolate
// chapter. Leaflet loads only when the map nears the viewport (utils/leaflet).

interface HomeNetworkMapProps {
  activeCode: string;
  onSelectGateway: (code: string) => void;
  /** Accessible name for the map region, in the page language. */
  label: string;
  /** Marker title (tooltip and screen-reader name), in the page language. */
  pointTitle: (g: Gateway) => string;
}

// Below this zoom only the selected point keeps its code label (labels overlap in Europe).
const LABEL_ZOOM = 3;

const markerIcon = (leaflet: Leaflet, g: Gateway, isSelected: boolean) =>
  leaflet.divIcon({
    className: 'tx-netmap-marker-wrap',
    // 44 × 44 px hit area (WCAG 2.5.8 target size, tracker #61); the visible dot sits in the middle.
    html: `<span class="tx-netmap-marker tx-netmap-marker--${g.kind}${isSelected ? ' is-selected' : ''}"><i></i><b>${g.code}</b></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

export const HomeNetworkMap: React.FC<HomeNetworkMapProps> = ({ activeCode, onSelectGateway, label, pointTitle }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [code: string]: L.Marker }>({});
  const lastCodeRef = useRef(activeCode);
  const onSelectRef = useRef(onSelectGateway);
  onSelectRef.current = onSelectGateway;
  const titleRef = useRef(pointTitle);
  titleRef.current = pointTitle;
  const L = useLeaflet(mapContainerRef);

  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 15],
      zoom: 1,
      minZoom: 1,
      maxZoom: 7,
      zoomSnap: 0.25,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
      worldCopyJump: true,
    });
    map.attributionControl.setPrefix(false);

    // Esri's dark-grey canvas basemap: no API key, meant for client-side use, and quiet enough
    // for the orange lanes to read on the chocolate chapter.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    TRADE_LANES.forEach(([from, to]) => {
      const a = getGateway(from);
      const b = getGateway(to);
      if (!a || !b) return;
      L.polyline(greatCircleSegments([a.lat, a.lng], [b.lat, b.lng]), {
        color: BRAND_COLORS.orange,
        weight: 1.8,
        opacity: 0.8,
        dashArray: '5, 6',
        interactive: false,
      }).addTo(map);
    });

    NETWORK_POINTS.forEach((g) => {
      const marker = L.marker([g.lat, g.lng], {
        icon: markerIcon(L, g, g.code === activeCode),
        title: titleRef.current(g),
        alt: titleRef.current(g),
        keyboard: true,
        zIndexOffset: g.kind === 'tanex' ? 500 : 0,
      }).addTo(map);
      marker.on('click', () => onSelectRef.current(g.code));
      marker.on('keypress', (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') onSelectRef.current(g.code);
      });
      markersRef.current[g.code] = marker;
    });

    // At world zoom nearby places overlap (Buea and Limbe, London and Paris), too close to be
    // usable targets (WCAG 2.5.8). There the dots are decorative; they become buttons once zoomed
    // in, and the page offers a place picker for the same choice.
    const syncLabelMode = () => {
      const compact = map.getZoom() < LABEL_ZOOM;
      wrapperRef.current?.classList.toggle('is-compact', compact);
      Object.values(markersRef.current).forEach((m) => {
        const el = m.getElement();
        if (!el) return;
        el.tabIndex = compact ? -1 : 0;
        if (compact) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
      });
    };
    map.on('zoomend', syncLabelMode);

    fitWorldView(map, L.latLngBounds(NETWORK_POINTS.map((g) => [g.lat, g.lng] as [number, number])));
    syncLabelMode();

    mapInstanceRef.current = map;
    lastCodeRef.current = activeCode;

    return () => {
      destroyMap(map);
      mapInstanceRef.current = null;
      markersRef.current = {};
    };
  }, [L]);

  // Language switch: marker names follow the page language.
  useEffect(() => {
    NETWORK_POINTS.forEach((g) => {
      const el = markersRef.current[g.code]?.getElement();
      if (el) {
        el.title = pointTitle(g);
        el.setAttribute('aria-label', pointTitle(g));
      }
    });
  }, [pointTitle, L]);

  // Restyle markers when the selection changes and fly to a newly picked point.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    NETWORK_POINTS.forEach((g) => {
      const marker = markersRef.current[g.code];
      marker?.setIcon(markerIcon(L, g, g.code === activeCode));
      marker?.setZIndexOffset(g.code === activeCode ? 1000 : g.kind === 'tanex' ? 500 : 0);
    });
    // setIcon replaces the element: re-apply the compact state.
    map.fire('zoomend');
    if (lastCodeRef.current === activeCode) return;
    lastCodeRef.current = activeCode;
    const target = getGateway(activeCode);
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), LABEL_ZOOM), { duration: 1.2 });
  }, [activeCode, L]);

  return (
    <div ref={wrapperRef} className="tx-netmap" role="region" aria-label={label}>
      <div ref={mapContainerRef} className="tx-netmap__canvas" />
    </div>
  );
};
