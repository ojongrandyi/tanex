import React, { useState, useEffect } from 'react';
import {
  Package,
  FileText,
  Truck,
  Layers,
  Box,
  Container,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Plus,
  Trash2,
  Printer,
  FileCheck,
  Save,
  Car,
  CheckSquare,
  Square,
  AlertTriangle,
  PawPrint,
  Heart
} from 'lucide-react';
import { resolveAddress, resolveAddressPrecise, resolveLocation, STATE_NAMES } from '../../services/geocodingService';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { MeasureInput, MoneyInput, UnitToggle, useUnitLabels } from '../../components/forms/UnitControls';
import { getCountry, postcodeLabel, regionLabel, shortRegion } from '../../data/countries';
import { formatDimensions, formatLength, formatWeight } from '../../shared/units';

// Weight text saved into event descriptions: kg first with lb alongside, readable in either system.
const bothUnits = (lbs: unknown) => `${formatWeight(lbs, 'metric')} (${formatWeight(lbs, 'imperial')})`;
import { useCurrency } from '../../utils/useCurrency';
import { calculateRouteGeometry, inferTransportMode, type TransportMode } from '../../services/routingEngine';
import { generateShipmentPlan } from '../../services/planningEngine';
import { useAdminData } from '../../context/AdminDataContext';
import { useAuth } from '../../auth/AuthContext';
import { AdminViewType } from '../AdminLayout';
import { Shipment, ShipmentStatus, TrackingEvent } from '../../types/shipment';
import { ADMIN_ROLE_LABEL, COMPANY, COMPANY_SHORT, LEGAL_NAME, REFERENCE_PREFIX, TRACKING_PREFIX } from '../../config/brand';
import { generateReference } from '../../shared/references';
import { SUFFIX_LENGTH } from '../../shared/trackingId';
import './CreateShipmentView.css';
import { Barcode as TrackingBarcode } from '../../components/Barcode';
import { ShipmentImagesPanel } from '../components/ShipmentImagesPanel';
import {
  PaymentDraft, PaymentRequestEditor, draftToRequest, emptyPaymentDraft, paymentDraftErrors, paymentDraftSummary,
} from '../components/PaymentRequestEditor';
import { api } from '../../services/api';
import { documentTitle } from '../../components/DocumentBrand';
import { CREATE_SHIPMENT_VIEW_TEXT as TXT } from './CreateShipmentView.text';
import { consoleIntlLocale } from '../i18n/consoleText';

interface CreateShipmentViewProps {
  onSelectView: (view: AdminViewType) => void;
  onOpenShipmentDetail: (trackingNumber: string) => void;
}

export type ShipmentTypeOption = 'Document' | 'Parcel' | 'Freight' | 'Pallet' | 'Container' | 'Vehicle' | 'Pets' | 'Multi-piece';
export type ServiceOption = 'Standard' | 'Express' | 'Priority' | 'Freight';

interface PackageItem {
  id: string;
  type: string;
  weightLbs: number;
  length: number;
  width: number;
  height: number;
  description: string;
}

