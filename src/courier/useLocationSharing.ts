// Location sharing during a delivery (DISPATCH_SPEC §6): only while one of the courier's jobs is
// PICKED_UP or ON_THE_WAY and the app is open. watchPosition feeds points; one is kept every 20 s,
// or sooner after 50 m of movement, and sent to POST /api/courier/location (points that could not
// be sent wait in memory and go with the next one, up to the server's 50 per request). The Screen
// Wake Lock keeps the screen on where supported. Nothing is collected outside an active job.
import { useCallback, useEffect, useRef, useState } from 'react';
import { courierUrls, sendRaw } from './courierApi';

export type LocationPermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface LocationSharing {
  permission: LocationPermission;
  /** True while a watch is running for an active job. */
  sharing: boolean;
  /** True while the screen wake lock is held. */
  screenLock: boolean;
  lastSentAt: number | null;
  /** Starts the watch (shows the browser's permission question if needed). */
  start: () => void;
}

const MIN_INTERVAL_MS = 20_000;
const MIN_DISTANCE_M = 50;
const MAX_BUFFER = 50;

interface Point { lat: number; lng: number; accuracyM?: number; speedMps?: number; heading?: number; recordedAtTs: number }

function distanceM(a: Point, b: Point): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface WakeLockSentinelLike { release: () => Promise<void>; released?: boolean; addEventListener?: (t: string, f: () => void) => void }

export function useLocationSharing(activeJobId: string | null): LocationSharing {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [permission, setPermission] = useState<LocationPermission>(supported ? 'unknown' : 'unsupported');
  const [sharing, setSharing] = useState(false);
  const [screenLock, setScreenLock] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [wanted, setWanted] = useState(false);

  const watchId = useRef<number | null>(null);
  const lastKept = useRef<Point | null>(null);
  const buffer = useRef<Point[]>([]);
  const sendingRef = useRef(false);
  const jobRef = useRef(activeJobId);
  jobRef.current = activeJobId;

  // Read the permission without asking; listen for changes made in the browser settings.
  useEffect(() => {
    if (!supported) return;
    let status: PermissionStatus | null = null;
    const update = () => status && setPermission(status.state as LocationPermission);
    if (!navigator.permissions?.query) {
      setPermission('prompt');
      return;
    }
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        status = s;
        update();
        s.addEventListener('change', update);
      })
      .catch(() => setPermission('prompt'));
    return () => status?.removeEventListener('change', update);
  }, [supported]);

  const flush = useCallback(async () => {
    const jobId = jobRef.current;
    if (sendingRef.current || !jobId || buffer.current.length === 0) return;
    sendingRef.current = true;
    const batch = buffer.current.slice(0, MAX_BUFFER);
    const res = await sendRaw(courierUrls.location(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, points: batch }),
    });
    sendingRef.current = false;
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
      // Sent, or refused (e.g. NO_ACTIVE_JOB once the job ended): either way these points are done.
      buffer.current = buffer.current.slice(batch.length);
      if (res.ok) setLastSentAt(Date.now());
    }
  }, []);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    lastKept.current = null;
    setSharing(false);
  }, []);

  const startWatch = useCallback(() => {
    if (!supported || watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted');
        const c = pos.coords;
        const p: Point = {
          lat: c.latitude, lng: c.longitude, recordedAtTs: pos.timestamp || Date.now(),
          ...(Number.isFinite(c.accuracy) ? { accuracyM: Math.round(c.accuracy) } : {}),
          ...(c.speed !== null && Number.isFinite(c.speed) ? { speedMps: c.speed } : {}),
          ...(c.heading !== null && Number.isFinite(c.heading) ? { heading: c.heading } : {}),
        };
        const prev = lastKept.current;
        if (prev && p.recordedAtTs - prev.recordedAtTs < MIN_INTERVAL_MS && distanceM(prev, p) < MIN_DISTANCE_M) return;
        lastKept.current = p;
        buffer.current = [...buffer.current, p].slice(-MAX_BUFFER);
        flush();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
          stopWatch();
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 60_000 },
    );
    setSharing(true);
  }, [supported, flush, stopWatch]);

  // Run the watch only while there is an active job and the courier agreed (or already granted).
  useEffect(() => {
    const allowed = permission === 'granted' || (wanted && permission !== 'denied');
    if (activeJobId && allowed) startWatch();
    else stopWatch();
  }, [activeJobId, permission, wanted, startWatch, stopWatch]);
  useEffect(() => () => stopWatch(), [stopWatch]);

  // Retry unsent points every 20 s while sharing (the watch may be quiet when standing still).
  useEffect(() => {
    if (!sharing) return;
    const t = window.setInterval(() => flush(), MIN_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [sharing, flush]);

  // Screen wake lock while sharing; browsers drop it when the tab is hidden, so take it again.
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!sharing || !wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      wl.request('screen').then((s) => {
        if (cancelled) { s.release().catch(() => {}); return; }
        sentinel = s;
        setScreenLock(true);
        s.addEventListener?.('release', () => setScreenLock(false));
      }).catch(() => setScreenLock(false));
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      sentinel?.release().catch(() => {});
      setScreenLock(false);
    };
  }, [sharing]);

  const start = useCallback(() => {
    setWanted(true);
    if (permission === 'unknown' || permission === 'prompt') setPermission('prompt');
    // Ask right away, inside the tap, so the browser shows its question.
    if (supported && activeJobId) startWatch();
  }, [permission, supported, activeJobId, startWatch]);

  return { permission, sharing, screenLock, lastSentAt, start };
}
