import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  Package,
  Calendar,
  Truck,
  Building2,
  MapPin,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ArrowLeft,
  ArrowRight,
  Headphones,
  Check,
  Phone,
  Mail,
  Clock,
  Car,
  FileText,
  Activity,
  Layers,
  ChevronDown,
  RotateCcw,
  PawPrint,
  Heart,
  Lock,
  Navigation,
  Zap,
  Scale,
  Box,
  Container,
  Stethoscope
} from 'lucide-react';
import { Shipment, TrackingEvent, RouteCheckpoint, ShipmentStatus } from '../types/shipment';
import { Barcode } from '../components/Barcode';
import { JourneyMap } from '../components/JourneyMap';
import { MultiPieceList } from '../components/MultiPieceList';
import { PackageGallery, type GalleryImage } from '../components/PackageGallery';
import { legacyPhotoUrls } from '../shared/legacyPhotos';
import { shipmentStatusLabel, shipmentStatusTone } from '../shared/shipmentStatus';
import { eventTitleText } from '../shared/eventTitles';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { SupportModal } from '../components/SupportModal';
import { calculateRouteGeometry, inferTransportMode } from '../services/routingEngine';
import { timeZoneForPlace } from '../shared/timeZones';
import { formatDimensions, formatDistance, formatWeight } from '../shared/units';
import { useUnitSystem } from '../utils/useUnitSystem';
import { UnitToggle } from '../components/forms/UnitControls';
import { simulationEngine } from '../services/simulationEngine';
import { api } from '../services/api';
import { generateShipmentPlan, calculateDynamicTimeProgress, getServiceCommitmentHours } from '../services/planningEngine';
import { resolveLocation } from '../services/geocodingService';
import { applyForwardOnlyShipmentUpdate } from '../utils/shipmentSync';
import { useCompanyContact } from '../utils/useCompanyContact';
import './TrackResultPage.css';

// The payment section is only downloaded for shipments that have a payment request.
const PaymentSection = lazy(() => import('../components/PaymentSection').then((m) => ({ default: m.PaymentSection })));

interface TrackResultPageProps {
  shipment: Shipment;
  onTrackAnother: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
}