export const CreateShipmentView: React.FC<CreateShipmentViewProps> = ({
  onSelectView,
  onOpenShipmentDetail
}) => {
  const { createShipment, generateDocument } = useAdminData();
  const { can } = useAuth();

  // Current Step: 1 to 7
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftSavedToast, setDraftSavedToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ----------------------------------------------------
  // STEP 1: Shipment Information
  // ----------------------------------------------------
  const [shipmentType, setShipmentType] = useState<ShipmentTypeOption>('Parcel');
  const [cargoCategory, setCargoCategory] = useState('General Cargo');
  const [service, setService] = useState<ServiceOption>('Express');
  // 'Auto' leaves the mode to inference (road within ~1,500 mi or North America, sea for
  // containers/freight, otherwise air); the server applies the same rule on read.
  const [transportModeChoice, setTransportModeChoice] = useState<'Auto' | TransportMode>('Auto');
  const units = useUnitLabels();
  const money = useCurrency();
  const [customerRef, setCustomerRef] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [internalRef, setInternalRef] = useState('');
  const [shipmentDescription, setShipmentDescription] = useState('');

  // ----------------------------------------------------
  // VEHICLE CARGO SPECIFIC STATE (When shipmentType === 'Vehicle')
  // ----------------------------------------------------
  const [vehMake, setVehMake] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehYear, setVehYear] = useState('');
  const [vehVin, setVehVin] = useState('');
  const [vehColor, setVehColor] = useState('');
  const [vehBodyType, setVehBodyType] = useState('SUV / Crossover');
  const [vehOperable, setVehOperable] = useState(true);
  const [vehCondition, setVehCondition] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [vehTitleNumber, setVehTitleNumber] = useState('');
  const [vehWeightLbs, setVehWeightLbs] = useState('');
  const [vehLengthIn, setVehLengthIn] = useState('');
  const [vehWidthIn, setVehWidthIn] = useState('');
  const [vehHeightIn, setVehHeightIn] = useState('');

  // Vehicle Condition Checklist
  const [damageChecklist, setDamageChecklist] = useState<string[]>([]);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [itemsReceived, setItemsReceived] = useState<string[]>([]);
  // ----------------------------------------------------
  // PALLET CARGO SPECIFIC STATE (When shipmentType === 'Pallet')
  // ----------------------------------------------------
  const [palletStandard, setPalletStandard] = useState('GMA Standard 48×40 in (US Wood)');
  const [palletCount, setPalletCount] = useState<number>(1);
  const [palletWeightPerSkid, setPalletWeightPerSkid] = useState<number>(0);
  const [palletHeightIn, setPalletHeightIn] = useState<number>(0);
  const [palletStackable, setPalletStackable] = useState<boolean>(false);
  const [palletForkliftAccess, setPalletForkliftAccess] = useState('4-Way Forklift Entry');
  const [palletSecuringChecks, setPalletSecuringChecks] = useState<string[]>([]);

  const handleTogglePalletCheck = (check: string) => {
    setPalletSecuringChecks(prev =>
      prev.includes(check) ? prev.filter(c => c !== check) : [...prev, check]
    );
  };

  // ----------------------------------------------------
  // CONTAINER CARGO SPECIFIC STATE (When shipmentType === 'Container')
  // ----------------------------------------------------
  const [containerNumber, setContainerNumber] = useState('');
  const [containerIsoSize, setContainerIsoSize] = useState('40ft High-Cube Dry Van (40HC / 9ft 6in)');
  const [containerBoltSeal, setContainerBoltSeal] = useState('');
  const [containerChassisNumber, setContainerChassisNumber] = useState('');
  const [containerTerminal, setContainerTerminal] = useState('');
  const [containerVgmWeight, setContainerVgmWeight] = useState('');
  const [containerTemperature, setContainerTemperature] = useState('Ambient / Dry Cargo');
  const [containerCustomsStatus, setContainerCustomsStatus] = useState('');

  // ----------------------------------------------------
  // HEAVY FREIGHT SPECIFIC STATE (When shipmentType === 'Freight')
  // ----------------------------------------------------
  const [freightClass, setFreightClass] = useState('Class 50 (Clean dense freight)');
  const [freightNmfcCode, setFreightNmfcCode] = useState('');
  const [freightLoadingMethod, setFreightLoadingMethod] = useState('Standard Raised Commercial Loading Dock (48" Dock Height)');
  const [freightLiftgatePickup, setFreightLiftgatePickup] = useState(false);
  const [freightLiftgateDelivery, setFreightLiftgateDelivery] = useState(true);
  const [freightHazMat, setFreightHazMat] = useState(false);
  const [freightUnNumber, setFreightUnNumber] = useState('');
  const [freightPiecesCount, setFreightPiecesCount] = useState<number>(1);
  const [freightTotalWeightLbs, setFreightTotalWeightLbs] = useState<number>(0);

  // ----------------------------------------------------
  // DOCUMENT CARGO SPECIFIC STATE (When shipmentType === 'Document')
  // ----------------------------------------------------
  const [docEnvelopeType, setDocEnvelopeType] = useState(`${COMPANY_SHORT} Waterproof Legal Pouch (12×16 in)`);
  const [docSealNumber, setDocSealNumber] = useState(() => generateReference('seal'));
  const [docDirectSignOnly, setDocDirectSignOnly] = useState(true);
  const [docUrgentDeadline, setDocUrgentDeadline] = useState('By 10:30 AM Next Business Day (Priority Legal)');
  const [docFilingCourtRef, setDocFilingCourtRef] = useState('');
  const [docContentsDescription, setDocContentsDescription] = useState('');

  // ----------------------------------------------------
  // PETS & LIVE ANIMAL SPECIFIC STATE (When shipmentType === 'Pets')
  // ----------------------------------------------------
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('Canine (Dog)');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petGender, setPetGender] = useState('Male (Neutered)');
  const [petWeightLbs, setPetWeightLbs] = useState<number>(0);
  const [petMicrochip, setPetMicrochip] = useState('');
  const [petCollarTag, setPetCollarTag] = useState('');

  // Travel Crate & IATA LAR Compliance
  const [petCrateType, setPetCrateType] = useState('IATA LAR Certified Series 400 (Large Rigid Kennel - 36×25×27 in)');
  const [petCrateLength, setPetCrateLength] = useState<number>(0);
  const [petCrateWidth, setPetCrateWidth] = useState<number>(0);
  const [petCrateHeight, setPetCrateHeight] = useState<number>(0);
  const [petCrateWeightLbs, setPetCrateWeightLbs] = useState<number>(0);
  const [petIsBrachycephalic, setPetIsBrachycephalic] = useState<boolean>(false);

  // Veterinary & Health Certificates
  const [petHealthCertNumber, setPetHealthCertNumber] = useState('');
  const [petRabiesTag, setPetRabiesTag] = useState('');
  const [petVetClinic, setPetVetClinic] = useState('');
  const [petVetPhone, setPetVetPhone] = useState('');
  const [petAcclimationCert, setPetAcclimationCert] = useState<boolean>(true);

  // Care & Welfare Directives
  const [petLastFed, setPetLastFed] = useState('');
  const [petWaterProtocol, setPetWaterProtocol] = useState('');
  const [petSpecialInstructions, setPetSpecialInstructions] = useState('');
  const [petCareDirectives, setPetCareDirectives] = useState<string[]>([]);

  const handleTogglePetDirective = (directive: string) => {
    setPetCareDirectives(prev =>
      prev.includes(directive) ? prev.filter(d => d !== directive) : [...prev, directive]
    );
  };
  const [senderName, setSenderName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  // Language of the customer emails for this shipment (booking and payment confirmations, G.8).
  const [notifyLocale, setNotifyLocale] = useState<'en' | 'fr'>('en');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderCountry, setSenderCountry] = useState('');
  const [senderCity, setSenderCity] = useState('');
  const [senderState, setSenderState] = useState('');
  const [senderZip, setSenderZip] = useState('');

  const [recipientName, setRecipientName] = useState('');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCountry, setRecipientCountry] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('');
  const [recipientZip, setRecipientZip] = useState('');

  // Warns (doesn't block, same as dateOrderWarning below) when the State field isn't a real
  // US state/territory code. Geocoding silently falls back to the geographic center of the
  // continental US when it can't recognize a state at all — with a typo like a county name
  // ("DENTON" instead of "TX") that fallback previously had no visible signal at all, so a
  // real shipment's route/map/distance quietly rendered toward the wrong part of the country.
  const isRecognizedState = (raw: string): boolean => {
    const val = raw.trim().toUpperCase();
    if (!val) return true; // empty is handled elsewhere as required/optional, not a bad-value warning
    if (STATE_NAMES[val]) return true;
    return Object.values(STATE_NAMES).some(name => name.toUpperCase() === val);
  };
  const senderStateWarning = React.useMemo(() => {
    if (senderCountry !== 'US' || isRecognizedState(senderState)) return null;
    return TXT.unknownUsState(senderState);
  }, [senderState, senderCountry]);
  const recipientStateWarning = React.useMemo(() => {
    if (recipientCountry !== 'US' || isRecognizedState(recipientState)) return null;
    return TXT.unknownUsState(recipientState);
  }, [recipientState, recipientCountry]);

  // ----------------------------------------------------
  // STEP 3: Packages (For Non-Vehicle Cargo)
  // ----------------------------------------------------
  const [packagesList, setPackagesList] = useState<PackageItem[]>([
    { id: '1', type: 'Box', weightLbs: 0, length: 0, width: 0, height: 0, description: '' }
  ]);

  // ----------------------------------------------------
  // STEP 4: Route & Intake Location
  // ----------------------------------------------------
  const [initialLocationMode, setInitialLocationMode] = useState<'NOT_RECEIVED' | 'ORIGIN' | 'CUSTOM'>('ORIGIN');
  const [customInitialLocation, setCustomInitialLocation] = useState('');

  // ----------------------------------------------------
  // STEP 5: Service & Operational Requirements
  // ----------------------------------------------------
  // Pickup defaults to today (local date); the ETA fills in from the route once both ends are known.
  const [pickupDate, setPickupDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [pickupWindow, setPickupWindow] = useState('09:00 AM - 12:00 PM');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [expectedDeliveryDateTouched, setExpectedDeliveryDateTouched] = useState(false);

  // Warns (doesn't block — the admin can still legitimately need to record a same-day or
  // manually-overridden date) when the ETA is chronologically before the pickup date, e.g. a
  // typo'd manual override. Silently skips the check if either date can't be parsed rather
  // than showing a false warning on well-formed input this simple parser doesn't recognize.
  const dateOrderWarning = React.useMemo(() => {
    if (!pickupDate || !expectedDeliveryDate) return null;
    const pickup = new Date(pickupDate);
    const delivery = new Date(expectedDeliveryDate);
    if (isNaN(pickup.getTime()) || isNaN(delivery.getTime())) return null;
    if (delivery.getTime() < pickup.getTime()) {
      return TXT.deliveryBeforePickup(pickup.toLocaleDateString(consoleIntlLocale(), { month: 'long', day: 'numeric', year: 'numeric' }));
    }
    return null;
  }, [pickupDate, expectedDeliveryDate]);
  const [isFragile, setIsFragile] = useState(false);
  const [isOversized, setIsOversized] = useState(true);
  const [isSpecialHandling, setIsSpecialHandling] = useState(true);
  const [isSignatureRequired, setIsSignatureRequired] = useState(true);
  const [isOtherHandling, setIsOtherHandling] = useState(false);
  const [otherHandlingInstructions, setOtherHandlingInstructions] = useState('');

  // ----------------------------------------------------
  // STEP 6: Pricing (administrator only)
  // ----------------------------------------------------
  // Charges start at zero and are entered by staff: the console has no tariff for these lanes, and
  // an invented price must never reach a waybill or receipt (#184).
  const [baseRate, setBaseRate] = useState<number>(0);
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [surcharges, setSurcharges] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0.00);
  const [manualAdjustment, setManualAdjustment] = useState<number>(0.00);
  const [internalPricingNotes, setInternalPricingNotes] = useState('');

  // ----------------------------------------------------
  // STEP 7 / Creation State
  // ----------------------------------------------------
  // Set from the server's response on create: the server assigns every tracking ID
  // (BRAND_GUIDE §7). Until then the UI shows the TX······ placeholder.
  const [generatedTrackingNumber, setGeneratedTrackingNumber] = useState<string>('');
  const [createdShipmentRecord, setCreatedShipmentRecord] = useState<Shipment | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);

  // Optional payment request (docs/update.md D.2, D-9): the courier types the amount, reason and
  // this shipment's payment accounts here, before the tracking ID exists. It is saved through the
  // admin-only payment route right after the server assigns the ID (never through the public
  // booking POST). Not included in the browser draft save.
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [paymentSaveState, setPaymentSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [paymentSaveError, setPaymentSaveError] = useState('');

  // Live preview of the actual computed delivery plan (same engine used at final submit),
  // so the "Expected Delivery Date (ETA)" field shown to the admin reflects a real,
  // route-aware estimate instead of a static, unrelated hardcoded default — while still
  // letting the admin type their own override, which is honored once touched.
  const previewEstimatedDeliveryDate = React.useMemo(() => {
    try {
      // Offline, country-aware lookup; no estimate until both ends can be placed.
      const originGeo = resolveAddress({ city: senderCity, region: senderState, countryCode: senderCountry });
      const destGeo = resolveAddress({ city: recipientCity, region: recipientState, countryCode: recipientCountry });
      if (!originGeo || !destGeo) return null;
      const routeFrom = { lat: originGeo.lat, lng: originGeo.lng, name: originGeo.city };
      const routeTo = { lat: destGeo.lat, lng: destGeo.lng, name: destGeo.city };
      const routePlan = calculateRouteGeometry(
        routeFrom,
        routeTo,
        inferTransportMode({ mode: transportModeChoice === 'Auto' ? undefined : transportModeChoice, shipmentType, service, origin: routeFrom, destination: routeTo })
      );
      const plan = generateShipmentPlan(
        { city: originGeo.city, state: originGeo.state ?? '', facilityName: (originGeo as any).facilityName },
        { city: destGeo.city, state: destGeo.state ?? '', facilityName: (destGeo as any).facilityName },
        service,
        routePlan.distanceMiles,
        pickupDate
      );
      return plan.estimatedDeliveryDate;
    } catch {
      return null;
    }
  }, [senderCity, senderState, senderCountry, recipientCity, recipientState, recipientCountry, service, pickupDate, transportModeChoice, shipmentType]);

  useEffect(() => {
    if (!expectedDeliveryDateTouched && previewEstimatedDeliveryDate) {
      setExpectedDeliveryDate(previewEstimatedDeliveryDate);
    }
  }, [previewEstimatedDeliveryDate, expectedDeliveryDateTouched]);

  // Computed Totals for all Cargo Handling Categories
  const totalWeight = shipmentType === 'Vehicle'
    ? parseFloat(vehWeightLbs) || 0
    : shipmentType === 'Pallet'
    ? (palletCount || 1) * (palletWeightPerSkid || 0)
    : shipmentType === 'Container'
    ? parseFloat(containerVgmWeight) || 0
    : shipmentType === 'Freight'
    ? freightTotalWeightLbs || 0
    : shipmentType === 'Document'
    ? 0.5
    : shipmentType === 'Pets'
    ? (petWeightLbs || 0) + (petCrateWeightLbs || 0)
    : packagesList.reduce((acc, p) => acc + (Number(p.weightLbs) || 0), 0);

  const totalPieces = shipmentType === 'Vehicle'
    ? 1
    : shipmentType === 'Pallet'
    ? palletCount || 1
    : shipmentType === 'Container'
    ? 1
    : shipmentType === 'Freight'
    ? freightPiecesCount || 1
    : shipmentType === 'Document'
    ? 1
    : shipmentType === 'Pets'
    ? 1
    : packagesList.length;

  const finalPrice = Math.max(0, (baseRate + additionalCharges + surcharges + manualAdjustment) - discount);

  // Quick Copy Sender to Recipient
  const handleCopySenderToRecipient = () => {
    setRecipientName(senderName);
    setRecipientCompany(senderCompany);
    setRecipientEmail(senderEmail);
    setRecipientPhone(senderPhone);
    setRecipientAddress(senderAddress);
    setRecipientCountry(senderCountry);
    setRecipientCity(senderCity);
    setRecipientState(senderState);
    setRecipientZip(senderZip);
  };


  // Autonomous Geocoding on ZIP code change
  const handleSenderZipChange = (zip: string) => {
    setSenderZip(zip);
    if (senderCountry === 'US' && zip.trim().length >= 5) {
      const geo = resolveLocation(zip);
      if (geo) {
        setSenderCity(geo.city);
        setSenderState(geo.state ?? '');
      }
    }
  };

  const handleRecipientZipChange = (zip: string) => {
    setRecipientZip(zip);
    if (recipientCountry === 'US' && zip.trim().length >= 5) {
      const geo = resolveLocation(zip);
      if (geo) {
        setRecipientCity(geo.city);
        setRecipientState(geo.state ?? '');
      }
    }
  };

  // Add Package Item
  const handleAddPackage = () => {
    setPackagesList(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'Box',
        weightLbs: 0,
        length: 0,
        width: 0,
        height: 0,
        description: ''
      }
    ]);
  };

  // Remove Package Item
  const handleRemovePackage = (id: string) => {
    if (packagesList.length <= 1) return;
    setPackagesList(prev => prev.filter(p => p.id !== id));
  };

  // Update Package Field
  const handleUpdatePackage = (id: string, field: keyof PackageItem, value: any) => {
    setPackagesList(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Toggle Damage Checklist
  const handleToggleDamage = (item: string) => {
    setDamageChecklist(prev =>
      prev.includes(item) ? prev.filter(d => d !== item) : [...prev, item]
    );
  };

  // Toggle Item Received
  const handleToggleItemReceived = (item: string) => {
    setItemsReceived(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  // Load Preset Test Data (All Cargo Categories)
  // Quick presets set the cargo template only: type, category, service level, handling flags and
  // the document pouch rules. They never fill in identifiers, descriptions, weights or animal
  // details: those come from the real consignment (#184).
  const handleLoadPreset = (
    type: 'vehicle_suv' | 'skid_pallet' | 'ocean_container' | 'heavy_freight' | 'legal_doc' | 'live_pet' | 'parts_parcel' | 'electronics'
  ) => {
    if (type === 'vehicle_suv') {
      setShipmentType('Vehicle');
      setCargoCategory('Automotive & Parts');
      setService('Standard');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'skid_pallet') {
      setShipmentType('Pallet');
      setCargoCategory('General Cargo');
      setService('Standard');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'ocean_container') {
      setShipmentType('Container');
      setCargoCategory('General Cargo');
      setService('Standard');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'heavy_freight') {
      setShipmentType('Freight');
      setCargoCategory('Industrial Machinery');
      setService('Priority');
      setIsOversized(true);
      setIsSpecialHandling(true);
    } else if (type === 'legal_doc') {
      setShipmentType('Document');
      setCargoCategory('Legal & Documents');
      setDocDirectSignOnly(true);
      setService('Priority');
      setIsSignatureRequired(true);
    } else if (type === 'live_pet') {
      setShipmentType('Pets');
      setCargoCategory('Live Animals & Pets (USDA / IPATA Regulated)');
      setService('Priority');
      setIsSpecialHandling(true);
    } else if (type === 'parts_parcel') {
      setShipmentType('Parcel');
      setCargoCategory('General Cargo');
      setService('Express');
      setIsOversized(false);
    } else {
      setShipmentType('Parcel');
      setCargoCategory('Electronics & Tech');
      setService('Express');
      setIsOversized(false);
    }
  };

  // Save Draft
  const handleSaveDraft = () => {
    const draftData = {
      shipmentType,
      cargoCategory,
      shipmentDescription,
      service,
      customerRef,
      senderName,
      senderCity,
      recipientName,
      recipientCity,
      packagesList,
      vehVin,
      finalPrice
    };
    try {
      localStorage.setItem('tx_admin_shipment_draft', JSON.stringify(draftData));
      setDraftSavedToast(TXT.draftManifestSavedToLocal);
      setTimeout(() => setDraftSavedToast(null), 3000);
    } catch {
      setDraftSavedToast(TXT.draftSaved);
      setTimeout(() => setDraftSavedToast(null), 3000);
    }
  };

  const handleNextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Saves the step-5 payment request once the shipment has its tracking ID. A failure never undoes
  // the shipment: the success screen says so and offers a retry.
  const savePaymentRequest = async (trackingNumber: string) => {
    setPaymentSaveState('saving');
    setPaymentSaveError('');
    try {
      await api.saveShipmentPayment(trackingNumber, draftToRequest(paymentDraft));
      setPaymentSaveState('saved');
    } catch (err: any) {
      setPaymentSaveState('failed');
      setPaymentSaveError(err?.message || TXT.theServerDidNotRespond);
    }
  };

  // The cargo facts a waybill needs. Nothing is pre-filled (#184), so they are checked here; the
  // messages show on step 1 (description) and step 3 (cargo details).
  const cargoDraftErrors = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!shipmentDescription.trim()) e.shipmentDescription = TXT.describeTheCargo;
    const missing: string[] = [];
    if (shipmentType === 'Vehicle') {
      if (!vehMake.trim()) e.vehMake = TXT.enterTheMake;
      if (!vehModel.trim()) e.vehModel = TXT.enterTheModel;
      if (!/^\d{4}$/.test(vehYear.trim())) missing.push(TXT.theVehicleYear4Digits);
      if (!(parseFloat(vehWeightLbs) > 0)) missing.push(TXT.theVehicleWeight);
    } else if (shipmentType === 'Pallet') {
      if (!(palletCount >= 1)) missing.push(TXT.theNumberOfPallets);
      if (!(palletWeightPerSkid > 0)) missing.push(TXT.theWeightPerPallet);
    } else if (shipmentType === 'Container') {
      if (!containerNumber.trim()) missing.push(TXT.theContainerNumber);
      if (!(parseFloat(containerVgmWeight) > 0)) missing.push(TXT.theVerifiedGrossMassVgm);
    } else if (shipmentType === 'Freight') {
      if (!(freightTotalWeightLbs > 0)) missing.push(TXT.theTotalFreightWeight);
    } else if (shipmentType === 'Pets') {
      if (!petName.trim()) missing.push(TXT.theAnimalSName);
      if (!(petWeightLbs > 0)) missing.push(TXT.theAnimalSWeight);
    } else if (shipmentType !== 'Document' && (packagesList.length === 0 || packagesList.some((p) => !(p.weightLbs > 0)))) {
      missing.push(TXT.aWeightForEveryPackage);
    }
    if (missing.length) e.cargo = TXT.stillNeeded(missing.join(', '));
    if (Object.keys(e).length) e.submit = TXT.someCargoDetailsAreMissing;
    return e;
  };

  // Final Action: Create Shipment
  const handleFinalCreateShipment = async () => {
    if (isCreatingShipment) return;
    const cargoProblems = cargoDraftErrors();
    if (Object.keys(cargoProblems).length) {
      setErrors(cargoProblems);
      setCurrentStep(cargoProblems.shipmentDescription ? 1 : 3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors({});
    // Check the optional payment request first, so nothing is created while it still has errors.
    if (paymentEnabled) {
      const paymentProblems = paymentDraftErrors(paymentDraft);
      if (Object.keys(paymentProblems).length) {
        setPaymentErrors(paymentProblems);
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setIsCreatingShipment(true);
    // Piece labels (TXxxxxxx-NN) are stamped from the server-assigned ID in createShipment.
    const formattedPieces = shipmentType === 'Vehicle'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Vehicle Manifest Created' : 'Vehicle Ingested & Inspected',
            currentLocation: [senderCity.trim(), shortRegion(senderCountry, senderState)].filter(Boolean).join(', '),
            weightLbs: parseFloat(vehWeightLbs) || 0,
            dimensions: {
              length: parseFloat(vehLengthIn) || 0,
              width: parseFloat(vehWidthIn) || 0,
              height: parseFloat(vehHeightIn) || 0
            }
          }
        ]
      : shipmentType === 'Pallet'
      ? Array.from({ length: Math.max(1, palletCount) }, (_, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          pieceNumber: idx + 1,
          totalPieces: palletCount,
          trackingNumber: '',
          status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
          statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Skid Manifested' : 'Skid Received & Scanned',
          currentLocation: `${senderCity}, ${senderState}`,
          weightLbs: palletWeightPerSkid,
          dimensions: {
            length: 48,
            width: 40,
            height: palletHeightIn || 0
          }
        }))
      : shipmentType === 'Container'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Container Booked' : 'Container Ingested at Terminal',
            currentLocation: `${senderCity}, ${senderState}`,
            weightLbs: parseFloat(containerVgmWeight) || 0,
            dimensions: {
              length: 480,
              width: 96,
              height: 114
            }
          }
        ]
      : shipmentType === 'Freight'
      ? Array.from({ length: Math.max(1, freightPiecesCount) }, (_, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          pieceNumber: idx + 1,
          totalPieces: freightPiecesCount,
          trackingNumber: '',
          status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
          statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Freight Linehaul Manifested' : 'Freight Ingested at Raised Dock',
          currentLocation: `${senderCity}, ${senderState}`,
          weightLbs: Math.round(freightTotalWeightLbs / (freightPiecesCount || 1)),
          dimensions: {
            length: 60,
            width: 48,
            height: 52
          }
        }))
      : shipmentType === 'Document'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Document Pouch Registered' : 'Document Pouch Sealed & Logged',
            currentLocation: `${senderCity}, ${senderState}`,
            weightLbs: 0.5,
            dimensions: {
              length: 16,
              width: 12,
              height: 1
            }
          }
        ]
      : shipmentType === 'Pets'
      ? [
          {
            id: '01',
            pieceNumber: 1,
            totalPieces: 1,
            trackingNumber: '',
            status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
            statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Pet Relocation Manifest Created' : 'Live Pet Health Ingested & Staged',
            currentLocation: `${senderCity}, ${senderState}`,
            weightLbs: (petWeightLbs || 0) + (petCrateWeightLbs || 0),
            dimensions: {
              length: petCrateLength || 0,
              width: petCrateWidth || 0,
              height: petCrateHeight || 0
            }
          }
        ]
      : packagesList.map((p, idx) => ({
          id: String(idx + 1).padStart(2, '0'),
          pieceNumber: idx + 1,
          totalPieces: packagesList.length,
          trackingNumber: '',
          status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
          statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Shipment Created' : 'Shipment Received at Origin',
          currentLocation: `${senderCity}, ${senderState}`,
          weightLbs: p.weightLbs,
          dimensions: {
            length: p.length,
            width: p.width,
            height: p.height
          }
        }));

    // Country is picked from the list; the country-aware lookup is instant for gateways and
    // U.S. metros and asks the live geocoder (restricted to that country) for anything else.
    // An address that can't be placed stops here instead of landing somewhere made up.
    if (!senderCountry || !recipientCountry || !senderCity.trim() || !recipientCity.trim()) {
      setErrors({ submit: TXT.chooseCountryAndCity });
      setIsCreatingShipment(false);
      return;
    }
    const [originGeo, destGeo] = await Promise.all([
      resolveAddressPrecise({ street: senderAddress, city: senderCity, region: senderState, countryCode: senderCountry }, getCountry(senderCountry)?.name),
      resolveAddressPrecise({ street: recipientAddress, city: recipientCity, region: recipientState, countryCode: recipientCountry }, getCountry(recipientCountry)?.name)
    ]);
    if (!originGeo || !destGeo) {
      const missing = !originGeo ? `${senderCity}, ${getCountry(senderCountry)?.name}` : `${recipientCity}, ${getCountry(recipientCountry)?.name}`;
      setErrors({ submit: TXT.couldNotLocate(missing) });
      setIsCreatingShipment(false);
      return;
    }
    const originRegion = shortRegion(senderCountry, senderState) || originGeo.state || '';
    const destRegion = shortRegion(recipientCountry, recipientState) || destGeo.state || '';
    const routeFrom = { lat: originGeo.lat, lng: originGeo.lng, name: originGeo.city };
    const routeTo = { lat: destGeo.lat, lng: destGeo.lng, name: destGeo.city };
    const chosenMode = transportModeChoice === 'Auto' ? undefined : transportModeChoice;
    const routePlan = calculateRouteGeometry(
      routeFrom,
      routeTo,
      inferTransportMode({ mode: chosenMode, shipmentType, service, origin: routeFrom, destination: routeTo })
    );
    const shipmentPlan = generateShipmentPlan(
      { city: originGeo.city, state: originGeo.state ?? '', facilityName: originGeo.facilityName },
      { city: destGeo.city, state: destGeo.state ?? '', facilityName: destGeo.facilityName },
      service,
      routePlan.distanceMiles,
      pickupDate
    );

    const initialTimeline: TrackingEvent[] = [
      {
        id: `evt-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        timezone: originGeo.timezone,
        displayDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        displayTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        title: initialLocationMode === 'NOT_RECEIVED'
          ? (shipmentType === 'Vehicle' ? 'Vehicle Consignment Registered' :
             shipmentType === 'Pallet' ? 'Pallet Consignment Registered' :
             shipmentType === 'Container' ? 'Intermodal FCL Booking Registered' :
             shipmentType === 'Freight' ? 'Freight Linehaul Tender Registered' :
             shipmentType === 'Document' ? 'Document Chain of Custody Registered' :
             shipmentType === 'Pets' ? 'Live Pet Transport Booking Registered' :
             'Shipment Record Created')
          : (shipmentType === 'Vehicle' ? `Vehicle Received & Inspected — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Pallet' ? `Pallet Skids Ingested & Scanned — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Container' ? `FCL Container Ingested at Terminal — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Freight' ? `Heavy Freight Ingested at Dock — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Document' ? `Document Pouch Sealed & Logged — ${originGeo.city}, ${originGeo.state}` :
             shipmentType === 'Pets' ? `Live Animal (${petName}) Ingested & Health Inspected — ${originGeo.city}, ${originGeo.state}` :
             'Shipment Received & Ingested'),
        facility: initialLocationMode === 'CUSTOM' ? customInitialLocation : originGeo.facilityName,
        city: originGeo.city,
        state: originGeo.state ?? '',
        description: initialLocationMode === 'NOT_RECEIVED'
          ? `Physical waybill registered by ${ADMIN_ROLE_LABEL}. Awaiting carrier collection.`
          : (shipmentType === 'Vehicle'
              ? `${vehYear} ${vehMake} ${vehModel} (VIN: ${vehVin}) inspected and physically received. Key custody verified.`
              : shipmentType === 'Pallet'
              ? `${palletCount} skids (${palletStandard}) verified. Stackability: ${palletStackable ? 'Stackable' : 'Non-Stackable (Top-Tier)'}. ISPM-15 compliant.`
              : shipmentType === 'Container'
              ? `Container ${containerNumber} received at terminal. Bolt Seal: ${containerBoltSeal}. VGM: ${bothUnits(containerVgmWeight)}.`
              : shipmentType === 'Freight'
              ? `Heavy freight (${freightClass}, ${freightNmfcCode}) received via commercial raised dock. Liftgate delivery: ${freightLiftgateDelivery ? 'Yes' : 'No'}.`
              : shipmentType === 'Document'
              ? `Security Pouch Sealed (${docSealNumber}). Direct consignee signature directive active.`
              : shipmentType === 'Pets'
              ? `Live animal ${petName} (${petBreed}, ${bothUnits(petWeightLbs)}) received. Microchip ${petMicrochip} verified against CVI #${petHealthCertNumber}. Dual dishes & climate kennel confirmed.`
              : `Shipment physically received at ${originGeo.city}, ${originGeo.state}. Code 128 barcode applied.`),
        isCurrent: true,
        isCompleted: true,
        operatorId: ADMIN_ROLE_LABEL
      }
    ];

    const newShipmentRecord: Shipment = {
      trackingNumber: '',
      status: (initialLocationMode === 'NOT_RECEIVED' ? 'BOOKED' : 'RECEIVED') as ShipmentStatus,
      statusText: initialLocationMode === 'NOT_RECEIVED' ? 'Manifest Created' : 'Received at Origin Facility',
      health: 'ON_TRACK',
      healthExplanation: 'Consignment created on schedule with verified physical barcodes.',
      progressPercent: initialLocationMode === 'NOT_RECEIVED' ? 0 : 5,
      shipmentType: shipmentType === 'Multi-piece' ? 'Parcel' : shipmentType,
      cargoCategory,
      cargoDescription: shipmentDescription,
      petDetails: shipmentType === 'Pets' ? {
        name: petName,
        species: petSpecies,
        breed: petBreed,
        age: petAge,
        gender: petGender,
        microchipNumber: petMicrochip,
        weightLbs: petWeightLbs,
        crateType: petCrateType,
        crateDimensions: { length: petCrateLength, width: petCrateWidth, height: petCrateHeight },
        healthCertificateNumber: petHealthCertNumber,
        rabiesVaccineNumber: petRabiesTag,
        vetClinicName: petVetClinic,
        vetPhone: petVetPhone,
        isBrachycephalic: petIsBrachycephalic,
        acclimationCertified: petAcclimationCert,
        lastFedTimestamp: petLastFed,
        waterRefillProtocol: petWaterProtocol,
        specialCareNotes: petSpecialInstructions
      } : undefined,
      vehicleDetails: shipmentType === 'Vehicle' ? {
        make: vehMake,
        model: vehModel,
        year: parseInt(vehYear) || 0,
        vin: vehVin,
        color: vehColor,
        bodyType: vehBodyType,
        operable: vehOperable,
        condition: vehCondition,
        existingDamage: damageChecklist,
        inspectionNotes,
        itemsReceived
      } : undefined,
      palletDetails: shipmentType === 'Pallet' ? {
        standard: palletStandard,
        count: palletCount,
        weightPerSkidLbs: palletWeightPerSkid,
        heightIn: palletHeightIn,
        stackable: palletStackable,
        forkliftAccess: palletForkliftAccess,
        securingChecks: palletSecuringChecks
      } : undefined,
      containerDetails: shipmentType === 'Container' ? {
        containerNumber,
        isoSize: containerIsoSize,
        boltSeal: containerBoltSeal,
        chassisNumber: containerChassisNumber,
        terminal: containerTerminal,
        vgmWeightLbs: parseFloat(containerVgmWeight) || 0,
        temperature: containerTemperature,
        customsStatus: containerCustomsStatus
      } : undefined,
      freightDetails: shipmentType === 'Freight' ? {
        freightClass,
        nmfcCode: freightNmfcCode,
        loadingMethod: freightLoadingMethod,
        liftgatePickup: freightLiftgatePickup,
        liftgateDelivery: freightLiftgateDelivery,
        hazMat: freightHazMat,
        unNumber: freightUnNumber || undefined,
        piecesCount: freightPiecesCount,
        totalWeightLbs: freightTotalWeightLbs
      } : undefined,
      documentDetails: shipmentType === 'Document' ? {
        envelopeType: docEnvelopeType,
        sealNumber: docSealNumber,
        directSignOnly: docDirectSignOnly,
        urgentDeadline: docUrgentDeadline,
        filingCourtRef: docFilingCourtRef || undefined,
        contentsDescription: docContentsDescription
      } : undefined,
      service: service === 'Priority' ? 'Priority' : service === 'Freight' ? 'Freight LTL' : service === 'Standard' ? 'Standard' : 'Express',
      transportMode: chosenMode,
      shipmentDate: new Date().toISOString().split('T')[0],
      // Honors the admin's manual ETA override if they typed one; otherwise this already
      // equals the same route-aware calculated date shown live in the Service step.
      estimatedDelivery: expectedDeliveryDate || shipmentPlan.estimatedDeliveryDate,
      estimatedDeliveryDetail: 'by ' + shipmentPlan.estimatedDeliveryTime,
      currentLocation: {
        city: senderCity.trim() || originGeo.city,
        state: originRegion,
        lat: originGeo.lat,
        lng: originGeo.lng,
        facility: initialLocationMode === 'CUSTOM' ? customInitialLocation : originGeo.facilityName
      } as any,
      currentFacility: initialLocationMode === 'CUSTOM' ? customInitialLocation : originGeo.facilityName,
      lastUpdated: 'Just now',
      nextStep: shipmentType === 'Vehicle' ? 'Corridor Dispatch & Staging' : 'Linehaul Sorting & Dispatch',
      nextStepLocation: `${originGeo.city} Sort Gateway`,
      origin: {
        city: senderCity.trim() || originGeo.city,
        state: originRegion,
        country: getCountry(senderCountry)?.name || '',
        lat: originGeo.lat,
        lng: originGeo.lng,
        facility: originGeo.facilityName
      } as any,
      destination: {
        city: recipientCity.trim() || destGeo.city,
        state: destRegion,
        country: getCountry(recipientCountry)?.name || '',
        lat: destGeo.lat,
        lng: destGeo.lng,
        facility: destGeo.facilityName
      } as any,
      notifyLocale,
      sender: {
        name: senderName.trim() || 'Sender / Shipper',
        company: senderCompany.trim(),
        addressLine: senderAddress.trim(),
        city: senderCity.trim() || originGeo.city,
        state: originRegion,
        region: senderState.trim() || undefined,
        postalCode: senderZip.trim() || undefined,
        phone: senderPhone.trim(),
        email: senderEmail.trim(),
        country: getCountry(senderCountry)?.name || '',
        countryCode: senderCountry
      },
      recipient: {
        name: recipientName.trim() || 'Consignee / Recipient',
        company: recipientCompany.trim(),
        addressLine: recipientAddress.trim(),
        city: recipientCity.trim() || destGeo.city,
        state: destRegion,
        region: recipientState.trim() || undefined,
        postalCode: recipientZip.trim() || undefined,
        phone: recipientPhone.trim(),
        email: recipientEmail.trim(),
        country: getCountry(recipientCountry)?.name || '',
        countryCode: recipientCountry
      },
      totalWeightLbs: totalWeight,
      totalPieces: totalPieces,
      dimensions: shipmentType === 'Vehicle'
        ? { length: parseFloat(vehLengthIn) || 0, width: parseFloat(vehWidthIn) || 0, height: parseFloat(vehHeightIn) || 0 }
        : (packagesList[0] ? { length: packagesList[0].length, width: packagesList[0].width, height: packagesList[0].height } : { length: 12, width: 12, height: 12 }),
      references: {
        customerReference: customerRef || undefined,
        orderNumber: internalRef || undefined,
        invoiceNumber: invoiceRef || undefined
      },
      routeCheckpoints: [
        { id: '1', name: `${originGeo.city}, ${originGeo.state}`, state: originGeo.state ?? '', type: 'origin', statusLabel: 'Ingested', lat: originGeo.lat, lng: originGeo.lng },
        { id: '2', name: `${destGeo.city}, ${destGeo.state}`, state: destGeo.state ?? '', type: 'destination', statusLabel: 'Destination', lat: destGeo.lat, lng: destGeo.lng }
      ],
      timeline: initialTimeline,
      pieces: formattedPieces,
      passportStages: [
        { id: 'p1', label: 'Tender Registered', sublabel: `${senderCity} Origin`, status: 'completed' },
        { id: 'p2', label: 'Corridor Movement', sublabel: 'En Route', status: 'upcoming' },
        { id: 'p3', label: 'Destination Arrival', sublabel: `${recipientCity} Hub`, status: 'upcoming' },
        { id: 'p4', label: 'Final Handover', sublabel: 'Signature Required', status: 'upcoming' }
      ],
      handlingRequirements: {
        fragile: isFragile,
        oversized: isOversized,
        specialHandling: isSpecialHandling,
        signatureRequired: isSignatureRequired,
        otherInstructions: isOtherHandling ? otherHandlingInstructions : undefined
      },
      pickupWindow: `${pickupDate} · ${pickupWindow}`,
      internalPricingNote: internalPricingNotes || undefined
    };

    // 1. Save into central Admin Context & persistent database. The server assigns the
    // tracking ID; everything below uses the one it returned.
    let created: Shipment;
    try {
      created = await createShipment(newShipmentRecord);
    } catch (err: any) {
      setErrors({ submit: TXT.registerFailed(err?.message || TXT.serverDidNotRespond) });
      setIsCreatingShipment(false);
      return;
    }
    const trackingNumber = created.trackingNumber;
    setGeneratedTrackingNumber(trackingNumber);

    // 1b. The optional payment request, now that the tracking ID exists.
    if (paymentEnabled) await savePaymentRequest(trackingNumber);

    // 2. Automatically generate the transport document (Bill of Lading, or Air Waybill for air)
    // in the Document Center, from what was entered in the wizard only: the seal is the real
    // document-pouch seal (document shipments), instructions are the admin's own handling notes.
    const bolSealNumber = shipmentType === 'Document' ? docSealNumber : undefined;
    const bolSpecialInstructions = newShipmentRecord.handlingRequirements?.otherInstructions || undefined;

    try {
      generateDocument({
        docType: 'BOL',
        title: `${documentTitle('BOL', created.transportMode || newShipmentRecord.transportMode)} (${trackingNumber})`,
        shipmentTracking: trackingNumber,
        senderName: senderName || 'Origin Consignor',
        senderCompany: senderCompany || '',
        senderAddress: senderAddress,
        senderCity: senderCity,
        senderState: originRegion,
        senderZip: senderZip,
        senderPhone: senderPhone,
        recipientName: recipientName || 'Destination Consignee',
        recipientCompany: recipientCompany || '',
        recipientAddress: recipientAddress,
        recipientCity: recipientCity,
        recipientState: destRegion,
        recipientZip: recipientZip,
        recipientPhone: recipientPhone,
        cargoDescription: shipmentDescription || 'Commercial Freight Cargo',
        shipmentType: shipmentType,
        service: service,
        weightLbs: totalWeight,
        pieces: totalPieces,
        dimensions: `${newShipmentRecord.dimensions.length}x${newShipmentRecord.dimensions.width}x${newShipmentRecord.dimensions.height} in`,
        declaredValue: newShipmentRecord.declaredValue || 0,
        charges: {
          baseAmount: baseRate,
          oversizeFee: additionalCharges,
          specialHandlingFee: surcharges,
          // Include the discount/manual adjustment the admin set in Step 5 so the total
          // matches the "Final Price" the admin approved. No tax or fuel line is invented.
          totalAmount: Math.max(0, baseRate + additionalCharges + surcharges + manualAdjustment - discount),
          paymentStatus: 'PAID'
        },
        bolCarrier: LEGAL_NAME,
        bolSealNumber,
        bolSpecialInstructions,
        fileSize: '148 KB'
      });
    } catch (e) {
      console.warn('Auto BOL document creation:', e);
    }

    setCreatedShipmentRecord(created);
    setIsCreatingShipment(false);
  };

  const handleCopySuccessTracking = () => {
    navigator.clipboard.writeText(generatedTrackingNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // ----------------------------------------------------
  // SUCCESS STATE VIEW
  // ----------------------------------------------------
  if (createdShipmentRecord) {
    return (
      <div className="shipment-success-view-container animate-fade-in">
        <div className="success-card-panel">
          <div className="success-header-badge">
            <div className="success-icon-wrap">
              <CheckCircle2 size={32} className="text-emerald" />
            </div>
            <h2>{TXT.shipmentCreatedSuccessfully}</h2>
            <p>{TXT.theShipmentRecordAndIts}</p>
          </div>

          {/* Tracking Identity Section */}
          <div className="success-identity-box">
            <span className="identity-label">{TXT.officialTrackingNumber}</span>
            <div className="identity-code-row">
              <strong className="tracking-val font-mono">{generatedTrackingNumber}</strong>
              <button
                className="identity-copy-btn"
                onClick={handleCopySuccessTracking}
                title={TXT.copyTrackingNumber}
              >
                {isCopied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                <span>{isCopied ? TXT.copied : TXT.copy}</span>
              </button>
            </div>

            {/* Real Code 128 barcode of the new tracking ID */}
            <div className="traditional-barcode-card">
              <TrackingBarcode value={generatedTrackingNumber} height={48} width={1.6} fontSize={12} />
            </div>
          </div>

          {/* Route Summary */}
          <div className="success-route-grid">
            <div className="route-node">
              <span className="r-label">{TXT.origin2}</span>
              <strong>{senderCity}, {senderState}</strong>
              <small>{senderName}</small>
            </div>
            <div className="route-arrow-icon">
              <ArrowRight size={20} className="text-blue" />
            </div>
            <div className="route-node">
              <span className="r-label">{TXT.destination2}</span>
              <strong>{recipientCity}, {recipientState}</strong>
              <small>{recipientName}</small>
            </div>
          </div>

          {/* Key Specs Row */}
          <div className="success-specs-strip">
            <div className="spec-item">
              <span className="s-label">{TXT.type2}</span>
              <strong>{TXT.shipmentTypes[shipmentType]}</strong>
            </div>
            <div className="spec-item">
              <span className="s-label">{TXT.cargo}</span>
              <strong className="truncate-cargo">{shipmentDescription}</strong>
            </div>
            <div className="spec-item">
              <span className="s-label">{TXT.service2}</span>
              <strong>{service}</strong>
            </div>
            <div className="spec-item">
              <span className="s-label">{TXT.totalWeight2}</span>
              <strong>{formatWeight(totalWeight, units.system)}</strong>
            </div>
          </div>

          {/* Payment request from step 5, saved once the tracking ID existed (update D.2). */}
          {paymentSaveState !== 'idle' && (
            <div className={`success-payment-status is-${paymentSaveState}`} role="status" aria-live="polite">
              {paymentSaveState === 'saving' && <span>{TXT.savingThePaymentRequest}</span>}
              {paymentSaveState === 'saved' && (
                <span>{TXT.paymentRequestSaved} {paymentDraftSummary(paymentDraft)}{TXT.theCustomerSeesItOn}</span>
              )}
              {paymentSaveState === 'failed' && (
                <>
                  <span>
                    {TXT.theShipmentWasCreatedBut}{paymentSaveError}{TXT.tryAgainOrAddIt}
                  </span>
                  <button type="button" className="success-payment-retry" onClick={() => savePaymentRequest(generatedTrackingNumber)}>
                    {TXT.tryAgain}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Optional step: package images, now that the server has assigned the tracking ID. */}
          {generatedTrackingNumber && can('shipments.edit') && (
            <div className="success-images-step">
              <ShipmentImagesPanel trackingNumber={generatedTrackingNumber} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="success-action-buttons-grid">
            <button
              className="action-btn primary"
              onClick={() => onOpenShipmentDetail(generatedTrackingNumber)}
            >
              <FileText size={16} />
              <span>{TXT.viewShipmentRecord}</span>
            </button>
            <button
              className="action-btn secondary"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              <span>{TXT.printWaybillLabel}</span>
            </button>
            <button
              className="action-btn secondary"
              onClick={() => onSelectView('document-center')}
            >
              <FileCheck size={16} />
              <span>{TXT.generateDocuments}</span>
            </button>
            <button
              className="action-btn secondary"
              onClick={() => {
                setCreatedShipmentRecord(null);
                setCurrentStep(1);
                setGeneratedTrackingNumber('');
                setPaymentEnabled(false);
                setPaymentDraft(emptyPaymentDraft());
                setPaymentErrors({});
                setPaymentSaveState('idle');
                setPaymentSaveError('');
              }}
            >
              <Plus size={16} />
              <span>{TXT.createAnotherShipment}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN MULTI-STEP WORKSPACE VIEW
  // ----------------------------------------------------
  return (
    <div className="tx-create-shipment-workspace">
      {draftSavedToast && (
        <div className="draft-saved-toast animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{draftSavedToast}</span>
        </div>
      )}

      {/* 1. TOP TITLE & WORKSPACE ACTIONS BAR */}
      <div className="workspace-top-bar">
        <div className="bar-left">
          <button className="back-link-btn" onClick={() => onSelectView('all-shipments')}>
            <ArrowLeft size={14} />
            <span>{TXT.allShipments}</span>
          </button>
          <div className="page-heading-wrap">
            <h2>{TXT.bookMasterConsignment}</h2>
            <p>{TXT.registerFreightVehiclesParcelsOr}</p>
          </div>
        </div>

        <div className="bar-right">
          <div className="preset-quick-pills">
            <span className="preset-caption">{TXT.quickPresets2}</span>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('vehicle_suv')}>
              <Car size={13} className="preset-icon-car" />
              <span>{TXT.vehicle}</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('live_pet')}>
              <PawPrint size={13} className="preset-icon-pet" />
              <span>{TXT.livePet}</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('skid_pallet')}>
              <Layers size={13} className="preset-icon-pallet" />
              <span>{TXT.palletSkids}</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('ocean_container')}>
              <Container size={13} className="preset-icon-container" />
              <span>{TXT.container}</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('heavy_freight')}>
              <Truck size={13} className="preset-icon-freight" />
              <span>{TXT.heavyFreight}</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('legal_doc')}>
              <FileText size={13} className="preset-icon-doc" />
              <span>{TXT.legalDoc}</span>
            </button>
            <button type="button" className="preset-pill" onClick={() => handleLoadPreset('parts_parcel')}>
              <Package size={13} className="preset-icon-pkg" />
              <span>{TXT.parcel}</span>
            </button>
          </div>
          <button type="button" className="save-draft-btn" onClick={handleSaveDraft}>
            <Save size={14} />
            <span>{TXT.saveDraft}</span>
          </button>
        </div>
      </div>

      {/* 2. PROGRESS STEP WIDGET (01 to 06) */}
      <div className="step-progress-container">
        {[
          { num: 1, label: TXT.shipment, desc: TXT.typeRefs },
          { num: 2, label: TXT.parties, desc: TXT.shipperConsignee },
          {
            num: 3,
            label: shipmentType === 'Vehicle' ? TXT.vehicleCargo
                 : shipmentType === 'Pallet' ? TXT.palletDeck
                 : shipmentType === 'Container' ? TXT.containerDeck
                 : shipmentType === 'Freight' ? TXT.freightDeck
                 : shipmentType === 'Document' ? TXT.documentDeck
                 : shipmentType === 'Pets' ? TXT.liveAnimalDeck
                 : TXT.packages,
            desc: shipmentType === 'Vehicle' ? TXT.specsInspection
                : shipmentType === 'Pallet' ? TXT.skidsStackability
                : shipmentType === 'Container' ? TXT.isoBoltSeal
                : shipmentType === 'Freight' ? TXT.classDockAccess
                : shipmentType === 'Document' ? TXT.securityCustody
                : shipmentType === 'Pets' ? TXT.healthCrateCare
                : TXT.itemManifest
          },
          { num: 4, label: TXT.service, desc: TXT.tierHandling },
          { num: 5, label: TXT.pricing, desc: TXT.tariffRating },
          { num: 6, label: TXT.reviewCreate, desc: TXT.issueWaybill }
        ].map((s) => {
          const isCompleted = currentStep > s.num;
          const isCurrent = currentStep === s.num;
          return (
            <button
              key={s.num}
              type="button"
              className={`step-pill ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => setCurrentStep(s.num)}
            >
              <span className="step-index">
                {isCompleted ? <Check size={11} strokeWidth={3} /> : `0${s.num}`}
              </span>
              <div className="step-label-stack">
                <span className="step-text">{s.label}</span>
                <span className="step-sub">{s.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. MAIN CONTENT: FORM STEP (LEFT) + LIVE SHIPMENT SUMMARY (RIGHT) */}
      <div className="step-form-grid-layout">
        {/* FORM WORKSPACE (LEFT) */}
        <div className="step-form-card">
          {/* ---------------------------------------------------- */}
          {/* STEP 1: SHIPMENT INFORMATION */}
          {/* ---------------------------------------------------- */}
          {currentStep === 1 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <div className="step-heading-badge">{TXT.step01}</div>
                <h3>{TXT.shipmentClassificationIdentifiers}</h3>
                <p>{TXT.establishWhatTheCargoIs}</p>
              </div>

              {/* Shipment Type Big Visual Selection */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.cargoHandlingCategory}</label>
                <div className="shipment-type-tiles-grid">
                  {[
                    { id: 'Parcel', label: TXT.parcel, icon: <Package size={19} />, colorClass: 'accent', desc: TXT.boxedGoodsParts },
                    { id: 'Vehicle', label: TXT.vehicle, icon: <Car size={19} />, colorClass: 'blue', desc: TXT.carsTrucksAutos },
                    { id: 'Pets', label: TXT.livePets, icon: <PawPrint size={19} />, colorClass: 'rose', desc: TXT.liveAnimalTransport },
                    { id: 'Document', label: TXT.document, icon: <FileText size={19} />, colorClass: 'green', desc: TXT.envelopesContracts },
                    { id: 'Freight', label: TXT.freight, icon: <Truck size={19} />, colorClass: 'purple', desc: TXT.heavyOversizedLinehaul },
                    { id: 'Pallet', label: TXT.pallet, icon: <Layers size={19} />, colorClass: 'amber', desc: TXT.skiddedPalletizedCargo },
                    { id: 'Container', label: TXT.container, icon: <Container size={19} />, colorClass: 'navy', desc: TXT.sealed20ft40ftContainer },
                    { id: 'Multi-piece', label: TXT.multiPiece, icon: <Box size={19} />, colorClass: 'indigo', desc: TXT.groupedParcelManifest }
                  ].map(t => {
                    const isSelected = shipmentType === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`type-tile ${isSelected ? 'active' : ''}`}
                        onClick={() => setShipmentType(t.id as ShipmentTypeOption)}
                      >
                        {isSelected && (
                          <span className="type-tile-selected-badge">
                            <Check size={9} strokeWidth={3.5} />
                          </span>
                        )}
                        <div className={`tile-circle-icon ${t.colorClass}`}>
                          {t.icon}
                        </div>
                        <strong className="tile-title">{t.label}</strong>
                        <small className="tile-desc">{t.desc}</small>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cargo Category & Free-form Description */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.cargoContentDescription}</label>
                <p className="field-hint-txt">{TXT.describeTheItemsCommoditiesOr}</p>
                <div className="input-grid-2">
                  <div className="input-field">
                    <label>{TXT.cargoCategory}</label>
                    <select
                      value={cargoCategory}
                      onChange={e => setCargoCategory(e.target.value)}
                    >
                      <option value="Automotive & Parts">{TXT.automotiveParts}</option>
                      <option value="Live Animals & Pets (USDA / IPATA Regulated)">{TXT.liveAnimalsPetsUsdaIpata}</option>
                      <option value="General Cargo">{TXT.generalCargo}</option>
                      <option value="Electronics & Tech">{TXT.electronicsTech}</option>
                      <option value="Industrial Machinery">{TXT.industrialMachinery}</option>
                      <option value="Medical & BioTech">{TXT.medicalBiotech}</option>
                      <option value="Apparel & Textiles">{TXT.apparelTextiles}</option>
                      <option value="Legal & Documents">{TXT.legalDocuments}</option>
                      <option value="Furniture & Fixtures">{TXT.furnitureFixtures}</option>
                      <option value="Personal Effects">{TXT.personalEffects}</option>
                      <option value="Other">{TXT.other}</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label>{TXT.contentCargoDescription}</label>
                    <input
                      type="text"
                      value={shipmentDescription}
                      onChange={e => setShipmentDescription(e.target.value)}
                      placeholder={TXT.cargoOrConsignmentDescription}
                    />
                    {errors.shipmentDescription && <span className="field-error-msg">{errors.shipmentDescription}</span>}
                  </div>
                </div>
              </div>

              {/* References Section */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.referenceIdentifiersOptional}</label>
                <div className="input-grid-3">
                  <div className="input-field">
                    <label>{TXT.customerReference}</label>
                    <input
                      type="text"
                      value={customerRef}
                      onChange={e => setCustomerRef(e.target.value)}
                      placeholder={TXT.poNumberRef}
                    />
                  </div>
                  <div className="input-field">
                    <label>{TXT.invoiceReference}</label>
                    <input
                      type="text"
                      value={invoiceRef}
                      onChange={e => setInvoiceRef(e.target.value)}
                      placeholder={TXT.invoiceNumber}
                    />
                  </div>
                  <div className="input-field">
                    <label>{TXT.internalReference}</label>
                    <input
                      type="text"
                      value={internalRef}
                      onChange={e => setInternalRef(e.target.value)}
                      placeholder={TXT.internalRefCode}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 2: SENDER & RECIPIENT */}
          {/* ---------------------------------------------------- */}
          {currentStep === 2 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <div className="heading-with-action">
                  <div>
                    <h3>{TXT.t02SenderRecipient}</h3>
                    <p>{TXT.enterTheShipmentPartiesThis}</p>
                  </div>
                  <button
                    type="button"
                    className="copy-parties-btn"
                    onClick={handleCopySenderToRecipient}
                  >
                    {TXT.copySenderRecipient}
                  </button>
                </div>
              </div>


              {/* Shared US States Datalist */}
              <datalist id="us-states-list">
                {Object.entries(STATE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{code} — {name}</option>
                ))}
              </datalist>

              {/* Sender Box */}
              <div className="parties-box sender">
                <div className="parties-box-head">
                  <span className="party-tag blue">{TXT.senderPickupLocation}</span>
                </div>
                <div className="input-grid-2">
                  <div className="input-field">
                    <label>{TXT.fullName}</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={e => setSenderName(e.target.value)}
                      placeholder={TXT.shipperFullName}
                    />
                  </div>
                  <div className="input-field">
                    <label>{TXT.companyOptional}</label>
                    <input
                      type="text"
                      value={senderCompany}
                      onChange={e => setSenderCompany(e.target.value)}
                      placeholder={TXT.companyNameOptional}
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label>{TXT.emailOptional}</label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={e => setSenderEmail(e.target.value)}
                      placeholder={TXT.shipperCompanyCom}
                    />
                  </div>
                  <div className="input-field">
                    <label htmlFor="sender-phone">{TXT.phoneOptional}</label>
                    <PhoneInput
                      id="sender-phone"
                      value={senderPhone}
                      onChange={setSenderPhone}
                      defaultCountry={senderCountry || 'US'}
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="sender-locale">{TXT.customerLanguage}</label>
                    <select id="sender-locale" value={notifyLocale} onChange={e => setNotifyLocale(e.target.value === 'fr' ? 'fr' : 'en')}>
                      <option value="en">{TXT.english}</option>
                      <option value="fr">{TXT.french}</option>
                    </select>
                    <small className="tx-iam-hint">{TXT.languageOfTheEmailsThe}</small>
                  </div>
                </div>

                <div className="input-field full-width">
                  <label>{TXT.pickupStreetAddress}</label>
                  <input
                    type="text"
                    value={senderAddress}
                    onChange={e => setSenderAddress(e.target.value)}
                    placeholder={TXT.streetAddressSuiteUnit}
                  />
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="sender-country">{TXT.country}</label>
                    <CountrySelect id="sender-country" value={senderCountry} onChange={setSenderCountry} />
                  </div>
                  <div className="input-field">
                    <label htmlFor="sender-city">{TXT.city}</label>
                    <input
                      id="sender-city"
                      type="text"
                      value={senderCity}
                      onChange={e => setSenderCity(e.target.value)}
                      placeholder={TXT.eGLagos}
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="sender-region">{regionLabel(senderCountry)} {TXT.optional}</label>
                    <input
                      id="sender-region"
                      type="text"
                      list={senderCountry === 'US' ? 'us-states-list' : undefined}
                      value={senderState}
                      onChange={e => setSenderState(senderCountry === 'US' ? e.target.value.toUpperCase() : e.target.value)}
                      maxLength={60}
                    />
                    {senderStateWarning && (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>
                        ⚠ {senderStateWarning}
                      </span>
                    )}
                  </div>
                  <div className="input-field">
                    <label htmlFor="sender-postcode">{postcodeLabel(senderCountry)} {TXT.optional}</label>
                    <input
                      id="sender-postcode"
                      type="text"
                      value={senderZip}
                      onChange={e => handleSenderZipChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Recipient Box */}
              <div className="parties-box recipient">
                <div className="parties-box-head">
                  <span className="party-tag purple">{TXT.recipientDeliveryDestination}</span>
                </div>
                <div className="input-grid-2">
                  <div className="input-field">
                    <label>{TXT.fullName}</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder={TXT.recipientFullName}
                    />
                  </div>
                  <div className="input-field">
                    <label>{TXT.companyOptional}</label>
                    <input
                      type="text"
                      value={recipientCompany}
                      onChange={e => setRecipientCompany(e.target.value)}
                      placeholder={TXT.companyNameOptional}
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label>{TXT.emailOptional}</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder={TXT.recipientCompanyCom}
                    />
                  </div>
                  <div className="input-field">
                    <label htmlFor="recipient-phone">{TXT.phoneOptional}</label>
                    <PhoneInput
                      id="recipient-phone"
                      value={recipientPhone}
                      onChange={setRecipientPhone}
                      defaultCountry={recipientCountry || senderCountry || 'US'}
                    />
                  </div>
                </div>

                <div className="input-field full-width">
                  <label>{TXT.deliveryStreetAddress}</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={e => setRecipientAddress(e.target.value)}
                    placeholder={TXT.streetAddressSuiteUnit}
                  />
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="recipient-country">{TXT.country}</label>
                    <CountrySelect id="recipient-country" value={recipientCountry} onChange={setRecipientCountry} />
                  </div>
                  <div className="input-field">
                    <label htmlFor="recipient-city">{TXT.city}</label>
                    <input
                      id="recipient-city"
                      type="text"
                      value={recipientCity}
                      onChange={e => setRecipientCity(e.target.value)}
                      placeholder={TXT.eGLondon}
                    />
                  </div>
                </div>

                <div className="input-grid-2">
                  <div className="input-field">
                    <label htmlFor="recipient-region">{regionLabel(recipientCountry)} {TXT.optional}</label>
                    <input
                      id="recipient-region"
                      type="text"
                      list={recipientCountry === 'US' ? 'us-states-list' : undefined}
                      value={recipientState}
                      onChange={e => setRecipientState(recipientCountry === 'US' ? e.target.value.toUpperCase() : e.target.value)}
                      maxLength={60}
                    />
                    {recipientStateWarning && (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>
                        ⚠ {recipientStateWarning}
                      </span>
                    )}
                  </div>
                  <div className="input-field">
                    <label htmlFor="recipient-postcode">{postcodeLabel(recipientCountry)} {TXT.optional}</label>
                    <input
                      id="recipient-postcode"
                      type="text"
                      value={recipientZip}
                      onChange={e => handleRecipientZipChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 3: SMART ADAPTIVE CARGO SPECIFICATIONS (units: see the toggle) */}
          {/* ---------------------------------------------------- */}
          {currentStep === 3 && (
            <div className="step-inner-content animate-fade-in">
              <div className="tx-heading-with-units admin-units-bar">
                <span className="dim-label">{TXT.weightsAndDimensionsIn}</span>
                <UnitToggle />
              </div>
              {errors.cargo && <p className="field-error-msg" role="alert">{errors.cargo}</p>}
              {/* CASE A: VEHICLE CARGO SPECIFICATION */}
              {shipmentType === 'Vehicle' ? (
                <div className="vehicle-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03VehicleCargoSpecifications}</h3>
                        <p>{TXT.vehicleShippingDetailsVinIdentification}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Identity Details */}
                  <div className="vehicle-form-deck">
                    <span className="deck-sub-title">{TXT.t1VehicleIdentification}</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.make}</label>
                        <input
                          type="text"
                          value={vehMake}
                          onChange={e => setVehMake(e.target.value)}
                          placeholder={TXT.eGToyota}
                        />
                        {errors.vehMake && <span className="field-error-msg">{errors.vehMake}</span>}
                      </div>
                      <div className="input-field">
                        <label>{TXT.model}</label>
                        <input
                          type="text"
                          value={vehModel}
                          onChange={e => setVehModel(e.target.value)}
                          placeholder={TXT.eGLandCruiser}
                        />
                        {errors.vehModel && <span className="field-error-msg">{errors.vehModel}</span>}
                      </div>
                      <div className="input-field">
                        <label>{TXT.year}</label>
                        <input
                          type="number"
                          value={vehYear}
                          onChange={e => setVehYear(e.target.value)}
                          placeholder="2024"
                        />
                      </div>
                    </div>

                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.vin17CharacterNumber}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={vehVin}
                          onChange={e => setVehVin(e.target.value.toUpperCase())}
                          placeholder={TXT.t17CharacterVin}
                        />
                        {errors.vehVin && <span className="field-error-msg">{errors.vehVin}</span>}
                      </div>
                      <div className="input-field">
                        <label>{TXT.color}</label>
                        <input
                          type="text"
                          value={vehColor}
                          onChange={e => setVehColor(e.target.value)}
                          placeholder={TXT.white}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.vehicleBodyType}</label>
                        <select
                          value={vehBodyType}
                          onChange={e => setVehBodyType(e.target.value)}
                        >
                          <option value="Pickup Truck">{TXT.pickupTruck}</option>
                          <option value="Sedan">{TXT.sedan}</option>
                          <option value="SUV / Crossover">{TXT.suvCrossover}</option>
                          <option value="Coupe">{TXT.coupe}</option>
                          <option value="Van / Minivan">{TXT.vanMinivan}</option>
                          <option value="Motorcycle">{TXT.motorcycle}</option>
                          <option value="Commercial / Heavy">{TXT.commercialHeavy}</option>
                        </select>
                      </div>
                    </div>

                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.licensePlateOptional}</label>
                        <input
                          type="text"
                          value={vehPlate}
                          onChange={e => setVehPlate(e.target.value)}
                          placeholder="e.g. 7XYZ892 (NY)"
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.titleRegistrationOptional}</label>
                        <input
                          type="text"
                          value={vehTitleNumber}
                          onChange={e => setVehTitleNumber(e.target.value)}
                          placeholder="e.g. TITLE-NY-90214"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operability & Dimensions */}
                  <div className="vehicle-form-deck">
                    <span className="deck-sub-title">{TXT.t2OperabilityPhysicalDimensions}</span>
                    <div className="operability-toggle-row">
                      <label className={`operable-option-card ${vehOperable ? 'active operable-yes' : ''}`}>
                        <input
                          type="radio"
                          name="operable"
                          checked={vehOperable}
                          onChange={() => setVehOperable(true)}
                        />
                        <div className="operable-card-body">
                          <div className="operable-head-row">
                            <strong>{TXT.operableDrivable}</strong>
                            <span className="operable-status-tag success">{TXT.runsDrives}</span>
                          </div>
                          <small>{TXT.vehicleStartsSteersBrakesAnd}</small>
                        </div>
                      </label>

                      <label className={`operable-option-card ${!vehOperable ? 'active operable-no' : ''}`}>
                        <input
                          type="radio"
                          name="operable"
                          checked={!vehOperable}
                          onChange={() => setVehOperable(false)}
                        />
                        <div className="operable-card-body">
                          <div className="operable-head-row">
                            <strong>{TXT.inoperableNonRunning}</strong>
                            <span className="operable-status-tag warning">{TXT.requiresWinch}</span>
                          </div>
                          <small>{TXT.vehicleCannotStartOrDrive}</small>
                        </div>
                      </label>
                    </div>

                    <div className="dim-row-group" style={{ marginTop: '0.75rem' }}>
                      <span className="dim-label">{TXT.dimensions}{units.length}):</span>
                      <div className="dim-input-group">
                        <MeasureInput
                          kind="length"
                          value={vehLengthIn}
                          onChange={val => setVehLengthIn(val === '' ? '' : String(val))}
                          placeholder={TXT.length}
                        />
                        <span className="dim-x">×</span>
                        <MeasureInput
                          kind="length"
                          value={vehWidthIn}
                          onChange={val => setVehWidthIn(val === '' ? '' : String(val))}
                          placeholder={TXT.width}
                        />
                        <span className="dim-x">×</span>
                        <MeasureInput
                          kind="length"
                          value={vehHeightIn}
                          onChange={val => setVehHeightIn(val === '' ? '' : String(val))}
                          placeholder={TXT.height}
                        />
                        <span className="dim-label" style={{ marginLeft: '0.5rem' }}>{TXT.in}</span>
                      </div>

                      <div className="dim-input-group" style={{ marginLeft: '1rem' }}>
                        <span className="dim-label">{TXT.curbWeight}{units.weight}):</span>
                        <MeasureInput
                          kind="weight"
                          style={{ width: '80px' }}
                          value={vehWeightLbs}
                          onChange={val => setVehWeightLbs(val === '' ? '' : String(val))}
                        />
                        <span className="dim-label">{TXT.lb}</span>
                      </div>
                    </div>
                  </div>

                  {/* Condition & Inspection */}
                  <div className="vehicle-form-deck">
                    <span className="deck-sub-title">{TXT.t3ConditionPreTripInspection}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <div className="field-label-split">
                          <label>{TXT.overallCondition}</label>
                          <span className="field-type-tag">{TXT.customAdminEntry}</span>
                        </div>
                        <input
                          type="text"
                          value={vehCondition}
                          onChange={e => setVehCondition(e.target.value)}
                          placeholder={TXT.eGCleanDailyDriver}
                          className="condition-custom-input"
                        />
                        <div className="condition-quick-chips">
                          <span className="chips-hint-text">{TXT.quickPresets}</span>
                          {[
                            'Showroom / Pristine',
                            'Clean / Minor Wear',
                            'Noticeable Cosmetic Wear',
                            'Mechanically Sound',
                            'Salvage / Inoperable'
                          ].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              className={`condition-chip-btn ${vehCondition === preset ? 'active' : ''}`}
                              onClick={() => setVehCondition(preset)}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    <div className="damage-checklist-wrap">
                      <label className="section-field-label" style={{ fontSize: '0.72rem' }}>{TXT.existingDamageNotedAtIntake}</label>
                      <div className="damage-pills-grid">
                        {[
                          'No major visible damage',
                          'Front bumper scratch',
                          'Rear bumper scratch',
                          'Driver side door ding',
                          'Passenger side ding',
                          'Windshield chip',
                          'Wheel / rim curb rash',
                          'Underbody wear'
                        ].map(dmg => (
                          <button
                            key={dmg}
                            type="button"
                            className={`damage-pill-btn ${damageChecklist.includes(dmg) ? 'active' : ''}`}
                            onClick={() => handleToggleDamage(dmg)}
                          >
                            {damageChecklist.includes(dmg) ? <CheckSquare size={13} /> : <Square size={13} />}
                            <span>{dmg}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="input-field full-width">
                      <label>{TXT.inspectionRemarks}</label>
                      <input
                        type="text"
                        value={inspectionNotes}
                        onChange={e => setInspectionNotes(e.target.value)}
                        placeholder={TXT.eGMinor1Inch}
                      />
                    </div>

                    {/* Keys & Documents Received */}
                    <div className="keys-docs-wrap">
                      <label className="section-field-label" style={{ fontSize: '0.72rem' }}>{TXT.itemsDocumentsReceivedWithVehicle}</label>
                      <div className="keys-grid">
                        {[
                          'Vehicle',
                          'Primary Key',
                          'Spare Key',
                          'Title Document',
                          'Registration',
                          'Bill of Sale',
                          'Owner Manuals'
                        ].map(item => (
                          <button
                            key={item}
                            type="button"
                            className={`item-pill-btn ${itemsReceived.includes(item) ? 'active' : ''}`}
                            onClick={() => handleToggleItemReceived(item)}
                          >
                            {itemsReceived.includes(item) ? <Check size={13} className="text-emerald" /> : null}
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Pallet' ? (
                <div className="pallet-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03PalletizedCargoSkidConfiguration}</h3>
                        <p>{TXT.configureStandardPalletGeometrySkid}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Standard & Physical Specs */}
                  <div className="vehicle-form-deck pallet-deck-panel">
                    <span className="deck-sub-title">{TXT.t1SkidGeometryQuantity}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.palletStandardBaseType}</label>
                        <select
                          value={palletStandard}
                          onChange={e => setPalletStandard(e.target.value)}
                        >
                          <option value="GMA Standard 48×40 in (US Wood)">{TXT.gmaStandard4840In}</option>
                          <option value="ISO Euro Pallet EUR-1 (1200×800 mm)">{TXT.isoEuroPalletEur1}</option>
                          <option value="ISO Euro Pallet EUR-2 (1200×1000 mm)">{TXT.isoEuroPalletEur2}</option>
                          <option value="Heavy Duty Industrial Skid 48×48 in">{TXT.heavyDutyIndustrialSkid48}</option>
                          <option value="Half-Pallet Retail Display 40×24 in">{TXT.halfPalletRetailDisplay40}</option>
                          <option value="Custom Engineered Machinery Runner">{TXT.customEngineeredMachineryRunnerBase}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.forkliftPalletJackEntry}</label>
                        <select
                          value={palletForkliftAccess}
                          onChange={e => setPalletForkliftAccess(e.target.value)}
                        >
                          <option value="4-Way Forklift Entry">{TXT.t4WayForkliftEntryUniversal}</option>
                          <option value="2-Way Entry (Stringer Block)">{TXT.t2WayEntryStringerBlock}</option>
                          <option value="Hydraulic Jack Friendly">{TXT.hydraulicPalletJackFriendlyBottom}</option>
                        </select>
                      </div>
                    </div>

                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.skidCountQuantity}</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={palletCount}
                          onChange={e => setPalletCount(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.weightPerSkid}{units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          min="10"
                          step="10"
                          value={palletWeightPerSkid}
                          onChange={val => setPalletWeightPerSkid(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.totalSkidHeight}{units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          min="12"
                          max="96"
                          value={palletHeightIn}
                          onChange={val => setPalletHeightIn(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    <div className="pallet-live-calc-strip">
                      <div className="calc-metric-pill">
                        <span>{TXT.totalPayloadWeight}</span>
                        <strong className="font-mono text-emerald">{formatWeight(palletCount * palletWeightPerSkid, units.system)}</strong>
                      </div>
                      <div className="calc-metric-pill">
                        <span>{TXT.estimatedCubicVolume}</span>
                        <strong className="font-mono">{(((48 * 40 * palletHeightIn) / 1728) * palletCount).toFixed(1)} {TXT.cuFt}</strong>
                      </div>
                      <div className="calc-metric-pill">
                        <span>{TXT.trailerLinehaulSlots}</span>
                        <strong className="font-mono">{palletStackable ? Math.ceil(palletCount / 2) : palletCount} {TXT.floorPositions}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Stackability Directive */}
                  <div className="vehicle-form-deck pallet-deck-panel">
                    <span className="deck-sub-title">{TXT.t2TrailerConsolidationStackabilityDirective}</span>
                    <p className="field-hint-txt" style={{ marginTop: '-0.2rem', marginBottom: '0.65rem' }}>
                      {TXT.carrierLinehaulDispatchersMustKnow}
                    </p>
                    <div className="operability-toggle-row">
                      <button
                        type="button"
                        className={`operable-option-card ${!palletStackable ? 'active' : ''}`}
                        onClick={() => setPalletStackable(false)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.doNotDoubleStackTop}</span>
                            <span className="opt-badge-pill inoperable-badge">{TXT.topTierMandate}</span>
                          </div>
                          <div className="opt-radio-circle">
                            {!palletStackable && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.topSurfaceIsFragilePyramid}
                        </p>
                      </button>

                      <button
                        type="button"
                        className={`operable-option-card ${palletStackable ? 'active' : ''}`}
                        onClick={() => setPalletStackable(true)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.stackableDoubleStackCertified}</span>
                            <span className="opt-badge-pill operable-badge">2-TIER APPROVED</span>
                          </div>
                          <div className="opt-radio-circle">
                            {palletStackable && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.skidHasAUniformFlat}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Pallet Securing & ISPM-15 Compliance */}
                  <div className="vehicle-form-deck pallet-deck-panel">
                    <span className="deck-sub-title">{TXT.t3UnitSecuringRegulatoryCompliance}</span>
                    <div className="damage-pills-grid">
                      {[
                        'Heat-Treated (ISPM-15 Certified)',
                        'Heavy Gauge Stretch-Wrapped',
                        'Steel Banded / Strapped',
                        'Corner Edge Protectors',
                        'Top Dust Cover / Weather-Resistant Sheeting',
                        'Anti-Slip Pallet Liners'
                      ].map(check => (
                        <button
                          key={check}
                          type="button"
                          className={`damage-pill-btn ${palletSecuringChecks.includes(check) ? 'active' : ''}`}
                          onClick={() => handleTogglePalletCheck(check)}
                        >
                          {palletSecuringChecks.includes(check) ? <CheckSquare size={13} /> : <Square size={13} />}
                          <span>{check}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Container' ? (
                <div className="container-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03IntermodalFclContainerSpecifications}</h3>
                        <p>{TXT.solasVerifiedGrossMassVgm}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Container Unit Identification & ISO Type */}
                  <div className="vehicle-form-deck container-deck-panel">
                    <span className="deck-sub-title">{TXT.t1ContainerEquipmentIdentification}</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.containerUnitNumberIso6346}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={containerNumber}
                          onChange={e => setContainerNumber(e.target.value.toUpperCase())}
                          placeholder="MSCU-749102-3"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.t4LetterPrefix6Digits}</span>
                      </div>
                      <div className="input-field">
                        <label>{TXT.isoContainerEquipmentSize}</label>
                        <select
                          value={containerIsoSize}
                          onChange={e => setContainerIsoSize(e.target.value)}
                        >
                          <option value="40ft High-Cube Dry Van (40HC / 9ft 6in)">{TXT.t40ftHighCubeDryVan}</option>
                          <option value="20ft General Purpose Standard (20GP / 8ft 6in)">{TXT.t20ftStandardGpDryVan}</option>
                          <option value="40ft General Purpose Standard (40GP / 8ft 6in)">{TXT.t40ftStandardGpDryVan}</option>
                          <option value="45ft High-Cube Pallet Wide (45HCPW)">{TXT.t45ftHighCubePalletWide}</option>
                          <option value="40ft High-Cube Refrigerated Reefer (40HR)">{TXT.t40ftHighCubeRefrigeratedReefer}</option>
                          <option value="20ft Open Top / Flat Rack Special">{TXT.t20ftOpenTopFlatRack}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.iso17712HighSecurityBolt}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={containerBoltSeal}
                          onChange={e => setContainerBoltSeal(e.target.value.toUpperCase())}
                          placeholder="HSS-NY-984021"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.tamperEvidentBoltSealC}</span>
                      </div>
                    </div>

                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.verifiedGrossMassVgm} {units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          className="font-mono"
                          value={containerVgmWeight}
                          onChange={val => setContainerVgmWeight(val === '' ? '' : String(val))}
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.totalCertifiedScaleWeightSolas}</span>
                      </div>
                      <div className="input-field">
                        <label>{TXT.portRailRampTerminal}</label>
                        <select
                          value={containerTerminal}
                          onChange={e => setContainerTerminal(e.target.value)}
                        >
                          <option value="Port of New York / Newark Container Terminal (PNCT)">{TXT.portOfNewYorkNewark}</option>
                          <option value="Port of Los Angeles - Pier 400 APM">{TXT.portOfLosAngelesPier}</option>
                          <option value="Port of Long Beach - Pier T (TTI)">{TXT.portOfLongBeachPier}</option>
                          <option value="BNSF Logistics Park Chicago (LPC)">{TXT.bnsfLogisticsParkChicagoLpc}</option>
                          <option value="Georgia Ports Authority - Savannah Ocean Terminal">{TXT.georgiaPortsAuthoritySavannahOcean}</option>
                          <option value="Union Pacific Global IV Intermodal Terminal">{TXT.unionPacificGlobalIvIntermodal}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.intermodalChassis}</label>
                        <input
                          type="text"
                          value={containerChassisNumber}
                          onChange={e => setContainerChassisNumber(e.target.value)}
                          placeholder={TXT.chas8812TriAxle}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Atmosphere & Customs Status */}
                  <div className="vehicle-form-deck container-deck-panel">
                    <span className="deck-sub-title">{TXT.t2EnvironmentalCustomsControl}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.atmosphereReeferTemperature}</label>
                        <select
                          value={containerTemperature}
                          onChange={e => setContainerTemperature(e.target.value)}
                        >
                          <option value="Ambient / Dry Cargo">{TXT.ambientStandardDryCargo}</option>
                          <option value="Chilled Fresh (+2°C to +4°C / 36°F to 39°F)">{TXT.chilledFresh2CTo}</option>
                          <option value="Deep Frozen (-20°C / -4°F)">{TXT.deepFrozen20C4}</option>
                          <option value="Ultra-Low Cryo (-60°C)">{TXT.ultraLowCryo60C}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.customsTerminalPreGateStatus}</label>
                        <select
                          value={containerCustomsStatus}
                          onChange={e => setContainerCustomsStatus(e.target.value)}
                        >
                          <option value="">{TXT.notSet}</option>
                          <option value="Pre-Cleared / Manifest Approved">{TXT.preClearedAmsManifestApproved}</option>
                          <option value="In-Bond Transit (IT 7512 Authorized)">{TXT.inBondTransitIt7512}</option>
                          <option value="Customs Hold / Pending Physical Inspection">{TXT.customsHoldPendingPhysicalInspection}</option>
                          <option value="Gate-In Complete / Staged for Vessel">{TXT.gateInCompleteStagedFor}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Freight' ? (
                <div className="freight-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03HeavyFreightLtlLinehaul}</h3>
                        <p>{TXT.nationalMotorFreightClassificationNmfc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Freight Rating & NMFC Code */}
                  <div className="vehicle-form-deck freight-deck-panel">
                    <span className="deck-sub-title">{TXT.t1RatingClassification}</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.freightClassRating}</label>
                        <select
                          value={freightClass}
                          onChange={e => setFreightClass(e.target.value)}
                        >
                          <option value="Class 50 (Clean dense freight)">{TXT.class50CleanDenseFreight}</option>
                          <option value="Class 55">{TXT.class553550Lbs}</option>
                          <option value="Class 60">{TXT.class603035Lbs}</option>
                          <option value="Class 65">{TXT.class6522530}</option>
                          <option value="Class 70 (Machinery, auto parts)">{TXT.class70MachineryAutoParts}</option>
                          <option value="Class 77.5">{TXT.class775TiresParts}</option>
                          <option value="Class 85">{TXT.class85CratedMachinery12}</option>
                          <option value="Class 92.5">{TXT.class925105}</option>
                          <option value="Class 100">{TXT.class1009105}</option>
                          <option value="Class 125">{TXT.class12589Lbs}</option>
                          <option value="Class 150">{TXT.class15068Lbs}</option>
                          <option value="Class 200">{TXT.class20046Lbs}</option>
                          <option value="Class 300">{TXT.class30024Lbs}</option>
                          <option value="Class 500 (Low density / high value)">{TXT.class500LowDensityHigh}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.nmfcCode}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={freightNmfcCode}
                          onChange={e => setFreightNmfcCode(e.target.value)}
                          placeholder={TXT.nmfc18260Sub2}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.totalScaleWeight}{units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          step="10"
                          value={freightTotalWeightLbs}
                          onChange={val => setFreightTotalWeightLbs(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.piecesCratesQuantity}</label>
                        <input
                          type="number"
                          min="1"
                          value={freightPiecesCount}
                          onChange={e => setFreightPiecesCount(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.facilityLoadingMethod}</label>
                        <select
                          value={freightLoadingMethod}
                          onChange={e => setFreightLoadingMethod(e.target.value)}
                        >
                          <option value='Standard Raised Commercial Loading Dock (48" Dock Height)'>{TXT.standardRaisedCommercialLoadingDock}</option>
                          <option value="Ground Level Facility (Forklift from Yard)">{TXT.groundLevelFacilityForkliftFrom}</option>
                          <option value="Construction Site / Industrial Yard">{TXT.constructionSiteIndustrialYard}</option>
                          <option value="Residential / Limited Access Facility">{TXT.residentialLimitedAccessFacility}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Liftgate Requirements (Essential in Freight Dispatch) */}
                  <div className="vehicle-form-deck freight-deck-panel">
                    <span className="deck-sub-title">{TXT.t2SpecializedHydraulicLiftgateDirectives}</span>
                    <div className="operability-toggle-row">
                      <button
                        type="button"
                        className={`operable-option-card ${freightLiftgatePickup ? 'active' : ''}`}
                        onClick={() => setFreightLiftgatePickup(!freightLiftgatePickup)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.liftgateRequiredAtPickup}</span>
                            <span className={`opt-badge-pill ${freightLiftgatePickup ? 'operable-badge' : 'neutral-badge'}`}>
                              {freightLiftgatePickup ? TXT.required : TXT.notRequired}
                            </span>
                          </div>
                          <div className="opt-radio-circle">
                            {freightLiftgatePickup && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.originShipperLacksA48}
                        </p>
                      </button>

                      <button
                        type="button"
                        className={`operable-option-card ${freightLiftgateDelivery ? 'active' : ''}`}
                        onClick={() => setFreightLiftgateDelivery(!freightLiftgateDelivery)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.liftgateRequiredAtDelivery}</span>
                            <span className={`opt-badge-pill ${freightLiftgateDelivery ? 'operable-badge' : 'neutral-badge'}`}>
                              {freightLiftgateDelivery ? TXT.required : TXT.notRequired}
                            </span>
                          </div>
                          <div className="opt-radio-circle">
                            {freightLiftgateDelivery && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.destinationConsigneeLocationLacksA}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: HazMat Declaration */}
                  <div className="vehicle-form-deck freight-deck-panel">
                    <span className="deck-sub-title">{TXT.t3HazardousMaterialsHazmatDeclaration}</span>
                    <label className="save-address-checkbox" style={{ margin: '0.25rem 0 0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={freightHazMat}
                        onChange={e => setFreightHazMat(e.target.checked)}
                      />
                      <span>{TXT.consignmentContainsHazardousMaterialsHazmat}</span>
                    </label>

                    {freightHazMat && (
                      <div className="hazmat-alert-box animate-fade-in">
                        <div className="hazmat-badge">
                          <AlertTriangle size={15} />
                          <span>{TXT.hazmatDeclarationRequired49Cfr}</span>
                        </div>
                        <div className="input-grid-2" style={{ marginTop: '0.65rem' }}>
                          <div className="input-field">
                            <label>{TXT.unNaIdentificationNumber}</label>
                            <input
                              type="text"
                              className="font-mono"
                              value={freightUnNumber}
                              onChange={e => setFreightUnNumber(e.target.value)}
                              placeholder={TXT.eGUn3480Lithium}
                            />
                          </div>
                          <div className="input-field">
                            <label>{TXT.emergencyResponseContact}</label>
                            <input
                              type="text"
                              placeholder={TXT.t24HourEmergencyResponseNumber}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : shipmentType === 'Document' ? (
                <div className="doc-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03SecureDocumentCourierPouch}</h3>
                        <p>{TXT.chainOfCustodyTrackingTamper}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Pouch Format & Numbered Security Seal */}
                  <div className="vehicle-form-deck doc-deck-panel">
                    <span className="deck-sub-title">{TXT.t1CourierPackagingSecuritySeal}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.packagingEnvelopeFormat}</label>
                        <select
                          value={docEnvelopeType}
                          onChange={e => setDocEnvelopeType(e.target.value)}
                        >
                          <option value={`${COMPANY_SHORT} Waterproof Legal Pouch (12×16 in)`}>{COMPANY_SHORT} {TXT.waterproofLegalPouch1216}</option>
                          <option value="Rigid Cardboard Stay-Flat Mailer (9.5×12.5 in)">{TXT.rigidCardboardStayFlatMailer}</option>
                          <option value="Heavy Duty Tyvek Courier Envelope (10×13 in)">{TXT.heavyDutyTyvekCourierEnvelope}</option>
                          <option value="Tamper-Evident Bank Deposit Polybag">{TXT.tamperEvidentBankDepositEvidence}</option>
                          <option value="Archival Box / Legal Binder Folder">{TXT.archivalBoxLegalBinderFolder}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.numberedSecuritySealId}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={docSealNumber}
                          onChange={e => setDocSealNumber(e.target.value.toUpperCase())}
                          placeholder={`${REFERENCE_PREFIX}-SL-892401`}
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.sequentialTamperEvidentBarcodeSeal}</span>
                      </div>
                    </div>

                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.targetDeliveryCommitmentWindow}</label>
                        <select
                          value={docUrgentDeadline}
                          onChange={e => setDocUrgentDeadline(e.target.value)}
                        >
                          <option value="By 10:30 AM Next Business Day (Priority Legal)">{TXT.by1030AmNext}</option>
                          <option value="End of Business Day (5:00 PM)">{TXT.endOfBusinessDay5}</option>
                          <option value="Same-Day Hotshot Courier (Within 4 Hours)">{TXT.sameDayHotshotCourierWithin}</option>
                          <option value="Saturday Courier Handover">{TXT.saturdayCourierHandover}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.courtCaseEscrowNotaryFiling}</label>
                        <input
                          type="text"
                          value={docFilingCourtRef}
                          onChange={e => setDocFilingCourtRef(e.target.value)}
                          placeholder={TXT.eGCase2026Ny}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Chain of Custody Directive */}
                  <div className="vehicle-form-deck doc-deck-panel">
                    <span className="deck-sub-title">{TXT.t2ChainOfCustodySignature}</span>
                    <div className="operability-toggle-row">
                      <button
                        type="button"
                        className={`operable-option-card ${docDirectSignOnly ? 'active' : ''}`}
                        onClick={() => setDocDirectSignOnly(!docDirectSignOnly)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.directInPersonConsigneeSignature}</span>
                            <span className="opt-badge-pill operable-badge">{TXT.strictNoWaiver}</span>
                          </div>
                          <div className="opt-radio-circle">
                            {docDirectSignOnly && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.theCourierMustHandThe}
                        </p>
                      </button>
                    </div>

                    <div className="input-field full-width" style={{ marginTop: '0.75rem' }}>
                      <label>{TXT.contentsDescriptionDocumentInventory}</label>
                      <input
                        type="text"
                        value={docContentsDescription}
                        onChange={e => setDocContentsDescription(e.target.value)}
                        placeholder={TXT.eGExecutedCommercialVehicle}
                      />
                    </div>
                  </div>
                </div>
              ) : shipmentType === 'Pets' ? (
                /* CASE: LIVE ANIMAL & PET TRANSPORT DECK */
                <div className="pet-cargo-builder-deck">
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03LiveAnimalPetTransport}</h3>
                        <p>{TXT.individualAnimalIdentity15Digit}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Pet Identification & Biometrics */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">{TXT.t1AnimalIdentificationBiometrics}</span>
                    <div className="input-grid-3">
                      <div className="input-field">
                        <label>{TXT.petAnimalName}</label>
                        <input
                          type="text"
                          value={petName}
                          onChange={e => setPetName(e.target.value)}
                          placeholder={TXT.eGBarnaby}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.species}</label>
                        <select
                          value={petSpecies}
                          onChange={e => setPetSpecies(e.target.value)}
                        >
                          <option value="Canine (Dog)">{TXT.canineDog}</option>
                          <option value="Feline (Cat)">{TXT.felineCat}</option>
                          <option value="Avian (Bird)">{TXT.avianBird}</option>
                          <option value="Small Mammal (Rabbit/Ferret)">{TXT.smallMammalRabbitFerret}</option>
                          <option value="Equine (Horse / Pony)">{TXT.equineHorsePony}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.breed}</label>
                        <input
                          type="text"
                          value={petBreed}
                          onChange={e => setPetBreed(e.target.value)}
                          placeholder={TXT.eGGoldenRetriever}
                        />
                      </div>
                    </div>

                    <div className="input-grid-4" style={{ marginTop: '0.75rem' }}>
                      <div className="input-field">
                        <label>{TXT.ageDob}</label>
                        <input
                          type="text"
                          value={petAge}
                          onChange={e => setPetAge(e.target.value)}
                          placeholder={TXT.eG3Years}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.genderStatus}</label>
                        <select
                          value={petGender}
                          onChange={e => setPetGender(e.target.value)}
                        >
                          <option value="Male (Neutered)">{TXT.maleNeutered}</option>
                          <option value="Male (Intact)">{TXT.maleIntact}</option>
                          <option value="Female (Spayed)">{TXT.femaleSpayed}</option>
                          <option value="Female (Intact)">{TXT.femaleIntact}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.petNetWeight}{units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          step="0.5"
                          value={petWeightLbs}
                          onChange={val => setPetWeightLbs(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.microchipRfid}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={petMicrochip}
                          onChange={e => setPetMicrochip(e.target.value)}
                          placeholder={TXT.t98514100284910215DigitIso}
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.iso1178411785Compliant}</span>
                      </div>
                    </div>

                    {/* Snub-nosed / Brachycephalic Warning Toggle */}
                    <div className="operability-toggle-row" style={{ marginTop: '1rem' }}>
                      <button
                        type="button"
                        className={`operable-option-card ${petIsBrachycephalic ? 'warning-active' : ''}`}
                        onClick={() => setPetIsBrachycephalic(!petIsBrachycephalic)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.brachycephalicSnubNosedBreedProtocol}</span>
                            <span className={`opt-badge-pill ${petIsBrachycephalic ? 'brachy-badge active' : 'brachy-badge'}`}>
                              {petIsBrachycephalic ? '⚠️ RESTRICTIVE AIRWAY ACTIVE' : TXT.standardAirway}
                            </span>
                          </div>
                          <div className="opt-radio-circle">
                            {petIsBrachycephalic && <span className="opt-radio-dot" style={{ backgroundColor: 'var(--tx-accent-text)' }} />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.pugsFrenchBulldogsPersianCats}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: IATA LAR Certified Travel Crate & Dimensions */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">{TXT.t2IataLarCertifiedTravel}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.travelKennelSpecification}</label>
                        <select
                          value={petCrateType}
                          onChange={e => {
                            const val = e.target.value;
                            setPetCrateType(val);
                            if (val.includes('Series 400')) {
                              setPetCrateLength(36); setPetCrateWidth(25); setPetCrateHeight(27); setPetCrateWeightLbs(22);
                            } else if (val.includes('Series 500')) {
                              setPetCrateLength(40); setPetCrateWidth(27); setPetCrateHeight(30); setPetCrateWeightLbs(28);
                            } else if (val.includes('Series 200')) {
                              setPetCrateLength(26); setPetCrateWidth(18); setPetCrateHeight(19); setPetCrateWeightLbs(12);
                            } else if (val.includes('Series 100')) {
                              setPetCrateLength(21); setPetCrateWidth(16); setPetCrateHeight(15); setPetCrateWeightLbs(8);
                            }
                          }}
                        >
                          <option value="IATA LAR Certified Series 400 (Large Rigid Kennel - 36×25×27 in)">{TXT.iataLarSeries400Large}</option>
                          <option value="IATA LAR Certified Series 500 (X-Large Rigid Kennel - 40×27×30 in)">{TXT.iataLarSeries500X}</option>
                          <option value="IATA LAR Certified Series 200 (Medium Rigid Kennel - 26×18×19 in)">{TXT.iataLarSeries200Medium}</option>
                          <option value="IATA LAR Certified Series 100 (Small Rigid Kennel - 21×16×15 in)">{TXT.iataLarSeries100Small}</option>
                          <option value="Custom Reinforced Wooden Sky Crate (IATA CR-82 Heavy Duty)">{TXT.customReinforcedWoodenSkyCrate}</option>
                        </select>
                      </div>
                      <div className="input-field">
                        <label>{TXT.kennelTareWeight}{units.weight}) *</label>
                        <MeasureInput
                          kind="weight"
                          step="0.5"
                          value={petCrateWeightLbs}
                          onChange={val => setPetCrateWeightLbs(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    <div className="input-grid-3" style={{ marginTop: '0.75rem' }}>
                      <div className="input-field">
                        <label>{TXT.crateLength}{units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          value={petCrateLength}
                          onChange={val => setPetCrateLength(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.crateWidth}{units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          value={petCrateWidth}
                          onChange={val => setPetCrateWidth(val === '' ? 0 : val)}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.crateHeight}{units.length}) *</label>
                        <MeasureInput
                          kind="length"
                          value={petCrateHeight}
                          onChange={val => setPetCrateHeight(val === '' ? 0 : val)}
                        />
                      </div>
                    </div>

                    {/* Weight Breakdown Callout */}
                    <div className="pet-weight-calc-pill">
                      <PawPrint size={14} className="text-rose" />
                      <span>
                        {TXT.liveScaledManifestWeight} <strong>{formatWeight(petWeightLbs, units.system)} {TXT.petNet}</strong> + <strong>{formatWeight(petCrateWeightLbs, units.system)} {TXT.crateTare}</strong> = <strong className="font-mono text-emerald">{totalWeight.toFixed(1)} {TXT.lbsTotalScaledWeight}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Section 3: Veterinary Health & USDA APHIS Certification */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">{TXT.t3VeterinaryHealthRegulatoryDocumentation}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.certificateOfVeterinaryInspectionCvi}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={petHealthCertNumber}
                          onChange={e => setPetHealthCertNumber(e.target.value)}
                          placeholder="e.g. CVI-NY-2026-88194"
                        />
                        <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.validWithin10DaysOf}</span>
                      </div>
                      <div className="input-field">
                        <label>{TXT.rabiesVaccinationTagClinic}</label>
                        <input
                          type="text"
                          className="font-mono"
                          value={petRabiesTag}
                          onChange={e => setPetRabiesTag(e.target.value)}
                          placeholder={TXT.eGRab202711}
                        />
                      </div>
                    </div>

                    <div className="input-grid-2" style={{ marginTop: '0.75rem' }}>
                      <div className="input-field">
                        <label>{TXT.attendingVeterinaryHospitalClinic}</label>
                        <input
                          type="text"
                          value={petVetClinic}
                          onChange={e => setPetVetClinic(e.target.value)}
                          placeholder={TXT.eGManhattanAnimalHealth}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.t247EmergencyAttendingVet}</label>
                        <input
                          type="text"
                          value={petVetPhone}
                          onChange={e => setPetVetPhone(e.target.value)}
                          placeholder="e.g. (212) 555-0149"
                        />
                      </div>
                    </div>

                    <div className="operability-toggle-row" style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className={`operable-option-card ${petAcclimationCert ? 'active' : ''}`}
                        onClick={() => setPetAcclimationCert(!petAcclimationCert)}
                      >
                        <div className="opt-top">
                          <div className="opt-title-group">
                            <span className="opt-title">{TXT.usdaAcclimationCertificateAttached}</span>
                            <span className="opt-badge-pill operable-badge">{TXT.vetEndorsed}</span>
                          </div>
                          <div className="opt-radio-circle">
                            {petAcclimationCert && <span className="opt-radio-dot" />}
                          </div>
                        </div>
                        <p className="opt-desc">
                          {TXT.licensedVeterinarianCertifiesTheAnimal}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 4: Welfare, Feeding & Hydration Protocols */}
                  <div className="vehicle-form-deck pet-deck-panel">
                    <span className="deck-sub-title">{TXT.t4AnimalWelfareNutritionHydration}</span>
                    <div className="input-grid-2">
                      <div className="input-field">
                        <label>{TXT.preDepartureFeedingTimestamp}</label>
                        <input
                          type="text"
                          value={petLastFed}
                          onChange={e => setPetLastFed(e.target.value)}
                          placeholder={TXT.eG4HoursPrior}
                        />
                      </div>
                      <div className="input-field">
                        <label>{TXT.hydrationWaterProtocol}</label>
                        <input
                          type="text"
                          value={petWaterProtocol}
                          onChange={e => setPetWaterProtocol(e.target.value)}
                          placeholder={TXT.eGFreshSpringWater}
                        />
                      </div>
                    </div>

                    <div className="input-field full-width" style={{ marginTop: '0.75rem' }}>
                      <label>{TXT.specialWelfareInstructionsCalmingProtocol}</label>
                      <textarea
                        rows={2}
                        value={petSpecialInstructions}
                        onChange={e => setPetSpecialInstructions(e.target.value)}
                        placeholder={TXT.eGFavoriteBlanketInside}
                      />
                    </div>

                    <div className="cargo-checklist-block" style={{ marginTop: '1rem' }}>
                      <label className="section-field-label">{TXT.mandatoryLiveAnimalWelfareDirectives}</label>
                      <div className="checklist-grid-2">
                        {[
                          'Dual Door-Accessible Food/Water Dishes Attached',
                          'IATA Live Animals (AVI) Green Label Affixed',
                          'Active Climate Control 68°F-74°F Hold Guaranteed',
                          'Absorbent Bedding Layer Pre-Installed',
                          'Emergency 24/7 Vet On-Call Authorized',
                          'No Sedatives / Tranquilizers Administered (AVMA Compliance)',
                          'Priority Tarmac Ramp Transfer (Sun Shielding)'
                        ].map((directive, idx) => {
                          const isChecked = petCareDirectives.includes(directive);
                          return (
                            <div
                              key={idx}
                              className={`checklist-item-card ${isChecked ? 'active' : ''}`}
                              onClick={() => handleTogglePetDirective(directive)}
                            >
                              <div className="chk-icon">
                                {isChecked ? <CheckSquare size={16} className="text-rose" /> : <Square size={16} className="text-slate-500" />}
                              </div>
                              <span className="chk-label">{directive}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CASE B: GENERAL PACKAGES / MULTI-PIECE EDITOR */
                <div>
                  <div className="step-section-heading">
                    <div className="heading-with-action">
                      <div>
                        <h3>{TXT.t03PackagesPieces}</h3>
                        <p>{TXT.configureSinglePieceOrMulti}</p>
                      </div>
                      <button
                        type="button"
                        className="add-package-btn"
                        onClick={handleAddPackage}
                      >
                        <Plus size={14} /> {TXT.addAnotherPackage}
                      </button>
                    </div>
                  </div>

                  {/* Package List */}
                  <div className="packages-accordion-list">
                    {packagesList.map((pkg, idx) => (
                      <div key={pkg.id} className="package-editor-card">
                        <div className="pkg-card-head">
                          <div className="pkg-head-left">
                            <span className="pkg-num-badge">{TXT.piece0}{idx + 1}</span>
                            <span className="pkg-preview-meta">{[formatWeight(pkg.weightLbs, units.system), formatDimensions(pkg, units.system)].filter(Boolean).join(' • ')}</span>
                          </div>
                          {packagesList.length > 1 && (
                            <button
                              type="button"
                              className="pkg-remove-btn"
                              onClick={() => handleRemovePackage(pkg.id)}
                            >
                              <Trash2 size={14} /> {TXT.remove}
                            </button>
                          )}
                        </div>

                        <div className="pkg-card-body">
                          <div className="input-grid-3">
                            <div className="input-field">
                              <label>{TXT.packageType}</label>
                              <select
                                value={pkg.type}
                                onChange={e => handleUpdatePackage(pkg.id, 'type', e.target.value)}
                              >
                                <option value="Box">{TXT.box}</option>
                                <option value="Envelope">{TXT.envelope}</option>
                                <option value="Pallet">{TXT.pallet}</option>
                                <option value="Crate">{TXT.crate}</option>
                                <option value="Tube">{TXT.tube}</option>
                              </select>
                            </div>
                            <div className="input-field">
                              <label>{TXT.weight}{units.weight}) *</label>
                              <MeasureInput
                                kind="weight"
                                step="0.1"
                                min="0.1"
                                value={pkg.weightLbs}
                                onChange={v => handleUpdatePackage(pkg.id, 'weightLbs', v === '' ? 0 : v)}
                              />
                            </div>
                            <div className="input-field">
                              <label>{TXT.pieceContentDescription}</label>
                              <input
                                type="text"
                                value={pkg.description}
                                onChange={e => handleUpdatePackage(pkg.id, 'description', e.target.value)}
                                placeholder={TXT.pieceContentDescription2}
                              />
                            </div>
                          </div>

                          <div className="dim-row-group">
                            <span className="dim-label">{TXT.dimensions}{units.length}):</span>
                            <div className="dim-input-group">
                              <MeasureInput
                                kind="length"
                                min="0"
                                aria-label={TXT.length2(units.length)}
                                value={pkg.length}
                                onChange={v => handleUpdatePackage(pkg.id, 'length', v === '' ? 0 : v)}
                                placeholder={TXT.length}
                              />
                              <span className="dim-x">×</span>
                              <MeasureInput
                                kind="length"
                                min="0"
                                aria-label={TXT.width2(units.length)}
                                value={pkg.width}
                                onChange={v => handleUpdatePackage(pkg.id, 'width', v === '' ? 0 : v)}
                                placeholder={TXT.width}
                              />
                              <span className="dim-x">×</span>
                              <MeasureInput
                                kind="length"
                                min="0"
                                aria-label={TXT.height2(units.length)}
                                value={pkg.height}
                                onChange={v => handleUpdatePackage(pkg.id, 'height', v === '' ? 0 : v)}
                                placeholder={TXT.height}
                              />
                            </div>
                            <span className="dim-calc-tag font-mono">
                              {formatWeight((pkg.length * pkg.width * pkg.height) / 139, units.system)} {TXT.dim}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Aggregate Strip */}
                  <div className="packages-total-bar">
                    <div className="total-stat-unit">
                      <span>{TXT.totalPackages}</span>
                      <strong>{totalPieces}</strong>
                    </div>
                    <div className="total-stat-unit">
                      <span>{TXT.totalScaleWeight2}</span>
                      <strong>{formatWeight(totalWeight, units.system)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 4: SERVICE & SHIPPING REQUIREMENTS */}
          {/* ---------------------------------------------------- */}
          {currentStep === 4 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <h3>{TXT.t04ServiceOperationalRequirements}</h3>
                <p>{TXT.specifyServiceSpeedTierPickup}</p>
              </div>

              {/* Integrated Transit Corridor Overview Strip */}
              <div className="step-corridor-strip">
                <div className="corridor-endpoint">
                  <span className="corridor-role">{TXT.origin2}</span>
                  <strong>{senderCity || 'New York'}, {senderState || 'NY'}</strong>
                  <span className="corridor-zip font-mono">ZIP {senderZip || '10005'}</span>
                </div>
                <div className="corridor-arrow-bridge">
                  <span className="bridge-line" />
                  <div className="bridge-pill">
                    <Truck size={13} />
                    <span>{TXT.directTransitCorridor}</span>
                  </div>
                  <span className="bridge-line" />
                </div>
                <div className="corridor-endpoint dest">
                  <span className="corridor-role">{TXT.destination2}</span>
                  <strong className="text-accent">{recipientCity || 'Los Angeles'}, {recipientState || 'CA'}</strong>
                  <span className="corridor-zip font-mono">ZIP {recipientZip || '90071'}</span>
                </div>
              </div>

              {/* Service Level Radio Pills */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.serviceLevel}</label>
                <div className="service-radio-grid">
                  {[
                    { id: 'Standard', label: TXT.standard, desc: TXT.t35BusinessDaysTransit },
                    { id: 'Express', label: TXT.express, desc: TXT.t12BusinessDaysGuaranteed },
                    { id: 'Priority', label: TXT.priority, desc: TXT.timeCriticalExpedited },
                    { id: 'Freight', label: TXT.freight, desc: TXT.heavyTransportCorridor }
                  ].map(s => (
                    <label
                      key={s.id}
                      className={`service-radio-tile ${service === s.id ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="service"
                        checked={service === s.id}
                        onChange={() => setService(s.id as ServiceOption)}
                      />
                      <div className="srv-tile-body">
                        <strong>{s.label}</strong>
                        <small>{s.desc}</small>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Transport Mode (main leg) */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.transportMode}</label>
                <div className="service-radio-grid">
                  {([
                    { id: 'Auto', label: TXT.auto, desc: TXT.chosenFromDistanceAndCargo },
                    { id: 'Road', label: TXT.legRoad, desc: TXT.truckOnRealRoads },
                    { id: 'Air', label: TXT.legAir, desc: TXT.flightBetweenGateways },
                    { id: 'Sea', label: TXT.legSea, desc: TXT.oceanFreightBetweenPorts }
                  ] as const).map(m => (
                    <label
                      key={m.id}
                      className={`service-radio-tile ${transportModeChoice === m.id ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="transportMode"
                        checked={transportModeChoice === m.id}
                        onChange={() => setTransportModeChoice(m.id)}
                      />
                      <div className="srv-tile-body">
                        <strong>{m.label}</strong>
                        <small>{m.desc}</small>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pickup & Delivery Windows */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.scheduleControlledDeliveryWindow}</label>
                <div className="input-grid-3">
                  <div className="input-field">
                    <label>{TXT.preferredPickupDate}</label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={e => setPickupDate(e.target.value)}
                    />
                  </div>
                  <div className="input-field">
                    <label>{TXT.pickupTimeWindow}</label>
                    <input
                      type="text"
                      value={pickupWindow}
                      onChange={e => setPickupWindow(e.target.value)}
                      placeholder="e.g. 09:00 AM - 12:00 PM"
                    />
                  </div>
                  <div className="input-field">
                    <label>{TXT.expectedDeliveryDateEta}</label>
                    <input
                      type="text"
                      value={expectedDeliveryDate}
                      onChange={e => { setExpectedDeliveryDate(e.target.value); setExpectedDeliveryDateTouched(true); }}
                      placeholder={TXT.eGAugust222026}
                    />
                    {expectedDeliveryDateTouched ? (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>
                        {TXT.manualOverride}{' '}
                        <button
                          type="button"
                          onClick={() => setExpectedDeliveryDateTouched(false)}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                        >
                          {TXT.useCalculatedEta}
                        </button>
                      </span>
                    ) : (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem' }}>{TXT.autoCalculatedFromRouteService}</span>
                    )}
                    {dateOrderWarning && (
                      <span className="field-hint-txt" style={{ fontSize: '0.65rem', color: '#dc2626', display: 'block', marginTop: '0.2rem' }}>
                        ⚠ {dateOrderWarning}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Handling Checkboxes */}
              <div className="form-group-block">
                <label className="section-field-label">{TXT.specialHandlingDirectives}</label>
                <div className="handling-checkbox-grid">
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isFragile}
                      onChange={e => setIsFragile(e.target.checked)}
                    />
                    <span>{TXT.fragileCargo}</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isOversized}
                      onChange={e => setIsOversized(e.target.checked)}
                    />
                    <span>{TXT.oversizedItem}</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isSpecialHandling}
                      onChange={e => setIsSpecialHandling(e.target.checked)}
                    />
                    <span>{TXT.specialHandling}</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isSignatureRequired}
                      onChange={e => setIsSignatureRequired(e.target.checked)}
                    />
                    <span>{TXT.signatureRequired}</span>
                  </label>
                  <label className="handling-chk">
                    <input
                      type="checkbox"
                      checked={isOtherHandling}
                      onChange={e => setIsOtherHandling(e.target.checked)}
                    />
                    <span>{TXT.otherRequirements}</span>
                  </label>
                </div>

                {isOtherHandling && (
                  <div className="input-field full-width" style={{ marginTop: '0.75rem' }}>
                    <label>{TXT.additionalInstructions}</label>
                    <textarea
                      rows={2}
                      value={otherHandlingInstructions}
                      onChange={e => setOtherHandlingInstructions(e.target.value)}
                      placeholder={TXT.specifyUniqueHandlingOrCustody}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 5: PRICING (PRIVATE ADMIN) */}
          {/* ---------------------------------------------------- */}
          {currentStep === 5 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <h3>{TXT.t05ShipmentPricingAdministratorOnly}</h3>
                <p>{TXT.internalRateCalculationPricingIs}</p>
              </div>

              {/* Pricing Line Items */}
              <div className="pricing-calculator-card">
                <div className="pricing-row-input">
                  <label>{TXT.baseLinehaulRate}{money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={baseRate}
                    onChange={val => setBaseRate(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>{TXT.additionalChargesHandling}{money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={additionalCharges}
                    onChange={val => setAdditionalCharges(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>{TXT.distanceFuelSurcharges}{money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={surcharges}
                    onChange={val => setSurcharges(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>{TXT.discount}{money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={discount}
                    onChange={val => setDiscount(val === '' ? 0 : val)}
                  />
                </div>
                <div className="pricing-row-input">
                  <label>{TXT.manualAdjustment}{money.symbol})</label>
                  <MoneyInput
                    step="0.01"
                    value={manualAdjustment}
                    onChange={val => setManualAdjustment(val === '' ? 0 : val)}
                  />
                </div>

                <div className="final-price-strip">
                  <span>{TXT.finalShippingPrice}</span>
                  <strong className="font-mono text-blue">{money.format(finalPrice)} {money.currency}</strong>
                </div>
              </div>

              <div className="form-group-block">
                <label className="section-field-label">{TXT.privateInternalPricingNote}</label>
                <div className="input-field full-width">
                  <input
                    type="text"
                    value={internalPricingNotes}
                    onChange={e => setInternalPricingNotes(e.target.value)}
                    placeholder={TXT.eGSpecialNegotiatedRate}
                  />
                </div>
              </div>

              {/* Customer payment request (update D.2): unlike the pricing above, this IS public.
                  Saving it needs payments.manage, so it is offered only with that permission. */}
              {can('payments.manage') && (
              <div className="create-payment-block">
                <label className="create-payment-toggle">
                  <input
                    type="checkbox"
                    checked={paymentEnabled}
                    onChange={e => {
                      setPaymentEnabled(e.target.checked);
                      if (!e.target.checked) setPaymentErrors({});
                    }}
                  />
                  <span>{TXT.addAPaymentRequestFor}</span>
                </label>
                <p className="create-payment-hint">
                  {TXT.unlikeThePricingAboveThis} <strong>{TXT.isShownToTheCustomer}</strong> {TXT.onTheTrackPageThe}
                </p>
                {paymentEnabled && Object.keys(paymentErrors).length > 0 && (
                  <p className="create-payment-alert" role="alert">
                    {TXT.fixTheHighlightedPaymentDetails}
                  </p>
                )}
                {paymentEnabled && (
                  <PaymentRequestEditor
                    value={paymentDraft}
                    onChange={d => {
                      setPaymentDraft(d);
                      // Once errors are showing, re-check as the courier fixes them.
                      if (Object.keys(paymentErrors).length) setPaymentErrors(paymentDraftErrors(d));
                    }}
                    errors={paymentErrors}
                    idPrefix="create-payment"
                  />
                )}
              </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 6: REVIEW & CREATE */}
          {/* ---------------------------------------------------- */}
          {currentStep === 6 && (
            <div className="step-inner-content animate-fade-in">
              <div className="step-section-heading">
                <h3>{TXT.t06ReviewCreate}</h3>
                <p>{TXT.carefullyVerifyAllShipmentSpecifications}</p>
              </div>

              <div className="review-summary-container">
                {/* Review: customer payment request (step 5), public on the track page */}
                <div className="review-segment">
                  <span className="seg-title">{TXT.customerPaymentRequest}</span>
                  <div>
                    {paymentEnabled ? (
                      <strong>{paymentDraftSummary(paymentDraft)}</strong>
                    ) : (
                      <span>{TXT.noneYouCanAddOne}</span>
                    )}
                  </div>
                </div>

                {/* Review: Shipment & Cargo */}
                <div className="review-segment">
                  <span className="seg-title">{TXT.shipmentCargo}</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>{TXT.type}</small>
                      <strong>{TXT.shipmentTypes[shipmentType]}</strong>
                    </div>
                    <div>
                      <small>{TXT.cargoDescription}</small>
                      <strong className="text-blue">{shipmentDescription}</strong>
                    </div>
                  </div>
                </div>

                {/* If Vehicle, Show Specific Identity */}
                {shipmentType === 'Vehicle' && (
                  <div className="review-segment vehicle-highlight">
                    <span className="seg-title">{TXT.vehicleCargoIdentifiers}</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>{TXT.vehicle2}</small>
                        <strong>{vehYear} {vehMake} {vehModel} ({vehColor})</strong>
                      </div>
                      <div>
                        <small>{TXT.vinNumber}</small>
                        <strong className="font-mono">{vehVin}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.operability}</small>
                        <span>{vehOperable ? TXT.operableRunsDrives : TXT.inoperable}</span>
                      </div>
                      <div>
                        <small>{TXT.documentsKeys}</small>
                        <span>{itemsReceived.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Pallet, Show Skid Configuration */}
                {shipmentType === 'Pallet' && (
                  <div className="review-segment pallet-highlight">
                    <span className="seg-title">{TXT.palletSkidSpecifications}</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>{TXT.palletStandard}</small>
                        <strong>{palletStandard}</strong>
                      </div>
                      <div>
                        <small>{TXT.skidsUnits}</small>
                        <strong>{palletCount} {TXT.skids}{formatWeight(palletWeightPerSkid, units.system)}{TXT.skid} {formatLength(palletHeightIn, units.system)} {TXT.high}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.stackabilityDirective}</small>
                        <span className={palletStackable ? 'text-emerald font-bold' : 'text-accent font-bold'}>
                          {palletStackable ? TXT.stackableDoubleStackCertified : TXT.doNotDoubleStackTop}
                        </span>
                      </div>
                      <div>
                        <small>{TXT.securingCompliance}</small>
                        <span>{palletSecuringChecks.join(', ') || TXT.standardWrap}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Container, Show Intermodal FCL Details */}
                {shipmentType === 'Container' && (
                  <div className="review-segment container-highlight">
                    <span className="seg-title">{TXT.intermodalFclContainerIdentifiers}</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>{TXT.containerUnitIso6346}</small>
                        <strong className="font-mono text-blue">{containerNumber}</strong>
                      </div>
                      <div>
                        <small>{TXT.isoEquipmentSize}</small>
                        <strong>{containerIsoSize}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.highSecurityBoltSeal}</small>
                        <strong className="font-mono text-emerald">{containerBoltSeal}</strong>
                      </div>
                      <div>
                        <small>{TXT.solasVgmScaleWeight}</small>
                        <strong className="font-mono">{formatWeight(containerVgmWeight, units.system)}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.terminalInterchange}</small>
                        <span>{containerTerminal}</span>
                      </div>
                      <div>
                        <small>{TXT.customsPreGate}</small>
                        <span>{containerCustomsStatus}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Freight, Show LTL Rating & Dock Directives */}
                {shipmentType === 'Freight' && (
                  <div className="review-segment freight-highlight">
                    <span className="seg-title">{TXT.heavyFreightLtlRating}</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>{TXT.freightClass}</small>
                        <strong className="text-blue">{freightClass}</strong>
                      </div>
                      <div>
                        <small>{TXT.nmfcClassification}</small>
                        <strong className="font-mono">{freightNmfcCode}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.loadingFacilityDock}</small>
                        <span>{freightLoadingMethod}</span>
                      </div>
                      <div>
                        <small>{TXT.liftgateRequired}</small>
                        <span>
                          {TXT.pickup} {freightLiftgatePickup ? TXT.yes : 'No'} {TXT.delivery} {freightLiftgateDelivery ? TXT.yes : 'No'}
                        </span>
                      </div>
                    </div>
                    {freightHazMat && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>{TXT.hazardousMaterialsHazmat}</small>
                        <strong className="text-accent">{freightUnNumber || TXT.hazmatRegulated}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* If Document, Show Custody & Security Seal */}
                {shipmentType === 'Document' && (
                  <div className="review-segment doc-highlight">
                    <span className="seg-title">{TXT.secureDocumentCustodySpecifications}</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>{TXT.courierPouchFormat}</small>
                        <strong>{docEnvelopeType}</strong>
                      </div>
                      <div>
                        <small>{TXT.tamperEvidentSeal}</small>
                        <strong className="font-mono text-emerald">{docSealNumber}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.signatureMandate}</small>
                        <strong className="text-emerald">
                          {docDirectSignOnly ? TXT.directInPersonPhotoId : TXT.standardDelivery}
                        </strong>
                      </div>
                      <div>
                        <small>{TXT.deliveryCommitment}</small>
                        <span>{docUrgentDeadline}</span>
                      </div>
                    </div>
                    {docFilingCourtRef && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>{TXT.filingReferenceCourtRef}</small>
                        <strong className="font-mono">{docFilingCourtRef}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* If Pet, Show Live Animal & Veterinary Care Highlights */}
                {shipmentType === 'Pets' && (
                  <div className="review-segment pet-highlight">
                    <span className="seg-title">{TXT.liveAnimalAviVeterinaryCare}</span>
                    <div className="seg-grid-2">
                      <div>
                        <small>{TXT.petIdentity}</small>
                        <strong>{petName} ({petSpecies} • {petBreed})</strong>
                      </div>
                      <div>
                        <small>{TXT.rfidMicrochip}</small>
                        <strong className="font-mono text-emerald">{petMicrochip}</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.travelKennelCrate}</small>
                        <span>{petCrateType} ({formatDimensions({ length: petCrateLength, width: petCrateWidth, height: petCrateHeight }, units.system)} {TXT.tare} {formatWeight(petCrateWeightLbs, units.system)})</span>
                      </div>
                      <div>
                        <small>{TXT.totalLiveScaledWeight}</small>
                        <strong className="font-mono">{formatWeight(totalWeight, units.system)} {TXT.pet} {formatWeight(petWeightLbs, units.system)} {TXT.crate2} {formatWeight(petCrateWeightLbs, units.system)})</strong>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.veterinaryCviHealthCert}</small>
                        <strong className="font-mono text-blue">{petHealthCertNumber}</strong>
                      </div>
                      <div>
                        <small>{TXT.rabiesTagClinic}</small>
                        <span>{petRabiesTag} ({petVetClinic})</span>
                      </div>
                    </div>
                    <div className="seg-grid-2" style={{ marginTop: '0.4rem' }}>
                      <div>
                        <small>{TXT.brachycephalicSnubNosed}</small>
                        <span className={petIsBrachycephalic ? 'text-accent font-bold' : 'text-slate-300'}>
                          {petIsBrachycephalic ? TXT.yesSnubNosedStrictTemp : TXT.noStandardAirway}
                        </span>
                      </div>
                      <div>
                        <small>{TXT.acclimationCertification}</small>
                        <span className={petAcclimationCert ? 'text-emerald font-bold' : 'text-slate-400'}>
                          {petAcclimationCert ? TXT.certified45FTo85 : TXT.standardCabinHold}
                        </span>
                      </div>
                    </div>
                    {petCareDirectives.length > 0 && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>{TXT.activeAnimalWelfareProtocols}</small>
                        <span>{petCareDirectives.join(' • ')}</span>
                      </div>
                    )}
                    {petSpecialInstructions && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <small>{TXT.careFeedingDirectives}</small>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--tx-choc-200)' }}>
                          {TXT.lastFed} {petLastFed} {TXT.hydration} {petWaterProtocol} {TXT.notes} {petSpecialInstructions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Review: Route */}
                <div className="review-segment">
                  <span className="seg-title">{TXT.routing}</span>
                  <div className="review-route-display">
                    <div className="r-box">
                      <span className="r-tag">{TXT.origin2}</span>
                      <strong>{senderCity}, {senderState} {senderZip}</strong>
                      <p>{senderName} • {senderCompany}</p>
                    </div>
                    <div className="r-arrow">↓</div>
                    <div className="r-box">
                      <span className="r-tag">{TXT.destination2}</span>
                      <strong>{recipientCity}, {recipientState} {recipientZip}</strong>
                      <p>{recipientName} • {recipientCompany}</p>
                    </div>
                  </div>
                </div>

                {/* Review: Payload */}
                <div className="review-segment">
                  <span className="seg-title">{TXT.payloadSpecifications}</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>{TXT.totalUnits}</small>
                      <strong>{totalPieces} {shipmentType === 'Vehicle' ? TXT.vehicle : shipmentType === 'Pets' ? TXT.livePet : TXT.pieces}</strong>
                    </div>
                    <div>
                      <small>{TXT.totalWeight}</small>
                      <strong>{formatWeight(totalWeight, units.system)} {TXT.total}</strong>
                    </div>
                  </div>
                </div>

                {/* Review: Operational Requirements */}
                <div className="review-segment">
                  <span className="seg-title">{TXT.operationalRequirements}</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>{TXT.pickupWindow}</small>
                      <strong>{pickupDate} · {pickupWindow}</strong>
                    </div>
                    <div>
                      <small>{TXT.expectedDeliveryEta}</small>
                      <strong>{expectedDeliveryDate}{expectedDeliveryDateTouched ? TXT.manualOverride2 : ''}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <small>{TXT.specialHandling2}</small>
                    <span>
                      {[
                        isFragile && 'Fragile',
                        isOversized && 'Oversized',
                        isSpecialHandling && 'Special Handling',
                        isSignatureRequired && 'Signature Required',
                        isOtherHandling && (otherHandlingInstructions || 'Other')
                      ].filter(Boolean).join(', ') || TXT.none}
                    </span>
                  </div>
                </div>

                {/* Review: Pricing */}
                <div className="review-segment">
                  <span className="seg-title">{TXT.administrativePricing}</span>
                  <div className="seg-grid-2">
                    <div>
                      <small>{TXT.internalFinalPrice}</small>
                      <strong className="text-emerald font-mono">{money.format(finalPrice)} {money.currency}</strong>
                    </div>
                    <div>
                      <small>{TXT.serviceLevel2}</small>
                      <span>{service}</span>
                    </div>
                  </div>
                </div>

                {/* Generated Tracking Identity Display */}
                <div className="review-identity-card">
                  <span className="identity-pre-title">TRACKING IDENTITY · ASSIGNED ON REGISTRATION</span>
                  <strong className="identity-tracking font-mono">{generatedTrackingNumber || `${TRACKING_PREFIX}${'·'.repeat(SUFFIX_LENGTH)}`}</strong>
                  {errors.submit && <span className="field-error-msg" role="alert">{errors.submit}</span>}
                  <div className="review-barcode-svg">
                    <svg className="code128-mini-svg" viewBox="0 0 280 40">
                      <rect x="5" y="2" width="3" height="36" fill="#000000" />
                      <rect x="11" y="2" width="2" height="36" fill="#000000" />
                      <rect x="16" y="2" width="5" height="36" fill="#000000" />
                      <rect x="24" y="2" width="2" height="36" fill="#000000" />
                      <rect x="29" y="2" width="5" height="36" fill="#000000" />
                      <rect x="37" y="2" width="3" height="36" fill="#000000" />
                      <rect x="43" y="2" width="4" height="36" fill="#000000" />
                      <rect x="50" y="2" width="2" height="36" fill="#000000" />
                      <rect x="55" y="2" width="6" height="36" fill="#000000" />
                      <rect x="64" y="2" width="3" height="36" fill="#000000" />
                      <rect x="70" y="2" width="4" height="36" fill="#000000" />
                      <rect x="77" y="2" width="5" height="36" fill="#000000" />
                      <rect x="85" y="2" width="2" height="36" fill="#000000" />
                      <rect x="90" y="2" width="5" height="36" fill="#000000" />
                      <rect x="98" y="2" width="3" height="36" fill="#000000" />
                      <rect x="104" y="2" width="6" height="36" fill="#000000" />
                      <rect x="113" y="2" width="2" height="36" fill="#000000" />
                      <rect x="118" y="2" width="5" height="36" fill="#000000" />
                      <rect x="126" y="2" width="3" height="36" fill="#000000" />
                      <rect x="132" y="2" width="6" height="36" fill="#000000" />
                      <rect x="141" y="2" width="3" height="36" fill="#000000" />
                      <rect x="147" y="2" width="4" height="36" fill="#000000" />
                      <rect x="154" y="2" width="5" height="36" fill="#000000" />
                      <rect x="162" y="2" width="2" height="36" fill="#000000" />
                      <rect x="167" y="2" width="6" height="36" fill="#000000" />
                      <rect x="176" y="2" width="3" height="36" fill="#000000" />
                      <rect x="182" y="2" width="4" height="36" fill="#000000" />
                      <rect x="189" y="2" width="5" height="36" fill="#000000" />
                      <rect x="197" y="2" width="2" height="36" fill="#000000" />
                      <rect x="202" y="2" width="6" height="36" fill="#000000" />
                      <rect x="211" y="2" width="4" height="36" fill="#000000" />
                      <rect x="218" y="2" width="2" height="36" fill="#000000" />
                      <rect x="223" y="2" width="5" height="36" fill="#000000" />
                      <rect x="231" y="2" width="3" height="36" fill="#000000" />
                      <rect x="237" y="2" width="6" height="36" fill="#000000" />
                      <rect x="246" y="2" width="4" height="36" fill="#000000" />
                      <rect x="253" y="2" width="2" height="36" fill="#000000" />
                      <rect x="258" y="2" width="5" height="36" fill="#000000" />
                      <rect x="266" y="2" width="4" height="36" fill="#000000" />
                    </svg>
                  </div>
                  <small className="identity-notice">
                    {TXT.creatingThisShipmentWillGenerate}
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* Step Navigation Bottom Bar */}
          <div className="step-nav-footer">
            <div className="step-footer-left">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="step-back-btn"
                  onClick={handlePrevStep}
                >
                  <ArrowLeft size={14} />
                  <span>{TXT.previousStep}</span>
                </button>
              )}
            </div>

            <div className="step-footer-right">
              <span className="step-count-badge">{TXT.stage} {currentStep} OF 6</span>
              {currentStep < 6 ? (
                <button
                  type="button"
                  className="step-continue-btn"
                  onClick={handleNextStep}
                >
                  <span>{TXT.continue}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="create-shipment-final-btn"
                  onClick={handleFinalCreateShipment}
                  disabled={isCreatingShipment}
                >
                  <CheckCircle2 size={17} />
                  <span>{isCreatingShipment ? TXT.verifyingRouteRegistering : TXT.registerMasterConsignment}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PERSISTENT CONSIGNMENT PASSPORT (RIGHT) */}
        <aside className="persistent-summary-column">
          <div className="summary-sticky-card">
            <div className="summary-passport-header">
              <div className="summary-head-title-row">
                <span className="summary-carrier-tag">{COMPANY.toUpperCase()}</span>
                <span className="summary-live-badge">
                  <span className="summary-live-dot" />
                  <span>{TXT.liveManifest}</span>
                </span>
              </div>
              <h4 className="summary-passport-title">{TXT.consignmentPassport}</h4>
            </div>

            {/* Visual Route Corridor */}
            <div className="summary-route-corridor">
              <div className="corridor-city origin">
                <span className="corridor-label">{TXT.origin2}</span>
                <strong className="corridor-name">{senderCity || TXT.origin}{senderState ? `, ${senderState}` : ''}</strong>
              </div>
              <div className="corridor-arrow-wrap">
                <span className="corridor-line" />
                <span className="corridor-arrow">→</span>
              </div>
              <div className="corridor-city dest">
                <span className="corridor-label">{TXT.destination2}</span>
                <strong className="corridor-name text-accent">{recipientCity || TXT.destination}{recipientState ? `, ${recipientState}` : ''}</strong>
              </div>
            </div>

            <div className="summary-specs-list">
              <div className="summary-line-item">
                <span className="s-prop">{TXT.handlingMode}</span>
                <strong className="s-val">{TXT.shipmentTypes[shipmentType]}</strong>
              </div>

              <div className="summary-line-item">
                <span className="s-prop">{TXT.cargoDescription2}</span>
                <strong className="s-val truncate-summary" title={shipmentDescription}>{shipmentDescription || TXT.commercialFreight}</strong>
              </div>

              <div className="summary-line-item">
                <span className="s-prop">{TXT.serviceClass}</span>
                <span className={`summary-service-pill ${(service || 'standard').toLowerCase().replace(/\s+/g, '-')}`}>
                  {service}
                </span>
              </div>

              <div className="summary-divider" />

              <div className="summary-line-item">
                <span className="s-prop">{TXT.payloadUnits}</span>
                <strong className="s-val">
                  {shipmentType === 'Vehicle'
                    ? TXT.t1Vehicle(vehMake, vehModel)
                    : shipmentType === 'Pallet'
                    ? TXT.skids2(palletCount, palletStandard.split(' ')[0])
                    : shipmentType === 'Container'
                    ? TXT.t1FclContainer(containerIsoSize.split(' ')[0])
                    : shipmentType === 'Freight'
                    ? TXT.heavyUnits(freightPiecesCount, freightClass.split(' ')[0])
                    : shipmentType === 'Document'
                    ? TXT.t1SecurePouch(docEnvelopeType.split(' ')[0])
                    : shipmentType === 'Pets'
                    ? TXT.t1LivePet(petName || TXT.petFallback, petBreed || petSpecies)
                    : TXT.packagesCount(totalPieces)}
                </strong>
              </div>

              <div className="summary-line-item">
                <span className="s-prop">{TXT.scaleWeight}</span>
                <strong className="s-val font-mono">{formatWeight(totalWeight, units.system)}</strong>
              </div>
            </div>

            <div className="summary-price-box">
              <div className="price-label-row">
                <span className="price-lead-label">{TXT.commercialTariffTotal}</span>
                <span className="price-currency-tag">{money.currency}</span>
              </div>
              <div className="price-big-amount">
                <span className="amount-number font-mono">{money.format(finalPrice)}</span>
              </div>
            </div>

            <div className="summary-barcode-box">
              <div className="barcode-simulation-lines">
                <div className="b-bar w-2" /><div className="b-bar w-1" /><div className="b-bar w-3" />
                <div className="b-bar w-1" /><div className="b-bar w-4" /><div className="b-bar w-2" />
                <div className="b-bar w-3" /><div className="b-bar w-1" /><div className="b-bar w-2" />
                <div className="b-bar w-4" /><div className="b-bar w-1" /><div className="b-bar w-3" />
              </div>
              <span className="barcode-tracking-text font-mono">
                {generatedTrackingNumber || `${TRACKING_PREFIX}${'·'.repeat(SUFFIX_LENGTH)}`}
              </span>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};
