import React, { useState } from 'react';
import {
  Radio,
  Search,
  CheckCircle2,
  MapPin,
  Clock,
  Send,
  AlertTriangle,
  Plus,
  Copy,
  Check,
  Edit3,
  Eye,
  Calendar,
  Lock,
  X,
  AlertCircle,
  Truck,
  Package
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { Shipment, ShipmentStatus, TrackingEvent } from '../../types/shipment';
import { AdminViewType } from '../AdminLayout';
import { resolveLocation, resolveLocationPrecise } from '../../services/geocodingService';
import './TrackingEventsView.css';
import { ADMIN_ROLE_LABEL, COMPANY_SHORT, displayOperator } from '../../config/brand';
import { NETWORK_POINTS } from '../../data/gateways';
import { WeightText } from '../../components/forms/UnitControls';
import { formatInZone, isValidTimeZone, timeZoneForPlace, utcOffsetLabel, zonedTimeToUtc } from '../../shared/timeZones';
import { SHIPMENT_STATUS_OPTIONS, knownStatusLabel, shipmentStatusLabel } from '../../shared/shipmentStatus';
import { TRACKING_EVENTS_VIEW_TEXT as TXT } from './TrackingEventsView.text';

// Preset event locations: TanEx locations and the gateways (CONTENT §9), each with its IANA time
// zone. TanEx offices and delivery cities are named as TanEx's; gateways keep "City Gateway (CODE)".
const NETWORK_LOCATIONS = NETWORK_POINTS.map((g) => ({
  city: g.city,
  state: g.iso,
  timezone: g.timeZone,
  facility: g.kind === 'tanex' && g.code !== 'DLA' ? `${COMPANY_SHORT} ${g.name}` : `${g.city} Gateway (${g.code})`
}));

// Time zones offered for an event's local time: every gateway zone, plus a few others and UTC.
const EVENT_TIME_ZONES = Array.from(new Set([
  ...NETWORK_POINTS.map((g) => g.timeZone),
  'America/Denver',
  'America/Phoenix',
  'UTC'
]));

const timeZoneOptionLabel = (tz: string) => `${tz.replace(/_/g, ' ')} (${utcOffsetLabel(tz)})`;

// "August 20, 2026" / "Sep 28, 2026" / "2026-09-28" -> "2026-09-28", or null.
const toIsoDate = (text: string): string | null => {
  const trimmed = (text || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(`${trimmed} 12:00`);
  if (isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

// Customer-facing message pre-filled for each status (editable before saving). Keys are the
// status codes in SHIPMENT_STATUS_OPTIONS (names from CONTENT §6.3).
const MESSAGE_TEMPLATES: Record<string, string> = {
  BOOKED: 'Shipment booked and waybill registered.',
  RECEIVED: `Shipment collected and received into the ${COMPANY_SHORT} network.`,
  PROCESSING: 'Your shipment is at our origin gateway and is being prepared for departure.',
  DEPARTED_FACILITY: 'Your shipment has departed and is on its way to the next gateway.',
  IN_TRANSIT: 'Your shipment is in transit to its destination gateway.',
  DESTINATION_PROCESSING: 'Your shipment has arrived at the destination gateway.',
  CUSTOMS_CLEARANCE: 'Your shipment is going through customs clearance.',
  OUT_FOR_DELIVERY: 'Your shipment is out for delivery with our courier.',
  DELIVERED: 'Your shipment has been delivered and signed for.',
  ON_HOLD: 'Your shipment is temporarily on hold.',
  DELAYED: 'Your shipment has been delayed. The estimated delivery has been updated.',
  RETURNED: 'Your shipment is being returned to the sender.'
};

// Helper: Format Date & Time helpers for input fields
const getTodayDateStr = () => new Date().toISOString().split('T')[0];
const getCurrentTimeStr = () => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  return strTime;
};

// Safe Location Formatter Helper
const formatLocationStr = (loc: any): string => {
  if (!loc) return 'In Transit';
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object') {
    const city = loc.city || loc.name || '';
    const state = loc.state || '';
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (loc.facility) return loc.facility;
  }
  return 'In Transit Hub';
};

// Color Theme Helper for Event Statuses. Status codes show their CONTENT §6.3 name.
const getEventTheme = (statusStr?: string, title?: string) => {
  const theme = getEventColors(statusStr, title);
  const name = knownStatusLabel(statusStr);
  return name ? { ...theme, label: name.toUpperCase() } : theme;
};

const getEventColors = (statusStr?: string, title?: string) => {
  const s = (statusStr || title || '').toUpperCase();
  if (s.includes('DELIVERED')) {
    return { color: '#16a34a', bg: '#f0fdf4', border: '#86efac', text: '#166534', label: TXT.delivered2, theme: 'theme-delivered' };
  }
  if (s.includes('OUT_FOR_DELIVERY') || s.includes('OUT FOR DELIVERY')) {
    return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: TXT.outForDelivery2, theme: 'theme-out-for-delivery' };
  }
  if (s.includes('DELAY') || s.includes('EXCEPTION') || s.includes('WEATHER')) {
    return { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: TXT.delayException, theme: 'theme-delay' };
  }
  if (s.includes('HOLD') || s.includes('RETURN')) {
    return { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: TXT.onHold, theme: 'theme-hold' };
  }
  if (s.includes('PROCESSING') || s.includes('SORT') || s.includes('CUSTOMS')) {
    return { color: 'var(--tx-cat-violet-600)', bg: 'var(--tx-cat-violet-50)', border: 'var(--tx-cat-violet-200)', text: 'var(--tx-cat-violet-700)', label: TXT.processing, theme: 'theme-processing' };
  }
  if (s.includes('DEPARTED') || s.includes('IN_TRANSIT')) {
    return { color: 'var(--tx-cat-sky-600)', bg: 'var(--tx-cat-sky-50)', border: 'var(--tx-cat-sky-300)', text: 'var(--tx-cat-sky-700)', label: TXT.departed, theme: 'theme-departed' };
  }
  if (s.includes('ARRIVED')) {
    return { color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', label: TXT.arrived, theme: 'theme-arrived' };
  }
  if (s.includes('RECEIVED')) {
    return { color: 'var(--tx-cat-teal-600)', bg: 'var(--tx-cat-teal-50)', border: 'var(--tx-cat-teal-200)', text: 'var(--tx-cat-teal-800)', label: TXT.received, theme: 'theme-received' };
  }
  return { color: 'var(--tx-choc-600)', bg: 'var(--tx-cream-100)', border: 'var(--tx-choc-200)', text: 'var(--tx-choc-700)', label: TXT.shipmentCreated, theme: 'theme-created' };
};

interface TrackingEventsViewProps {
  onSelectView?: (view: AdminViewType) => void;
}

export const TrackingEventsView: React.FC<TrackingEventsViewProps> = ({ onSelectView }) => {
  const { shipments, addTrackingEvent, updateShipmentStatus, correctTrackingEvent } = useAdminData();

  // Active shipment selection (defaults to the first shipment)
  const [selectedTracking, setSelectedTracking] = useState<string>(
    shipments[0]?.trackingNumber || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState<boolean>(false);
  const [inspectEvent, setInspectEvent] = useState<TrackingEvent | null>(null);
  const [correctingEvent, setCorrectingEvent] = useState<TrackingEvent | null>(null);

  // Form State: Add Tracking Event (Fully Editable Date & Time!)
  const [formEventStatus, setFormEventStatus] = useState<string>('IN_TRANSIT');
  const [formLocationIndex, setFormLocationIndex] = useState<number>(0);
  const [formCustomLocation, setFormCustomLocation] = useState<string>('');
  const [formFacility, setFormFacility] = useState<string>(NETWORK_LOCATIONS[0].facility);
  const [formCustomerMessage, setFormCustomerMessage] = useState<string>(MESSAGE_TEMPLATES.IN_TRANSIT);
  const [formInternalNote, setFormInternalNote] = useState<string>('Shipment arrived after scheduled departure. Processing for next available movement.');
  const [formDelayReason, setFormDelayReason] = useState<string>('Weather-related transportation delay');
  const [formEventDate, setFormEventDate] = useState<string>(getTodayDateStr());
  const [formEventTime, setFormEventTime] = useState<string>(getCurrentTimeStr());
  const [formTimezone, setFormTimezone] = useState<string>(NETWORK_LOCATIONS[0].timezone);

  // Form State: Correct / Edit Event (Fully Editable Date & Time!)
  const [correctedLocation, setCorrectedLocation] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('Location was incorrectly recorded during barcode scan.');
  const [correctedCustomerMessage, setCorrectedCustomerMessage] = useState<string>('');
  const [correctedEventDate, setCorrectedEventDate] = useState<string>('');
  const [correctedEventTime, setCorrectedEventTime] = useState<string>('');
  const [correctedTimezone, setCorrectedTimezone] = useState<string>('UTC');

  const currentShipment: Shipment | undefined = shipments.find(
    s => s.trackingNumber.toUpperCase() === selectedTracking.toUpperCase()
  );

  const timelineEvents: TrackingEvent[] = currentShipment
    ? (currentShipment.timeline || (currentShipment as any).events || [])
    : [];

  // Snapshot KPIs — gives this page the same at-a-glance stat row as the other admin
  // screens, using metrics relevant to scanning/logging tracking events specifically.
  const inTransitCount = shipments.filter(s =>
    s.status === 'IN_TRANSIT' || s.status === 'OUT_FOR_DELIVERY'
  ).length;
  const totalEventsLogged = shipments.reduce((acc, s) => {
    const events = s.timeline || (s as any).events || [];
    return acc + events.length;
  }, 0);
  const delayedCount = shipments.filter(s =>
    s.status === 'HELD' || s.status === 'EXCEPTION' || s.status === 'ON_HOLD' || s.status === 'DELAYED' || Boolean(s.delayNotice?.hasDelay)
  ).length;

  // Auto-update message template when status changes in Add modal
  const handleStatusChange = (newStatus: string) => {
    setFormEventStatus(newStatus);
    if (MESSAGE_TEMPLATES[newStatus]) {
      setFormCustomerMessage(MESSAGE_TEMPLATES[newStatus]);
    }
  };

  // Auto-update facility & timezone when location selection changes
  const handleLocationChange = (idx: number) => {
    setFormLocationIndex(idx);
    if (idx < NETWORK_LOCATIONS.length) {
      const loc = NETWORK_LOCATIONS[idx];
      setFormFacility(loc.facility);
      setFormTimezone(loc.timezone);
    }
  };

  // Search Filter
  const filteredShipments = shipments.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.trackingNumber.toLowerCase().includes(q) ||
      s.sender.name.toLowerCase().includes(q) ||
      s.recipient.name.toLowerCase().includes(q) ||
      (s.cargoDescription && s.cargoDescription.toLowerCase().includes(q)) ||
      (s.references?.customerReference && s.references.customerReference.toLowerCase().includes(q))
    );
  });

  const handleCopyTracking = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Submit New Tracking Event (With Custom Date & Time)
  const handleAddEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShipment || isSubmittingEvent) return;
    setIsSubmittingEvent(true);

    const isCustom = formLocationIndex === NETWORK_LOCATIONS.length;
    const locCity = isCustom
      ? formCustomLocation.split(',')[0]?.trim() || 'Custom Gateway'
      : NETWORK_LOCATIONS[formLocationIndex].city;
    const locState = isCustom
      ? formCustomLocation.split(',')[1]?.trim() || ''
      : NETWORK_LOCATIONS[formLocationIndex].state;

    // The 8 preset network locations are all major metros already covered instantly by the
    // offline table; a custom-typed location is the case that actually needs the live
    // geocoding fallback, since it could be any town in the country.
    const locGeo = isCustom
      ? await resolveLocationPrecise(formCustomLocation)
      : resolveLocation(`${locCity}, ${locState}`);

    // The event's instant from the entered local date + time in the chosen zone. The server
    // stores the instant and zone and shows local time + UTC offset.
    const eventZone = isValidTimeZone(formTimezone) ? formTimezone : 'UTC';
    const occurredAtTs = zonedTimeToUtc(formEventDate, formEventTime, eventZone) ?? Date.now();
    const local = formatInZone(occurredAtTs, eventZone);

    // The event's status is the shipment's new status (the options are the status codes).
    const mappedShipmentStatus = (SHIPMENT_STATUS_OPTIONS.some(o => o.value === formEventStatus)
      ? formEventStatus
      : 'IN_TRANSIT') as ShipmentStatus;
    const eventTitle = shipmentStatusLabel(mappedShipmentStatus);

    const newEvent: TrackingEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date(occurredAtTs).toISOString(),
      occurredAt: new Date(occurredAtTs).toISOString(),
      timezone: eventZone,
      utcOffset: local.utcOffset,
      displayDate: local.displayDate,
      displayTime: local.displayTime,
      title: eventTitle,
      status: mappedShipmentStatus,
      eventStatus: formEventStatus,
      location: `${locCity}, ${locState}`,
      facility: formFacility || `${locCity} Gateway`,
      city: locCity,
      state: locState,
      description: formCustomerMessage,
      internalNote: formInternalNote,
      recordedBy: ADMIN_ROLE_LABEL,
      operatorId: ADMIN_ROLE_LABEL,
      isCurrent: true,
      isCompleted: true
    };

    // addTrackingEvent already recorded the real event (with this exact title/description)
    // both locally and server-side — this follow-up call exists only to sync the shipment's
    // status/progress/location fields, so it must not create a second, near-identical event
    // on top of the one just added (it used to, making every "Record Event" submission
    // produce two almost-duplicate timeline rows).
    addTrackingEvent(currentShipment.trackingNumber, newEvent);
    updateShipmentStatus(
      currentShipment.trackingNumber,
      mappedShipmentStatus,
      `${locCity}, ${locState}`,
      formFacility,
      formCustomerMessage,
      undefined,
      eventTitle,
      locGeo?.lat,
      locGeo?.lng,
      undefined,
      true, // skipLocalEventDuplicate
      true  // skipServerEventCreation
    );

    setShowAddModal(false);
    setIsSubmittingEvent(false);
    setSuccessToast(TXT.trackingEventRecordedForCurrent(newEvent.title, currentShipment.trackingNumber, locCity, locState));
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Submit Event Correction & Time Edit (Preserving Audit Trail)
  const handleCorrectEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingEvent || !currentShipment) return;

    const originalLocation = `${correctingEvent.city}, ${correctingEvent.state}`;
    const originalTime = `${correctingEvent.displayDate} — ${correctingEvent.displayTime}`;
    const newCity = correctedLocation.split(',')[0]?.trim() || correctingEvent.city;
    const newState = correctedLocation.split(',')[1]?.trim() || correctingEvent.state;

    const correctedZone = isValidTimeZone(correctedTimezone) ? correctedTimezone : 'UTC';
    const correctedIsoDate = toIsoDate(correctedEventDate || correctingEvent.displayDate);
    const correctedTs = correctedIsoDate && correctedEventTime
      ? zonedTimeToUtc(correctedIsoDate, correctedEventTime, correctedZone)
      : null;
    const correctedLocal = correctedTs !== null ? formatInZone(correctedTs, correctedZone) : null;

    correctTrackingEvent(currentShipment.trackingNumber, correctingEvent.id, {
      city: newCity,
      state: newState,
      displayDate: correctedLocal?.displayDate || correctedEventDate || correctingEvent.displayDate,
      displayTime: correctedLocal?.displayTime || correctingEvent.displayTime,
      ...(correctedTs !== null ? { occurredAt: new Date(correctedTs).toISOString(), utcOffset: correctedLocal?.utcOffset } : {}),
      timezone: correctedZone,
      description: correctedCustomerMessage || correctingEvent.description,
      correctionAudit: {
        originalLocation: `${originalLocation} (${originalTime})`,
        originalTitle: correctingEvent.title,
        reason: correctionReason,
        correctedAt: new Date().toLocaleDateString('en-US') + ' ' + new Date().toLocaleTimeString('en-US'),
        operator: ADMIN_ROLE_LABEL
      }
    });

    setCorrectingEvent(null);
    setSuccessToast(TXT.eventCorrectedAndAuditLog);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="tx-tracking-events-workspace animate-fade-in">
      {successToast && (
        <div className="tracking-toast-success animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 1. PAGE HEADER */}
      <div className="tracking-page-header">
        <div className="header-title-block">
          <h2>{TXT.trackingEvents}</h2>
          <p>{TXT.manageShipmentStatusLocationAnd}</p>
        </div>

        {/* Search Input Box */}
        <div className="tracking-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="tracking-search-input font-mono"
            placeholder={TXT.searchTrackingSenderRecipientCity}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. SNAPSHOT KPI ROW (matches Dashboard / Shipments visual language) */}
      <div className="tev-kpi-row">
        <div className="tev-kpi-card">
          <div className="tev-card-header">
            <div className="tev-circle-icon accent">
              <Package size={15} />
            </div>
            <span className="tev-card-label">{TXT.trackableShipments}</span>
          </div>
          <strong className="tev-card-number">{shipments.length}</strong>
          <span className="tev-card-subtext">{TXT.availableInTheScanner}</span>
        </div>

        <div className="tev-kpi-card">
          <div className="tev-card-header">
            <div className="tev-circle-icon blue">
              <Truck size={15} />
            </div>
            <span className="tev-card-label">{TXT.inTransitNow}</span>
          </div>
          <strong className="tev-card-number">{inTransitCount}</strong>
          <span className="tev-card-subtext">{TXT.activelyMoving}</span>
        </div>

        <div className="tev-kpi-card">
          <div className="tev-card-header">
            <div className="tev-circle-icon emerald">
              <Radio size={15} />
            </div>
            <span className="tev-card-label">{TXT.eventsLogged}</span>
          </div>
          <strong className="tev-card-number">{totalEventsLogged}</strong>
          <span className="tev-card-subtext">{TXT.totalCheckpointScans}</span>
        </div>

        <div className="tev-kpi-card">
          <div className="tev-card-header">
            <div className={`tev-circle-icon ${delayedCount > 0 ? 'red' : 'green'}`}>
              <AlertTriangle size={15} />
            </div>
            <span className="tev-card-label">{TXT.delayedHeld}</span>
          </div>
          <strong className="tev-card-number">{delayedCount}</strong>
          <span className="tev-card-subtext">{delayedCount > 0 ? TXT.needsAttention : TXT.allClear}</span>
        </div>
      </div>

      {/* 3. QUICK SCENARIO SELECTOR PILLS */}
      {shipments.length > 0 && (
        <div className="shipment-quick-pills-bar">
          <span className="pills-label">{TXT.quickSelect}</span>
          {filteredShipments.length === 0 ? (
            <span className="pills-label" style={{ fontStyle: 'italic' }}>{TXT.noShipmentsMatch}{searchQuery}".</span>
          ) : (
            filteredShipments.slice(0, 5).map(s => {
              const isSelected = s.trackingNumber.toUpperCase() === selectedTracking.toUpperCase();
              const theme = getEventTheme(s.status, s.statusText);
              return (
                <button
                  key={s.trackingNumber}
                  className={`shipment-quick-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedTracking(s.trackingNumber)}
                >
                  <span className="quick-pill-dot" style={{ backgroundColor: theme.color }} />
                  <strong>{s.trackingNumber}</strong>
                  <span>({s.sender.name} → {s.recipient.name})</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* 4. ACTIVE SHIPMENT STATE & IDENTITY BANNER */}
      {currentShipment ? (
        <div className="active-shipment-identity-panel">
          <div className="identity-panel-left">
            <div className="tracking-code-row">
              <span className="shipment-waybill-id font-mono">{currentShipment.trackingNumber}</span>
              <button
                className="copy-waybill-btn"
                onClick={() => handleCopyTracking(currentShipment.trackingNumber)}
                title={TXT.copyTrackingNumber}
              >
                {copiedId === currentShipment.trackingNumber ? (
                  <Check size={14} className="text-emerald" />
                ) : (
                  <Copy size={14} />
                )}
                <span>{copiedId === currentShipment.trackingNumber ? TXT.copied : TXT.copy}</span>
              </button>
            </div>

            {/* Traditional Code 128 Barcode Simulation (NO QR CODE) */}
            <div className="traditional-barcode-strip">
              <svg className="code128-barcode-svg" viewBox="0 0 260 36">
                <rect x="5" y="2" width="3" height="32" fill="#000000" />
                <rect x="11" y="2" width="2" height="32" fill="#000000" />
                <rect x="16" y="2" width="4" height="32" fill="#000000" />
                <rect x="23" y="2" width="2" height="32" fill="#000000" />
                <rect x="28" y="2" width="5" height="32" fill="#000000" />
                <rect x="36" y="2" width="3" height="32" fill="#000000" />
                <rect x="42" y="2" width="4" height="32" fill="#000000" />
                <rect x="49" y="2" width="2" height="32" fill="#000000" />
                <rect x="54" y="2" width="6" height="32" fill="#000000" />
                <rect x="63" y="2" width="3" height="32" fill="#000000" />
                <rect x="69" y="2" width="4" height="32" fill="#000000" />
                <rect x="76" y="2" width="5" height="32" fill="#000000" />
                <rect x="84" y="2" width="2" height="32" fill="#000000" />
                <rect x="89" y="2" width="5" height="32" fill="#000000" />
                <rect x="97" y="2" width="3" height="32" fill="#000000" />
                <rect x="103" y="2" width="6" height="32" fill="#000000" />
                <rect x="112" y="2" width="2" height="32" fill="#000000" />
                <rect x="117" y="2" width="5" height="32" fill="#000000" />
                <rect x="125" y="2" width="3" height="32" fill="#000000" />
                <rect x="131" y="2" width="6" height="32" fill="#000000" />
                <rect x="140" y="2" width="3" height="32" fill="#000000" />
                <rect x="146" y="2" width="4" height="32" fill="#000000" />
                <rect x="153" y="2" width="5" height="32" fill="#000000" />
                <rect x="161" y="2" width="2" height="32" fill="#000000" />
                <rect x="166" y="2" width="6" height="32" fill="#000000" />
                <rect x="175" y="2" width="3" height="32" fill="#000000" />
                <rect x="181" y="2" width="4" height="32" fill="#000000" />
                <rect x="188" y="2" width="5" height="32" fill="#000000" />
                <rect x="196" y="2" width="2" height="32" fill="#000000" />
                <rect x="201" y="2" width="6" height="32" fill="#000000" />
                <rect x="210" y="2" width="4" height="32" fill="#000000" />
                <rect x="217" y="2" width="2" height="32" fill="#000000" />
                <rect x="222" y="2" width="5" height="32" fill="#000000" />
                <rect x="230" y="2" width="3" height="32" fill="#000000" />
                <rect x="236" y="2" width="6" height="32" fill="#000000" />
                <rect x="245" y="2" width="4" height="32" fill="#000000" />
              </svg>
              <span className="barcode-caption font-mono">{currentShipment.trackingNumber}</span>
            </div>

            {/* Shipment Context: Parties, Cargo, Route */}
            <div className="shipment-meta-summary">
              <div className="meta-pair">
                <span className="m-label">{TXT.parties}</span>
                <strong>{currentShipment.sender?.name || TXT.sender} → {currentShipment.recipient?.name || TXT.recipient}</strong>
              </div>
              <div className="meta-pair">
                <span className="m-label">{TXT.cargo}</span>
                <strong>{currentShipment.cargoDescription || currentShipment.shipmentType} (<WeightText lbs={currentShipment.totalWeightLbs} />)</strong>
              </div>
              <div className="meta-pair">
                <span className="m-label">{TXT.route}</span>
                <strong>{formatLocationStr(currentShipment.origin)} → {formatLocationStr(currentShipment.destination)}</strong>
              </div>
            </div>
          </div>

          <div className="identity-panel-right">
            <div className="current-state-card">
              <div className="state-badge-row">
                <span className="state-tag-label">{TXT.currentStatus}</span>
                <span className={`status-pill ${currentShipment.status.toLowerCase().replace(/_/g, '-')}`}>
                  {shipmentStatusLabel(currentShipment.status)}
                </span>
              </div>

              <div className="state-badge-row">
                <span className="state-tag-label">{TXT.currentLocation}</span>
                <strong className="current-loc-val">
                  <MapPin size={15} className="text-blue" />
                  {formatLocationStr(currentShipment.currentLocation)}
                </strong>
              </div>

              <div className="state-badge-row">
                <span className="state-tag-label">{TXT.lastRecordedMilestone}</span>
                <span className="last-upd-val font-mono">{currentShipment.lastUpdated}</span>
              </div>

              <button
                className="add-event-primary-btn"
                onClick={() => {
                  setFormEventStatus('IN_TRANSIT');
                  setFormCustomerMessage(MESSAGE_TEMPLATES.IN_TRANSIT);
                  setFormEventDate(getTodayDateStr());
                  setFormEventTime(getCurrentTimeStr());
                  setShowAddModal(true);
                }}
              >
                <Plus size={16} />
                <span>{TXT.addTrackingEvent}</span>
              </button>
            </div>
          </div>
        </div>
      ) : shipments.length === 0 ? (
        <div className="no-shipment-selected-card">
          <Package size={32} className="text-slate" />
          <h3>{TXT.noShipmentsToScanYet}</h3>
          <p>{TXT.createAShipmentFirstThen}</p>
          {onSelectView && (
            <button className="tev-empty-cta" onClick={() => onSelectView('create-shipment')}>
              <Plus size={15} />
              <span>{TXT.newShipment}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="no-shipment-selected-card">
          <AlertCircle size={32} className="text-slate" />
          <h3>{TXT.noShipmentFound}</h3>
          <p>{TXT.pleaseEnterAValidTracking}</p>
        </div>
      )}

      {/* 5. MAIN VERTICAL CHRONOLOGICAL TIMELINE (CENTERPIECE WITH RICH COLORS) */}
      {currentShipment && (
        <div className="tracking-timeline-deck">
          <div className="timeline-deck-header">
            <div className="timeline-title-wrap">
              <h3>{TXT.chronologicalTrackingHistory}</h3>
              <p>{TXT.appendOnlyAuditTrailEvery}</p>
            </div>
            <div className="timeline-legend-row">
              <span className="legend-chip color-arrived">{TXT.inTransitArrived}</span>
              <span className="legend-chip color-delivered">{TXT.delivered}</span>
              <span className="legend-chip color-out">{TXT.outForDelivery}</span>
              <span className="legend-chip color-delayed">{TXT.delayedOnHold}</span>
            </div>
          </div>

          <div className="vertical-timeline-flow">
            {timelineEvents.map((event, index) => {
              const isLatest = index === 0;
              const theme = getEventTheme(event.eventStatus, event.title);

              return (
                <div
                  key={event.id}
                  className={`timeline-event-node ${isLatest ? 'latest-current' : ''} ${theme.theme}`}
                >
                  {/* Spine Connector Line */}
                  <div className="timeline-spine">
                    <div
                      className={`node-marker ${isLatest ? 'pulse-active' : ''}`}
                      style={{
                        borderColor: theme.color,
                        backgroundColor: theme.bg
                      }}
                    >
                      <div className="inner-dot" style={{ backgroundColor: theme.color }} />
                    </div>
                    {index < timelineEvents.length - 1 && <div className="spine-connector-line" />}
                  </div>

                  {/* Event Content Card with Left Color Accent Ribbon */}
                  <div
                    className="timeline-card-content"
                    style={{
                      borderLeft: `4px solid ${theme.color}`
                    }}
                  >
                    <div className="event-card-head">
                      <div className="event-head-left">
                        <span
                          className="event-status-pill"
                          style={{
                            backgroundColor: theme.bg,
                            color: theme.text,
                            borderColor: theme.border
                          }}
                        >
                          {event.title.toUpperCase()}
                        </span>
                        <strong className="event-location-title">
                          <MapPin size={14} style={{ color: theme.color }} />
                          {event.city}, {event.state}
                        </strong>
                        <span className="event-facility-sub font-mono">• {event.facility}</span>
                      </div>

                      <div className="event-head-right">
                        <div className="event-timestamp font-mono">
                          <Clock size={13} style={{ color: theme.color }} />
                          <span>{event.displayDate} — {event.displayTime}</span>
                        </div>
                        <div className="event-actions-group">
                          <button
                            className="event-action-icon-btn"
                            title={TXT.inspectFullDetails}
                            onClick={() => setInspectEvent(event)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="event-action-icon-btn"
                            title={TXT.editCorrectThisEventChange}
                            onClick={() => {
                              setCorrectingEvent(event);
                              setCorrectedLocation(`${event.city}, ${event.state}`);
                              setCorrectedCustomerMessage(event.description);
                              setCorrectedEventDate(event.displayDate);
                              setCorrectedEventTime(event.displayTime.match(/\d{1,2}:\d{2}\s*[AaPp][Mm]/)?.[0] || event.displayTime);
                              setCorrectedTimezone(isValidTimeZone(event.timezone) ? event.timezone : timeZoneForPlace({ city: event.city, state: event.state }));
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Customer-Facing Tracking Message */}
                    <div className="customer-facing-box">
                      <span className="box-tag-label" style={{ color: theme.text }}>{TXT.customerFacingMessage2}</span>
                      <p className="customer-msg-text">"{event.description}"</p>
                    </div>

                    {/* Internal Operational Note (Admin Only) */}
                    {event.internalNote && (
                      <div className="internal-admin-note-box">
                        <div className="note-head">
                          <Lock size={12} className="text-amber" />
                          <span className="note-label">{TXT.internalOperationalNotePrivate}</span>
                        </div>
                        <p className="note-text">{event.internalNote}</p>
                      </div>
                    )}

                    {/* Correction Audit Badge if Event was Corrected */}
                    {event.correctionAudit && (
                      <div className="correction-audit-banner">
                        <AlertTriangle size={13} className="text-amber" />
                        <span>
                          <strong>{TXT.editedCorrected}</strong> {TXT.formerly} {event.correctionAudit.originalLocation} {TXT.by} {displayOperator(event.correctionAudit.operator)}{TXT.reason} {event.correctionAudit.reason}
                        </span>
                      </div>
                    )}

                    {/* Provenance Footer */}
                    <div className="event-provenance-footer">
                      <span>{TXT.recordedBy} <strong>{displayOperator(event.recordedBy)}</strong></span>
                      <span>{TXT.auditMilestoneId} <code className="font-mono">{event.id}</code></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==========================================================================
          5. MODAL: ADD TRACKING EVENT (WITH EDITABLE DATE & TIME)
          ========================================================================== */}
      {showAddModal && currentShipment && (
        <div className="tracking-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="tracking-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="m-title-block">
                <h3>{TXT.recordTrackingEvent}</h3>
                <p>{TXT.shipment} <strong className="font-mono">{currentShipment.trackingNumber}</strong> ({currentShipment.cargoDescription || currentShipment.shipmentType})</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="modal-form-content">
              {/* Event Status Dropdown */}
              <div className="form-group-unit">
                <label>{TXT.eventStatus}</label>
                <select
                  value={formEventStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="modal-select-input"
                >
                  {SHIPMENT_STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* DATE & TIME (NOW FULLY EDITABLE!) */}
              <div className="form-group-unit datetime-editor-box">
                <label className="datetime-box-label">
                  <Calendar size={14} className="text-blue" />
                  <span>{TXT.eventDateTimeEditable}</span>
                </label>
                <div className="input-grid-3">
                  <div className="input-field">
                    <label style={{ fontSize: '0.68rem', color: 'var(--tx-choc-600)' }}>{TXT.date}</label>
                    <input
                      type="date"
                      value={formEventDate}
                      onChange={e => setFormEventDate(e.target.value)}
                      className="modal-text-input"
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label style={{ fontSize: '0.68rem', color: 'var(--tx-choc-600)' }}>{TXT.time}</label>
                    <input
                      type="text"
                      value={formEventTime}
                      onChange={e => setFormEventTime(e.target.value)}
                      placeholder="e.g. 04:35 PM"
                      className="modal-text-input"
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label style={{ fontSize: '0.68rem', color: 'var(--tx-choc-600)' }}>{TXT.timezone}</label>
                    <select
                      value={formTimezone}
                      onChange={e => setFormTimezone(e.target.value)}
                      className="modal-select-input"
                    >
                      {(EVENT_TIME_ZONES.includes(formTimezone) ? EVENT_TIME_ZONES : [formTimezone, ...EVENT_TIME_ZONES]).map(tz => (
                        <option key={tz} value={tz}>{timeZoneOptionLabel(tz)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Location Selector */}
              <div className="form-group-unit">
                <label>{TXT.shipmentPhysicalLocation}</label>
                <div className="input-grid-2">
                  <select
                    value={formLocationIndex}
                    onChange={e => handleLocationChange(parseInt(e.target.value))}
                    className="modal-select-input"
                  >
                    {NETWORK_LOCATIONS.map((loc, idx) => (
                      <option key={idx} value={idx}>
                        {loc.city}, {loc.state} ({utcOffsetLabel(loc.timezone)})
                      </option>
                    ))}
                    <option value={NETWORK_LOCATIONS.length}>{TXT.customLocation}</option>
                  </select>

                  <input
                    type="text"
                    value={formFacility}
                    onChange={e => setFormFacility(e.target.value)}
                    placeholder={TXT.specificFacilityOrHubName}
                    className="modal-text-input"
                  />
                </div>

                {formLocationIndex === NETWORK_LOCATIONS.length && (
                  <input
                    type="text"
                    style={{ marginTop: '0.5rem' }}
                    value={formCustomLocation}
                    onChange={e => setFormCustomLocation(e.target.value)}
                    placeholder={TXT.enterCityStateEG}
                    className="modal-text-input"
                  />
                )}
              </div>

              {/* Delay Specifics if Status is Delayed */}
              {formEventStatus === 'DELAYED' && (
                <div className="form-group-unit delay-highlight-box">
                  <label>{TXT.delayExceptionReason}</label>
                  <select
                    value={formDelayReason}
                    onChange={e => setFormDelayReason(e.target.value)}
                    className="modal-select-input"
                  >
                    <option value="Weather-related transportation delay">{TXT.weatherRelatedTransportationDelay}</option>
                    <option value="Intermodal linehaul corridor congestion">{TXT.intermodalLinehaulCorridorCongestion}</option>
                    <option value="Mechanical vehicle inspection / maintenance">{TXT.mechanicalVehicleInspectionMaintenance}</option>
                    <option value="Customer appointment delivery requested">{TXT.customerAppointmentDeliveryRequested}</option>
                    <option value="Security / Agricultural inspection clearance">{TXT.securityAgriculturalInspectionClearance}</option>
                  </select>
                </div>
              )}

              {/* Customer-Facing Message */}
              <div className="form-group-unit">
                <label>{TXT.customerFacingMessage}</label>
                <p className="field-subtext">{TXT.thisMessageAppearsDirectlyOn}</p>
                <textarea
                  rows={3}
                  value={formCustomerMessage}
                  onChange={e => setFormCustomerMessage(e.target.value)}
                  className="modal-textarea"
                />
              </div>

              {/* Internal Operational Note */}
              <div className="form-group-unit">
                <div className="label-with-private-tag">
                  <label>{TXT.internalNoteAdminOnly}</label>
                  <span className="private-badge">{TXT.private}</span>
                </div>
                <p className="field-subtext">{TXT.willNeverAppearOnPublic}</p>
                <input
                  type="text"
                  value={formInternalNote}
                  onChange={e => setFormInternalNote(e.target.value)}
                  placeholder={TXT.eGShipmentArrivedAfter}
                  className="modal-text-input"
                />
              </div>

              {/* Timestamp & Operator Auto-Stamp */}
              <div className="modal-provenance-strip">
                <div className="prov-item">
                  <span className="prov-label">{TXT.recordedBy2}</span>
                  <strong>{ADMIN_ROLE_LABEL}</strong>
                </div>
                <div className="prov-item">
                  <span className="prov-label">{TXT.timestampStamp}</span>
                  <strong className="font-mono">{formEventDate} · {formEventTime} {formTimezone}</strong>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                  {TXT.cancel}
                </button>
                <button type="submit" className="btn-submit-event" disabled={isSubmittingEvent}>
                  <Send size={15} />
                  <span>{isSubmittingEvent ? TXT.verifyingLocation : TXT.recordTrackingEvent}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          6. MODAL: EDIT / CORRECT TRACKING EVENT (WITH EDITABLE DATE & TIME)
          ========================================================================== */}
      {correctingEvent && (
        <div className="tracking-modal-backdrop" onClick={() => setCorrectingEvent(null)}>
          <div className="tracking-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="m-title-block">
                <h3>{TXT.editCorrectTrackingEvent}</h3>
                <p>{TXT.milestone} <strong>{correctingEvent.title}</strong> {TXT.original} {correctingEvent.displayDate} — {correctingEvent.displayTime})</p>
              </div>
              <button className="modal-close-btn" onClick={() => setCorrectingEvent(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCorrectEventSubmit} className="modal-form-content">
              <div className="correction-warning-banner">
                <AlertTriangle size={16} className="text-amber" />
                <div>
                  <strong>{TXT.auditTrailPreservation}</strong>
                  <p>{TXT.youCanAdjustTheLocation}</p>
                </div>
              </div>

              {/* DATE & TIME CORRECTION (FULL EDIT CONTROL) */}
              <div className="form-group-unit datetime-editor-box">
                <label className="datetime-box-label">
                  <Calendar size={14} className="text-blue" />
                  <span>{TXT.adjustDateTime}</span>
                </label>
                <div className="input-grid-3">
                  <div className="input-field">
                    <label style={{ fontSize: '0.68rem', color: 'var(--tx-choc-600)' }}>{TXT.dateEGAugust20}</label>
                    <input
                      type="text"
                      value={correctedEventDate}
                      onChange={e => setCorrectedEventDate(e.target.value)}
                      placeholder={TXT.eGAugust202026}
                      className="modal-text-input"
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label style={{ fontSize: '0.68rem', color: 'var(--tx-choc-600)' }}>{TXT.timeEG435}</label>
                    <input
                      type="text"
                      value={correctedEventTime}
                      onChange={e => setCorrectedEventTime(e.target.value)}
                      placeholder="e.g. 4:35 PM"
                      className="modal-text-input"
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label style={{ fontSize: '0.68rem', color: 'var(--tx-choc-600)' }}>{TXT.timezone}</label>
                    <select
                      value={correctedTimezone}
                      onChange={e => setCorrectedTimezone(e.target.value)}
                      className="modal-select-input"
                    >
                      {(EVENT_TIME_ZONES.includes(correctedTimezone) ? EVENT_TIME_ZONES : [correctedTimezone, ...EVENT_TIME_ZONES]).map(tz => (
                        <option key={tz} value={tz}>{timeZoneOptionLabel(tz)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group-unit">
                <label>{TXT.correctedLocationCityState}</label>
                <input
                  type="text"
                  value={correctedLocation}
                  onChange={e => setCorrectedLocation(e.target.value)}
                  placeholder={TXT.eGDetroitMi}
                  className="modal-text-input"
                  required
                />
              </div>

              <div className="form-group-unit">
                <label>{TXT.reasonForEditCorrection}</label>
                <input
                  type="text"
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  placeholder={TXT.eGTimestampAndLocation}
                  className="modal-text-input"
                  required
                />
              </div>

              <div className="form-group-unit">
                <label>{TXT.customerMessageAdjustWordingIf}</label>
                <textarea
                  rows={2}
                  value={correctedCustomerMessage}
                  onChange={e => setCorrectedCustomerMessage(e.target.value)}
                  className="modal-textarea"
                />
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setCorrectingEvent(null)}>
                  {TXT.cancel}
                </button>
                <button type="submit" className="btn-submit-event">
                  <CheckCircle2 size={15} />
                  <span>{TXT.saveChangesLogAudit}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          7. MODAL: INSPECT EVENT FULL DETAILS
          ========================================================================== */}
      {inspectEvent && (
        <div className="tracking-modal-backdrop" onClick={() => setInspectEvent(null)}>
          <div className="tracking-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="m-title-block">
                <h3>{TXT.eventMetadataInspection}</h3>
                <p>{TXT.auditId} <strong className="font-mono">{inspectEvent.id}</strong></p>
              </div>
              <button className="modal-close-btn" onClick={() => setInspectEvent(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="inspect-details-body">
              <div className="inspect-grid-2">
                <div className="inspect-item">
                  <span className="i-label">{TXT.milestone2}</span>
                  <strong>{inspectEvent.title}</strong>
                </div>
                <div className="inspect-item">
                  <span className="i-label">{TXT.eventStatus2}</span>
                  <span className="font-mono">{shipmentStatusLabel(inspectEvent.eventStatus || inspectEvent.status)}</span>
                </div>
                <div className="inspect-item">
                  <span className="i-label">{TXT.recordedLocation}</span>
                  <strong>{inspectEvent.city}, {inspectEvent.state}</strong>
                </div>
                <div className="inspect-item">
                  <span className="i-label">{TXT.facilityHub}</span>
                  <span>{inspectEvent.facility}</span>
                </div>
                <div className="inspect-item">
                  <span className="i-label">{TXT.timestamp}</span>
                  <span className="font-mono">{inspectEvent.displayDate} — {inspectEvent.displayTime}</span>
                </div>
                <div className="inspect-item">
                  <span className="i-label">{TXT.operatorProvenance}</span>
                  <strong>{displayOperator(inspectEvent.recordedBy)}</strong>
                </div>
              </div>

              <div className="inspect-box">
                <span className="i-label">{TXT.customerFacingMessage2}</span>
                <p>"{inspectEvent.description}"</p>
              </div>

              {inspectEvent.internalNote && (
                <div className="inspect-box private">
                  <span className="i-label">{TXT.internalOperationalNote}</span>
                  <p>{inspectEvent.internalNote}</p>
                </div>
              )}

              {inspectEvent.correctionAudit && (
                <div className="inspect-box correction">
                  <span className="i-label">{TXT.auditEditLog}</span>
                  <p>{TXT.editedBy} {displayOperator(inspectEvent.correctionAudit.operator)} {TXT.at} {inspectEvent.correctionAudit.correctedAt}: {inspectEvent.correctionAudit.reason}</p>
                </div>
              )}
            </div>

            <div className="modal-footer-actions">
              <button type="button" className="btn-cancel" onClick={() => setInspectEvent(null)}>
                {TXT.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
