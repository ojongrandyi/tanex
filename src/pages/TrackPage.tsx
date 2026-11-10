import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, Truck, FileText, AlertTriangle, Clock, Layers, Headphones, X } from 'lucide-react';
import { SupportModal } from '../components/SupportModal';
import { Shipment } from '../types/shipment';
import { api } from '../services/api';
import { TRACKING_ID_EXAMPLE, TRACKING_PREFIX } from '../config/brand';
import { useEscapeKey } from '../utils/useEscapeKey';
import { parseTrackingInput } from '../shared/trackingId';
import { shipmentStatusLabel, shipmentStatusTone } from '../shared/shipmentStatus';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import './TrackPage.css';

// Track page (CONTENT §6.1, §6.5). Behaviour is unchanged from before E.5: one ID or up to 10,
// recent searches kept in this browser (ngf_recent_tracking), the not-found banner from App, and
// the several-shipments results dialog fed by the same masked public endpoint.

interface TrackPageProps {
  onTrack: (trackingNumber: string) => void;
  onNavigate: (page: string, param?: string) => void;
  notFoundQuery?: string | null;
}

// CONTENT §6.1 multi-track limit.
const MAX_BATCH = 10;

type BatchResult = { query: string; shipment: Shipment | null };

// Status pill colour on a batch card.
function batchPillClass(shipment: Shipment): 'delivered' | 'delayed' | 'transit' {
  const tone = shipmentStatusTone(shipment.status);
  if (tone === 'delivered') return 'delivered';
  if (tone === 'hold' || tone === 'delayed' || tone === 'returning') return 'delayed';
  return 'transit';
}

function isDelayedOrHeld(shipment: Shipment): boolean {
  return batchPillClass(shipment) === 'delayed' || shipment.health === 'POTENTIAL_DELAY' || shipment.health === 'ATTENTION_REQUIRED';
}

function placeText(place: any): string {
  if (!place) return '';
  if (typeof place === 'string') return place;
  return place.facility || [place.city, place.state].filter(Boolean).join(', ');
}

