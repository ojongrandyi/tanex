import React, { useState } from 'react';
import {
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  User,
  Clock,
  Plus,
  Trash2,
  FileText,
  Copy,
  Check,
  Building,
  Layers,
  Printer,
  ListChecks
} from 'lucide-react';
import { Barcode } from '../components/Barcode';
import { useAdminData } from '../context/AdminDataContext';
import { resolveAddressPrecise } from '../services/geocodingService';
import './ShipPage.css';
import { pieceLabel } from '../shared/trackingId';
import { shipmentStatusLabel } from '../shared/shipmentStatus';
import { COMPANY } from '../config/brand';
import { SERVICE_OPTIONS, type ServiceOptionId } from '../data/serviceOptions';
import { Plane as IconAir, Ship as IconSea, TrainFront as IconRail, Truck as IconRoad, Warehouse as IconStore, Bike as IconBike } from 'lucide-react';
import { documentTitle } from '../components/DocumentBrand';
import { CountrySelect } from '../components/forms/CountrySelect';
import { PhoneInput } from '../components/forms/PhoneInput';
import { MeasureInput, MoneyInput, UnitToggle, useUnitLabels } from '../components/forms/UnitControls';
import { getCountry, shortRegion } from '../data/countries';
import { formatDimensions, formatWeight } from '../shared/units';
import { type TransportMode } from '../shared/transportMode';
import { useCurrency } from '../utils/useCurrency';
import { isPlainClick } from '../router/Link';
import { useApiErrorText, useAreaT } from '../i18n/I18nProvider';

interface ShipPageProps {
  onTrack: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
}

// Weight in pounds and dimensions in inches (canonical); the inputs show the viewer's units.
interface PieceItem {
  id: string;
  weight: number | '';
  length: number | '';
  width: number | '';
  height: number | '';
  description: string;
}

interface AddressFieldsProps {
  idPrefix: string;
  country: string;
  onCountry: (code: string) => void;
  city: string;
  onCity: (v: string) => void;
  region: string;
  onRegion: (v: string) => void;
  postcode: string;
  onPostcode: (v: string) => void;
  cityPlaceholder: string;
  labels: { country: string; countrySearch: string; city: string; region: string; postcode: string; optional: string };
}

