import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  FileText,
  DollarSign,
  Calendar,
  Send,
  Eye,
  ShieldCheck,
  RotateCcw,
  ArrowLeft,
  Lock,
  Truck
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { useAuth } from '../../auth/AuthContext';
import { QuoteRequest, QuoteRequestStatus, QuoteRequestPricing } from '../../types/admin';
import './QuoteRequestsView.css';
import { MoneyInput } from '../../components/forms/UnitControls';
import { useCurrency } from '../../utils/useCurrency';
import { useUnitSystem } from '../../utils/useUnitSystem';
import { formatDimensions, formatWeight } from '../../shared/units';
import { TRANSPORT_MODE_LABELS } from '../../shared/transportMode';
import { SERVICE_OPTIONS } from '../../data/serviceOptions';
import { QUOTE_REQUESTS_VIEW_TEXT as TXT } from './QuoteRequestsView.text';

export const QuoteRequestsView: React.FC = () => {
  const { quoteRequests, publishQuote, updateQuoteStatus, convertQuoteToShipment, settings } = useAdminData();
  // quotes.view reads; publishing and status changes need quotes.manage, converting also shipments.create.
  const { can } = useAuth();
  const canManageQuotes = can('quotes.manage');
  const money = useCurrency();
  const [units] = useUnitSystem();

  // The admin's "Quote Validity (Days)" setting only ever affected re-opening an already-
  // EXPIRED quote — the actual "publish a new quote" path below (both the default here and
  // handleSelectQuote's reset) had this same date hardcoded as a literal instead, so the
  // setting looked like it controlled quote expiry but silently didn't for the common case.
  const computeDefaultValidUntil = () => {
    const days = settings.quoteValidityDays || 14;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Selected quote for the review workspace
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Pricing Form State (Ultra-Simple Single Amount)
  const [finalPrice, setFinalPrice] = useState<number>(350);
  const [validUntilDate, setValidUntilDate] = useState<string>(computeDefaultValidUntil());
  const [internalNotes, setInternalNotes] = useState<string>('Oversized automotive part. Confirm packaging before shipment creation.');

  // Modal States
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);

  const selectedQuote = quoteRequests.find(q => q.id === selectedQuoteId);

  // Set pricing state when quote is selected
  const handleSelectQuote = (quote: QuoteRequest) => {
    setSelectedQuoteId(quote.id);
    if (quote.pricing) {
      setFinalPrice(quote.pricing.finalPrice || 350);
      setValidUntilDate(quote.pricing.validUntil || computeDefaultValidUntil());
    } else {
      setFinalPrice(350);
      setValidUntilDate(computeDefaultValidUntil());
    }
    setInternalNotes(quote.internalNotes || '');
  };

  // Search Filter
  const filteredQuotes = quoteRequests.filter(q => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      q.id.toLowerCase().includes(term) ||
      q.requesterName.toLowerCase().includes(term) ||
      q.recipientName.toLowerCase().includes(term) ||
      q.requesterEmail.toLowerCase().includes(term) ||
      q.requesterPhone.toLowerCase().includes(term) ||
      q.originCity.toLowerCase().includes(term) ||
      q.destCity.toLowerCase().includes(term) ||
      q.cargoDescription.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    const matchesService = serviceFilter === 'ALL' || q.requestedService === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  // Snapshot KPIs — same at-a-glance stat row used across the other admin screens.
  const newPendingCount = quoteRequests.filter(q => q.status === 'NEW' || q.status === 'UNDER_REVIEW').length;
  const awaitingResponseCount = quoteRequests.filter(q => q.status === 'QUOTE_PUBLISHED' || q.status === 'RATE_PUBLISHED').length;
  const acceptedCount = quoteRequests.filter(q => q.status === 'ACCEPTED').length;

  // Handle Publish Quote
  const handleConfirmPublish = () => {
    if (!selectedQuote) return;
    const pricing: QuoteRequestPricing = {
      baseShipping: Number(finalPrice) || 0,
      oversizeHandling: 0,
      specialHandling: 0,
      finalPrice: Number(finalPrice) || 0,
      validUntil: validUntilDate
    };

    publishQuote(selectedQuote.id, pricing, internalNotes);
    setShowPublishConfirmModal(false);
    setSuccessToast(TXT.quotePublishedSuccessfullyFor(selectedQuote.id, money.format(finalPrice)));
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Handle Convert to Shipment (Strict direct transition)
  const handleConvertShipment = async (quoteId: string) => {
    if (isConverting) return;
    setIsConverting(true);
    try {
      const createdShipment = await convertQuoteToShipment(quoteId);
      setSuccessToast(createdShipment
        ? TXT.acceptedQuoteConvertedDirectlyTo(quoteId, createdShipment.trackingNumber)
        : TXT.quoteCouldNotBeConverted(quoteId));
      setTimeout(() => setSuccessToast(null), 5000);
    } finally {
      setIsConverting(false);
    }
  };

  // Helper for Status Badge Styling
  const renderStatusBadge = (status: QuoteRequestStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="quote-status-badge badge-new">NEW</span>;
      case 'UNDER_REVIEW':
        return <span className="quote-status-badge badge-review">{TXT.underReview2}</span>;
      case 'QUOTE_PUBLISHED':
        return <span className="quote-status-badge badge-published">{TXT.quotePublished3}</span>;
      case 'RATE_PUBLISHED':
        return <span className="quote-status-badge badge-published">{TXT.ratePublished2}</span>;
      case 'ACCEPTED':
        return <span className="quote-status-badge badge-accepted">{TXT.accepted2}</span>;
      case 'DECLINED':
        return <span className="quote-status-badge badge-declined">{TXT.declined2}</span>;
      case 'EXPIRED':
        return <span className="quote-status-badge badge-expired">{TXT.expired2}</span>;
      case 'CONVERTED':
        return <span className="quote-status-badge badge-converted">{TXT.converted2}</span>;
      default:
        // Defensive fallback for any status value outside the known set (e.g. stale/legacy
        // data) — still renders a properly styled pill instead of unstyled plain text.
        return <span className="quote-status-badge badge-review">{String(status).replace(/_/g, ' ')}</span>;
    }
  };

  // Structured inches when the quote has them (converted to the viewer's units), otherwise the
  // stored display string of older quotes; '—' when nothing was given.
  const formatDims = (dims: any, structured?: QuoteRequest['dimensionsIn']) => {
    const inches = structured || (dims && typeof dims === 'object' ? dims : null);
    if (inches) return formatDimensions(inches, units) || '—';
    if (typeof dims === 'string' && dims.trim()) return dims;
    return '—';
  };

  return (
    <div className="tx-quote-requests-workspace animate-fade-in">
      {successToast && (
        <div className="quote-toast-success animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{successToast}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW A: DETAIL WORKSPACE (If a quote is opened for review)
          ========================================================================= */}
      {selectedQuote ? (
        <div className="quote-detail-workspace animate-fade-in">
          {/* Top Bar Navigation */}
          <div className="detail-top-nav">
            <button className="back-to-list-btn" onClick={() => setSelectedQuoteId(null)}>
              <ArrowLeft size={16} />
              <span>{TXT.backToQuoteRequests}</span>
            </button>
            <div className="detail-id-cluster">
              <span className="detail-quote-id font-mono">{selectedQuote.id}</span>
              {renderStatusBadge(selectedQuote.status)}
            </div>
          </div>

          <div className="quote-split-layout">
            {/* LEFT COLUMN: REQUEST DETAILS */}
            <div className="quote-request-card">
              <div className="card-section-head">
                <FileText size={18} className="text-blue" />
                <div>
                  <h3>{TXT.customerShippingInquiryDetails}</h3>
                  <p>{TXT.inquirySubmittedOn} {selectedQuote.submittedDate} {TXT.viaWebsitePortal}</p>
                </div>
              </div>

              {/* Visual Route Header */}
              <div className="route-visual-banner">
                <div className="route-node origin">
                  <span className="r-tag">{TXT.origin}</span>
                  <strong>{selectedQuote.originCity}, {selectedQuote.originState}</strong>
                  <small className="font-mono">{selectedQuote.originZip || '10001'}</small>
                </div>
                <div className="route-divider-arrow">
                  <div className="line" />
                  <ArrowRight size={18} className="arrow" />
                  <div className="line" />
                </div>
                <div className="route-node dest">
                  <span className="r-tag">{TXT.destination}</span>
                  <strong>{selectedQuote.destCity}, {selectedQuote.destState}</strong>
                  <small className="font-mono">{selectedQuote.destZip || '90071'}</small>
                </div>
              </div>

              {/* Sender & Recipient Grid */}
              <div className="parties-2col-grid">
                <div className="party-box">
                  <div className="p-header">
                    <User size={15} className="text-blue" />
                    <span className="p-role">{TXT.requesterSender}</span>
                  </div>
                  <strong className="party-name">{selectedQuote.requesterName}</strong>
                  {selectedQuote.requesterCompany && (
                    <div className="party-meta-row">
                      <Building size={13} className="text-slate" />
                      <span>{selectedQuote.requesterCompany}</span>
                    </div>
                  )}
                  <div className="party-meta-row">
                    <Mail size={13} className="text-slate" />
                    <span>{selectedQuote.requesterEmail}</span>
                  </div>
                  <div className="party-meta-row">
                    <Phone size={13} className="text-slate" />
                    <span>{selectedQuote.requesterPhone}</span>
                  </div>
                  {selectedQuote.requesterAddress && (
                    <div className="party-meta-row">
                      <MapPin size={13} className="text-slate" />
                      <span>{selectedQuote.requesterAddress}</span>
                    </div>
                  )}
                </div>

                <div className="party-box">
                  <div className="p-header">
                    <User size={15} className="text-emerald" />
                    <span className="p-role">{TXT.destinationRecipient}</span>
                  </div>
                  <strong className="party-name">{selectedQuote.recipientName}</strong>
                  {selectedQuote.recipientEmail && (
                    <div className="party-meta-row">
                      <Mail size={13} className="text-slate" />
                      <span>{selectedQuote.recipientEmail}</span>
                    </div>
                  )}
                  {selectedQuote.recipientPhone && (
                    <div className="party-meta-row">
                      <Phone size={13} className="text-slate" />
                      <span>{selectedQuote.recipientPhone}</span>
                    </div>
                  )}
                  {selectedQuote.recipientAddress && (
                    <div className="party-meta-row">
                      <MapPin size={13} className="text-slate" />
                      <span>{selectedQuote.recipientAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cargo & Physical Pieces Breakdown */}
              <div className="cargo-spec-section">
                <div className="spec-section-head">
                  <Package size={15} className="text-blue" />
                  <h4>{TXT.cargoDescriptionPayloadSpecifications}</h4>
                </div>

                <div className="cargo-main-summary">
                  <div className="cargo-headline">
                    <span className="cargo-title">{selectedQuote.cargoDescription}</span>
                    <span className="cargo-type-pill font-mono">{selectedQuote.cargoType}</span>
                  </div>

                  <div className="cargo-metrics-strip">
                    <div className="metric-cell">
                      <span className="m-lbl">{TXT.quantity}</span>
                      <strong>{selectedQuote.quantity} {selectedQuote.quantity === 1 ? TXT.unit : TXT.units}</strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-lbl">{TXT.scaleWeight}</span>
                      <strong>{formatWeight(selectedQuote.totalWeightLbs, units) || '—'}</strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-lbl">{TXT.dimensions}</span>
                      <strong className="font-mono">{formatDims(selectedQuote.dimensions, selectedQuote.dimensionsIn)}</strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-lbl">{TXT.serviceTier}</span>
                      <strong className="text-blue">{selectedQuote.requestedService}{selectedQuote.transportMode ? ` · ${TXT.transportModes[selectedQuote.transportMode]}` : ''}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Special Requirements */}
              <div className="special-req-box">
                <span className="req-label">{TXT.specialHandlingInstructions}</span>
                <p className="req-text">
                  {selectedQuote.specialRequirements || TXT.noneProvided}
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: INTERNAL PRICING AREA (ULTRA-SIMPLE) */}
            <div className="quote-pricing-card">
              <div className="card-section-head pricing-head">
                <DollarSign size={18} className="text-emerald" />
                <div>
                  <h3>{TXT.setShippingPrice}</h3>
                  <p>{TXT.determineTheTotalPriceFor}</p>
                </div>
              </div>

              <div className="pricing-body">
                {/* Single Simple Price Input */}
                <div className="single-price-box">
                  <label className="price-box-label">{TXT.totalQuotePrice}{money.currency})</label>
                  <div className="single-price-input-wrap">
                    <span className="price-dollar-sign">{money.symbol}</span>
                    <MoneyInput
                      step="0.01"
                      value={finalPrice}
                      onChange={v => setFinalPrice(v === '' ? 0 : v)}
                      className="single-price-input font-mono"
                    />
                  </div>
                  <small className="price-help-text">{TXT.theExactAllInclusiveAmount}</small>
                </div>

                {/* Validity Date */}
                <div className="validity-input-box">
                  <label className="validity-label">
                    <Calendar size={13} className="text-blue" />
                    <span>{TXT.quoteValidUntilExpirationDate}</span>
                  </label>
                  <input
                    type="text"
                    value={validUntilDate}
                    onChange={e => setValidUntilDate(e.target.value)}
                    placeholder={TXT.eGSeptember22026}
                    className="validity-date-input"
                  />
                  <small className="validity-help-text">{TXT.guaranteesThisPriceUntilThe}</small>
                </div>

                {/* Internal Admin Notes (Private) */}
                <div className="internal-notes-area">
                  <div className="notes-head">
                    <Lock size={12} className="text-amber" />
                    <span>{TXT.internalNotesPrivateToAdmin}</span>
                  </div>
                  <textarea
                    rows={3}
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    placeholder={TXT.privateRemarksForOperations}
                    className="internal-notes-textarea"
                  />
                </div>

                {/* Lifecycle State Actions */}
                <div className="pricing-actions-footer">
                  {selectedQuote.status === 'NEW' || selectedQuote.status === 'UNDER_REVIEW' ? (
                    canManageQuotes && (
                      <div className="action-buttons-stack">
                        <button
                          className="btn-publish-quote-primary"
                          onClick={() => setShowPublishConfirmModal(true)}
                        >
                          <Send size={16} />
                          <span>{TXT.publishFinalQuote}{money.format(finalPrice)})</span>
                        </button>
                        {selectedQuote.status === 'NEW' && (
                          <button
                            className="btn-review-status-secondary"
                            onClick={() => {
                              updateQuoteStatus(selectedQuote.id, 'UNDER_REVIEW');
                              setSuccessToast(TXT.quoteMarkedAsUnderReview(selectedQuote.id));
                              setTimeout(() => setSuccessToast(null), 3000);
                            }}
                          >
                            <Clock size={14} />
                            <span>{TXT.markAsUnderReview}</span>
                          </button>
                        )}
                      </div>
                    )
                  ) : selectedQuote.status === 'QUOTE_PUBLISHED' || selectedQuote.status === 'RATE_PUBLISHED' ? (
                    <div className="published-state-box">
                      <div className="pub-status-alert">
                        <CheckCircle2 size={16} className="text-emerald" />
                        <div>
                          <strong>{TXT.quotePublished} {money.format(selectedQuote.pricing?.finalPrice)}</strong>
                          <p>{TXT.validUntil} {selectedQuote.pricing?.validUntil}{TXT.awaitingCustomerDecision}</p>
                        </div>
                      </div>

                      {canManageQuotes && (
                        <div className="decision-recorder-buttons">
                          <button
                            className="btn-record-accept"
                            onClick={() => {
                              updateQuoteStatus(selectedQuote.id, 'ACCEPTED');
                              setSuccessToast(TXT.recordedCustomerAcceptanceForQuote(selectedQuote.id));
                              setTimeout(() => setSuccessToast(null), 3000);
                            }}
                          >
                            <Check size={14} />
                            <span>{TXT.recordCustomerAcceptance}</span>
                          </button>
                          <button
                            className="btn-record-decline"
                            onClick={() => {
                              updateQuoteStatus(selectedQuote.id, 'DECLINED');
                              setSuccessToast(TXT.recordedQuoteAsDeclined(selectedQuote.id));
                              setTimeout(() => setSuccessToast(null), 3000);
                            }}
                          >
                            <XCircle size={14} />
                            <span>{TXT.recordDeclined}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : selectedQuote.status === 'ACCEPTED' ? (
                    <div className="accepted-action-box">
                      <div className="accept-banner">
                        <CheckCircle2 size={18} className="text-emerald" />
                        <div>
                          <strong>{TXT.quoteAcceptedByCustomer}{money.format(selectedQuote.pricing?.finalPrice)})</strong>
                          <p>{TXT.readyForPhysicalShipmentProvisioning}</p>
                        </div>
                      </div>

                      {canManageQuotes && can('shipments.create') && (
                        <button
                          className="btn-convert-to-shipment"
                          onClick={() => handleConvertShipment(selectedQuote.id)}
                          disabled={isConverting}
                        >
                          <Truck size={17} />
                          <span>{isConverting ? TXT.verifyingRouteConverting : TXT.createShipmentFromQuote}</span>
                        </button>
                      )}
                    </div>
                  ) : selectedQuote.status === 'CONVERTED' ? (
                    <div className="converted-state-box">
                      <ShieldCheck size={20} className="text-blue" />
                      <div>
                        <strong>{TXT.consignmentActive} <span className="font-mono text-blue">{selectedQuote.convertedShipmentId || selectedQuote.id}</span></strong>
                        <p>{TXT.thisQuoteWasConvertedInto}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="closed-state-box">
                      <span>{TXT.status} <strong>{selectedQuote.status}</strong></span>
                      {canManageQuotes && (
                        <button
                          className="btn-reopen-quote"
                          onClick={() => updateQuoteStatus(selectedQuote.id, 'UNDER_REVIEW')}
                        >
                          <RotateCcw size={13} />
                          <span>{TXT.reOpenQuote}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           VIEW B: MAIN QUOTE REQUESTS DIRECTORY & TABLE
           ========================================================================= */
        <div className="quotes-directory-view animate-fade-in">
          {/* Header */}
          <div className="quotes-page-header">
            <div className="header-title-block">
              <h2>{TXT.quoteRequests}</h2>
              <p>{TXT.reviewShippingInquiriesDeterminePricing}</p>
            </div>
          </div>

          {/* Snapshot KPI Row (matches Dashboard / Shipments visual language) */}
          <div className="qr-kpi-row">
            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className="qr-circle-icon accent">
                  <Package size={15} />
                </div>
                <span className="qr-card-label">{TXT.totalRequests}</span>
              </div>
              <strong className="qr-card-number">{quoteRequests.length}</strong>
              <span className="qr-card-subtext">{TXT.allTimeInquiries}</span>
            </div>

            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className={`qr-circle-icon ${newPendingCount > 0 ? 'amber' : 'green'}`}>
                  <Clock size={15} />
                </div>
                <span className="qr-card-label">{TXT.newPending}</span>
              </div>
              <strong className="qr-card-number">{newPendingCount}</strong>
              <span className="qr-card-subtext">{TXT.awaitingReview}</span>
            </div>

            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className="qr-circle-icon blue">
                  <Send size={15} />
                </div>
                <span className="qr-card-label">{TXT.ratePublished2}</span>
              </div>
              <strong className="qr-card-number">{awaitingResponseCount}</strong>
              <span className="qr-card-subtext">{TXT.awaitingCustomer}</span>
            </div>

            <div className="qr-kpi-card">
              <div className="qr-card-header">
                <div className="qr-circle-icon emerald">
                  <CheckCircle2 size={15} />
                </div>
                <span className="qr-card-label">{TXT.accepted2}</span>
              </div>
              <strong className="qr-card-number">{acceptedCount}</strong>
              <span className="qr-card-subtext">{TXT.readyToConvert}</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="quotes-filter-bar">
            <div className="quote-search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="quote-search-input font-mono"
                placeholder={TXT.searchQuoteIdApplicantName}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-selects-cluster">
              <div className="filter-unit">
                <label>{TXT.status}</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">{TXT.allStatuses}</option>
                  <option value="NEW">{TXT.new}</option>
                  <option value="UNDER_REVIEW">{TXT.underReview}</option>
                  <option value="QUOTE_PUBLISHED">{TXT.quotePublished2}</option>
                  <option value="RATE_PUBLISHED">{TXT.ratePublished}</option>
                  <option value="ACCEPTED">{TXT.accepted}</option>
                  <option value="DECLINED">{TXT.declined}</option>
                  <option value="EXPIRED">{TXT.expired}</option>
                  <option value="CONVERTED">{TXT.converted}</option>
                </select>
              </div>

              <div className="filter-unit">
                <label>{TXT.service}</label>
                <select
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">{TXT.allServices}</option>
                  {SERVICE_OPTIONS.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Master Table of Quote Requests */}
          <div className="quotes-table-card">
            <table className="quotes-master-table">
              <thead>
                <tr>
                  <th>{TXT.quoteId}</th>
                  <th>{TXT.parties}</th>
                  <th>{TXT.cargoDescription}</th>
                  <th>{TXT.route}</th>
                  <th>{TXT.specs}</th>
                  <th>{TXT.status2}</th>
                  <th>{TXT.submitted}</th>
                  <th className="text-right">{TXT.action}</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-table-cell">
                      {TXT.noQuoteRequestsMatchYour}
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map(quote => (
                    <tr
                      key={quote.id}
                      className={`quote-row-item ${quote.id === 'QR-2026-00124' ? 'flagship-row' : ''}`}
                      onClick={() => handleSelectQuote(quote)}
                    >
                      {/* Quote ID */}
                      <td>
                        <div className="id-cell">
                          <strong className="quote-id-txt font-mono">{quote.id}</strong>
                          {quote.id === 'QR-2026-00124' && <span className="flagship-pill">{TXT.sample}</span>}
                        </div>
                      </td>

                      {/* Parties */}
                      <td>
                        <div className="parties-cell">
                          <strong>{quote.requesterName}</strong>
                          <span className="sub-to">→ {quote.recipientName}</span>
                        </div>
                      </td>

                      {/* Cargo Description */}
                      <td>
                        <div className="cargo-cell">
                          <strong>{quote.cargoDescription}</strong>
                          <small className="cargo-type font-mono">{quote.cargoType}</small>
                        </div>
                      </td>

                      {/* Route */}
                      <td>
                        <div className="route-cell">
                          <span>{quote.originCity}, {quote.originState}</span>
                          <ArrowRight size={12} className="route-arr" />
                          <span>{quote.destCity}, {quote.destState}</span>
                        </div>
                      </td>

                      {/* Specs */}
                      <td>
                        <div className="specs-cell">
                          <strong>{formatWeight(quote.totalWeightLbs || (quote as any).weightLbs, units) || '—'}</strong>
                          <small className="font-mono">{formatDims(quote.dimensions, quote.dimensionsIn)}</small>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {renderStatusBadge(quote.status)}
                      </td>

                      {/* Date */}
                      <td>
                        <span className="date-cell">{quote.submittedDate}</span>
                      </td>

                      {/* Action */}
                      <td className="text-right" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn-review-row"
                          onClick={() => handleSelectQuote(quote)}
                        >
                          <Eye size={13} />
                          <span>{TXT.review}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Table Footer */}
            <div className="quotes-table-footer">
              <span>{TXT.showing} <strong>{filteredQuotes.length}</strong> {TXT.of} <strong>{quoteRequests.length}</strong> {TXT.quoteInquiries}</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: PUBLISH QUOTE CONFIRMATION
          ========================================================================= */}
      {showPublishConfirmModal && selectedQuote && (
        <div className="quote-modal-backdrop" onClick={() => setShowPublishConfirmModal(false)}>
          <div className="quote-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{TXT.publishQuote}</h3>
              <button className="modal-close-btn" onClick={() => setShowPublishConfirmModal(false)}>
                <XCircle size={18} />
              </button>
            </div>

            <div className="publish-confirm-body">
              <div className="confirm-summary-box">
                <div className="c-row">
                  <span>{TXT.quoteReference}</span>
                  <strong className="font-mono">{selectedQuote.id}</strong>
                </div>
                <div className="c-row">
                  <span>{TXT.customer}</span>
                  <strong>{selectedQuote.requesterName} ({selectedQuote.originCity} → {selectedQuote.destCity})</strong>
                </div>
                <div className="c-row highlight">
                  <span>{TXT.finalAmount}</span>
                  <strong className="font-mono text-emerald">{money.format(finalPrice)} {money.currency}</strong>
                </div>
                <div className="c-row">
                  <span>{TXT.validUntil2}</span>
                  <strong>{validUntilDate}</strong>
                </div>
              </div>

              <p className="publish-disclaimer">
                {TXT.oncePublishedThisQuoteWill}
              </p>
            </div>

            <div className="modal-actions-footer">
              <button className="btn-cancel" onClick={() => setShowPublishConfirmModal(false)}>
                {TXT.cancel}
              </button>
              <button className="btn-confirm-publish" onClick={handleConfirmPublish}>
                <Send size={15} />
                <span>{TXT.publishQuote2}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