export const TrackResultPage: React.FC<TrackResultPageProps> = ({
  shipment,
  onTrackAnother,
  onNavigate,
}) => {
  // An empty phone hides the call button (no placeholder number).
  const { phone: supportPhone, phoneHref } = useCompanyContact();

  // Continuous real-time synchronized state
  const [liveShipment, setLiveShipment] = useState<Shipment>(shipment);
  // Status names and server-written event titles follow the page language (I18N_SPEC §5); the
  // rest of this page is translated with task E.5.
  const locale = useLocale();
  const t = useAreaT('trackResult');

  useEffect(() => {
    setLiveShipment(prev => applyForwardOnlyShipmentUpdate(prev, shipment));
  }, [shipment]);

  useEffect(() => {
    // Real progress now comes from the server (server/progress.ts), on a schedule, for every
    // viewer — this subscription is just for instant same-session updates an admin makes
    // through the control modal (a manual scrub-to-percentage preview, a delay advisory),
    // broadcast live via localStorage rather than waiting for the next poll. Guarded the same
    // forward-only way as every other entry point below.
    const unsubscribe = simulationEngine.subscribe((updated) => {
      if (updated.trackingNumber.toUpperCase() === (shipment?.trackingNumber || '').toUpperCase()) {
        setLiveShipment(prev => applyForwardOnlyShipmentUpdate(prev, updated));
      }
    });

    return () => unsubscribe();
  }, [shipment?.trackingNumber]);

  useEffect(() => {
    // The server now advances a shipment's real progress on its own over elapsed time
    // (see server/progress.ts) — but an already-open tab has no way to notice that
    // happened without asking again. Periodically re-fetch so genuine background
    // progress becomes visible without requiring a manual page reload.
    const trackingNumber = shipment?.trackingNumber;
    if (!trackingNumber) return;

    const POLL_MS = 8000;
    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const fresh = await api.trackShipment(trackingNumber);
        if (!fresh) return;
        setLiveShipment(prev => applyForwardOnlyShipmentUpdate(prev, fresh));
      } catch (err: any) {
        if (err?.status === 404) {
          // The shipment behind this tracking number is gone (deleted, or never existed) —
          // retrying every 8 seconds forever can't fix that. Stop; a genuinely new tracking
          // number means a fresh mount of this page anyway (new trackingNumber dependency).
          stopped = true;
          clearInterval(interval);
        }
        // Any other error: silent, a failed background refresh shouldn't disrupt the page.
      }
    }, POLL_MS);

    return () => { stopped = true; clearInterval(interval); };
  }, [shipment?.trackingNumber]);

  const [supportOpen, setSupportOpen] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [showEarlierEvents, setShowEarlierEvents] = useState(false);

  // Safe field extraction from synchronized liveShipment
  const trackingNum = liveShipment?.trackingNumber || shipment?.trackingNumber || '';
  const status = liveShipment?.status || 'IN_TRANSIT';
  const statusTone = shipmentStatusTone(status);
  const isDelivered = statusTone === 'delivered';
  const isHold = statusTone === 'hold';
  const isDelayed = statusTone === 'delayed';
  // The admin's Operations Control modal records a hold/delay reason into statusText as
  // "On hold (<reason>)" / "Delayed (<reason>)" — there's no separate reason column in
  // the backend, so this is the one place that value actually survives the round trip to the
  // database. Pull it back out here so the public page can tell the customer WHY, instead of
  // a generic "your shipment is on hold" that never says anything more.
  const holdOrDelayReasonMatch = /\((.+)\)\s*$/.exec(liveShipment?.statusText || '');
  const holdOrDelayReason = holdOrDelayReasonMatch ? holdOrDelayReasonMatch[1] : undefined;
  const hasRevisedSchedule = isHold || isDelayed || Boolean(shipment.delayNotice?.hasDelay);
  // Single canonical status name (CONTENT §6.3, shared with the admin), reused everywhere the
  // page shows the shipment's current status.
  const statusDisplayLabel = shipmentStatusLabel(status, locale);
  // Vehicle views only for real vehicle shipments (by type or stored vehicle details).
  const isVehicle = liveShipment?.shipmentType === 'Vehicle' || !!liveShipment?.vehicleDetails;
  const isPet = liveShipment?.shipmentType === 'Pets' || !!liveShipment?.petDetails;
  const pet = liveShipment?.petDetails;
  
  const originCity = liveShipment?.origin?.city || shipment?.origin?.city || '';
  const originState = liveShipment?.origin?.state || shipment?.origin?.state || 'NY';
  // No fallback — ZIP is optional at booking (CreateShipmentView), and showing a fake one for
  // a shipment that genuinely doesn't have it on file is exactly the "shows a placeholder
  // for a field I left blank" problem this page shouldn't have. Reads sender/recipient's
  // postalCode first — origin.zip/destination.zip have no backing database column at all, so
  // that value only ever survives in memory until the next refetch, when it silently reverts
  // to nothing; postalCode on the party record is what actually round-trips through the API.
  const originZip = (liveShipment?.sender as any)?.postalCode || (liveShipment?.origin as any)?.zip || (shipment?.sender as any)?.postalCode || (shipment?.origin as any)?.zip;
  const destCity = liveShipment?.destination?.city || shipment?.destination?.city || '';
  const destState = liveShipment?.destination?.state || shipment?.destination?.state || 'CA';
  const destZip = (liveShipment?.recipient as any)?.postalCode || (liveShipment?.destination as any)?.zip || (shipment?.recipient as any)?.postalCode || (shipment?.destination as any)?.zip;
  // Facility names only when stored (no invented terminal names).
  const originFacility = (liveShipment?.origin as any)?.facilityName || (shipment?.origin as any)?.facilityName || '';
  const destFacility = (liveShipment?.destination as any)?.facilityName || (shipment?.destination as any)?.facilityName || '';

  const currentCity = typeof liveShipment?.currentLocation === 'string'
    ? liveShipment.currentLocation.split(',')[0].trim()
    : (typeof liveShipment?.currentLocation === 'object' && (liveShipment.currentLocation as any)?.city) || (typeof shipment?.currentLocation === 'object' && (shipment?.currentLocation as any)?.city) || originCity;
    
  const currentState = typeof liveShipment?.currentLocation === 'string'
    ? liveShipment.currentLocation.split(',')[1]?.trim() || originState
    : typeof liveShipment?.currentLocation === 'object'
      ? ((liveShipment.currentLocation as any)?.state ?? '')
      : ((typeof shipment?.currentLocation === 'object' && (shipment?.currentLocation as any)?.state) || '');

  // "In flight" / "At sea" positions have no region, so it's left off rather than filled in.
  const currentLocationText = [currentCity, currentState].filter(Boolean).join(', ');

  // Real coordinates for wherever the shipment's currentLocation actually points — an
  // admin-set facility or a live simulation tick, both now kept accurate (see the routing
  // fixes above). JourneyMap uses these to plot the vehicle marker for real instead of
  // guessing a point from progress % alone.
  const currentLat = typeof liveShipment?.currentLocation === 'object'
    ? (liveShipment.currentLocation as any)?.lat
    : (typeof shipment?.currentLocation === 'object' ? (shipment?.currentLocation as any)?.lat : undefined);
  const currentLng = typeof liveShipment?.currentLocation === 'object'
    ? (liveShipment.currentLocation as any)?.lng
    : (typeof shipment?.currentLocation === 'object' ? (shipment?.currentLocation as any)?.lng : undefined);

  // "Just now" is a real, valid value (the shipment really was just touched) — it just isn't
  // a displayable date/time on its own. This used to reject it and substitute a hardcoded
  // fake past date instead of formatting the actual current moment it stands in for.
  const lastUpdated = typeof liveShipment?.lastUpdated === 'string' && liveShipment.lastUpdated !== 'Just now'
    ? liveShipment.lastUpdated
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const estDeliveryDate = typeof liveShipment?.estimatedDelivery === 'string'
    ? liveShipment.estimatedDelivery
    : (typeof liveShipment?.estimatedDelivery === 'object' && (liveShipment.estimatedDelivery as any)?.date) || '';

  const estDeliveryTime = typeof liveShipment?.estimatedDeliveryDetail === 'string'
    ? liveShipment.estimatedDeliveryDetail
    : (typeof liveShipment?.estimatedDelivery === 'object' && (liveShipment.estimatedDelivery as any)?.timeWindow) || '';
  const estDeliveryText = [estDeliveryDate, estDeliveryTime].filter(Boolean).join(' · ') || '—';

  const service = liveShipment?.service || shipment?.service || 'Express';

  // Real shipment data always wins; these are only fallbacks when a field is missing.
  const cargoType = liveShipment?.shipmentType || 'Freight';
  const cargoDescription = liveShipment?.cargoDescription || shipment?.cargoDescription || 'General cargo';
  const shipmentType = cargoType === 'Vehicle' ? 'Freight' : cargoType;
  // Stored in pounds; shown in the viewer's units (no invented fallback weight)
  const totalWeight = Number(liveShipment?.totalWeightLbs || shipment?.totalWeightLbs || 0);
  const [unitSystem] = useUnitSystem();
  const totalWeightText = totalWeight > 0 ? formatWeight(totalWeight, unitSystem) : '—';
  const dimensionsText = formatDimensions(liveShipment?.dimensions || shipment?.dimensions, unitSystem);

  // Parties data — only Full Name and Street Address are required at booking (see
  // CreateShipmentView); Company/Email/Phone are explicitly optional there, so a blank one
  // must not show a fabricated fallback value here: those fields are conditionally rendered
  // below and simply omitted when empty.
  const senderName = shipment?.sender?.name || t('parties.sender');
  const senderCompany = shipment?.sender?.company;
  const senderAddress = shipment?.sender?.addressLine;
  const senderPhone = shipment?.sender?.phone;
  const senderEmail = shipment?.sender?.email;

  const recipientName = shipment?.recipient?.name || t('parties.recipient');
  const recipientCompany = shipment?.recipient?.company;
  const recipientAddress = shipment?.recipient?.addressLine;
  const recipientPhone = shipment?.recipient?.phone;
  const recipientEmail = shipment?.recipient?.email;

  const originGeo = resolveLocation([originCity, originState].filter(Boolean).join(', ')) || resolveLocation(originCity) || resolveLocation(originState) || { lat: 40.7128, lng: -74.0050 };
  const currentGeo = resolveLocation([currentCity, currentState].filter(Boolean).join(', ')) || resolveLocation(currentCity) || resolveLocation(currentState) || { lat: 41.8781, lng: -87.6298 };
  const destGeo = resolveLocation([destCity, destState].filter(Boolean).join(', ')) || resolveLocation(destCity) || resolveLocation(destState) || { lat: 34.0522, lng: -118.2437 };

  const routeCheckpoints: RouteCheckpoint[] = [
    {
      id: 'pt-origin',
      name: originCity,
      state: originState,
      type: 'origin',
      statusLabel: t('map.origin'),
      lat: (liveShipment?.origin as any)?.lat || (shipment?.origin as any)?.lat || originGeo.lat,
      lng: (liveShipment?.origin as any)?.lng || (shipment?.origin as any)?.lng || originGeo.lng,
    },
    {
      id: 'pt-current',
      name: currentCity,
      state: currentState,
      type: 'current',
      statusLabel: t('map.current'),
      lat: (liveShipment?.currentLocation as any)?.lat || currentGeo.lat,
      lng: (liveShipment?.currentLocation as any)?.lng || currentGeo.lng,
    },
    {
      id: 'pt-dest',
      name: destCity,
      state: destState,
      type: 'destination',
      statusLabel: t('map.destination'),
      dateLabel: `${estDeliveryDate} • ${estDeliveryTime}`,
      lat: (liveShipment?.destination as any)?.lat || (shipment?.destination as any)?.lat || destGeo.lat,
      lng: (liveShipment?.destination as any)?.lng || (shipment?.destination as any)?.lng || destGeo.lng,
    }
  ];

  // Timeline events
  const rawEventsList: TrackingEvent[] = (liveShipment?.timeline && liveShipment.timeline.length > 0)
    ? liveShipment.timeline
    : (shipment?.timeline && shipment.timeline.length > 0)
    ? shipment.timeline
    : (liveShipment?.events && liveShipment.events.length > 0)
    ? liveShipment.events
    : (shipment?.events && shipment.events.length > 0)
    ? shipment.events
    : [];

  const handleCopyTrackingNumber = () => {
    navigator.clipboard.writeText(trackingNum);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  // Automated routing & planned milestone calculations. The mode (road, air or sea legs) comes
  // from the shipment, or is inferred for older records the same way the server does.
  const routeOrigin = { lat: (liveShipment?.origin as any)?.lat || (shipment?.origin as any)?.lat || originGeo.lat, lng: (liveShipment?.origin as any)?.lng || (shipment?.origin as any)?.lng || originGeo.lng, name: originCity };
  const routeDestination = { lat: (liveShipment?.destination as any)?.lat || (shipment?.destination as any)?.lat || destGeo.lat, lng: (liveShipment?.destination as any)?.lng || (shipment?.destination as any)?.lng || destGeo.lng, name: destCity };
  const transportMode = inferTransportMode({
    mode: liveShipment?.transportMode ?? shipment?.transportMode,
    shipmentType: cargoType,
    service,
    origin: routeOrigin,
    destination: routeDestination
  });
  const routeGeom = calculateRouteGeometry(routeOrigin, routeDestination, transportMode);

  const timeProgress = calculateDynamicTimeProgress(liveShipment || shipment, 48);

  // NOTE: progressPercent intentionally does NOT blend in timeProgress.progressPercent via
  // Math.max() here. timeProgress is a wall-clock estimate (elapsed real time since the
  // shipment's first event vs. its SLA window) — for demo data with fixed past dates, that
  // ratio only ever climbs and permanently pins near its 94% ceiling well after the SLA
  // window has passed, silently overriding whatever progress the simulation/admin actually
  // set. The real, admin-controllable progressPercent is the source of truth; timeProgress
  // is used only as a last-resort fallback when no real value exists at all.
  const progressPercent = status === 'DELIVERED'
    ? 100
    : isHold
    ? (liveShipment?.frozenProgressPercent ?? shipment?.frozenProgressPercent ?? shipment?.progressPercent ?? 35)
    : String(status) === 'CREATED' || String(status) === 'AWAITING_PICKUP' || String(status) === 'BOOKED'
    ? 0
    : (liveShipment as any)?.progressPercent !== undefined
    ? (liveShipment as any).progressPercent
    : (shipment as any)?.progressPercent !== undefined
    ? (shipment as any).progressPercent
    : timeProgress.progressPercent;

  // Anchor the planned-milestone timeline to this shipment's real, already-stored estimated
  // delivery date (working backward by the service SLA window) instead of deriving forward
  // from "right now" — otherwise the 6-stage timeline's own final "Delivered" milestone date
  // would silently drift out of sync with the ETA already shown in the header/summary cards,
  // the same class of self-contradicting-date bug this timeline replacement was meant to fix.
  const slaHoursForPlan = getServiceCommitmentHours(service, routeGeom.distanceMiles);
  const parsedEstDelivery = new Date(estDeliveryDate);
  const planPickupDateStr = !isNaN(parsedEstDelivery.getTime())
    ? new Date(parsedEstDelivery.getTime() - slaHoursForPlan * 3600 * 1000).toISOString()
    : undefined;

  const plan = generateShipmentPlan(
    { city: originCity, state: originState },
    { city: destCity, state: destState },
    service,
    routeGeom.distanceMiles,
    planPickupDateStr,
    rawEventsList,
    status as ShipmentStatus,
    progressPercent
  );

  // Captioned package images first, then older uncaptioned photos (CONTENT.md §6.6).
  const galleryImages: GalleryImage[] = useMemo(() => [
    ...(liveShipment.images ?? []),
    ...legacyPhotoUrls(liveShipment.photos).map((url, i) => ({ url, caption: t('gallery.untitled', { n: i + 1 }), width: null, height: null })),
  ], [liveShipment.images, liveShipment.photos]);

  const eventsList: TrackingEvent[] = useMemo(() => {
    let sourceList = [...rawEventsList];
    if (status === 'DELIVERED') {
      const hasDelivered = sourceList.some(e => e.status === 'DELIVERED' || e.title.toLowerCase().includes('delivered'));
      if (!hasDelivered) {
        const lastUp = typeof liveShipment?.lastUpdated === 'string' && liveShipment.lastUpdated.includes('·')
          ? liveShipment.lastUpdated
          : lastUpdated;
        const parts = lastUp.split('·');
        const dStr = parts[0]?.trim() || '';
        const tStr = parts[1]?.trim() || '';

        const delEvent: TrackingEvent = {
          id: 'auto-delivered-scan',
          timestamp: new Date().toISOString(),
          timezone: timeZoneForPlace({ city: destCity, state: destState }),
          displayDate: dStr,
          displayTime: tStr,
          title: shipmentStatusLabel('DELIVERED'),
          titleKey: 'event.status',
          titleVars: { status: 'DELIVERED' },
          facility: '',
          city: destCity,
          state: destState,
          description: '',
          isCurrent: true,
          isCompleted: true
        };

        sourceList = [delEvent, ...sourceList];
      }
    }

    // Intelligent Deduplication: Filter out rapid tick artifacts & repetitive status pings
    const seenSignatures = new Set<string>();
    const cleaned: TrackingEvent[] = [];

    for (const evt of sourceList) {
      // Normalize signature: event title without non-alphanumeric noise + city
      const normTitle = (evt.title || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const normCity = (evt.city || '').trim().toLowerCase();
      const sig = `${normTitle}_${normCity}`;
      
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        cleaned.push(evt);
      }
      // Maximum realistic milestone checkpoints for any domestic highway consignment
      if (cleaned.length >= 8) break;
    }

    return cleaned;
  }, [status, rawEventsList, destCity, destState, liveShipment, shipment]);

  // The primary 6-stage timeline, derived from `plan.plannedMilestones` (see the
  // generateShipmentPlan call above) — genuinely computed from this shipment's real pickup
  // date, real service-level SLA window, and real confirmed events/progress, instead of a
  // fixed "Aug 21-23, 2026" mockup timeline that used to render identically for every
  // shipment regardless of when it was actually created or what had actually happened to it.
  const referenceTimelineEvents = useMemo(() => {
    const milestones = plan.plannedMilestones;
    const lastConfirmedIndex = milestones.reduce(
      (acc, m, idx) => (m.milestoneState === 'CONFIRMED' ? idx : acc),
      -1
    );
    return milestones.map((m, idx) => ({
      id: m.id,
      title: m.stageStatus ? shipmentStatusLabel(m.stageStatus, locale) : m.stageName,
      dateStr: m.plannedDateTime,
      location: m.location,
      statusType: (idx === lastConfirmedIndex && status !== 'DELIVERED')
        ? ('current' as const)
        : m.milestoneState === 'CONFIRMED'
          ? ('confirmed' as const)
          : ('estimated' as const),
      description: m.description
    }));
  }, [plan.plannedMilestones, status, locale]);

  const scrollToTimeline = () => {
    const el = document.getElementById('shipment-timeline-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // CONTENT §6.3 lines. The ETA is given in the destination's local time zone.
  const destZone = timeZoneForPlace({ city: destCity, state: destState });
  const destZoneName = destZone === 'UTC' ? 'UTC' : t('summary.zoneTime', { zone: (destZone.split('/').pop() || destZone).replace(/_/g, ' ') });
  const etaLine = estDeliveryDate
    ? t('summary.etaLine', { date: [estDeliveryDate, estDeliveryTime].filter(Boolean).join(', '), zone: destZoneName })
    : '';
  // Delivered: date and time of the delivery scan; the signer comes from the admin's delivery
  // record ("Delivered (Signed by …)"), already masked by the public API.
  const deliveredEvent = eventsList.find(e => e.status === 'DELIVERED' || (e.title || '').toLowerCase().includes('delivered'));
  const [lastUpdatedDate, lastUpdatedTime] = lastUpdated.split(' · ');
  const deliveredDate = deliveredEvent?.displayDate || lastUpdatedDate;
  const deliveredTime = deliveredEvent?.displayTime || lastUpdatedTime;
  const signerMatch = /signed (?:for )?by ([^().]+)/i.exec(`${liveShipment?.statusText || ''} ${deliveredEvent?.description || ''}`);
  const signer = signerMatch ? signerMatch[1].trim() : '';
  const deliveredLine = [
    deliveredTime ? t('summary.deliveredLineTime', { date: deliveredDate, time: deliveredTime }) : t('summary.deliveredLine', { date: deliveredDate }),
    signer ? t('summary.signedBy', { name: signer }) : '',
  ].filter(Boolean).join(' ');
  const statusLine = isDelivered ? deliveredLine : etaLine;

  return (
    <div className="ngf-redesign-tracking-page animate-fade-in">
      {/* =========================================================================
          0. HERO BANNER
          ========================================================================= */}
      <section className="ngf-cinematic-hero-section">

        <div className="ngf-hero-content-wrap">
          {/* Top Breadcrumb & Status */}
          <div className="ngf-hero-top-bar">
            <button
              type="button"
              className="hero-back-link"
              onClick={() => onNavigate('track')}
            >
              <ArrowLeft size={16} />
              <span>{t('back')}</span>
            </button>
          </div>

          <div className="hero-status-pill-wrap">
            <span className={`hero-live-status-pill ${isHold ? 'hold' : isDelayed ? 'delayed' : status === 'DELIVERED' ? 'delivered' : 'in-transit'}`}>
              <span className="hero-live-dot" />
              {statusDisplayLabel.toUpperCase()}
            </span>
          </div>

          <h1 className="hero-tracking-number font-mono">{trackingNum}</h1>
          <h2 className="hero-cargo-title">{cargoDescription}</h2>

          <div className="hero-route-strip">
            <div className="hero-route-stop">
              <MapPin size={16} className="text-blue" />
              <span>{[originCity, originState].filter(Boolean).join(', ')}</span>
            </div>
            <ArrowRight size={14} className="hero-route-arrow" />
            <div className="hero-route-stop">
              <MapPin size={16} className="text-blue" />
              <span>{[destCity, destState].filter(Boolean).join(', ')}</span>
            </div>
          </div>

          {/* Floating Frosted Dark Metrics Bar */}
          <div className="hero-floating-metrics-bar">
            <div className="hero-metric-cell">
              <div className="hero-metric-icon amber">
                <Zap size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">{t('metrics.service')}</span>
                <strong className="hero-metric-val">{service}</strong>
              </div>
            </div>

            <div className="hero-metric-sep" />

            <div className="hero-metric-cell">
              <div className="hero-metric-icon amber">
                <Calendar size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">{t('metrics.eta')}</span>
                <strong className="hero-metric-val">{estDeliveryText}</strong>
              </div>
            </div>

            <div className="hero-metric-sep" />

            <div className="hero-metric-cell">
              <div className="hero-metric-icon amber">
                <Truck size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">{t('metrics.distance')}</span>
                <strong className="hero-metric-val">{formatDistance(routeGeom.distanceMiles, unitSystem)}</strong>
              </div>
            </div>

            <div className="hero-metric-sep" />

            <div className="hero-metric-cell">
              <div className={`hero-metric-icon ${hasRevisedSchedule ? 'amber' : 'emerald'}`}>
                <Activity size={18} />
              </div>
              <div className="hero-metric-text">
                <span className="hero-metric-lbl">{t('metrics.status')}</span>
                <strong className={`hero-metric-val ${hasRevisedSchedule ? 'text-amber' : 'text-emerald'}`}>
                  {statusDisplayLabel}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <div className="ngf-track-container">
        {/* Hold / Delay Advisory — surfaces the specific reason an admin recorded via
            Operations Control, instead of leaving a customer to guess why their shipment
            stopped moving or when it'll actually arrive. */}
        {(isHold || isDelayed) && (
          <div className={`tracking-top-alert-banner animate-fade-in ${isHold ? 'hold' : 'delay'}`}>
            {isHold ? <Clock size={18} /> : <AlertTriangle size={18} />}
            <div>
              <strong>{statusDisplayLabel}{holdOrDelayReason ? `: ${holdOrDelayReason}` : ''}</strong>
              {etaLine && <p>{etaLine}</p>}
            </div>
          </div>
        )}

        {/* RTO Alert (If active) */}
        {shipment?.returnLeg && (
          <div className="rto-active-advisory-banner animate-fade-in">
            <RotateCcw size={18} className="text-amber" />
            <div>
              <strong>{shipmentStatusLabel('RETURNED')} ({shipment.returnLeg.reason})</strong>
              <p>{t('returning', { place: [originCity, originState].filter(Boolean).join(', '), id: shipment.returnLeg.returnTrackingNumber })}</p>
            </div>
          </div>
        )}

        {/* Return shipment: link back to the original */}
        {shipment?.returnOf && (
          <div className="rto-active-advisory-banner animate-fade-in">
            <RotateCcw size={18} className="text-amber" />
            <div>
              <strong>{shipmentStatusLabel('RETURNED')}</strong>
              <p>{t('returnOf', { id: shipment.returnOf })}</p>
            </div>
          </div>
        )}

        {/* =========================================================================
            1. WHITE CONSIGNMENT SUMMARY CARD (3 COLUMNS + CORRIDOR RAIL)
            ========================================================================= */}
        <section className="ngf-hero-summary-card">
          <div className="hero-summary-grid">
            {/* Column 1: Tracking Number & Barcode */}
            <div className="hero-col-barcode">
              <span className="hero-col-label">{t('summary.trackingId')}</span>
              <div className="tracking-number-row">
                <h3 className="tracking-number-val font-mono">{trackingNum}</h3>
                <button
                  type="button"
                  className="copy-btn-inline"
                  onClick={handleCopyTrackingNumber}
                  title={t('summary.copy')}
                  aria-label={copiedNumber ? t('summary.copied') : t('summary.copy')}
                >
                  {copiedNumber ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                </button>
              </div>

              {/* Code 128 Linear Barcode */}
              <div className="hero-barcode-container">
                <Barcode
                  value={trackingNum}
                  height={54}
                  width={1.5}
                  fontSize={11}
                  displayValue={true}
                />
              </div>
            </div>

            {/* Column 2: Current Status & Details */}
            <div className="hero-col-status">
              <span className="hero-col-label">{t('summary.status')}</span>
              <h2 className="status-hero-heading">
                {statusDisplayLabel}
              </h2>
              {statusLine && (
                <p className="status-hero-sub">
                  {statusLine}
                </p>
              )}

              <div className="last-recorded-checkpoint-box">
                <span className="chk-label">{t('summary.lastScan')}</span>
                <span className="chk-val">{currentLocationText}{currentLocationText ? ' · ' : ''}{lastUpdated}</span>
              </div>
            </div>

            {/* Column 3: Estimated Delivery & Meta Specs */}
            <div className="hero-col-eta-specs">
              <span className="hero-col-label">{t('summary.eta')}</span>
              <div className="eta-highlight-box">
                <div className="eta-date-row">
                  <Calendar size={22} className="text-blue" />
                  <div>
                    <strong>{estDeliveryDate || '—'}</strong>
                    {estDeliveryTime && <small>{estDeliveryTime}</small>}
                  </div>
                </div>
                {hasRevisedSchedule ? (
                  <span className="on-schedule-pill revised">
                    <Clock size={13} />
                    <span>{t('summary.revised')}</span>
                  </span>
                ) : (
                  <span className="on-schedule-pill">
                    <CheckCircle2 size={13} />
                    <span>{t('summary.onSchedule')}</span>
                  </span>
                )}
              </div>

              {/* Meta Specs Table */}
              <div className="hero-specs-mini-table">
                <div className="spec-item-row">
                  <span className="s-lbl">{t('summary.service')}</span>
                  <span className="s-val">{service}</span>
                </div>
                <div className="spec-item-row">
                  <span className="s-lbl">{t('summary.type')}</span>
                  <span className="s-val">{shipmentType}</span>
                </div>
                <div className="spec-item-row">
                  <span className="s-lbl">{t('summary.weight')}</span>
                  <span className="s-val">{totalWeightText}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Route transit rail */}
          <div className="hero-corridor-journey-strip">
            <div className="corridor-point origin">
              <div className="corridor-point-icon">
                <Navigation size={16} />
              </div>
              <div className="corridor-point-text">
                <span className="corridor-label">{t('corridor.origin')}</span>
                <strong className="corridor-city">{[originCity, originState].filter(Boolean).join(', ') || '—'}</strong>
                {originFacility && <small className="corridor-facility">{originFacility}</small>}
              </div>
            </div>

            <div className="corridor-track-wrapper">
              <div className="corridor-meta-badges">
                <span className="corridor-dist-badge">
                  <span>{t('corridor.total', { distance: formatDistance(routeGeom.distanceMiles, unitSystem), mode: t(`modes.${transportMode}`) })}</span>
                </span>
                <span className="corridor-status-badge">
                  {status === 'DELIVERED' ? (
                    <span className="text-emerald font-bold">✓ {t('corridor.complete', { n: 100 })}</span>
                  ) : (
                    <span>● {t('corridor.complete', { n: progressPercent })}</span>
                  )}
                </span>
                <span className="corridor-sla-badge">
                  <span>{statusDisplayLabel}</span>
                </span>
              </div>
              <div className="corridor-progress-rail">
                <div 
                  className={`corridor-progress-fill ${status === 'DELIVERED' ? 'delivered' : ''}`}
                  style={{ width: `${Math.min(Math.max(progressPercent, 5), 100)}%` }}
                >
                  <span className="corridor-hauler-indicator" title={t('corridor.progress', { n: progressPercent })}
                    aria-hidden="true">
                    📦
                  </span>
                </div>
              </div>
            </div>

            <div className="corridor-point destination">
              <div className="corridor-point-icon dest">
                <MapPin size={16} />
              </div>
              <div className="corridor-point-text">
                <span className="corridor-label">{t('corridor.destination')}</span>
                <strong className="corridor-city">{[destCity, destState].filter(Boolean).join(', ') || '—'}</strong>
                {destFacility && <small className="corridor-facility">{destFacility}</small>}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. FULL-WIDTH INTERACTIVE ROUTE MAP
            ========================================================================= */}
        <section className="ngf-route-map-section" aria-labelledby="track-route-title">
          <h3 id="track-route-title" className="card-section-title ngf-route-title">{t('route.title')}</h3>
          <JourneyMap
            checkpoints={routeCheckpoints}
            currentLocationText={currentLocationText}
            currentLat={currentLat}
            currentLng={currentLng}
            lastEventDescription={isDelivered ? statusDisplayLabel : t('route.towards', { status: statusDisplayLabel, mode: t(`modes.${transportMode}`).toLowerCase(), city: destCity })}
            totalDistance={formatDistance(routeGeom.distanceMiles, unitSystem)}
            transitTime={t('route.hours', { n: plan.serviceCommitmentHours })}
            progressPercent={progressPercent}
            shipmentStatus={status}
            delayNotice={liveShipment.delayNotice}
            onScrollToTimeline={scrollToTimeline}
            transportMode={transportMode}
          />
        </section>

        {/* Package images (CONTENT.md §6.6), then any older photos saved on the record
            (photos_json, no caption); renders nothing when there are none. */}
        <PackageGallery images={galleryImages} />

        {/* Payment request (CONTENT.md §6.8); only when the shipment has one that isn't cancelled. */}
        {liveShipment.payment && liveShipment.payment.status !== 'CANCELLED' && (
          <Suspense fallback={null}>
            <PaymentSection trackingNumber={trackingNum} payment={liveShipment.payment} />
          </Suspense>
        )}

        {/* =========================================================================
            3. TWO-COLUMN MAIN CONTENT (LEFT: TIMELINE | RIGHT: VEHICLE & DETAILS)
            ========================================================================= */}
        <section className="ngf-main-content-grid">
          {/* LEFT COLUMN: Clean Chronological Shipment Timeline */}
          <div id="shipment-timeline-section" className="content-col-timeline">
            <div className="timeline-card">
              <div className="timeline-card-header">
                <h3 className="card-section-title" style={{ margin: 0 }}>{t('timeline.title')}</h3>
                <span className="timeline-count-tag font-mono">
                  {t('timeline.count', { n: referenceTimelineEvents.filter(e => e.statusType === 'confirmed' || e.statusType === 'current').length, m: referenceTimelineEvents.length })}
                </span>
              </div>

              {/* 6 Formatted Events */}
              <div className="timeline-items-list">
                {referenceTimelineEvents.map((evt, idx) => {
                  const isCurrent = evt.statusType === 'current';
                  const isConfirmed = evt.statusType === 'confirmed';
                  const isLast = idx === referenceTimelineEvents.length - 1;

                  return (
                    <div key={evt.id} className={`t-event-row ${isCurrent ? 'active-event' : ''}`}>
                      <div className="t-icon-col">
                        <div className={`t-icon-badge ${isCurrent ? 'current' : isConfirmed ? 'confirmed' : 'estimated'}`}>
                          {isCurrent ? (
                            <Truck size={14} className="text-white animate-pulse" />
                          ) : isConfirmed ? (
                            <Check size={14} />
                          ) : (
                            <span className="hollow-circle-dot" />
                          )}
                        </div>
                        {!isLast && <div className={`t-line-connector ${isConfirmed ? 'solid' : 'dashed'}`} />}
                      </div>

                      <div className="t-content-col">
                        <div className="t-event-head-row">
                          <h4 className={`t-event-title ${isCurrent ? 'text-blue' : ''}`}>{eventTitleText(evt, locale)}</h4>
                          <span className={`t-tag ${evt.statusType}`}>
                            {evt.statusType === 'confirmed' ? t('timeline.confirmed') : evt.statusType === 'current' ? t('timeline.current') : t('timeline.estimated')}
                          </span>
                        </div>
                        <div className="t-event-meta-sub">
                          <span className="t-time-text">{evt.dateStr}</span>
                          <span className="t-dot-sep">•</span>
                          <span className="t-location-text">{evt.location}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View Full Timeline Button */}
              <button
                type="button"
                className="view-full-timeline-action-btn"
                onClick={() => setShowEarlierEvents(!showEarlierEvents)}
              >
                <span>{showEarlierEvents ? t('timeline.hide') : t('timeline.show')}</span>
                <ChevronDown size={15} style={{ transform: showEarlierEvents ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </button>

              {/* Expanded Facility Scan Logs */}
              {showEarlierEvents && (
                <div className="timeline-extended-logs animate-fade-in">
                  <div className="extended-logs-header">
                    <span className="font-mono text-xs text-slate-500 font-bold uppercase tracking-wider">{t('timeline.allScans')}</span>
                  </div>
                  {eventsList.length === 0 && (
                    <div className="extended-scan-item">
                      <div className="scan-title">{t('timeline.none')}</div>
                    </div>
                  )}
                  {eventsList.map((evt, idx) => (
                    <div key={evt.id || idx} className="extended-scan-item">
                      <div className="scan-time font-mono">{evt.displayDate} · {evt.displayTime}</div>
                      <div className="scan-title">{eventTitleText(evt, locale)}{evt.city || evt.state ? ` · ${[evt.city, evt.state].filter(Boolean).join(', ')}` : ''}</div>
                      <div className="scan-facility text-xs text-slate-500">{evt.facility}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: STRUCTURED CARGO DETAILS */}
          <div className="content-col-details">
            {/* Cargo-Type-Specific Specifications — shown for the non-Vehicle types that
                have real, structured data of their own (Pets, Pallet, Container, Freight,
                Document). Vehicle no longer gets a photo gallery here (removed per request —
                no images on the public track result page), and Parcel/Multi-piece/
                unrecognized types get no extra card either, since the generic "Shipment
                Details" card below already covers everything relevant for them. */}
            {!isVehicle && isPet && pet && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">{t('pet.title')}</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <PawPrint size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('pet.name')}</small>
                      <strong>{pet.name || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Heart size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('pet.species')}</small>
                      <strong>{[pet.species, pet.breed].filter(Boolean).join(' — ') || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Scale size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('pet.weight')}</small>
                      <strong>{pet.weightLbs ? formatWeight(pet.weightLbs, unitSystem) : '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('pet.crate')}</small>
                      <strong>{pet.crateType || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <FileText size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('pet.microchip')}</small>
                      <strong className="font-mono">{pet.microchipNumber || '—'}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Stethoscope size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('pet.vet')}</small>
                      <strong>{pet.vetClinicName || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Pallet' && liveShipment?.palletDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">{t('pallet.title')}</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <Layers size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('pallet.standard')}</small>
                      <strong>{liveShipment.palletDetails.standard}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('pallet.count')}</small>
                      <strong>{liveShipment.palletDetails.count}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Scale size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('pallet.perSkid')}</small>
                      <strong>{formatWeight(liveShipment.palletDetails.weightPerSkidLbs, unitSystem)}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <ShieldCheck size={18} className="dtl-icon text-emerald" />
                    <div className="dtl-cell-content">
                      <small>{t('pallet.stackable')}</small>
                      <strong>{liveShipment.palletDetails.stackable ? t('handling.yes') : t('pallet.notStackable')}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Container' && liveShipment?.containerDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">{t('container.title')}</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <Container size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('container.number')}</small>
                      <strong className="font-mono">{liveShipment.containerDetails.containerNumber}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('container.size')}</small>
                      <strong>{liveShipment.containerDetails.isoSize}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Lock size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('container.seal')}</small>
                      <strong className="font-mono">{liveShipment.containerDetails.boltSeal}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Building2 size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('container.terminal')}</small>
                      <strong>{liveShipment.containerDetails.terminal}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Freight' && liveShipment?.freightDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">{t('freight.title')}</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <Truck size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('freight.class')}</small>
                      <strong>{liveShipment.freightDetails.freightClass}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <FileText size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('freight.nmfc')}</small>
                      <strong className="font-mono">{liveShipment.freightDetails.nmfcCode}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Box size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('freight.loading')}</small>
                      <strong>{liveShipment.freightDetails.loadingMethod}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <ShieldCheck size={18} className="dtl-icon text-emerald" />
                    <div className="dtl-cell-content">
                      <small>{t('freight.liftgate')}</small>
                      <strong>
                        {liveShipment.freightDetails.liftgatePickup && liveShipment.freightDetails.liftgateDelivery
                          ? t('freight.liftBoth')
                          : liveShipment.freightDetails.liftgateDelivery
                            ? t('freight.liftDelivery')
                            : liveShipment.freightDetails.liftgatePickup
                              ? t('freight.liftPickup')
                              : t('freight.liftNone')}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isVehicle && liveShipment?.shipmentType === 'Document' && liveShipment?.documentDetails && (
              <div className="shipment-details-spec-card">
                <h3 className="card-section-title">{t('document.title')}</h3>
                <div className="shipment-details-two-col-grid">
                  <div className="detail-cell">
                    <FileText size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('document.pouch')}</small>
                      <strong>{liveShipment.documentDetails.envelopeType}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Lock size={18} className="dtl-icon text-blue" />
                    <div className="dtl-cell-content">
                      <small>{t('document.seal')}</small>
                      <strong className="font-mono">{liveShipment.documentDetails.sealNumber}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <ShieldCheck size={18} className="dtl-icon text-emerald" />
                    <div className="dtl-cell-content">
                      <small>{t('document.signature')}</small>
                      <strong>{liveShipment.documentDetails.directSignOnly ? t('document.signDirect') : t('document.signStandard')}</strong>
                    </div>
                  </div>
                  <div className="detail-cell">
                    <Clock size={18} className="dtl-icon text-slate-500" />
                    <div className="dtl-cell-content">
                      <small>{t('document.deadline')}</small>
                      <strong>{liveShipment.documentDetails.urgentDeadline || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card 2: Shipment Details (2-Column Icon Grid) */}
            <div className="shipment-details-spec-card">
              <div className="ngf-heading-with-units">
                <h3 className="card-section-title">{t('details.title')}</h3>
                <UnitToggle />
              </div>
              <div className="shipment-details-two-col-grid">
                {/* Row 1 */}
                <div className="detail-cell">
                  <FileText size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>{t('details.trackingId')}</small>
                    <div className="tracking-with-copy">
                      <strong className="font-mono">{trackingNum}</strong>
                      <button
                        type="button"
                        onClick={handleCopyTrackingNumber}
                        className="inline-copy-btn"
                        title={t('summary.copy')}
                        aria-label={t('summary.copy')}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="detail-cell">
                  <MapPin size={18} className="dtl-icon text-blue" />
                  <div className="dtl-cell-content">
                    <small>{t('details.origin')}</small>
                    <strong>
                      {[originCity, originState].filter(Boolean).join(', ') || '—'}
                      <span className="gps-sub font-mono">
                        ({Number(routeCheckpoints[0].lat).toFixed(4)}, {Number(routeCheckpoints[0].lng).toFixed(4)})
                      </span>
                    </strong>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="detail-cell">
                  <Car size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>{t('details.cargo')}</small>
                    <strong>{cargoDescription}</strong>
                  </div>
                </div>

                <div className="detail-cell">
                  <MapPin size={18} className="dtl-icon text-blue" />
                  <div className="dtl-cell-content">
                    <small>{t('details.destination')}</small>
                    <strong>
                      {[destCity, destState].filter(Boolean).join(', ') || '—'}
                      <span className="gps-sub font-mono">
                        ({Number(routeCheckpoints[2].lat).toFixed(4)}, {Number(routeCheckpoints[2].lng).toFixed(4)})
                      </span>
                    </strong>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="detail-cell">
                  <Scale size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>{t('details.weight')}</small>
                    <strong>{totalWeightText}</strong>
                  </div>
                </div>

                <div className="detail-cell">
                  <Package size={18} className="dtl-icon text-blue" />
                  <div className="dtl-cell-content">
                    <small>{t('details.service')}</small>
                    <strong>{service}</strong>
                  </div>
                </div>

                {/* Row 4 */}
                <div className="detail-cell">
                  <Box size={18} className="dtl-icon text-slate-500" />
                  <div className="dtl-cell-content">
                    <small>{t('details.dimensions')}</small>
                    <strong>{dimensionsText || '—'}</strong>
                  </div>
                </div>

                <div className="detail-cell">
                  <ShieldCheck size={18} className="dtl-icon text-emerald" />
                  <div className="dtl-cell-content">
                    <small>{t('details.status')}</small>
                    <strong className="status-highlight text-emerald">
                      <span className="mini-green-pulse" />
                      {statusDisplayLabel}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Pieces (CONTENT §6.3) — each piece label travels with the shipment. */}
            {(liveShipment?.pieces?.length ?? 0) > 0 && (
              <MultiPieceList
                pieces={liveShipment.pieces}
                statusLabel={statusDisplayLabel}
                locationText={currentLocationText}
              />
            )}

            {/* Card 3: Shipment Parties (Side-by-side Sender and Recipient) */}
            <div className="shipment-parties-card">
              <h3 className="card-section-title">{t('parties.title')}</h3>
              <div className="parties-two-col-layout">
                {/* Sender */}
                <div className="party-box sender-box">
                  <div className="party-header-tag">
                    <User size={15} className="text-blue" />
                    <span>{t('parties.from')}</span>
                  </div>
                  <h4 className="party-name">{senderName}</h4>
                  {senderCompany && <p className="party-company">{senderCompany}</p>}
                  {senderAddress && <p className="party-address">{senderAddress}</p>}
                  <p className="party-city-state">{[originCity, originState].filter(Boolean).join(', ')}{originZip ? ` ${originZip}` : ''}</p>
                  {senderPhone && (
                    <a href={`tel:${senderPhone.replace(/[^0-9+]/g, '')}`} className="party-phone-link font-mono">
                      <Phone size={13} />
                      <span>{senderPhone}</span>
                    </a>
                  )}
                  {senderEmail && (
                    <a href={`mailto:${senderEmail}`} className="party-email-link font-mono">
                      <Mail size={13} />
                      <span>{senderEmail}</span>
                    </a>
                  )}
                </div>

                {/* Recipient */}
                <div className="party-box recipient-box">
                  <div className="party-header-tag">
                    <User size={15} className="text-blue" />
                    <span>{t('parties.to')}</span>
                  </div>
                  <h4 className="party-name">{recipientName}</h4>
                  {recipientCompany && <p className="party-company">{recipientCompany}</p>}
                  {recipientAddress && <p className="party-address">{recipientAddress}</p>}
                  <p className="party-city-state">{[destCity, destState].filter(Boolean).join(', ')}{destZip ? ` ${destZip}` : ''}</p>
                  {recipientPhone && (
                    <a href={`tel:${recipientPhone.replace(/[^0-9+]/g, '')}`} className="party-phone-link font-mono">
                      <Phone size={13} />
                      <span>{recipientPhone}</span>
                    </a>
                  )}
                  {recipientEmail && (
                    <a href={`mailto:${recipientEmail}`} className="party-email-link font-mono">
                      <Mail size={13} />
                      <span>{recipientEmail}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Special Handling — reads the real handlingRequirements this shipment
                was created with. This used to be three literal JSX strings ("Fragile: No",
                "Signature Required: Yes") that showed the same values for every shipment
                regardless of what was actually set, and never surfaced `oversized` at all. */}
            <div className="special-handling-card">
              <h3 className="card-section-title">{t('handling.title')}</h3>
              <div className="handling-items-row">
                <div className="handling-pill">
                  <span className="h-label">{t('handling.fragile')}</span>
                  <strong className={`h-val ${liveShipment?.handlingRequirements?.fragile ? 'text-amber' : ''}`}>
                    {liveShipment?.handlingRequirements?.fragile ? t('handling.yes') : t('handling.no')}
                  </strong>
                </div>
                <div className="handling-pill">
                  <span className="h-label">{t('handling.signature')}</span>
                  <strong className={`h-val ${liveShipment?.handlingRequirements?.signatureRequired ? 'text-emerald' : ''}`}>
                    {liveShipment?.handlingRequirements?.signatureRequired ? t('handling.yes') : t('handling.no')}
                  </strong>
                </div>
                {liveShipment?.handlingRequirements?.oversized && (
                  <div className="handling-pill">
                    <span className="h-label">{t('handling.oversized')}</span>
                    <strong className="h-val text-amber">{t('handling.yes')}</strong>
                  </div>
                )}
              </div>
              {liveShipment?.handlingRequirements?.otherInstructions && (
                <p className="text-xs text-slate-500" style={{ marginTop: '0.5rem' }}>{liveShipment.handlingRequirements.otherInstructions}</p>
              )}
            </div>

          </div>
        </section>

        {/* =========================================================================
            4. NEED HELP? (CONTENT §6.3 / §6.4)
            ========================================================================= */}
        <section className="ngf-help-banner-card">
          <div className="help-banner-left">
            <div>
              <h3>{t('help.title')}</h3>
              <p>{t('help.body')}</p>
            </div>
          </div>

          <div className="help-banner-actions">
            {supportPhone && (
              <a href={phoneHref} className="help-btn phone-btn accent-dispatch-btn">
                <Phone size={15} />
                <span>{supportPhone}</span>
              </a>
            )}
            <button className="help-btn contact-btn" onClick={() => setSupportOpen(true)} type="button">
              <Headphones size={15} />
              <span>{t('help.contact')}</span>
            </button>
          </div>
        </section>
      </div>

      {/* Support Dialog */}
      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        initialTrackingNumber={trackingNum}
      />
    </div>
  );
};
