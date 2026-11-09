import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  ShieldCheck,
  Download,
  Phone,
  User,
  Check,
  Copy,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { QuoteRequest } from '../types/admin';
import { useAdminData } from '../context/AdminDataContext';
import { useCompanyContact } from '../utils/useCompanyContact';
import { DOMAIN, LEGAL_NAME, LOGO, LOGO_ALT, LOGO_HEIGHT, LOGO_WIDTH } from '../config/brand';
import { useCurrency } from '../utils/useCurrency';
import { useUnitSystem } from '../utils/useUnitSystem';
import { formatDimensions as formatDims, formatWeight } from '../shared/units';
import { useAreaT } from '../i18n/I18nProvider';
import { findServiceOption, SERVICE_OPTIONS } from '../data/serviceOptions';
import './PublicQuoteResultPage.css';

interface PublicQuoteResultPageProps {
  quote: QuoteRequest;
  onTrackShipment: (trackingNumber: string) => void;
  onNavigate: (page: string) => void;
}

// Status names shown to the customer for the stored quote status codes (CONTENT §7.4).
const QUOTE_STATUS_KEYS: Record<string, 'review' | 'ready' | 'accepted' | 'booked' | 'declined' | 'expired'> = {
  NEW: 'review',
  UNDER_REVIEW: 'review',
  QUOTE_PUBLISHED: 'ready',
  RATE_PUBLISHED: 'ready',
  ACCEPTED: 'accepted',
  CONVERTED: 'booked',
  DECLINED: 'declined',
  EXPIRED: 'expired'
};

