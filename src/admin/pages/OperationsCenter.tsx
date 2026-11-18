import React, { useState } from 'react';
import {
  Package,
  Eye,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  Truck,
  Edit3,
  SlidersHorizontal
} from 'lucide-react';
import { EditShipmentModal } from '../components/EditShipmentModal';
import { useAdminData } from '../../context/AdminDataContext';
import { useAuth } from '../../auth/AuthContext';
import { AdminViewType } from '../AdminLayout';
import { Shipment } from '../../types/shipment';
import './OperationsCenter.css';
import { WeightText } from '../../components/forms/UnitControls';
import { shipmentStatusLabel, shipmentStatusTone, type StatusTone } from '../../shared/shipmentStatus';
import { GATEWAYS } from '../../data/gateways';
import { NewProofsPanel } from '../components/NewProofsPanel';
import { BRAND_COLORS } from '../../config/brand';
import { OPERATIONS_CENTER_TEXT as TXT } from './OperationsCenter.text';
import { consoleIntlLocale, consoleLang } from '../i18n/consoleText';

// Badge colours per status family (names come from CONTENT §6.3).
const OPS_STATUS_CHIP: Record<StatusTone, { className: string; dot: string }> = {
  booked: { className: 'arrived', dot: 'slate' },
  transit: { className: 'in-transit', dot: 'blue' },
  out: { className: 'out-delivery', dot: 'amber' },
  delivered: { className: 'delivered', dot: 'green' },
  hold: { className: 'delayed', dot: 'red' },
  delayed: { className: 'delayed', dot: 'red' },
  returning: { className: 'delayed', dot: 'red' },
};

interface OperationsCenterProps {
  onSelectView: (view: AdminViewType) => void;
  onOpenShipmentDetail: (trackingNumber: string) => void;
  onQuickUpdateStatus: (shipment: Shipment) => void;
  /** Proofs of payment waiting for review, from the console's poll (update G.1/G.2). */
  newProofsCount?: number;
  onProofsChanged?: () => void;
}

