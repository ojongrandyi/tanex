// Optional map pin on the booking form (CONTENT §7.5 "Pin on map (optional)"). Tap the map to set the
// pin, drag it to adjust. Starts at the chosen area's pin, else the city's. Leaflet loads only when the
// customer opens the map (useLeaflet); the Esri street tiles are the same as the other public maps.
import React, { useEffect, useRef } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { destroyMap, useLeaflet } from '../../utils/leaflet';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS';
// South-West and Littoral coast, when neither the area nor the city has a pin.
const OVERVIEW: [number, number] = [4.3, 9.5];

export interface MapPin { lat: number; lng: number }

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export const PinMap: React.FC<{
  value: MapPin | null;
  onChange: (pin: MapPin) => void;
  near: { lat: number | null; lng: number | null } | null;
  label: string;
}> = ({ value, onChange, near, label }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const leaflet = useLeaflet(boxRef);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    if (!leaflet || !boxRef.current || mapRef.current) return;
    const hasNear = near && near.lat !== null && near.lng !== null;
    const start: [number, number] = value ? [value.lat, value.lng] : hasNear ? [near!.lat!, near!.lng!] : OVERVIEW;
    const map = leaflet.map(boxRef.current, { center: start, zoom: value ? 16 : hasNear ? 14 : 8, scrollWheelZoom: false });
    leaflet.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => changeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
    mapRef.current = map;
    return () => {
      destroyMap(map);
      mapRef.current = null;
      markerRef.current = null;
    };
    // Created once; the effect below follows the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet]);

  useEffect(() => {
    const map = mapRef.current;
    if (!leaflet || !map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const at: [number, number] = [value.lat, value.lng];
    if (!markerRef.current) {
      const icon = leaflet.divIcon({ className: 'tx-ld-pin', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 24] });
      markerRef.current = leaflet.marker(at, { draggable: true, icon, keyboard: false }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        changeRef.current({ lat: round(p.lat), lng: round(p.lng) });
      });
    } else {
      markerRef.current.setLatLng(at);
    }
  }, [leaflet, value?.lat, value?.lng]);

  return <div ref={boxRef} className="tx-ld-pinmap" role="application" aria-label={label} />;
};
