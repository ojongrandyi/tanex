// Optional map pin for a delivery city or area (DISPATCH_SPEC §3): click the map (or drag the pin)
// to set it, or type the coordinates. Leaflet loads on demand through the shared loader; the tiles
// are the same Esri street basemap as the public maps, with attribution shown.
import React, { useEffect, useRef } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { destroyMap, useLeaflet } from '../../utils/leaflet';
import { DISPATCH_TEXT } from './strings';

const T = DISPATCH_TEXT.tariffs;
const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS';
// Shown when neither the area nor its city has a pin yet: the South-West and Littoral coast.
const OVERVIEW: [number, number] = [4.3, 9.5];

export interface Pin { lat: number | null; lng: number | null }

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export const PinPicker: React.FC<{
  value: Pin;
  onChange: (pin: Pin) => void;
  /** Where to look first when there is no pin (the city's pin). */
  near?: Pin;
}> = ({ value, onChange, near }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const leaflet = useLeaflet(boxRef);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const has = value.lat !== null && value.lng !== null;

  useEffect(() => {
    if (!leaflet || !boxRef.current || mapRef.current) return;
    const start: [number, number] = has
      ? [value.lat!, value.lng!]
      : near && near.lat !== null && near.lng !== null ? [near.lat, near.lng] : OVERVIEW;
    const map = leaflet.map(boxRef.current, { center: start, zoom: has ? 15 : near?.lat != null ? 13 : 8, scrollWheelZoom: false });
    leaflet.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => changeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
    mapRef.current = map;
    return () => {
      destroyMap(map);
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; the pin effect below follows later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet]);

  useEffect(() => {
    const map = mapRef.current;
    if (!leaflet || !map) return;
    if (!has) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const at: [number, number] = [value.lat!, value.lng!];
    if (!markerRef.current) {
      const icon = leaflet.divIcon({ className: 'tx-pin-marker', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 22] });
      markerRef.current = leaflet.marker(at, { draggable: true, icon, keyboard: false }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        changeRef.current({ lat: round(p.lat), lng: round(p.lng) });
      });
    } else {
      markerRef.current.setLatLng(at);
    }
  }, [leaflet, has, value.lat, value.lng]);

  const num = (s: string): number | null => {
    if (s.trim() === '') return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  return (
    <fieldset className="tx-pin">
      <legend>{T.pin}</legend>
      <small className="tx-iam-hint">{T.pinHint}</small>
      <div ref={boxRef} className="tx-pin-map" aria-hidden="true" />
      <div className="tx-pin-coords">
        <label className="tx-iam-field">
          <span>{T.lat}</span>
          <input type="text" inputMode="decimal" value={value.lat ?? ''}
            onChange={(e) => onChange({ lat: num(e.target.value), lng: value.lng })} />
        </label>
        <label className="tx-iam-field">
          <span>{T.lng}</span>
          <input type="text" inputMode="decimal" value={value.lng ?? ''}
            onChange={(e) => onChange({ lat: value.lat, lng: num(e.target.value) })} />
        </label>
        <button type="button" className="tx-iam-btn small" disabled={!has && value.lat === null && value.lng === null}
          onClick={() => onChange({ lat: null, lng: null })}>{T.clearPin}</button>
      </div>
    </fieldset>
  );
};