export const OperationsCenter: React.FC<OperationsCenterProps> = ({
  onSelectView,
  onOpenShipmentDetail,
  onQuickUpdateStatus,
  newProofsCount = 0,
  onProofsChanged
}) => {
  const { shipments, quoteRequests, updateShipmentFull } = useAdminData();
  const { can } = useAuth();
  const [tableFilter, setTableFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'HELD'>('ALL');
  // Edit pen on Recent Shipments (update I.5).
  const [editShipment, setEditShipment] = useState<Shipment | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState<string>('');

  // Metrics calculation
  const totalShipmentsCount = shipments.length;
  const inTransitShipments = shipments.filter(s =>
    s.status === 'IN_TRANSIT' ||
    s.status === 'OUT_FOR_DELIVERY'
  );
  const inTransitCount = inTransitShipments.length;
  const deliveredCount = shipments.filter(s => s.status === 'DELIVERED').length;
  // On hold or delayed (current codes and the legacy HELD/EXCEPTION codes, through the shared
  // status tones), or carrying a delay notice. One rule for the card, the filter and the status
  // line (#185); it used to miss ON_HOLD, the code the console sets.
  const needsAttention = (s: (typeof shipments)[number]) => {
    const tone = shipmentStatusTone(s.status);
    return tone === 'hold' || tone === 'delayed' || Boolean(s.delayNotice?.hasDelay);
  };
  const exceptionCount = shipments.filter(needsAttention).length;

  const totalPieces = shipments.reduce((acc, s) => {
    const piecesCount = Array.isArray(s.pieces) && s.pieces.length > 0 ? s.pieces.length : (s.totalPieces || 1);
    return acc + piecesCount;
  }, 0);


  // Pending quotes awaiting tariff certification
  const pendingQuotes = quoteRequests.filter(q => q.status === 'NEW' || q.status === 'UNDER_REVIEW');

  // Filtered shipments for the main table
  const filteredShipments = shipments.filter(s => {
    // Status tab filter
    if (tableFilter === 'IN_TRANSIT') {
      const isTransit = s.status === 'IN_TRANSIT' || s.status === 'OUT_FOR_DELIVERY';
      if (!isTransit) return false;
    } else if (tableFilter === 'DELIVERED') {
      if (s.status !== 'DELIVERED') return false;
    } else if (tableFilter === 'HELD') {
      const isHeld = needsAttention(s);
      if (!isHeld) return false;
    }

    // Search query filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      const tracking = (s.trackingNumber || '').toLowerCase();
      const sender = typeof s.sender === 'object' ? (s.sender?.name || '').toLowerCase() : '';
      const recipient = typeof s.recipient === 'object' ? (s.recipient?.name || '').toLowerCase() : '';
      const origCity = typeof s.origin === 'object' ? (s.origin?.city || '').toLowerCase() : '';
      const destCity = typeof s.destination === 'object' ? (s.destination?.city || '').toLowerCase() : '';
      return tracking.includes(q) || sender.includes(q) || recipient.includes(q) || origCity.includes(q) || destCity.includes(q);
    }

    return true;
  });

  // Helper to format ETA cleanly into date and window
  const getEtaParts = (est: any, detail?: string) => {
    let dateStr = TXT.scheduled;
    let timeStr = detail || TXT.standardLinehaul;
    if (typeof est === 'string' && est.trim()) {
      dateStr = est.trim();
    } else if (typeof est === 'object' && est) {
      dateStr = est.date || TXT.scheduled;
      timeStr = est.timeWindow || detail || TXT.standardLinehaul;
    }
    dateStr = dateStr
      .replace('January', 'Jan')
      .replace('February', 'Feb')
      .replace('March', 'Mar')
      .replace('April', 'Apr')
      .replace('June', 'Jun')
      .replace('July', 'Jul')
      .replace('August', 'Aug')
      .replace('September', 'Sep')
      .replace('October', 'Oct')
      .replace('November', 'Nov')
      .replace('December', 'Dec');
    return { date: dateStr, time: timeStr };
  };

  return (
    <div className="ops-terminal-container">
      {/* ====================================================================
          1. NETWORK OPERATIONAL STATUS STRIP
         ==================================================================== */}
      <div className="ops-subhead-strip">
        <div className="subhead-left">
          {/* Measured from the shipment list, not a fixed claim (#185). */}
          {can('shipments.view') && (
            <>
              <span className={`live-status-pill${exceptionCount > 0 ? ' is-attention' : ''}`} role="status">
                <span className="live-dot" aria-hidden="true" />
                <span>
                  {exceptionCount === 0
                    ? TXT.noHoldsOrDelays
                    : TXT.needAttention(exceptionCount)}
                </span>
              </span>
              <span className="subhead-sep" aria-hidden="true">·</span>
            </>
          )}
          <span className="subhead-text">{GATEWAYS.length} {TXT.gatewaysInNetwork}</span>
        </div>
        <div className="subhead-right">
          <span className="subhead-date">
            {new Date().toLocaleDateString(consoleIntlLocale(), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ====================================================================
          2. ENTERPRISE KPI METRIC CARDS (MATCHING SHIPMENTS PAGE)
         ==================================================================== */}
      {can('shipments.view') && (
      <div className="ops-kpi-row">
        {/* Card 1: Active Shipments */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('all-shipments')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className="ops-circle-icon accent">
              <Package size={15} />
            </div>
            <span className="ops-card-label">{TXT.totalConsignments}</span>
          </div>
          <strong className="ops-card-number">{totalShipmentsCount}</strong>
          <span className="ops-card-subtext">{TXT.activeMasterFleet} {totalPieces} {TXT.pcs}</span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-accent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND_COLORS.orange} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={BRAND_COLORS.orange} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C25,36 40,24 60,30 C80,36 100,26 120,32 C135,36 145,18 160,32 L160,48 L0,48 Z"
                fill="url(#ops-spark-accent)"
              />
              <path
                d="M0,36 C25,36 40,24 60,30 C80,36 100,26 120,32 C135,36 145,18 160,32"
                fill="none"
                stroke={BRAND_COLORS.orange}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: In Transit */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('all-shipments')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className="ops-circle-icon blue">
              <Truck size={15} />
            </div>
            <span className="ops-card-label">{TXT.inTransit}</span>
          </div>
          <strong className="ops-card-number">{inTransitCount}</strong>
          <span className="ops-card-subtext">{TXT.activeLinehaulFleet}</span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,38 C25,38 45,42 65,32 C85,22 105,38 125,32 C140,28 150,16 160,34 L160,48 L0,48 Z"
                fill="url(#ops-spark-blue)"
              />
              <path
                d="M0,38 C25,38 45,42 65,32 C85,22 105,38 125,32 C140,28 150,16 160,34"
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Pending Quotes */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('quote-requests')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className={`ops-circle-icon ${pendingQuotes.length > 0 ? 'amber' : 'green'}`}>
              <Tag size={15} />
            </div>
            <span className="ops-card-label">{TXT.pendingQuotes}</span>
          </div>
          <strong className="ops-card-number" style={{ color: pendingQuotes.length > 0 ? 'var(--tx-accent-text)' : 'var(--tx-text)' }}>
            {pendingQuotes.length}
          </strong>
          <span className="ops-card-subtext">
            {pendingQuotes.length > 0 ? TXT.commercialReviewRequired : TXT.allRequestsCertified}
          </span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-amber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pendingQuotes.length > 0 ? BRAND_COLORS.orange : '#10b981'} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={pendingQuotes.length > 0 ? BRAND_COLORS.orange : '#10b981'} stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,42 C30,42 55,38 80,40 C105,42 125,34 140,22 C148,16 154,26 160,36 L160,48 L0,48 Z"
                fill="url(#ops-spark-amber)"
              />
              <path
                d="M0,42 C30,42 55,38 80,40 C105,42 125,34 140,22 C148,16 154,26 160,36"
                fill="none"
                stroke={pendingQuotes.length > 0 ? BRAND_COLORS.orange : '#10b981'}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Exceptions & Holds */}
        <div
          className="ops-kpi-card"
          onClick={() => onSelectView('all-shipments')}
          role="button"
          tabIndex={0}
        >
          <div className="ops-card-header">
            <div className="ops-circle-icon red">
              <AlertCircle size={15} />
            </div>
            <span className="ops-card-label">{TXT.exceptionsHolds}</span>
          </div>
          <strong className="ops-card-number" style={{ color: exceptionCount > 0 ? 'var(--tx-danger-600)' : 'var(--tx-text)' }}>
            {exceptionCount}
          </strong>
          <span className="ops-card-subtext">
            {exceptionCount > 0 ? TXT.dispatcherActionNeeded : TXT.zeroFreightHoldsLogged}
          </span>

          <div className="ops-sparkline-wrap">
            <svg viewBox="0 0 160 48" preserveAspectRatio="none" className="kpi-sparkline-svg">
              <defs>
                <linearGradient id="ops-spark-red" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,36 C20,36 35,26 50,32 C70,26 85,34 105,30 C120,26 135,34 150,18 C155,22 158,32 160,34 L160,48 L0,48 Z"
                fill="url(#ops-spark-red)"
              />
              <path
                d="M0,36 C20,36 35,26 50,32 C70,26 85,34 105,30 C120,26 135,34 150,18 C155,22 158,32 160,34"
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
      )}

      {/* New payment proofs waiting for review (update G.2) */}
      {can('payments.view') && (
        <NewProofsPanel
          newProofsCount={newProofsCount}
          onProofsChanged={onProofsChanged}
          onOpenPayments={() => onSelectView('payments')}
        />
      )}

      {/* ====================================================================
          3. MAIN RECENT SHIPMENTS TABLE (MATCHING MASTER LEDGER DESIGN)
         ==================================================================== */}
      {can('shipments.view') && (
      <div className="ops-section-card">
        <div className="ops-table-header-block">
          <div className="table-title-group">
            <div className="table-title-row">
              <h2 className="ops-section-title">{TXT.recentShipments}</h2>
              <span className="ops-shipment-count-pill">{filteredShipments.length} {TXT.active}</span>
            </div>
          </div>

          <div className="table-controls-group">
            {/* Filter Tabs */}
            <div className="table-filter-tabs">
              <button
                className={`filter-tab-btn ${tableFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTableFilter('ALL')}
              >
                {TXT.all}{totalShipmentsCount})
              </button>
              <button
                className={`filter-tab-btn ${tableFilter === 'IN_TRANSIT' ? 'active' : ''}`}
                onClick={() => setTableFilter('IN_TRANSIT')}
              >
                {shipmentStatusLabel('IN_TRANSIT', consoleLang())} ({inTransitCount})
              </button>
              <button
                className={`filter-tab-btn ${tableFilter === 'DELIVERED' ? 'active' : ''}`}
                onClick={() => setTableFilter('DELIVERED')}
              >
                {TXT.delivered}{deliveredCount})
              </button>
              {exceptionCount > 0 && (
                <button
                  className={`filter-tab-btn ${tableFilter === 'HELD' ? 'active' : ''}`}
                  onClick={() => setTableFilter('HELD')}
                >
                  {shipmentStatusLabel('ON_HOLD', consoleLang())} / {shipmentStatusLabel('DELAYED', consoleLang())} ({exceptionCount})
                </button>
              )}
            </div>

            {/* Quick Search */}
            <div className="table-search-wrap">
              <Search size={13} className="table-search-icon" />
              <input
                type="text"
                placeholder={TXT.searchTrackingCustomer}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="table-search-input"
              />
            </div>

            {/* View Full Ledger Button */}
            <button
              className="ops-btn-secondary"
              onClick={() => onSelectView('all-shipments')}
            >
              {TXT.allShipments}
            </button>
          </div>
        </div>

        {totalShipmentsCount === 0 ? (
          <div className="ops-empty-panel">
            <Package size={36} className="empty-panel-icon" />
            <h4>{TXT.noConsignmentsInLedger}</h4>
            <p>{TXT.zeroShipmentsRegisteredInThe}</p>
            {can('shipments.create') && (
              <button
                className="ops-btn-primary"
                onClick={() => onSelectView('create-shipment')}
              >
                {TXT.bookNewShipment}
              </button>
            )}
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="ops-empty-panel">
            <Search size={32} className="empty-panel-icon" />
            <h4>{TXT.noMatchingShipmentsFound}</h4>
            <p>{tableSearch ? TXT.noConsignmentsFoundMatching(tableSearch) : TXT.noShipmentsFoundWithThe}</p>
            <button
              className="ops-btn-secondary"
              onClick={() => { setTableFilter('ALL'); setTableSearch(''); }}
            >
              {TXT.resetFilters}
            </button>
          </div>
        ) : (
          <div className="ops-table-responsive">
            <table className="ops-data-table">
              <colgroup>
                <col style={{ width: '19%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{TXT.consignment}</th>
                  <th>{TXT.service}</th>
                  <th>{TXT.route}</th>
                  <th>{TXT.customer}</th>
                  <th>{TXT.status}</th>
                  <th>{TXT.estDelivery}</th>
                  <th style={{ textAlign: 'right' }}>{TXT.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.slice(0, 8).map(shipment => {
                  const senderCity = typeof shipment.origin === 'object' ? shipment.origin?.city : 'Origin';
                  const senderState = typeof shipment.origin === 'object' ? shipment.origin?.state : '';
                  const destCity = typeof shipment.destination === 'object' ? shipment.destination?.city : 'Destination';
                  const destState = typeof shipment.destination === 'object' ? shipment.destination?.state : '';
                  const senderName = typeof shipment.sender === 'object' ? (shipment.sender?.name || shipment.sender?.company || 'Shipper') : (shipment.sender || 'Shipper');
                  const recipientName = typeof shipment.recipient === 'object' ? (shipment.recipient?.name || shipment.recipient?.company || 'Consignee') : (shipment.recipient || 'Consignee');
                  const piecesCount = Array.isArray(shipment.pieces) && shipment.pieces.length > 0 ? shipment.pieces.length : (shipment.totalPieces || 1);
                  const weight = shipment.totalWeightLbs || 0;
                  const eta = getEtaParts(shipment.estimatedDelivery, shipment.estimatedDeliveryDetail);
                  const serviceClean = (shipment.service || 'Standard').replace(' Express', '');
                  // Reflects whether the shipment is genuinely in transit right now — not
                  // whether an admin happened to have a live-ticking preview open (that
                  // feature no longer exists). A shipment moves at its real pace whether
                  // anyone's watching or not (server/progress.ts).
                  const isSimulating = shipment.status === 'IN_TRANSIT';

                  return (
                    <tr
                      key={shipment.trackingNumber}
                      className="ops-table-clickable-row"
                    >
                      {/* 1. CONSIGNMENT */}
                      <td>
                        <div className="ops-consignment-cell">
                          <div className="ops-mode-box" title={shipment.service}>
                            {shipment.service === 'Express' ? (
                              <Truck size={13} className="text-accent" />
                            ) : (
                              <Package size={13} className="text-slate" />
                            )}
                          </div>
                          <div className="ops-consignment-text">
                            <strong className="ops-tracking-code font-mono">{shipment.trackingNumber}</strong>
                            <span className="ops-specs-text">
                              {piecesCount} {piecesCount === 1 ? 'pc' : 'pcs'}{weight > 0 ? <> (<WeightText lbs={weight} />)</> : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. SERVICE */}
                      <td>
                        <span className={`ops-service-pill ${serviceClean.toLowerCase().replace(/\s+/g, '-')}`}>
                          {serviceClean}
                        </span>
                      </td>

                      {/* 3. ROUTE */}
                      <td>
                        <div className="ops-route-stack">
                          <span className="ops-route-origin">{senderCity}{senderState ? `, ${senderState}` : ''}</span>
                          <span className="ops-route-arrow">→</span>
                          <span className="ops-route-dest">{destCity}{destState ? `, ${destState}` : ''}</span>
                          <span className="ops-cargo-desc truncate" title={shipment.cargoDescription || shipment.shipmentType || TXT.commercialFreight}>
                            {shipment.cargoDescription || shipment.shipmentType || TXT.commercialFreight}
                          </span>
                        </div>
                      </td>

                      {/* 4. CUSTOMER */}
                      <td>
                        <div className="ops-customer-cell">
                          <strong className="ops-customer-name truncate" title={senderName}>{senderName}</strong>
                          <span className="ops-customer-consignee truncate" title={TXT.to2(recipientName)}>{TXT.to} {recipientName}</span>
                        </div>
                      </td>

                      {/* 5. STATUS */}
                      <td>
                        <span className={`ops-status-chip ${OPS_STATUS_CHIP[shipmentStatusTone(shipment.status)].className}`}>
                          <span className={`chip-dot ${OPS_STATUS_CHIP[shipmentStatusTone(shipment.status)].dot}`} /> {shipmentStatusLabel(shipment.status, consoleLang())}
                        </span>
                      </td>

                      {/* 6. EST. DELIVERY */}
                      <td>
                        <div className="ops-eta-cell">
                          <strong className="ops-eta-date">{eta.date}</strong>
                          <span className="ops-eta-subtext">{eta.time || TXT.justNow}</span>
                        </div>
                      </td>

                      {/* 7. ACTIONS */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="ops-action-cluster">
                          {can('tracking.update') && (
                            <button
                              type="button"
                              className={`ops-control-btn ${isSimulating ? 'sim-active' : ''}`}
                              onClick={() => onQuickUpdateStatus(shipment)}
                              title={TXT.operationsControl}
                            >
                              <SlidersHorizontal size={12} className="control-dash" aria-hidden="true" />
                              <span>{isSimulating ? TXT.moving : TXT.control}</span>
                            </button>
                          )}

                          {/* Edit pen (update I.5): the same editor as All Shipments — details, photos, payment request. */}
                          {can('shipments.edit') && (
                            <button
                              type="button"
                              className="ops-inspect-icon-btn ops-edit-icon-btn"
                              onClick={() => setEditShipment(shipment)}
                              title={TXT.editConsignment}
                              aria-label={TXT.edit(shipment.trackingNumber)}
                            >
                              <Edit3 size={13} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="ops-inspect-icon-btn"
                            onClick={() => onOpenShipmentDetail(shipment.trackingNumber)}
                            title={TXT.inspectConsignment}
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {editShipment && (
        <EditShipmentModal
          shipment={editShipment}
          onClose={() => setEditShipment(null)}
          onSave={async (updated) => {
            const result = await updateShipmentFull(updated);
            // A failure is shown inside the edit form, which stays open.
            if (result.success) {
              setSavedToast(TXT.consignmentUpdated(updated.trackingNumber));
              setTimeout(() => setSavedToast(null), 4000);
            }
            return result;
          }}
        />
      )}

      {savedToast && (
        <div className="admin-toast-success animate-fade-in" role="status">
          <CheckCircle2 size={18} />
          <span>{savedToast}</span>
        </div>
      )}
    </div>
  );
};