// Country first (searchable), then city, then the optional region and postcode for that country.
const AddressFields: React.FC<AddressFieldsProps> = (f) => (
  <>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-country`}>{f.labels.country} *</label>
      <CountrySelect id={`${f.idPrefix}-country`} value={f.country} onChange={f.onCountry} className="ngf-input" required placeholder={f.labels.countrySearch} />
    </div>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-city`}>{f.labels.city} *</label>
      <input id={`${f.idPrefix}-city`} type="text" required value={f.city} onChange={(e) => f.onCity(e.target.value)} className="ngf-input" placeholder={f.cityPlaceholder} />
    </div>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-region`}>{f.labels.region} <span className="ngf-field-optional">{f.labels.optional}</span></label>
      <input id={`${f.idPrefix}-region`} type="text" value={f.region} onChange={(e) => f.onRegion(e.target.value)} className="ngf-input" />
    </div>
    <div className="form-group">
      <label htmlFor={`${f.idPrefix}-postcode`}>{f.labels.postcode} <span className="ngf-field-optional">{f.labels.optional}</span></label>
      <input id={`${f.idPrefix}-postcode`} type="text" value={f.postcode} onChange={(e) => f.onPostcode(e.target.value)} className="ngf-input font-mono" />
    </div>
  </>
);

// "Buea, Cameroon" / "Houston, TX" for summaries
const placeText = (city: string, region: string, countryCode: string) =>
  [city, countryCode === 'US' ? region.trim().toUpperCase() : getCountry(countryCode)?.name].filter(Boolean).join(', ');

// Collection windows without promised hours (#33): the coordinator confirms the time. Stored in
// English (the console reads them); the page shows the translated label.
const PICKUP_WINDOWS = ['Today', 'Tomorrow morning', 'Tomorrow afternoon'] as const;
const PICKUP_WINDOW_KEYS = { Today: 'today', 'Tomorrow morning': 'tomorrowMorning', 'Tomorrow afternoon': 'tomorrowAfternoon' } as const;

const DROP_OFF_LABEL = 'Drop-off at the TanEx office';

const SERVICE_ICONS: Record<ServiceOptionId, React.ElementType> = {
  air: IconAir,
  maritime: IconSea,
  rail: IconRail,
  road: IconRoad,
  warehousing: IconStore,
  'local-delivery': IconBike,
};


export const ShipPage: React.FC<ShipPageProps> = ({ onTrack, onNavigate }) => {
  // API errors in the page language (codes, I18N_SPEC §5); English keeps the server text.
  const apiErrorText = useApiErrorText();
  const t = useAreaT('ship');
  const tsv = useAreaT('services');
  const STEP_TITLES = [t('steps.sender'), t('steps.recipient'), t('steps.pieces'), t('steps.service')];
  const BOOKING_STAGES = (['book', 'collect', 'move', 'deliver'] as const).map((k) => ({ title: t(`how.${k}.title`), body: t(`how.${k}.body`) }));
  const NEXT_STEPS = [t('done.stepLabel'), t('done.stepReady'), t('done.stepTrack')];
  const regionLabel = (code: string) => (code === 'US' ? t('fields.state') : code === 'CA' ? t('fields.province') : t('fields.region'));
  const postcodeLabel = (code: string) => (code === 'US' ? t('fields.zip') : code === 'CA' ? t('fields.postal') : t('fields.postcode'));
  const addressLabels = (country: string) => ({ country: t('fields.country'), countrySearch: t('fields.countrySearch'), city: t('fields.city'), region: regionLabel(country), postcode: postcodeLabel(country), optional: t('fields.optional') });
  const modeLabel = (m: TransportMode) => t(`modes.${m}`);
  const { createShipment, generateDocument } = useAdminData();
  const units = useUnitLabels();
  const money = useCurrency();

  // Multi-step form flow
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State - Sender (Origin)
  const [senderCompany, setSenderCompany] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderCountry, setSenderCountry] = useState('');
  const [senderCity, setSenderCity] = useState('');
  const [senderState, setSenderState] = useState('');
  const [senderZip, setSenderZip] = useState('');
  const [pickupType, setPickupType] = useState<'pickup' | 'dropoff'>('pickup');
  const [pickupWindow, setPickupWindow] = useState<string>(PICKUP_WINDOWS[0]);

  // Form State - Recipient (Destination)
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCountry, setRecipientCountry] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Form State - Pieces (Clean, empty piece item)
  const [piecesList, setPiecesList] = useState<PieceItem[]>([
    {
      id: '01',
      weight: '',
      length: '',
      width: '',
      height: '',
      description: '',
    },
  ]);

  // Form State - Service (one of the four §7.1 services)
  const [selectedService, setSelectedService] = useState<ServiceOptionId>('air');
  // '' = let us recommend
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const [declaredValue, setDeclaredValue] = useState<number | ''>('');
  const [requireSignature, setRequireSignature] = useState(true);
  // TanEx is open 7 days (#119), so no separate weekend option; the collection windows cover every day.
  const saturdayDelivery = false;

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(false);
  const [generatedTracking, setGeneratedTracking] = useState('');
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Calculations
  const totalWeight = piecesList.reduce((acc, curr) => acc + (curr.weight === '' ? 0 : curr.weight), 0);
  const totalPieces = piecesList.length;

  const handleAddPiece = () => {
    const nextNum = (piecesList.length + 1).toString().padStart(2, '0');
    setPiecesList([
      ...piecesList,
      {
        id: nextNum,
        weight: '',
        length: '',
        width: '',
        height: '',
        description: '',
      },
    ]);
  };

  const handleRemovePiece = (index: number) => {
    if (piecesList.length > 1) {
      setPiecesList(piecesList.filter((_, i) => i !== index));
    }
  };

  const handleUpdatePiece = <K extends keyof PieceItem>(index: number, field: K, val: PieceItem[K]) => {
    const updated = [...piecesList];
    updated[index] = { ...updated[index], [field]: val };
    setPiecesList(updated);
  };

  // Step Validation Logic
  const validateStep = (step: number): boolean => {
    setFormError(null);
    if (step === 1) {
      // State/region and postcode are optional (not every country has them).
      if (!senderContact.trim() || !senderPhone.trim() || !senderAddress.trim() || !senderCountry || !senderCity.trim()) {
        setFormError(t('errors.sender'));
        return false;
      }
    } else if (step === 2) {
      if (!recipientContact.trim() || !recipientPhone.trim() || !recipientAddress.trim() || !recipientCountry || !recipientCity.trim()) {
        setFormError(t('errors.recipient'));
        return false;
      }
    } else if (step === 3) {
      for (const p of piecesList) {
        if (p.weight === '' || p.weight <= 0) {
          setFormError(t('errors.weight', { unit: units.weight }));
          return false;
        }
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setFormError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const getServiceName = () =>
    (SERVICE_OPTIONS.find((s) => s.id === selectedService) || SERVICE_OPTIONS[0]).name;

  const collectionText = pickupType === 'pickup' ? pickupWindow : DROP_OFF_LABEL;
  const serviceLabel = (id: ServiceOptionId) => tsv(`items.${(SERVICE_OPTIONS.find((o) => o.id === id) || SERVICE_OPTIONS[0]).key}.name`);
  const collectionLabel = pickupType === 'pickup'
    ? t(`windows.${PICKUP_WINDOW_KEYS[pickupWindow as keyof typeof PICKUP_WINDOW_KEYS] ?? 'today'}`)
    : t('fields.dropoff');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setIsSubmitting(true);

    const originRegion = shortRegion(senderCountry, senderState);
    const destRegion = shortRegion(recipientCountry, recipientState);
    const originLabel = [senderCity.trim(), originRegion].filter(Boolean).join(', ');
    // Inches; 0 = side not given (shown as "—"), never an invented size.
    const dimensionsOf = (piece: PieceItem) => ({
      length: piece.length === '' ? 0 : piece.length,
      width: piece.width === '' ? 0 : piece.width,
      height: piece.height === '' ? 0 : piece.height
    });
    const party = (company: string, name: string, phone: string, street: string, city: string, region: string, postcode: string, countryCode: string) => ({
      company,
      name,
      phone,
      addressLine: street,
      city: city.trim(),
      state: shortRegion(countryCode, region),
      region: region.trim() || undefined,
      postalCode: postcode.trim() || undefined,
      country: getCountry(countryCode)?.name || '',
      countryCode
    });

    // Piece ids and labels (TXxxxxxx-NN) are stamped from the server-assigned ID in createShipment.
    const piecesFormatted = piecesList.map((p, idx) => ({
      id: '',
      pieceNumber: idx + 1,
      totalPieces: piecesList.length,
      trackingNumber: '',
      status: 'AWAITING_PICKUP' as const,
      statusText: shipmentStatusLabel('BOOKED'),
      currentLocation: originLabel,
      weightLbs: p.weight === '' ? 0 : p.weight,
      dimensions: dimensionsOf(p)
    }));

    // Coordinates for the route map, from the country-aware lookup (live geocoder when the
    // offline tables only have a guess). An address we can't place at all stops the booking.
    const [originGeo, destGeo] = await Promise.all([
      resolveAddressPrecise({ street: senderAddress, city: senderCity, region: senderState, countryCode: senderCountry }, getCountry(senderCountry)?.name),
      resolveAddressPrecise({ street: recipientAddress, city: recipientCity, region: recipientState, countryCode: recipientCountry }, getCountry(recipientCountry)?.name)
    ]);
    if (!originGeo || !destGeo) {
      const missing = !originGeo ? `${senderCity}, ${getCountry(senderCountry)?.name}` : `${recipientCity}, ${getCountry(recipientCountry)?.name}`;
      setFormError(t('errors.notFound', { place: missing }));
      setIsSubmitting(false);
      return;
    }

    // Register into persistent application state & backend database. The server assigns the
    // tracking ID; the confirmation and the BOL below use the one it returned.
    let newTrackingId: string;
    try {
      const created = await createShipment({
        status: 'AWAITING_PICKUP',
        statusText: shipmentStatusLabel('BOOKED'),
        statusMessage: `${shipmentStatusLabel('BOOKED')} · ${collectionText}`,
        health: 'ON_TRACK',
        progressPercent: 10,
        lastUpdated: 'Just now',
        createdAt: 'Today',
        service: getServiceName(),
        transportMode: transportMode || undefined,
        shipmentType: 'Parcel',
        cargoCategory: 'Commercial Goods',
        cargoDescription: piecesList[0]?.description || 'Parcel',
        totalWeightLbs: totalWeight,
        totalPieces: totalPieces,
        declaredValue: declaredValue === '' ? 0 : declaredValue,
        dimensions: dimensionsOf(piecesList[0]),
        origin: {
          city: senderCity.trim(),
          state: originRegion,
          country: getCountry(senderCountry)?.name || '',
          lat: originGeo.lat,
          lng: originGeo.lng
        },
        destination: {
          city: recipientCity.trim(),
          state: destRegion,
          country: getCountry(recipientCountry)?.name || '',
          lat: destGeo.lat,
          lng: destGeo.lng
        },
        currentLocation: originLabel,
        currentFacility: originLabel,
        sender: party(senderCompany, senderContact, senderPhone, senderAddress, senderCity, senderState, senderZip, senderCountry),
        recipient: party(recipientCompany, recipientContact, recipientPhone, recipientAddress, recipientCity, recipientState, recipientZip, recipientCountry),
        pieces: piecesFormatted,
        // Collection and extras chosen on the form, for the operations team.
        pickupWindow: collectionText,
        handlingRequirements: {
          signatureRequired: requireSignature,
          otherInstructions: [
            saturdayDelivery ? 'Weekend Delivery requested' : '',
            deliveryInstructions.trim()
          ].filter(Boolean).join('. ') || undefined
        }
      });
      newTrackingId = created.trackingNumber;
    } catch (err: any) {
      setFormError(t('errors.save', { reason: apiErrorText(err, t('errors.noReply')) }));
      setIsSubmitting(false);
      return;
    }
    setGeneratedTracking(newTrackingId);

    // Auto-generate Master Record in Document Center
    generateDocument({
      docType: 'BOL',
      title: `${documentTitle('BOL', transportMode || undefined)} (${newTrackingId})`,
      shipmentTracking: newTrackingId,
      senderName: senderContact,
      senderCompany: senderCompany,
      senderAddress: senderAddress,
      senderCity: senderCity,
      senderState: originRegion,
      senderZip: senderZip,
      senderPhone: senderPhone,
      recipientName: recipientContact,
      recipientCompany: recipientCompany,
      recipientAddress: recipientAddress,
      recipientCity: recipientCity,
      recipientState: destRegion,
      recipientZip: recipientZip,
      recipientPhone: recipientPhone,
      cargoDescription: piecesList[0]?.description || 'Commercial Express Consignment',
      shipmentType: 'Parcel',
      service: getServiceName(),
      weightLbs: totalWeight,
      pieces: totalPieces,
      // Documents keep the canonical unit (inches)
      dimensions: formatDimensions(piecesList[0], 'imperial'),
      declaredValue: declaredValue === '' ? 0 : declaredValue,
      // No price yet: the coordinator confirms the rate (charges are added in the Document Center).
      bolSpecialInstructions: [saturdayDelivery ? 'Weekend Delivery requested' : '', deliveryInstructions.trim()].filter(Boolean).join('. ') || undefined
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedBooking(true);
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }, 600);
  };

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(generatedTracking);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  return (
    <div className="ngf-page-ship">
      {/* =========================================================================
          1. CINEMATIC HERO SECTION
          ========================================================================= */}
      <section className="ngf-ship-hero">
        <div className="ngf-ship-hero-bg" />
        <div className="ngf-container-wide ship-hero-container">
          <nav className="ngf-ship-breadcrumbs" aria-label={t('breadcrumb')}>
            <a href="/" onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onNavigate('home'); }} className="crumb-link">{t('home')}</a>
            <span className="crumb-sep">/</span>
            <span className="crumb-current" aria-current="page">{t('title')}</span>
          </nav>

          <h1 className="ship-hero-title">{t('title')}</h1>
        </div>
      </section>

      {/* =========================================================================
          2. MAIN FORM CONTAINER & STICKY LIVE SUMMARY
          ========================================================================= */}
      <div className="ngf-container-wide ngf-ship-workspace">
        {submittedBooking ? (
          /* BOOKING CONFIRMATION SCREEN */
          <div className="ngf-booking-confirmed-card animate-fade-in">
            <div className="confirm-header" role="status">
              <CheckCircle2 size={56} className="confirm-check-icon text-emerald" />
              <h2>{t('done.title')}</h2>
              <p>{t('done.body', { id: generatedTracking })}</p>
            </div>

            {/* Tracking ID and piece labels: this block is what "Print labels" prints. */}
            <div className="ship-print-labels">
            <div className="confirm-barcode-block">
              <div className="barcode-block-header">
                <span className="barcode-tag">{COMPANY}</span>
                <span className="barcode-service">{serviceLabel(selectedService)}</span>
              </div>

              <div className="barcode-render-stage">
                <Barcode
                  value={generatedTracking}
                  height={55}
                  width={1.6}
                  fontSize={14}
                  displayValue={true}
                />
              </div>

              <div className="barcode-block-meta">
                <div><strong>{t('done.route')}</strong> {placeText(senderCity, senderState, senderCountry)} → {placeText(recipientCity, recipientState, recipientCountry)}</div>
                <div><strong>{t('done.pieces')}</strong> {t('done.piecesValue', { n: totalPieces, weight: formatWeight(totalWeight, units.system) })}</div>
                {transportMode && <div><strong>{t('done.mode')}</strong> {modeLabel(transportMode)}</div>}
                <div><strong>{t('done.collection')}</strong> {collectionLabel}</div>
              </div>
            </div>

            {/* Piece Barcodes List */}
            <div className="confirm-pieces-grid">
              {piecesList.map((piece, idx) => (
                <div key={piece.id} className="confirm-piece-card">
                  <div className="piece-card-header">
                    <span className="font-bold">{t('done.piece', { n: idx + 1, total: piecesList.length })}</span>
                    <small>{[formatWeight(piece.weight, units.system), formatDimensions(piece, units.system)].filter(Boolean).join(' • ')}</small>
                  </div>
                  <div className="piece-barcode-render">
                    <Barcode
                      value={pieceLabel(generatedTracking, idx + 1)}
                      height={32}
                      width={1.1}
                      fontSize={10}
                      displayValue={true}
                    />
                  </div>
                </div>
              ))}
            </div>
            </div>

            {/* Next steps (CONTENT §7.3); the collection-time step applies to collections only */}
            <div className="confirm-instructions-card">
              <div className="inst-icon"><ListChecks size={20} className="text-accent flex-shrink-0" /></div>
              <div>
                <h3>{t('done.next')}</h3>
                <ul className="ship-next-steps">
                  {NEXT_STEPS.filter((step, i) => i !== 1 || pickupType === 'pickup').map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="confirm-action-row">
              <button
                type="button"
                className="tx-btn tx-btn--primary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>{t('done.print')}</span>
              </button>

              <button
                type="button"
                className="tx-btn tx-btn--ghost"
                onClick={() => onTrack(generatedTracking)}
              >
                <span>{t('done.track')}</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="tx-btn tx-btn--ghost"
                onClick={handleCopyTracking}
              >
                {copiedTracking ? (
                  <>
                    <Check size={16} className="text-emerald" />
                    <span>{t('done.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>{t('done.copy')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="tx-btn tx-btn--ghost"
                onClick={() => {
                  setSubmittedBooking(false);
                  setTransportMode('');
                  setCurrentStep(1);
                }}
              >
                <span>{t('done.another')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* MULTI-STEP BOOKING FORM + STICKY SIDEBAR */
          <div className="ngf-ship-grid">
            {/* Left Column: Multi-Section Form */}
            <div className="ngf-ship-main-form">
              {/* Unified Responsive Step Stepper */}
              <div className="form-steps-nav">
                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
                  onClick={() => setCurrentStep(1)}
                >
                  <span className="step-num">{currentStep > 1 ? '✓' : '1'}</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[0]}</span>
                    <span className="step-sub">{senderCity ? placeText(senderCity, senderState, senderCountry) : t('steps.from')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
                  onClick={() => validateStep(1) && setCurrentStep(2)}
                >
                  <span className="step-num">{currentStep > 2 ? '✓' : '2'}</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[1]}</span>
                    <span className="step-sub">{recipientCity ? placeText(recipientCity, recipientState, recipientCountry) : t('steps.to')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
                  onClick={() => validateStep(1) && validateStep(2) && setCurrentStep(3)}
                >
                  <span className="step-num">{currentStep > 3 ? '✓' : '3'}</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[2]}</span>
                    <span className="step-sub">{[t(totalPieces === 1 ? 'steps.piece' : 'steps.piecesN', { n: totalPieces }), formatWeight(totalWeight, units.system)].filter(Boolean).join(' · ')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`step-nav-item ${currentStep === 4 ? 'active' : ''}`}
                  onClick={() => validateStep(1) && validateStep(2) && validateStep(3) && setCurrentStep(4)}
                >
                  <span className="step-num">4</span>
                  <div className="step-label-group">
                    <span className="step-title">{STEP_TITLES[3]}</span>
                    <span className="step-sub">{serviceLabel(selectedService)}</span>
                  </div>
                </button>
              </div>

              {/* Mobile Real-Time Step Progress Indicator */}
              <div className="mobile-step-summary-bar">
                <div className="mobile-step-text">
                  <span className="step-badge-mini">{currentStep}/4</span>
                  <strong>
                    {STEP_TITLES[currentStep - 1]}
                  </strong>
                </div>
                <div className="mobile-step-track">
                  <div className="mobile-step-fill" style={{ width: `${(currentStep / 4) * 100}%` }} />
                </div>
              </div>

              {/* Error Notice */}
              {formError && (
                <div className="form-validation-error animate-fade-in">
                  <FileText size={18} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: ORIGIN & SENDER */}
              {currentStep === 1 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><User size={20} /></div>
                    <div>
                      <h2>1. {STEP_TITLES[0]}</h2>
                    </div>
                  </div>

                  <div className="form-fields-grid">
                    <div className="form-group span-2">
                      <label htmlFor="ship-sender-company">{t('fields.company')} <span className="ngf-field-optional">{t('fields.optional')}</span></label>
                      <input
                        id="ship-sender-company"
                        type="text"
                        value={senderCompany}
                        onChange={(e) => setSenderCompany(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ship-sender-name">{t('fields.senderName')} *</label>
                      <input
                        id="ship-sender-name"
                        type="text"
                        required
                        value={senderContact}
                        onChange={(e) => setSenderContact(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="sender-phone">{t('fields.phone')} *</label>
                      <PhoneInput id="sender-phone" required value={senderPhone} onChange={setSenderPhone} defaultCountry={senderCountry || 'CM'} className="ngf-input" placeholder={t('fields.phonePlaceholder')} codeLabel={t('fields.callingCode')} />
                    </div>

                    <div className="form-group span-2">
                      <label htmlFor="ship-sender-address">{t('fields.street')} *</label>
                      <input
                        id="ship-sender-address"
                        type="text"
                        required
                        value={senderAddress}
                        onChange={(e) => setSenderAddress(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <AddressFields
                      idPrefix="sender"
                      country={senderCountry}
                      onCountry={setSenderCountry}
                      city={senderCity}
                      onCity={setSenderCity}
                      region={senderState}
                      onRegion={setSenderState}
                      postcode={senderZip}
                      onPostcode={setSenderZip}
                      cityPlaceholder={t('fields.cityFromPlaceholder')}
                      labels={addressLabels(senderCountry)}
                    />
                  </div>

                  {/* Collection or drop-off */}
                  <div className="tender-mode-wrap">
                    <span className="section-sublabel" id="ship-collection-label">{t('fields.collection')}</span>
                    <div className="tender-toggle-row" role="radiogroup" aria-labelledby="ship-collection-label">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={pickupType === 'pickup'}
                        className={`tender-card ${pickupType === 'pickup' ? 'selected' : ''}`}
                        onClick={() => setPickupType('pickup')}
                      >
                        <Truck size={22} className="text-accent" />
                        <div>
                          <strong>{t('fields.collect')}</strong>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={pickupType === 'dropoff'}
                        className={`tender-card ${pickupType === 'dropoff' ? 'selected' : ''}`}
                        onClick={() => setPickupType('dropoff')}
                      >
                        <Building size={22} className="text-accent" />
                        <div>
                          <strong>{t('fields.dropoff')}</strong>
                        </div>
                      </button>
                    </div>

                    {pickupType === 'pickup' && (
                      <div className="pickup-window-select">
                        <label htmlFor="ship-collection-window">{t('fields.collectionTime')}</label>
                        <select
                          id="ship-collection-window"
                          value={pickupWindow}
                          onChange={(e) => setPickupWindow(e.target.value)}
                          className="ngf-input"
                        >
                          {PICKUP_WINDOWS.map((w) => (
                            <option key={w} value={w}>{t(`windows.${PICKUP_WINDOW_KEYS[w]}`)}</option>
                          ))}
                        </select>
                        <p className="tx-hint">{t('fields.collectionHint')}</p>
                      </div>
                    )}
                  </div>

                  <div className="form-step-actions">
                    <button
                      type="button"
                      className="tx-btn tx-btn--primary"
                      onClick={handleNextStep}
                    >
                      <span>{t('actions.continue')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DESTINATION & RECIPIENT */}
              {currentStep === 2 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><MapPin size={20} /></div>
                    <div>
                      <h2>2. {STEP_TITLES[1]}</h2>
                    </div>
                  </div>

                  <div className="form-fields-grid">
                    <div className="form-group span-2">
                      <label htmlFor="ship-recipient-company">{t('fields.company')} <span className="ngf-field-optional">{t('fields.optional')}</span></label>
                      <input
                        id="ship-recipient-company"
                        type="text"
                        value={recipientCompany}
                        onChange={(e) => setRecipientCompany(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ship-recipient-name">{t('fields.recipientName')} *</label>
                      <input
                        id="ship-recipient-name"
                        type="text"
                        required
                        value={recipientContact}
                        onChange={(e) => setRecipientContact(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="recipient-phone">{t('fields.phone')} *</label>
                      <PhoneInput id="recipient-phone" required value={recipientPhone} onChange={setRecipientPhone} defaultCountry={recipientCountry || senderCountry || 'US'} className="ngf-input" />
                    </div>

                    <div className="form-group span-2">
                      <label htmlFor="ship-recipient-address">{t('fields.street')} *</label>
                      <input
                        id="ship-recipient-address"
                        type="text"
                        required
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        className="ngf-input"
                      />
                    </div>

                    <AddressFields
                      idPrefix="recipient"
                      country={recipientCountry}
                      onCountry={setRecipientCountry}
                      city={recipientCity}
                      onCity={setRecipientCity}
                      region={recipientState}
                      onRegion={setRecipientState}
                      postcode={recipientZip}
                      onPostcode={setRecipientZip}
                      cityPlaceholder={t('fields.cityToPlaceholder')}
                      labels={addressLabels(recipientCountry)}
                    />

                    <div className="form-group span-2">
                      <label htmlFor="ship-delivery-instructions">{t('fields.instructions')} <span className="ngf-field-optional">{t('fields.optional')}</span></label>
                      <input
                        id="ship-delivery-instructions"
                        type="text"
                        value={deliveryInstructions}
                        onChange={(e) => setDeliveryInstructions(e.target.value)}
                        className="ngf-input"
                      />
                    </div>
                  </div>

                  <div className="form-step-actions dual">
                    <button
                      type="button"
                      className="tx-btn tx-btn--ghost"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft size={16} />
                      <span>{t('actions.back')}</span>
                    </button>

                    <button
                      type="button"
                      className="tx-btn tx-btn--primary"
                      onClick={handleNextStep}
                    >
                      <span>{t('actions.continue')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: MULTI-PIECE CONSIGNMENT BUILDER */}
              {currentStep === 3 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><Layers size={20} /></div>
                    <div className="sec-title-wrap">
                      <div>
                        <h2>3. {STEP_TITLES[2]}</h2>
                        <UnitToggle className="ship-unit-toggle" label={t('fields.units')} />
                      </div>
                      <button
                        type="button"
                        className="add-piece-btn"
                        onClick={handleAddPiece}
                      >
                        <Plus size={15} aria-hidden="true" /> {t('fields.addPiece')}
                      </button>
                    </div>
                  </div>

                  <div className="pieces-builder-list">
                    {piecesList.map((piece, index) => (
                      <div key={index} className="piece-builder-row">
                        <div className="piece-badge-col">
                          <span className="p-badge font-mono">#{piece.id}</span>
                          {piecesList.length > 1 && (
                            <button
                              type="button"
                              className="p-delete-btn"
                              onClick={() => handleRemovePiece(index)}
                              title={t('fields.removePiece', { n: piece.id })}
                              aria-label={t('fields.removePiece', { n: piece.id })}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="piece-inputs-col">
                          <div className="piece-dim-grid">
                            <div className="p-field">
                              <label htmlFor={`piece-${index}-weight`}>{t('fields.weight', { unit: units.weight })} *</label>
                              <MeasureInput
                                id={`piece-${index}-weight`}
                                kind="weight"
                                step="0.1"
                                min="0.1"
                                required
                                value={piece.weight}
                                onChange={(v) => handleUpdatePiece(index, 'weight', v)}
                                className="ngf-input"
                              />
                            </div>

                            <div className="p-field">
                              <label htmlFor={`piece-${index}-length`}>{t('fields.length', { unit: units.length })}</label>
                              <MeasureInput
                                id={`piece-${index}-length`}
                                kind="length"
                                min="0"
                                value={piece.length}
                                onChange={(v) => handleUpdatePiece(index, 'length', v)}
                                className="ngf-input"
                              />
                            </div>

                            <div className="p-field">
                              <label htmlFor={`piece-${index}-width`}>{t('fields.width', { unit: units.length })}</label>
                              <MeasureInput
                                id={`piece-${index}-width`}
                                kind="length"
                                min="0"
                                value={piece.width}
                                onChange={(v) => handleUpdatePiece(index, 'width', v)}
                                className="ngf-input"
                              />
                            </div>

                            <div className="p-field">
                              <label htmlFor={`piece-${index}-height`}>{t('fields.height', { unit: units.length })}</label>
                              <MeasureInput
                                id={`piece-${index}-height`}
                                kind="length"
                                min="0"
                                value={piece.height}
                                onChange={(v) => handleUpdatePiece(index, 'height', v)}
                                className="ngf-input"
                              />
                            </div>
                          </div>

                          <div className="p-field-desc">
                            <label htmlFor={`ship-piece-${index}-contents`}>{t('fields.contents')} <span className="ngf-field-optional">{t('fields.optional')}</span></label>
                            <input
                              id={`ship-piece-${index}-contents`}
                              type="text"
                              value={piece.description}
                              onChange={(e) => handleUpdatePiece(index, 'description', e.target.value)}
                              placeholder={t('fields.contentsPlaceholder')}
                              className="ngf-input"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="form-step-actions dual">
                    <button
                      type="button"
                      className="tx-btn tx-btn--ghost"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft size={16} />
                      <span>{t('actions.back')}</span>
                    </button>

                    <button
                      type="button"
                      className="tx-btn tx-btn--primary"
                      onClick={handleNextStep}
                    >
                      <span>{t('actions.continue')}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: SERVICE TIER & SUBMISSION */}
              {currentStep === 4 && (
                <div className="form-section-card animate-fade-in">
                  <div className="sec-header">
                    <div className="sec-icon"><Truck size={20} /></div>
                    <div>
                      <h2>4. {STEP_TITLES[3]}</h2>
                    </div>
                  </div>

                  {/* Service cards: the four §7.1 services, summaries from §3.1 */}
                  <div className="services-select-grid" role="radiogroup" aria-label={t('fields.serviceGroup')}>
                    {SERVICE_OPTIONS.map((s) => {
                      const Icon = SERVICE_ICONS[s.id];
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={selectedService === s.id}
                          className={`service-option-card ${selectedService === s.id ? 'selected' : ''}`}
                          onClick={() => setSelectedService(s.id)}
                        >
                          <div className="serv-head">
                            <Icon size={20} className="text-accent" />
                            <strong>{tsv(`items.${s.key}.name`)}</strong>
                          </div>
                          <small>{tsv(`items.${s.key}.summary`)}</small>
                        </button>
                      );
                    })}
                  </div>

                  {/* Transport mode (tracker 2.8) */}
                  <div className="transport-mode-row">
                    <label htmlFor="ship-mode" className="section-sublabel">{t('fields.mode')}</label>
                    <select
                      id="ship-mode"
                      value={transportMode}
                      onChange={(e) => setTransportMode(e.target.value as TransportMode | '')}
                      className="ngf-input"
                    >
                      <option value="">{t('fields.modeAuto')}</option>
                      <option value="Air">{modeLabel('Air')}</option>
                      <option value="Sea">{modeLabel('Sea')}</option>
                      <option value="Road">{modeLabel('Road')}</option>
                    </select>
                  </div>

                  {/* Extras (CONTENT §3.4 add-ons) */}
                  <div className="addons-grid">
                    <div className="addon-checkbox-row">
                      <input
                        type="checkbox"
                        id="signCheck"
                        checked={requireSignature}
                        onChange={(e) => setRequireSignature(e.target.checked)}
                      />
                      <label htmlFor="signCheck">
                        <strong>{t('fields.signature')}</strong>
                        <small>{t('fields.signatureHint')}</small>
                      </label>
                    </div>


                    <div className="declared-value-row">
                      <label htmlFor="ship-declared-value">{t('fields.declared', { currency: money.currency })} <span className="ngf-field-optional">{t('fields.optional')}</span></label>
                      <div className="value-input-wrap">
                        <span className="curr-sym">{money.symbol}</span>
                        <MoneyInput
                          id="ship-declared-value"
                          min="0"
                          value={declaredValue}
                          onChange={setDeclaredValue}
                          className="ngf-input font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-step-actions dual">
                    <button
                      type="button"
                      className="tx-btn tx-btn--ghost"
                      onClick={handlePrevStep}
                    >
                      <ArrowLeft size={16} />
                      <span>{t('actions.back')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="tx-btn tx-btn--primary submit-booking-btn"
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border" />
                          <span>{t('actions.booking')}</span>
                        </>
                      ) : (
                        <>
                          <span>{t('actions.book')}</span>
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Summary */}
            <aside className="ngf-ship-sidebar">
              <div className="sidebar-sticky-card">
                <div className="sidebar-head">
                  <h2>{t('summary.title')}</h2>
                </div>

                <div className="sidebar-route-preview">
                  <div className="route-loc origin">
                    <MapPin size={16} className="text-accent" />
                    <div>
                      <small>{t('summary.from')}</small>
                      <strong>{senderCity ? placeText(senderCity, senderState, senderCountry) : '—'}</strong>
                    </div>
                  </div>
                  <div className="route-arrow-line">
                    <span className="route-line" />
                    <span className="route-dot" />
                  </div>
                  <div className="route-loc dest">
                    <MapPin size={16} className="text-accent" />
                    <div>
                      <small>{t('summary.to')}</small>
                      <strong>{recipientCity ? placeText(recipientCity, recipientState, recipientCountry) : '—'}</strong>
                    </div>
                  </div>
                </div>

                <div className="sidebar-specs-list">
                  <div className="spec-row">
                    <span>{t('summary.pieces')}</span>
                    <strong>{totalPieces}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('summary.weight')}</span>
                    <strong>{formatWeight(totalWeight, units.system) || '—'}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('summary.service')}</span>
                    <strong className="text-accent">
                      {serviceLabel(selectedService)}
                    </strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('summary.mode')}</span>
                    <strong>{transportMode ? modeLabel(transportMode) : t('summary.modeAuto')}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('summary.collection')}</span>
                    <strong>{collectionLabel}</strong>
                  </div>
                  <div className="spec-row">
                    <span>{t('summary.signature')}</span>
                    <strong>{requireSignature ? t('summary.yes') : t('summary.no')}</strong>
                  </div>
                </div>

                <div className="sidebar-pricing-breakdown">
                  <p className="admin-publishing-note">
                    {t('summary.note')}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. HOW BOOKING WORKS (CONTENT §7.3)
          ========================================================================= */}
      <section className="ngf-ship-process-section">
        <div className="ngf-container-wide">
          <div className="section-center-header">
            <h2>{t('how.title')}</h2>
            <div className="section-header-line" />
          </div>

          <div className="process-steps-grid">
            {BOOKING_STAGES.map((stage, i) => (
              <div key={stage.title} className="p-step-card">
                <div className="step-badge">{String(i + 1).padStart(2, '0')}</div>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
