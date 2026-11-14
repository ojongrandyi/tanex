// Small map on the job screen (DISPATCH_SPEC §6): pickup (P) and drop-off (D) pins, fitted to
// both. Leaflet loads on demand; the tiles are the same Esri street basemap as the other maps.
// Places without a pin are left off; with no pin at all the map is replaced by a short note.
import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { destroyMap, useLeaflet } from '../utils/leaflet';
import type { CourierPlace } from './courierApi';
import { useCourierText } from './context';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS';

const pinned = (p: CourierPlace) => p.lat !== null && p.lng !== null;

export const JobMap: React.FC<{ pickup: CourierPlace; dropoff: CourierPlace }> = ({ pickup, dropoff }) => {
  const { t } = useCourierText();
  const boxRef = useRef<HTMLDivElement>(null);
  const leaflet = useLeaflet(boxRef);
  const points = [pickup, dropoff].map((p, i) => (pinned(p) ? { lat: p.lat!, lng: p.lng!, label: i === 0 ? 'P' : 'D' } : null));
  const key = points.map((p) => (p ? `${p.lat},${p.lng}` : '-')).join('|');

  useEffect(() => {
    const box = boxRef.current;
    const pins = points.filter((p): p is { lat: number; lng: number; label: string } => p !== null);
    if (!leaflet || !box || pins.length === 0) return;
    const map = leaflet.map(box, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
    leaflet.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    for (const p of pins) {
      const icon = leaflet.divIcon({
        className: `tx-cr-pin tx-cr-pin--${p.label === 'P' ? 'pickup' : 'dropoff'}`,
        html: `<span>${p.label}</span>`, iconSize: [30, 30], iconAnchor: [15, 15],
      });
      leaflet.marker([p.lat, p.lng], { icon, keyboard: false, interactive: false }).addTo(map);
    }
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
    else map.fitBounds(leaflet.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 16 });
    return () => destroyMap(map);
    // Recreated only when the pins change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet, key]);

  if (!points.some(Boolean)) return <p className="tx-cr-note">{t('job.noMap')}</p>;
  return <div ref={boxRef} className="tx-cr-map" role="img" aria-label={t('job.mapLabel')} />;
};