export const PublicQuoteResultPage: React.FC<PublicQuoteResultPageProps> = ({
  quote,
  onTrackShipment,
  onNavigate,
}) => {
  const t = useAreaT('quote');
  const { updateQuoteStatus, settings } = useAdminData();
  // CONTENT §7.1 side card, reused as the quote's terms; and the three next steps.
  const QUOTE_PROMISE = t('page.sideBody');
  const QUOTE_NEXT_STEPS = [t('steps.review'), t('steps.email'), t('steps.accept')];
  // Empty phone/address values hide their element (no placeholders).
  const { phone: supportPhone, email: dispatchEmail, address: headquartersAddress } = useCompanyContact();
  const companyName = settings.companyName || LEGAL_NAME;
  const [copiedId, setCopiedId] = useState(false);
  const [accepted, setAccepted] = useState(quote.status === 'ACCEPTED' || quote.status === 'CONVERTED');
  const money = useCurrency();
  const [units] = useUnitSystem();
  const q = quote as any;

  // Only stored values are shown; anything missing is left out rather than invented.
  const weightText = formatWeight(quote.totalWeightLbs || q.weightLbs, units) || '—';
  const place = (city?: string, state?: string, country?: string, countryCode?: string) =>
    [city, countryCode === 'US' ? state : '', country].filter(Boolean).join(', ');
  const originText = place(quote.originCity, quote.originState, quote.originCountry, quote.originCountryCode);
  const destText = place(quote.destCity, quote.destState, quote.destCountry, quote.destCountryCode);
  const routeText = originText && destText ? `${originText} → ${destText}` : '';
  const storedService: string = quote.requestedService || q.service || '';
  const knownService = SERVICE_OPTIONS.some((s) => s.name.toLowerCase() === storedService.toLowerCase());
  const serviceText = [knownService ? t(`services.${findServiceOption(storedService).key}`) : storedService, quote.transportMode ? t(`modes.${quote.transportMode}`) : '']
    .filter(Boolean).join(' · ');
  const pieceCount = typeof q.pieces === 'number' ? q.pieces : quote.quantity || 1;
  const companyText = quote.requesterCompany || q.company || '';
  const validUntil = quote.pricing?.validUntil || '';

  const handleCopyId = () => {
    navigator.clipboard.writeText(quote.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isPublished = quote.status === 'QUOTE_PUBLISHED' || quote.status === 'ACCEPTED' || quote.status === 'CONVERTED' || (quote.pricing && quote.pricing.finalPrice > 0);
  // Accept only a quote that is on offer (not declined or expired).
  const canAccept = quote.status === 'QUOTE_PUBLISHED' || quote.status === 'RATE_PUBLISHED';
  const statusLabel = QUOTE_STATUS_KEYS[quote.status] ? t(`status.${QUOTE_STATUS_KEYS[quote.status]}`) : quote.status.replace(/_/g, ' ').toLowerCase();

  // Structured inches when the quote has them (converted to the viewer's units), otherwise the
  // stored display string of older quotes; '—' when nothing was given.
  const formatDimensions = (dims: any) => {
    const structured = quote.dimensionsIn || (dims && typeof dims === 'object' ? dims : null);
    if (structured) return formatDims(structured, units) || '—';
    if (typeof dims === 'string' && dims.trim()) return dims;
    return '—';
  };

  // Charges exactly as published by the coordinator: zero lines are left out.
  const finalPrice = quote.pricing?.finalPrice || 0;
  const charges = [
    { label: routeText ? t('result.transportRoute', { route: routeText }) : t('result.transport'), amount: quote.pricing?.baseShipping || 0 },
    { label: t('result.oversize'), amount: quote.pricing?.oversizeHandling || 0 },
    { label: t('result.special'), amount: quote.pricing?.specialHandling || 0 }
  ].filter((c) => c.amount > 0);

  const askQuestion = () => onNavigate('contact');

  return (
    <div className="ngf-quote-result-page animate-fade-in">
      {/* =========================================================================
          SCREEN-ONLY VIEW (CONTENT §7.2)
          ========================================================================= */}
      <div className="screen-only-quotation-view">
        {/* Top Banner */}
        <div className="quote-res-hero">
          <div className="ngf-container-wide hero-content-flex">
            <div>
              <h1>{t('result.title')}</h1>
              <p className="hero-subtext">
                {t('result.reference', { ref: quote.id })}
              </p>
            </div>

            <div className="hero-actions-box">
              <button className="btn-copy-quote-id" onClick={handleCopyId}>
                {copiedId ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                <span>{copiedId ? t('result.copied') : t('result.copy')}</span>
              </button>
              {/* Opens the browser's print dialog, where the quote can be saved as a PDF. */}
              <button className="btn-print-quote" onClick={() => window.print()}>
                <Download size={14} />
                <span>{t('result.pdf')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="ngf-container-wide quote-res-body">
          {/* STATUS BAR */}
          <div className={`quote-status-alert-strip ${isPublished ? 'status-ready' : 'status-review'}`}>
            <div className="alert-left">
              {isPublished ? (
                <CheckCircle2 size={24} className="text-emerald" />
              ) : (
                <Clock size={24} className="text-amber" />
              )}
              <div>
                <h3>{isPublished ? t('result.total', { amount: money.format(finalPrice) }) : t('done.title')}</h3>
                <p>
                  {isPublished
                    ? (validUntil ? t('result.validUntil', { date: validUntil }) : QUOTE_PROMISE)
                    : QUOTE_NEXT_STEPS[0]}
                </p>
              </div>
            </div>

            <div className="alert-right-badge">
              <span className={`tariff-status-chip ${quote.status.toLowerCase()}`}>
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="quote-two-column-layout">
            {/* LEFT COLUMN: CHARGES & DETAILS */}
            <div className="quote-main-col">
              {isPublished ? (
                <div className="published-rate-highlight-card">
                  <div className="rate-card-header">
                    <div>
                      <span className="rate-card-label">{t('result.totalLabel')}</span>
                      <div className="rate-big-figure">
                        <strong className="amount font-mono">
                          {money.format(finalPrice)}
                        </strong>
                        <span className="currency-code">{money.currency}</span>
                      </div>
                    </div>

                    {validUntil && (
                      <div className="validity-lock-box">
                        <ShieldCheck size={20} className="text-emerald" />
                        <div>
                          <small>{t('result.validLabel')}</small>
                          <strong>{validUntil}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="tariff-breakdown-subdeck">
                    <span className="deck-title">{t('result.breakdown')}</span>
                    <div className="charges-table">
                      {charges.map((c) => (
                        <div key={c.label} className="charge-row">
                          <span>{c.label}</span>
                          <strong className="font-mono">{money.format(c.amount)}</strong>
                        </div>
                      ))}
                      <div className="charge-row total">
                        <strong>{t('result.totalLabel')}</strong>
                        <strong className="total-amount font-mono text-emerald">
                          {money.format(finalPrice)} {money.currency}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Accept & Book */}
                  <div className="rate-booking-cta">
                    {accepted || quote.convertedShipmentId ? (
                      <div className="quote-converted-notice">
                        <CheckCircle2 size={20} className="text-emerald" />
                        <div>
                          <strong>{t('result.accepted')}</strong>
                          {quote.convertedShipmentId ? (
                            <p>
                              {t('result.trackingId', { id: quote.convertedShipmentId })}
                            </p>
                          ) : (
                            <p>{t('result.acceptedNext')}</p>
                          )}
                        </div>
                        {quote.convertedShipmentId && (
                          <button
                            className="btn-track-converted"
                            onClick={() => onTrackShipment(quote.convertedShipmentId!)}
                          >
                            {t('result.track')} <ExternalLink size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : canAccept ? (
                      <div className="booking-cta-flex">
                        <div>
                          <strong>{routeText || serviceText}</strong>
                          <p>{QUOTE_NEXT_STEPS[2]}</p>
                        </div>
                        <button
                          className="btn-accept-rate"
                          onClick={() => {
                            setAccepted(true);
                            updateQuoteStatus(quote.id, 'ACCEPTED');
                          }}
                        >
                          <Check size={16} aria-hidden="true" /> {t('result.accept')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="pending-rate-waiting-card">
                  <div className="waiting-spinner-box">
                    <Clock size={40} className="text-amber" />
                  </div>
                  <h3>{t('done.next')}</h3>
                  <ol className="quote-res-next-steps">
                    {QUOTE_NEXT_STEPS.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
              )}

              {/* ROUTE, SERVICE & CARGO */}
              <div className="quote-specs-card">
                <h3 className="section-head-title">
                  <Truck size={17} className="text-blue" aria-hidden="true" /> {t('result.route')}
                </h3>

                <div className="route-banner-grid">
                  <div className="route-loc origin">
                    <span className="loc-tag">{t('result.from')}</span>
                    <strong>{originText || '—'}</strong>
                    {quote.originZip && <small className="font-mono">{quote.originZip}</small>}
                  </div>
                  <div className="route-center-line">
                    <div className="line" />
                    <ArrowRight size={16} className="arr" />
                    <div className="line" />
                  </div>
                  <div className="route-loc dest">
                    <span className="loc-tag">{t('result.to')}</span>
                    <strong>{destText || '—'}</strong>
                    {quote.destZip && <small className="font-mono">{quote.destZip}</small>}
                  </div>
                </div>

                <div className="specs-detail-grid">
                  <div className="spec-box">
                    <small>{t('result.service')}</small>
                    <strong className="text-blue">{serviceText || '—'}</strong>
                  </div>
                  <div className="spec-box">
                    <small>{t('result.contents')}</small>
                    <strong>{quote.cargoDescription || '—'}</strong>
                  </div>
                  <div className="spec-box">
                    <small>{t('result.weight')}</small>
                    <strong>{weightText}</strong>
                  </div>
                  <div className="spec-box">
                    <small>{t('result.pieces')}</small>
                    <strong>{pieceCount}</strong>
                  </div>
                  <div className="spec-box">
                    <small>{t('result.dimensions')}</small>
                    <strong className="font-mono">{formatDimensions(quote.dimensions)}</strong>
                  </div>
                  {q.declaredValue > 0 && (
                    <div className="spec-box">
                      <small>{t('result.declared')}</small>
                      <strong className="font-mono">{money.format(q.declaredValue)}</strong>
                    </div>
                  )}
                </div>

                {quote.specialRequirements || q.specialInstructions ? (
                  <div className="special-inst-box">
                    <small>{t('result.instructions')}</small>
                    <p>{quote.specialRequirements || q.specialInstructions}</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT COLUMN: DETAILS, PROMISE, QUESTIONS */}
            <div className="quote-side-col">
              <div className="side-detail-card">
                <div className="card-head">
                  <User size={15} className="text-blue" />
                  <h4>{t('result.yourDetails')}</h4>
                </div>
                <div className="card-body">
                  <div className="info-row">
                    <small>{t('result.name')}</small>
                    <strong>{quote.requesterName || q.customerName || '—'}</strong>
                  </div>
                  {companyText && (
                    <div className="info-row">
                      <small>{t('result.company')}</small>
                      <strong>{companyText}</strong>
                    </div>
                  )}
                  <div className="info-row">
                    <small>{t('result.email')}</small>
                    <strong className="text-blue">{quote.requesterEmail || q.customerEmail || '—'}</strong>
                  </div>
                  {(quote.requesterPhone || q.customerPhone) && (
                    <div className="info-row">
                      <small>{t('result.phone')}</small>
                      <strong className="font-mono">{quote.requesterPhone || q.customerPhone}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="side-detail-card guarantee-card">
                <div className="card-head">
                  <ShieldCheck size={16} className="text-emerald" />
                  <h4>{t('page.sideTitle')}</h4>
                </div>
                <div className="card-body">
                  <p className="guarantee-text">{QUOTE_PROMISE}</p>
                </div>
              </div>

              <div className="side-detail-card contact-desk-card">
                <div className="desk-head">
                  <Phone size={18} className="text-blue" />
                  <div>
                    <h4>{t('result.desk')}</h4>
                  </div>
                </div>
                <strong className="desk-phone">{supportPhone || dispatchEmail}</strong>
                <button type="button" className="btn-ask-question" onClick={askQuestion}>
                  <MessageCircle size={15} />
                  <span>{t('result.ask')}</span>
                </button>
              </div>
            </div>
          </div>

          <p className="quote-res-footer-line">{t('result.secure', { domain: DOMAIN })}</p>
        </div>
      </div>

      {/* =========================================================================
          PRINT-ONLY QUOTE (Letter/A4): what "Download PDF" saves
          ========================================================================= */}
      <div className="printable-official-quotation">
        <div className="print-doc-header">
          <div className="print-header-left">
            <img src={LOGO} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt={LOGO_ALT} className="print-doc-logo" />
            <div className="print-company-info">
              <strong>{companyName}</strong>
              {headquartersAddress && <span>{headquartersAddress}</span>}
              <span>{[supportPhone, dispatchEmail].filter(Boolean).join(' · ')}</span>
            </div>
          </div>

          <div className="print-header-right">
            <div className="print-doc-type-badge">{t('result.title')}</div>
            <div className="print-doc-meta-row">
              <span>{t('done.refLabel')}</span>
              <strong className="font-mono text-blue">{quote.id}</strong>
            </div>
            {validUntil && (
              <div className="print-doc-meta-row">
                <span>{t('result.validLabel')}</span>
                <strong className="text-emerald">{validUntil}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="print-divider" />

        <div className="print-parties-grid">
          <div className="print-party-box">
            <span className="box-title">{t('result.from')}</span>
            <strong>{quote.requesterName || q.customerName || '—'}</strong>
            {companyText && <span>{companyText}</span>}
            <span>{[originText, quote.originZip].filter(Boolean).join(' ') || '—'}</span>
            {(quote.requesterPhone || q.customerPhone) && <span>{quote.requesterPhone || q.customerPhone}</span>}
            <span>{quote.requesterEmail || q.customerEmail || '—'}</span>
          </div>

          <div className="print-party-box">
            <span className="box-title">{t('result.to')}</span>
            <span>{[destText, quote.destZip].filter(Boolean).join(' ') || '—'}</span>
            <span>{t('result.serviceLine')} <strong>{serviceText || '—'}</strong></span>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>{t('result.contents')}</th>
              <th>{t('result.pieces')}</th>
              <th>{t('result.weight')}</th>
              <th>{t('result.dimensionsShort')}</th>
              <th className="text-right">{t('result.declared')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>{quote.cargoDescription || '—'}</strong></td>
              <td>{pieceCount}</td>
              <td>{weightText}</td>
              <td className="font-mono">{formatDimensions(quote.dimensions)}</td>
              <td className="text-right font-mono">{q.declaredValue ? money.format(q.declaredValue) : '—'}</td>
            </tr>
          </tbody>
        </table>

        {isPublished && (
          <>
            <div className="print-section-title">{t('result.breakdown')}</div>
            <table className="print-table pricing-table">
              <thead>
                <tr>
                  <th>{t('result.charge')}</th>
                  <th className="text-right">{t('result.amount', { currency: money.currency })}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td className="text-right font-mono">{money.format(c.amount)}</td>
                  </tr>
                ))}
                <tr className="print-total-row">
                  <td><strong>{t('result.totalLabel')}</strong></td>
                  <td className="text-right font-mono print-grand-total">
                    {money.format(finalPrice)} {money.currency}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="print-terms-footer">
          <div className="terms-left">
            <span className="terms-header">{t('page.sideTitle')}</span>
            <p>{QUOTE_PROMISE}</p>
          </div>
        </div>

        <div className="print-bottom-watermark">
          <span>{t('result.reference', { ref: quote.id })}</span>
          <span>{t('result.secure', { domain: DOMAIN })}</span>
        </div>
      </div>
    </div>
  );
};
