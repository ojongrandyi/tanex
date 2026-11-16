// Live map for the dispatch board (DISPATCH_SPEC §7): on-duty couriers at their last position (the
// marker greys out after 2 minutes without a ping) and active jobs as pickup → drop-off lines. The
// map is decorative for screen readers: the courier table and the job columns carry the same facts.
// Leaflet loads on demand through the shared loader; same Esri street tiles as the other maps.
import React, { useEffect, useRef } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { destroyMap, useLeaflet } from '../../utils/leaflet';
import type { LatLng } from '../../shared/dispatchBoard';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS';
// Brand colours (tokens.css: --tx-choc-800, --tx-orange-500); Leaflet paths take literal colours.
// Buea, Limbe and Douala in one view when nothing has a position yet.
const OVERVIEW: [number, number] = [4.1, 9.45];

export interface MapCourier { userId: string; label: string; initials: string; at: LatLng; stale: boolean }
export interface MapRoute { jobId: string; label: string; from: LatLng | null; to: LatLng | null }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const DispatchMap: React.FC<{
  couriers: MapCourier[];
  routes: MapRoute[];
  onOpenJob: (jobId: string) => void;
}> = ({ couriers, routes, onOpenJob }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const leaflet = useLeaflet(boxRef);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const openRef = useRef(onOpenJob);
  openRef.current = onOpenJob;

  useEffect(() => {
    if (!leaflet || !boxRef.current || mapRef.current) return;
    const map = leaflet.map(boxRef.current, { center: OVERVIEW, zoom: 9, scrollWheelZoom: false, keyboard: false });
    leaflet.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    layerRef.current = leaflet.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      destroyMap(map);
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, [leaflet]);

  // Redrawn on every board refresh; the view is fitted only the first time there is something to show.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!leaflet || !map || !layer) return;
    layer.clearLayers();
    const points: [number, number][] = [];
    for (const r of routes) {
      const ends = [r.from, r.to].filter((p): p is LatLng => !!p);
      ends.forEach((p, i) => {
        points.push([p.lat, p.lng]);
        leaflet.circleMarker([p.lat, p.lng], {
          radius: 5, weight: 2, color: '#38241D', fillColor: i === 0 && r.from ? '#ffffff' : '#F48800', fillOpacity: 1,
          className: 'tx-board-route-end',
        }).addTo(layer).on('click', () => openRef.current(r.jobId)).bindTooltip(esc(r.label));
      });
      if (r.from && r.to) {
        leaflet.polyline([[r.from.lat, r.from.lng], [r.to.lat, r.to.lng]], {
          color: '#38241D', weight: 3, opacity: 0.7, dashArray: '6 6',
        }).addTo(layer).on('click', () => openRef.current(r.jobId)).bindTooltip(esc(r.label));
      }
    }
    for (const c of couriers) {
      points.push([c.at.lat, c.at.lng]);
      const icon = leaflet.divIcon({
        className: `tx-board-courier${c.stale ? ' is-stale' : ''}`,
        html: `<span>${esc(c.initials)}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      leaflet.marker([c.at.lat, c.at.lng], { icon, keyboard: false, zIndexOffset: 1000 }).addTo(layer).bindTooltip(esc(c.label));
    }
    if (!fittedRef.current && points.length > 0) {
      fittedRef.current = true;
      if (points.length === 1) map.setView(points[0], 14);
      else map.fitBounds(leaflet.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
    }
  }, [leaflet, couriers, routes]);

  return <div ref={boxRef} className="tx-board-map" aria-hidden="true" />;
};
