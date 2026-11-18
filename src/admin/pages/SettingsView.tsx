import React, { lazy, Suspense, useState } from 'react';
import {
  Building,
  Shield,
  DollarSign,
  Barcode as BarcodeIcon,
  Server,
  Save,
  CheckCircle2,
  Lock,
  MapPin,
  FileText,
  AlertTriangle,
  RotateCcw,
  Phone,
  Mail
} from 'lucide-react';
import { ADMIN_URL, COMPANY_SHORT, EMAIL, HQ_ADDRESS, LEGAL_NAME } from '../../config/brand';
import { useAdminData } from '../../context/AdminDataContext';
import { usePermission } from '../../auth/AuthContext';
import { MAIL_TEXT } from '../../auth/strings';
import './SettingsView.css';

// Settings → Email (B.6), loaded when its tab is opened.
const EmailSettingsPanel = lazy(() => import('../components/EmailSettingsPanel'));
import { CURRENCY_NAMES, DISPLAY_CURRENCIES, formatMoney, resolveCurrency, type DisplayCurrency } from '../../shared/currency';
import { MeasureInput, useUnitLabels } from '../../components/forms/UnitControls';
import { SETTINGS_VIEW_TEXT as TXT } from './SettingsView.text';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useAdminData();
  // settings.view reads; Reset Defaults and Save need settings.manage.
  const canManageSettings = usePermission('settings.manage');

  // Company Profile State — hydrated from persisted settings (falling back to the legacy
  // `headquarters` key for databases seeded before it was renamed to `headquartersAddress`)
  const [companyName, setCompanyName] = useState(settings.companyName || LEGAL_NAME);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone || '');
  const [dispatchEmail, setDispatchEmail] = useState(settings.dispatchEmail || EMAIL);
  const [headquarters, setHeadquarters] = useState(settings.headquartersAddress || (settings as any).headquarters || '');
  const [dotNumber, setDotNumber] = useState(settings.dotNumber || '');

  // Public Tracking & Privacy Controls (Consolidated from Tracking Control)
  const [piiMasking, setPiiMasking] = useState(settings.piiMaskingEnabled ?? true);
  const [mapVisibility, setMapVisibility] = useState<'CITY' | 'EXACT' | 'HIDDEN'>(settings.mapVisibility || 'CITY');
  const [cloakInternalNotes, setCloakInternalNotes] = useState(settings.cloakInternalNotes ?? true);
  const [showEstimatedTime, setShowEstimatedTime] = useState(settings.showEstimatedTime ?? true);

  // Pricing & Tariff Defaults
  const [fuelRate, setFuelRate] = useState((settings.defaultFuelSurchargeRate ? settings.defaultFuelSurchargeRate * 100 : 8.5).toString());
  const [quoteValidityDays, setQuoteValidityDays] = useState(String(settings.quoteValidityDays ?? 14));
  const [oversizeLengthThreshold, setOversizeLengthThreshold] = useState<number | ''>(settings.oversizeLengthThreshold ?? 60);
  const units = useUnitLabels();

  // Display currency (tracker 2.7): prices are stored in USD and shown in this currency at the
  // rate entered here. A non-USD currency without a rate keeps showing USD.
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>((settings.displayCurrency as DisplayCurrency) || 'USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(settings.exchangeRates || {}).map(([k, v]) => [k, String(v)])));
  const currencyPreview = resolveCurrency({
    displayCurrency,
    exchangeRates: Object.fromEntries(Object.entries(exchangeRates).map(([k, v]) => [k, parseFloat(v)]))
  });

  // Barcode & Document Automation
  const [barcodeStandard] = useState('Code 128 (High-Density Linear Symbology - No QR)');
  const [autoGenLabel, setAutoGenLabel] = useState(settings.autoGenLabel ?? true);
  const [autoGenReceipt, setAutoGenReceipt] = useState(settings.autoGenReceipt ?? true);

  // Authorized Signature / Stamp (used on Insurance Certificates & Bills of Lading)
  const [signatureStampUrl, setSignatureStampUrl] = useState(settings.signatureStampUrl || '');
  const [signatoryName, setSignatoryName] = useState(settings.signatoryName || '');
  const [signatoryTitle, setSignatoryTitle] = useState(settings.signatoryTitle || '');

  // Gateway Hub Telemetry — previously 4 hardcoded cards frozen on "NORMAL FLOW" with no
  // connection to the real hubSortStatus field this settings object already had. Now backed
  // by that field for real, and includes the 5th hub (EWR) the old hardcoded UI omitted.
  const [hubSortStatus, setHubSortStatus] = useState<{ [key: string]: 'NORMAL' | 'HIGH_VOLUME' | 'DELAYED' }>(
    settings.hubSortStatus || { JFK: 'NORMAL', EWR: 'NORMAL', ORD: 'NORMAL', DFW: 'NORMAL', LAX: 'NORMAL' }
  );
  const HUB_META: { code: string; city: string; name: string; onTime: string; scans: string }[] = [
    { code: 'JFK', city: 'NEW YORK', name: 'JFK International Cargo Gateway', onTime: '99.2% On-Time', scans: '1,840 Daily Scans' },
    { code: 'EWR', city: 'NEWARK', name: 'Newark Liberty Gateway Terminal', onTime: '98.9% On-Time', scans: '1,320 Daily Scans' },
    { code: 'ORD', city: 'CHICAGO', name: 'Chicago Intermodal Sort Terminal', onTime: '97.8% On-Time', scans: '2,420 Daily Scans' },
    { code: 'DFW', city: 'DALLAS', name: 'Dallas-Fort Worth Freight Gateway', onTime: '98.5% On-Time', scans: '1,150 Daily Scans' },
    { code: 'LAX', city: 'LOS ANGELES', name: 'Los Angeles Pacific Distribution Center', onTime: '99.4% On-Time', scans: '1,910 Daily Scans' }
  ];
  const [stampError, setStampError] = useState<string | null>(null);

  const handleStampFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStampError(null);

    if (!file.type.startsWith('image/')) {
      setStampError(TXT.pleaseUploadAnImageFile);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStampError(TXT.imageIsTooLargePlease);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setSignatureStampUrl(reader.result as string);
    reader.onerror = () => setStampError(TXT.couldNotReadThatFile);
    reader.readAsDataURL(file);
  };

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'PRIVACY' | 'TARIFF' | 'DOCUMENTS' | 'HUBS' | 'EMAIL'>('GENERAL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle Save
  const [toastIsError, setToastIsError] = useState(false);
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    // Previously showed "saved successfully" unconditionally, regardless of whether the PUT
    // actually reached the server — a rejected write (expired session, a rejected request)
    // looked identical to a real save, so a toggle like PII masking could show as saved in
    // the admin UI while the public site kept serving the old value indefinitely.
    const result = await updateSettings({
      companyName,
      supportPhone,
      dispatchEmail,
      headquartersAddress: headquarters,
      dotNumber,
      defaultFuelSurchargeRate: (parseFloat(fuelRate) || 8.5) / 100,
      piiMaskingEnabled: piiMasking,
      mapVisibility,
      cloakInternalNotes,
      showEstimatedTime,
      quoteValidityDays: parseInt(quoteValidityDays, 10) || 14,
      oversizeLengthThreshold: oversizeLengthThreshold === '' ? 60 : oversizeLengthThreshold,
      displayCurrency,
      exchangeRates: Object.fromEntries(
        Object.entries(exchangeRates)
          .map(([k, v]) => [k, parseFloat(v)] as const)
          .filter(([, v]) => Number.isFinite(v) && v > 0)
      ),
      autoGenLabel,
      autoGenReceipt,
      signatureStampUrl,
      signatoryName,
      signatoryTitle,
      hubSortStatus
    });
    setToastIsError(!result.success);
    setToastMessage(result.success
      ? TXT.systemSettingsSavedSuccessfully
      : TXT.failedToSaveSettingsYour(result.error || TXT.serverRejected));
    setTimeout(() => setToastMessage(null), result.success ? 3500 : 6000);
  };

  const handleResetDefaults = () => {
    setCompanyName(LEGAL_NAME);
    setSupportPhone('');
    setDispatchEmail(EMAIL);
    setHeadquarters(HQ_ADDRESS);
    setDotNumber('');
    setPiiMasking(true);
    setMapVisibility('CITY');
    setCloakInternalNotes(true);
    setShowEstimatedTime(true);
    setFuelRate('8.5');
    setQuoteValidityDays('14');
    setOversizeLengthThreshold(60);
    setDisplayCurrency('XAF');
    setAutoGenLabel(true);
    setAutoGenReceipt(true);
    setSignatureStampUrl('');
    setSignatoryName('');
    setSignatoryTitle('');
    setHubSortStatus({ JFK: 'NORMAL', EWR: 'NORMAL', ORD: 'NORMAL', DFW: 'NORMAL', LAX: 'NORMAL' });
    setStampError(null);
    setToastMessage(TXT.settingsRestoredToDefaultConfiguration);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="settings-page-container animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`settings-toast animate-fade-in${toastIsError ? ' toast-error' : ''}`}>
          {toastIsError ? <AlertTriangle size={18} className="text-crimson" /> : <CheckCircle2 size={18} className="text-emerald" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="settings-page-header">
        <div>
          <h2>{TXT.systemSettingsConfiguration}</h2>
          <p>{TXT.manageCompanyIdentityPublicTracking}</p>
        </div>

        {canManageSettings && activeTab !== 'EMAIL' && (
          <div className="settings-header-actions">
            <button
              type="button"
              className="btn-reset-settings"
              onClick={handleResetDefaults}
            >
              <RotateCcw size={15} />
              <span>{TXT.resetDefaults}</span>
            </button>
            <button
              type="button"
              className="btn-save-settings-primary"
              onClick={handleSaveAll}
            >
              <Save size={15} />
              <span>{TXT.saveAllSettings}</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="settings-nav-tabs">
        <button
          className={`settings-tab-btn ${activeTab === 'GENERAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('GENERAL')}
        >
          <Building size={16} />
          <span>{TXT.companyProfile}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'PRIVACY' ? 'active' : ''}`}
          onClick={() => setActiveTab('PRIVACY')}
        >
          <Shield size={16} />
          <span>{TXT.publicTrackingPrivacy}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'TARIFF' ? 'active' : ''}`}
          onClick={() => setActiveTab('TARIFF')}
        >
          <DollarSign size={16} />
          <span>{TXT.tariffPricingDefaults}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'DOCUMENTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('DOCUMENTS')}
        >
          <FileText size={16} />
          <span>{TXT.barcodeDocuments}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'HUBS' ? 'active' : ''}`}
          onClick={() => setActiveTab('HUBS')}
        >
          <Server size={16} />
          <span>{TXT.gatewayHubTelemetry}</span>
        </button>

        <button
          className={`settings-tab-btn ${activeTab === 'EMAIL' ? 'active' : ''}`}
          onClick={() => setActiveTab('EMAIL')}
        >
          <Mail size={16} />
          <span>{MAIL_TEXT.tab}</span>
        </button>
      </div>

      {/* Email has its own actions (test, retry) and nothing to save with the form below. */}
      {activeTab === 'EMAIL' && (
        <Suspense fallback={<p className="tx-iam-muted">{MAIL_TEXT.loading}</p>}>
          <EmailSettingsPanel />
        </Suspense>
      )}


      {/* Settings Content Grid */}
      <form onSubmit={handleSaveAll} className="settings-form-wrapper" hidden={activeTab === 'EMAIL'}>
        {/* =========================================================================
            SECTION 1: COMPANY & CARRIER PROFILE
            ========================================================================= */}
        {activeTab === 'GENERAL' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-blue">
                <Building size={20} />
              </div>
              <div>
                <h3>{TXT.companyCarrierIdentity}</h3>
                <p>{TXT.officialOrganizationInformationDisplayedOn}</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="form-row-2">
                <div className="settings-field">
                  <label>{TXT.legalCompanyName}</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="settings-input"
                  />
                  <small>{TXT.appearsAsTheRegisteredCommercial}</small>
                </div>

                <div className="settings-field">
                  {/* Stored under the existing key `dotNumber` (no renamed settings, CLAUDE.md rule 10). */}
                  <label htmlFor="settings-registration">{TXT.businessRegistrationRccmNiu}</label>
                  <input
                    id="settings-registration"
                    type="text"
                    value={dotNumber}
                    onChange={e => setDotNumber(e.target.value)}
                    className="settings-input font-mono"
                    placeholder="RCCM … · NIU …"
                  />
                  <small>{TXT.optionalShownOnThePublic}</small>
                </div>
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label>{TXT.centralDispatchSupportPhone}</label>
                  <div className="input-with-icon">
                    <Phone size={15} className="input-icon" />
                    <input
                      type="text"
                      value={supportPhone}
                      onChange={e => setSupportPhone(e.target.value)}
                      className="settings-input with-icon"
                    />
                  </div>
                  <small>{TXT.tollFreeCustomerInquiryHotline}</small>
                </div>

                <div className="settings-field">
                  <label>{TXT.operationsDispatchEmail}</label>
                  <div className="input-with-icon">
                    <Mail size={15} className="input-icon" />
                    <input
                      type="email"
                      value={dispatchEmail}
                      onChange={e => setDispatchEmail(e.target.value)}
                      className="settings-input with-icon"
                    />
                  </div>
                  <small>{TXT.primaryContactEmailForQuotes}</small>
                </div>
              </div>

              <div className="settings-field">
                <label>{TXT.primaryTerminalHeadquartersAddress}</label>
                <div className="input-with-icon">
                  <MapPin size={15} className="input-icon" />
                  <input
                    type="text"
                    value={headquarters}
                    onChange={e => setHeadquarters(e.target.value)}
                    className="settings-input with-icon"
                  />
                </div>
                <small>{TXT.mainAdministrativeFacilityAndOrigin}</small>
              </div>

              <div className="settings-field">
                <label htmlFor="settings-admin-url">{TXT.adminConsoleAddress}</label>
                <div className="input-with-icon">
                  <Lock size={15} className="input-icon" />
                  <input
                    id="settings-admin-url"
                    type="text"
                    value={ADMIN_URL}
                    readOnly
                    className="settings-input with-icon disabled-bg font-mono"
                  />
                </div>
                <small>{TXT.bookmarkThisAddressItIsn}</small>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: PUBLIC TRACKING & PRIVACY (Consolidated)
            ========================================================================= */}
        {activeTab === 'PRIVACY' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-emerald">
                <Shield size={20} />
              </div>
              <div>
                <h3>{TXT.publicTrackingCustomerPrivacyControls}</h3>
                <p>{TXT.configureWhatInformationIsVisible}</p>
              </div>
            </div>

            <div className="settings-card-body">
              {/* PII Masking Toggle Card */}
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>{TXT.strictCustomerPiiMaskingRecommended}</strong>
                  <p>
                    {TXT.masksCustomerPhoneNumbersAnd} <code>(310) •••-0892</code> {TXT.and} <code>{TXT.dMLosAngelesCa}</code>).
                  </p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={piiMasking}
                    onChange={e => setPiiMasking(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Internal Notes Cloaking */}
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>{TXT.cloakInternalOperationsNotes}</strong>
                  <p>
                    {TXT.strictlyPreventsInternalAdminRemarks} <i>{TXT.customerRequestedMorningDispatch}</i>{TXT.fromAppearingOnTheCustomer}
                  </p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={cloakInternalNotes}
                    onChange={e => setCloakInternalNotes(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Show Estimated Delivery Window */}
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>{TXT.displayEstimatedDeliveryWindowsPublicly}</strong>
                  <p>
                    {TXT.showsTheEstimatedDeliveryDate} <i>{TXT.estimatedDelivery2October2026}</i>{TXT.inTheDestinationSTime}
                  </p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={showEstimatedTime}
                    onChange={e => setShowEstimatedTime(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Public Map Visibility Mode */}
              <div className="settings-field pt-2">
                <label>{TXT.publicRouteMapDisplayMode}</label>
                <div className="radio-options-vertical">
                  <label className={`radio-card ${mapVisibility === 'CITY' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="mapVis"
                      checked={mapVisibility === 'CITY'}
                      onChange={() => setMapVisibility('CITY')}
                    />
                    <div>
                      <strong>{TXT.cityToCityRouteCorridor}</strong>
                      <span>{TXT.showsHighLevelTransitRoute}</span>
                    </div>
                  </label>

                  <label className={`radio-card ${mapVisibility === 'EXACT' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="mapVis"
                      checked={mapVisibility === 'EXACT'}
                      onChange={() => setMapVisibility('EXACT')}
                    />
                    <div>
                      <strong>{TXT.exactFacilityHubPins}</strong>
                      <span>{TXT.displaysIndividualWarehouseSortingPins}</span>
                    </div>
                  </label>

                  <label className={`radio-card ${mapVisibility === 'HIDDEN' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="mapVis"
                      checked={mapVisibility === 'HIDDEN'}
                      onChange={() => setMapVisibility('HIDDEN')}
                    />
                    <div>
                      <strong>{TXT.hideInteractiveMap}</strong>
                      <span>{TXT.replacesTheMapWithA}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 3: TARIFF & PRICING DEFAULTS
            ========================================================================= */}
        {activeTab === 'TARIFF' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-indigo">
                <DollarSign size={20} />
              </div>
              <div>
                <h3>{TXT.tariffPricingParameters}</h3>
                <p>{TXT.defaultParametersUsedWhenAn}</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="form-row-2">
                <div className="settings-field">
                  <label>{TXT.nationalFuelSurchargeIndex}</label>
                  <div className="input-with-icon">
                    <input
                      type="number"
                      step="0.1"
                      value={fuelRate}
                      onChange={e => setFuelRate(e.target.value)}
                      className="settings-input font-mono"
                    />
                  </div>
                  <small>{TXT.currentBaselineFuelIndexApplied}</small>
                </div>

                <div className="settings-field">
                  <label>{TXT.defaultQuoteOfferValidityWindow}</label>
                  <input
                    type="number"
                    value={quoteValidityDays}
                    onChange={e => setQuoteValidityDays(e.target.value)}
                    className="settings-input font-mono"
                  />
                  <small>{TXT.guaranteesQuotedShippingTariffsFor}</small>
                </div>
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label htmlFor="settings-currency">{TXT.displayCurrency}</label>
                  <select
                    id="settings-currency"
                    value={displayCurrency}
                    onChange={e => setDisplayCurrency(e.target.value as DisplayCurrency)}
                    className="settings-input"
                  >
                    {DISPLAY_CURRENCIES.map(c => (
                      <option key={c} value={c}>{c} — {CURRENCY_NAMES[c]}</option>
                    ))}
                  </select>
                  <small>{TXT.pricesAreStoredInUsd}</small>
                </div>

                {displayCurrency !== 'USD' && (
                  <div className="settings-field">
                    <label htmlFor="settings-rate">{TXT.exchangeRate1Usd} {displayCurrency})</label>
                    <input
                      id="settings-rate"
                      type="number"
                      step="any"
                      min="0"
                      value={exchangeRates[displayCurrency] ?? ''}
                      onChange={e => setExchangeRates(prev => ({ ...prev, [displayCurrency]: e.target.value }))}
                      className="settings-input font-mono"
                    />
                    {currencyPreview.missingRate ? (
                      <small className="settings-warning-text">{TXT.enterTheRateToSwitch} {displayCurrency}{TXT.untilThenTheyStayIn}</small>
                    ) : (
                      <small>{TXT.example35000IsShown} {formatMoney(350, currencyPreview)}{TXT.updateTheRateWhenIt}</small>
                    )}
                  </div>
                )}
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label>{TXT.oversizeCargoDimensionThreshold}{units.length})</label>
                  <MeasureInput
                    kind="length"
                    min="0"
                    value={oversizeLengthThreshold}
                    onChange={setOversizeLengthThreshold}
                    className="settings-input font-mono"
                  />
                  <small>{TXT.itemsLongerThanThisE}</small>
                </div>

                <div className="settings-field">
                  <label>{TXT.operatingCurrencyBillingCode}</label>
                  <input
                    type="text"
                    disabled
                    value="USD ($) — United States Dollar"
                    className="settings-input disabled-bg"
                  />
                  <small>{TXT.pricesAreStoredInUs}</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 4: BARCODE & DOCUMENT AUTOMATION
            ========================================================================= */}
        {activeTab === 'DOCUMENTS' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-amber">
                <BarcodeIcon size={20} />
              </div>
              <div>
                <h3>{TXT.barcodeDocumentGenerationRules}</h3>
                <p>{TXT.configureAutomatedDocumentationGenerationAnd}</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="settings-field">
                <label>{TXT.carrierBarcodeStandardStrictPolicy}</label>
                <input
                  type="text"
                  disabled
                  value={barcodeStandard}
                  className="settings-input font-mono disabled-bg"
                />
                <small>{COMPANY_SHORT} {TXT.usesLinearCode128Barcodes}</small>
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>{TXT.autoGenerateShippingLabelOn}</strong>
                  <p>{TXT.automaticallyRegistersA4x6Courier}</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={autoGenLabel}
                    onChange={e => setAutoGenLabel(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <strong>{TXT.autoGenerateShipmentReceiptOn}</strong>
                  <p>{TXT.issuesAnOfficialPaymentAnd}</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={autoGenReceipt}
                    onChange={e => setAutoGenReceipt(e.target.checked)}
                  />
                  <span className="slider-round" />
                </label>
              </div>

              <div className="settings-field pt-2">
                <label>{TXT.authorizedSignatureCompanyStamp}</label>
                <div className="stamp-upload-row">
                  <div className="stamp-preview-box">
                    {signatureStampUrl ? (
                      <img src={signatureStampUrl} alt={TXT.authorizedSignaturePreview} />
                    ) : (
                      <span className="stamp-preview-empty">{TXT.noStampUploaded}</span>
                    )}
                  </div>
                  <div className="stamp-upload-controls">
                    <label className="btn-upload-stamp">
                      <input type="file" accept="image/*" onChange={handleStampFileChange} hidden />
                      <span>{signatureStampUrl ? TXT.replaceImage : TXT.uploadImage}</span>
                    </label>
                    {signatureStampUrl && (
                      <button type="button" className="btn-remove-stamp" onClick={() => setSignatureStampUrl('')}>
                        {TXT.remove}
                      </button>
                    )}
                  </div>
                </div>
                {stampError && <small className="stamp-error-text">{stampError}</small>}
                <small>
                  {TXT.uploadedAsYourOwnAuthorized}
                </small>
              </div>

              <div className="form-row-2">
                <div className="settings-field">
                  <label>{TXT.signatoryName}</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={e => setSignatoryName(e.target.value)}
                    placeholder={TXT.eGMarcusAlvarado}
                    className="settings-input"
                  />
                  <small>{TXT.printedBeneathTheSignatureOn}</small>
                </div>
                <div className="settings-field">
                  <label>{TXT.signatoryTitle}</label>
                  <input
                    type="text"
                    value={signatoryTitle}
                    onChange={e => setSignatoryTitle(e.target.value)}
                    placeholder={TXT.eGDirectorOfCargo}
                    className="settings-input"
                  />
                  <small>{TXT.jobTitlePrintedAlongsideThe}</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 5: GATEWAY HUB TELEMETRY
            ========================================================================= */}
        {activeTab === 'HUBS' && (
          <div className="settings-card-section animate-fade-in">
            <div className="settings-card-header">
              <div className="header-icon-wrap icon-blue">
                <Server size={20} />
              </div>
              <div>
                <h3>{TXT.nationalGatewayHubTelemetry}</h3>
                <p>{TXT.realTimeStatusAndThroughput}</p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="hubs-status-grid">
                {HUB_META.map(hub => {
                  const status = hubSortStatus[hub.code] || 'NORMAL';
                  const pillClass = status === 'DELAYED' ? 'delayed' : status === 'HIGH_VOLUME' ? 'high-volume' : 'normal';
                  const pillLabel = status === 'DELAYED' ? 'DELAYED' : status === 'HIGH_VOLUME' ? 'HIGH VOLUME' : 'NORMAL FLOW';
                  return (
                    <div className="hub-telemetry-card" key={hub.code}>
                      <div className="hub-card-top">
                        <div className="hub-tag font-mono">{hub.code} · {hub.city}</div>
                        <span className={`hub-status-pill ${pillClass}`}>{pillLabel}</span>
                      </div>
                      <strong className="hub-name">{hub.name}</strong>
                      <div className="hub-metrics-row font-mono">
                        <span>{hub.onTime}</span>
                        <span>{hub.scans}</span>
                      </div>
                      <select
                        className="hub-status-select"
                        value={status}
                        onChange={(e) => setHubSortStatus(prev => ({ ...prev, [hub.code]: e.target.value as 'NORMAL' | 'HIGH_VOLUME' | 'DELAYED' }))}
                      >
                        <option value="NORMAL">{TXT.normalFlow}</option>
                        <option value="HIGH_VOLUME">{TXT.highVolume}</option>
                        <option value="DELAYED">{TXT.delayed}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Action Bar */}
        <div className="settings-footer-save-bar">
          <div className="save-bar-info">
            <Shield size={16} className="text-emerald" />
            <span>{TXT.allModificationsTakeEffectAcross}</span>
          </div>
          <button type="submit" className="btn-save-settings-primary">
            <Save size={15} />
            <span>{TXT.saveAllSettings}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
