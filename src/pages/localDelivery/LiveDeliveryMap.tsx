// Map of a local or intercity delivery on the track page (DISPATCH_SPEC §8, CONTENT §6.9; G.7). Shows the
// pickup and drop-off areas (area or city pins, never the customer's own pin) joined by a dashed line,
// and, only while the courier carries the parcel and the position is fresh, the courier's marker.
// A new position glides from the old one over about a second (straight interpolation); with reduced
// motion the marker jumps. Leaflet loads on demand; Esri street tiles as on the other public maps.
import React, { useEffect, useRef } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { destroyMap, useLeaflet } from '../../utils/leaflet';
import type { PublicPoint } from '../../shared/localTracking';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS';
const GLIDE_MS = 1200;

const reducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const LiveDeliveryMap: React.FC<{
  pickup: PublicPoint | null;
  dropoff: PublicPoint | null;
  /** Courier position; null hides the marker. */
  courier: PublicPoint | null;
  label: string;
  markerLabels: { pickup: string; dropoff: string; courier: string };
}> = ({ pickup, dropoff, courier, label, markerLabels }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const leaflet = useLeaflet(boxRef);
  const mapRef = useRef<L.Map | null>(null);
  const courierRef = useRef<L.Marker | null>(null);
  const frameRef = useRef<number | null>(null);
  const fittedWithCourier = useRef(false);
  const routeKey = [pickup, dropoff].map((p) => (p ? `${p.lat},${p.lng}` : '-')).join('|');

  // The map, the two area markers and the route line.
  useEffect(() => {
    const box = boxRef.current;
    if (!leaflet || !box) return;
    const map = leaflet.map(box, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
    leaflet.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    const pins: [number, number][] = [];
    const addPin = (p: PublicPoint | null, kind: 'pickup' | 'dropoff', text: string) => {
      if (!p) return;
      const icon = leaflet.divIcon({ className: `tx-ld-mk tx-ld-mk--${kind}`, html: `<span>${kind === 'pickup' ? 'A' : 'B'}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
      leaflet.marker([p.lat, p.lng], { icon, keyboard: false, title: text, alt: text }).addTo(map);
      pins.push([p.lat, p.lng]);
    };
    addPin(pickup, 'pickup', markerLabels.pickup);
    addPin(dropoff, 'dropoff', markerLabels.dropoff);
    if (pins.length === 2) leaflet.polyline(pins, { color: '#5C3A28', weight: 3, dashArray: '6 8', opacity: 0.8, interactive: false }).addTo(map);
    if (pins.length === 2) map.fitBounds(leaflet.latLngBounds(pins), { padding: [40, 40], maxZoom: 15 });
    else if (pins.length === 1) map.setView(pins[0], 14);
    else map.setView([4.3, 9.5], 8);
    mapRef.current = map;
    fittedWithCourier.current = false;
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      courierRef.current = null;
      mapRef.current = null;
      destroyMap(map);
    };
    // Rebuilt only when the route changes; the courier effect below moves the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet, routeKey]);

  // The courier marker: added, glided to each new position, or removed.
  useEffect(() => {
    const map = mapRef.current;
    if (!leaflet || !map) return;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (!courier) {
      courierRef.current?.remove();
      courierRef.current = null;
      return;
    }
    const target = leaflet.latLng(courier.lat, courier.lng);
    if (!courierRef.current) {
      const icon = leaflet.divIcon({ className: 'tx-ld-mk tx-ld-mk--courier', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
      courierRef.current = leaflet.marker(target, { icon, keyboard: false, title: markerLabels.courier, alt: markerLabels.courier, zIndexOffset: 1000 }).addTo(map);
      if (!fittedWithCourier.current) {
        fittedWithCourier.current = true;
        const pts: L.LatLngExpression[] = [target];
        if (dropoff) pts.push([dropoff.lat, dropoff.lng]);
        map.fitBounds(leaflet.latLngBounds(pts), { padding: [48, 48], maxZoom: 16 });
      }
      return;
    }
    const marker = courierRef.current;
    const from = marker.getLatLng();
    if (reducedMotion() || from.equals(target)) {
      marker.setLatLng(target);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / GLIDE_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
      marker.setLatLng([from.lat + (target.lat - from.lat) * e, from.lng + (target.lng - from.lng) * e]);
      frameRef.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    frameRef.current = requestAnimationFrame(step);
    // The marker follows the position; the labels don't change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet, routeKey, courier?.lat, courier?.lng]);

  return <div ref={boxRef} className="tx-ld-map" role="img" aria-label={label} />;
};