export const TrackPage: React.FC<TrackPageProps> = ({ onTrack, onNavigate, notFoundQuery }) => {
  const t = useAreaT('track');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [multiInput, setMultiInput] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Several-shipments results dialog
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  useEscapeKey(batchModalOpen, () => setBatchModalOpen(false));
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED'>('ALL');

  // Recent searches from this browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ngf_recent_tracking');
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 4));
    } catch {
      // Storage blocked: no recent list.
    }
  }, []);

  const saveRecentSearch = (num: string) => {
    try {
      const clean = num.trim().toUpperCase();
      const updated = [clean, ...recentSearches.filter((n) => n.toUpperCase() !== clean)].slice(0, 4);
      setRecentSearches(updated);
      localStorage.setItem('ngf_recent_tracking', JSON.stringify(updated));
    } catch {
      // Storage blocked: the search still runs.
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackingNumber.trim();
    if (clean) {
      saveRecentSearch(clean);
      onTrack(clean);
    }
  };

  const handleQuickTrack = (num: string) => {
    setTrackingNumber(num);
    saveRecentSearch(num);
    onTrack(num);
  };

  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawNumbers = multiInput.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, MAX_BATCH);
    if (rawNumbers.length === 0) return;
    if (rawNumbers.length === 1) {
      handleQuickTrack(rawNumbers[0]);
      return;
    }
    // Each number goes through the same masked public endpoint as single tracking
    // (/api/track/:id). An ID that isn't found is shown as not found; nothing is made up.
    const resolved: BatchResult[] = await Promise.all(
      rawNumbers.map(async (num) => {
        const clean = num.toUpperCase();
        try {
          const real = await api.trackShipment(clean);
          if (real) return { query: clean, shipment: real };
        } catch {
          // not found: shown as not found below
        }
        return { query: clean, shipment: null };
      }),
    );
    setBatchResults(resolved);
    setBatchFilter('ALL');
    setBatchModalOpen(true);
  };

  const found = batchResults.filter((r): r is { query: string; shipment: Shipment } => r.shipment !== null);
  const inTransitCount = found.filter((r) => batchPillClass(r.shipment) === 'transit').length;
  const deliveredCount = found.filter((r) => batchPillClass(r.shipment) === 'delivered').length;
  const delayedCount = found.filter((r) => isDelayedOrHeld(r.shipment)).length;
  const visibleResults = batchResults.filter((r) => {
    if (batchFilter === 'ALL') return true;
    if (!r.shipment) return false;
    if (batchFilter === 'IN_TRANSIT') return batchPillClass(r.shipment) === 'transit';
    if (batchFilter === 'DELIVERED') return batchPillClass(r.shipment) === 'delivered';
    return isDelayedOrHeld(r.shipment);
  });

  const notFoundIsMalformed = Boolean(notFoundQuery) && !parseTrackingInput(notFoundQuery!) && !notFoundQuery!.trim().toUpperCase().startsWith('QR');

  return (
    <div className="tx-track-page">
      <section className="tx-track-page__hero tx-dark" aria-labelledby="track-title">
        <div className="tx-track-page__wrap">
          <p className="tx-eyebrow">{t('page.eyebrow')}</p>
          <h1 className="tx-h1" id="track-title">{t('page.title')}</h1>
          <p className="tx-lead">{t('page.sub')}</p>

          {notFoundQuery && (
            <div className="tx-track-page__alert" role="alert">
              <AlertTriangle aria-hidden="true" />
              {notFoundIsMalformed ? (
                <p>{t('page.invalid', { example: TRACKING_ID_EXAMPLE })}</p>
              ) : (
                <p>
                  {t('page.notFoundStart', { id: notFoundQuery.trim().toUpperCase() })}{' '}
                  <button type="button" className="tx-track-page__inline" onClick={() => onNavigate('contact')}>{t('page.notFoundLink')}</button>{' '}
                  {t('page.notFoundEnd')}
                </p>
              )}
            </div>
          )}

          <div className="tx-track-page__card tx-light">
            <div className="tx-track-page__tabs" role="group" aria-label={t('page.tabsLabel')}>
              <button type="button" aria-pressed={activeTab === 'single'} className={activeTab === 'single' ? 'is-active' : ''} onClick={() => setActiveTab('single')}>
                <Search aria-hidden="true" /><span>{t('page.tabOne')}</span>
              </button>
              <button type="button" aria-pressed={activeTab === 'batch'} className={activeTab === 'batch' ? 'is-active' : ''} onClick={() => setActiveTab('batch')}>
                <Layers aria-hidden="true" /><span>{t('page.tabSeveral')}</span>
              </button>
            </div>

            {activeTab === 'single' && (
              <form onSubmit={handleSingleSubmit} className="tx-track-page__single" role="search">
                <label className="tx-visually-hidden" htmlFor="track-input">{t('page.inputLabel')}</label>
                <div className="tx-track">
                  <Search className="tx-track__icon" aria-hidden="true" />
                  <input
                    id="track-input"
                    type="text"
                    placeholder={t('page.placeholder', { example: TRACKING_ID_EXAMPLE })}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="tx-track__input"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoFocus
                  />
                  {trackingNumber && (
                    <button type="button" className="tx-track-page__clear" onClick={() => setTrackingNumber('')} aria-label={t('page.clear')}>
                      <X aria-hidden="true" />
                    </button>
                  )}
                  <button type="submit" className="tx-btn tx-btn--primary">
                    <span>{t('page.button')}</span><ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'batch' && (
              <form onSubmit={handleMultiSubmit} className="tx-track-page__batch">
                <label className="tx-label" htmlFor="track-batch-input">{t('page.batchLabel')}</label>
                <textarea
                  id="track-batch-input"
                  rows={4}
                  value={multiInput}
                  onChange={(e) => setMultiInput(e.target.value)}
                  className="tx-input tx-track-page__mono"
                  placeholder={`${TRACKING_ID_EXAMPLE}\n${TRACKING_PREFIX}8M4PQ6\n${TRACKING_PREFIX}3J7NKW`}
                  spellCheck={false}
                />
                <button type="submit" className="tx-btn tx-btn--primary">
                  <span>{t('page.button')}</span><ArrowRight aria-hidden="true" />
                </button>
              </form>
            )}

            {recentSearches.length > 0 && (
              <div className="tx-track-page__recent">
                <span className="tx-track-page__recent-label">{t('page.recent')}</span>
                <ul>
                  {recentSearches.map((num) => (
                    <li key={num}>
                      <button type="button" className="tx-chip tx-track-page__mono" onClick={() => handleQuickTrack(num)}>
                        <Clock aria-hidden="true" /><span>{num}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Where to find your ID (CONTENT §6.1) */}
      <section className="tx-track-page__section" aria-labelledby="track-find">
        <div className="tx-track-page__wrap">
          <h2 className="tx-h2" id="track-find">{t('find.title')}</h2>
          <ul className="tx-track-page__find">
            {([['booking', FileText], ['waybill', Truck], ['coordinator', Headphones]] as const).map(([k, Icon]) => (
              <li key={k} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                <h3 className="tx-card__title">{t(`find.${k}.title`)}</h3>
                <p className="tx-card__body">{t(`find.${k}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Help banner (CONTENT §6.1) */}
      <section className="tx-track-page__help tx-dark" aria-labelledby="track-help">
        <div className="tx-track-page__wrap tx-track-page__help-inner">
          <div>
            <h2 className="tx-h3" id="track-help">{t('help.title')}</h2>
            <p>{t('help.body')}</p>
          </div>
          <button type="button" className="tx-btn tx-btn--primary" onClick={() => setSupportModalOpen(true)}>
            <span>{t('help.button')}</span><ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} initialTrackingNumber={trackingNumber.trim().toUpperCase()} />

      {/* Several shipments: results */}
      {batchModalOpen && (
        <div className="batch-modal-backdrop" onClick={() => setBatchModalOpen(false)} data-lenis-prevent>
          <div className="batch-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="batch-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="batch-modal-header">
              <div className="batch-header-title">
                <Truck aria-hidden="true" />
                <h3 id="batch-modal-title">{t('batch.title')}</h3>
              </div>
              <button type="button" className="batch-modal-close" onClick={() => setBatchModalOpen(false)} aria-label={t('batch.close')}><X aria-hidden="true" /></button>
            </div>

            <div className="batch-filter-bar" role="group" aria-label={t('batch.filterLabel')}>
              {([
                ['ALL', t('batch.all', { n: batchResults.length })],
                ['IN_TRANSIT', t('batch.count', { label: shipmentStatusLabel('IN_TRANSIT', locale), n: inTransitCount })],
                ['DELIVERED', t('batch.count', { label: shipmentStatusLabel('DELIVERED', locale), n: deliveredCount })],
                ['DELAYED', t('batch.delayedOrHeld', { delayed: shipmentStatusLabel('DELAYED', locale), held: shipmentStatusLabel('ON_HOLD', locale).toLowerCase(), n: delayedCount })],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={batchFilter === key} className={`batch-filter-btn${batchFilter === key ? ' active' : ''}`} onClick={() => setBatchFilter(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="batch-modal-body">
              <div className="batch-cards-grid">
                {visibleResults.map(({ query, shipment }, index) => {
                  if (!shipment) {
                    return (
                      <div key={`${query}-${index}`} className="batch-shipment-card batch-not-found">
                        <div className="batch-card-top"><span className="batch-tracking-id">{query}</span></div>
                        <p className="batch-not-found-text">
                          {parseTrackingInput(query) ? t('batch.notFound', { id: query }) : t('page.invalid', { example: TRACKING_ID_EXAMPLE })}
                        </p>
                      </div>
                    );
                  }
                  const origin = placeText(shipment.origin);
                  const destination = placeText(shipment.destination);
                  const current = shipment.currentFacility || placeText(shipment.currentLocation);
                  const eta = typeof shipment.estimatedDelivery === 'string' ? shipment.estimatedDelivery : (shipment.estimatedDelivery as any)?.date;
                  return (
                    <div key={`${query}-${index}`} className="batch-shipment-card">
                      <div className="batch-card-top">
                        <div>
                          <span className="batch-tracking-id">{shipment.trackingNumber}</span>
                          {shipment.service && <span className="batch-service-sub">{shipment.service}</span>}
                        </div>
                        <span className={`batch-status-pill ${batchPillClass(shipment)}`}>{shipmentStatusLabel(shipment.status, locale)}</span>
                      </div>
                      <div className="batch-route-strip">
                        <div className="batch-route-point"><small>{t('batch.origin')}</small><strong>{origin || '—'}</strong></div>
                        <div className="batch-route-arrow" aria-hidden="true"><ArrowRight size={14} /></div>
                        <div className="batch-route-point right"><small>{t('batch.destination')}</small><strong>{destination || '—'}</strong></div>
                      </div>
                      <div className="batch-metrics-row">
                        <div className="batch-metric-box"><small>{t('batch.lastSeen')}</small><strong>{current || '—'}</strong></div>
                        <div className="batch-metric-box"><small>{t('batch.eta')}</small><strong>{eta || '—'}</strong></div>
                      </div>
                      <button type="button" className="btn-inspect-batch-item" onClick={() => { setBatchModalOpen(false); handleQuickTrack(shipment.trackingNumber); }}>
                        <span>{t('batch.open')}</span><ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="batch-modal-footer">
              <span className="batch-footer-count">{t('batch.found', { n: found.length, m: batchResults.length })}</span>
              <button type="button" className="tx-btn tx-btn--ghost tx-btn--sm" onClick={() => setBatchModalOpen(false)}>{t('batch.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
