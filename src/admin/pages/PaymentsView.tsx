import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Maximize2, RefreshCw, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import type { AdminPaymentProof, ProofStatus } from '../../shared/paymentProof';
import { ProofViewer } from '../components/ProofViewer';
import { ProofReviewControls } from '../components/ProofReviewControls';
import { ProofFacts, formatProofReceived, proofMethodView } from '../components/ProofFacts';
import './PaymentsView.css';
import { PAYMENTS_VIEW_TEXT as TXT } from './PaymentsView.text';
import { consoleLang } from '../i18n/consoleText';
import { PAYMENT_STATUS_LABELS } from '../../shared/paymentRequest';

interface PaymentsViewProps {
  searchQuery: string;
  onOpenShipmentDetail: (trackingNumber: string) => void;
  /** Called after the list loads, so the console can refresh its new-proof badge (update G.1). */
  onProofsChanged?: () => void;
}

type Filter = 'ALL' | ProofStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'SUBMITTED', get label() { return TXT.submitted; } },
  { value: 'APPROVED', get label() { return TXT.approved; } },
  { value: 'REJECTED', get label() { return TXT.rejected2; } },
  { value: 'ALL', get label() { return TXT.all; } },
];

const PROOF_STATUS_LABELS: Record<ProofStatus, string> = {
  get SUBMITTED() { return TXT.submitted; },
  get APPROVED() { return TXT.approved; },
  get REJECTED() { return TXT.rejected2; },
};

// Payment request status names, shared with the track page (CONTENT §6.8).
const requestStatusLabel = (status: string) =>
  (PAYMENT_STATUS_LABELS as Record<string, { en: string; fr: string }>)[status]?.[consoleLang()] ?? status;

/** Admin Payments page (docs/update.md F.5): proofs of payment sent from the track page. */
export const PaymentsView: React.FC<PaymentsViewProps> = ({ searchQuery, onOpenShipmentDetail, onProofsChanged }) => {
  const [proofs, setProofs] = useState<AdminPaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  const [viewing, setViewing] = useState<AdminPaymentProof | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProofs(await api.getPaymentProofs());
      onProofsChanged?.();
    } catch (err: any) {
      setError(err?.message || TXT.couldNotLoadPaymentProofs);
    } finally {
      setLoading(false);
    }
  }, [onProofsChanged]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return proofs.filter((p) => {
      if (filter !== 'ALL' && p.status !== filter) return false;
      if (!q) return true;
      return [p.trackingNumber, p.payerName, p.reference, p.payment?.chargeReason, proofMethodView(p)?.label]
        .some((field) => field?.toLowerCase().includes(q));
    });
  }, [proofs, filter, searchQuery]);

  const counts = useMemo(() => ({
    ALL: proofs.length,
    SUBMITTED: proofs.filter((p) => p.status === 'SUBMITTED').length,
    APPROVED: proofs.filter((p) => p.status === 'APPROVED').length,
    REJECTED: proofs.filter((p) => p.status === 'REJECTED').length,
  }), [proofs]);

  const openViewer = (proof: AdminPaymentProof, opener: HTMLElement) => {
    openerRef.current = opener;
    setViewing(proof);
  };
  // Approving one proof also changes its request, which other proofs for that shipment show,
  // so the list is reloaded after the reviewed proof is swapped in.
  const handleReviewed = (updated: AdminPaymentProof) => {
    setProofs((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    setViewing((current) => (current?.id === updated.id ? updated : current));
    load();
  };

  const closeViewer = useCallback(() => {
    setViewing(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  return (
    <div className="tx-payments-workspace animate-fade-in">
      <div className="payments-toolbar">
        <div className="payments-filters" role="tablist" aria-label={TXT.filterPaymentProofs}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`payments-filter-btn ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} <span className="font-mono">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="payments-refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>{TXT.refresh}</span>
        </button>
      </div>

      {error && (
        <div className="payments-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="payments-empty">
          <Wallet size={28} />
          <strong>{proofs.length === 0 ? TXT.noPaymentProofsYet : TXT.noProofsMatch}</strong>
          <p>{proofs.length === 0 ? TXT.proofsCustomersSendFromThe : TXT.tryAnotherFilterOrClear}</p>
        </div>
      )}

      <div className="payments-list">
        {visible.map((p) => (
          <article key={p.id} className={`proof-card status-${p.status.toLowerCase()}`}>
            <button
              type="button"
              className="proof-thumb"
              onClick={(e) => openViewer(p, e.currentTarget)}
              aria-label={TXT.openTheScreenshotSentFor(p.trackingNumber)}
            >
              <img src={p.fileUrl} alt="" loading="lazy" />
              <span className="proof-thumb-zoom" aria-hidden="true"><Maximize2 size={14} /></span>
            </button>

            <div className="proof-main">
              <div className="proof-head">
                <strong className="font-mono">{p.trackingNumber}</strong>
                <span className={`proof-badge ${p.status.toLowerCase()}`}>{PROOF_STATUS_LABELS[p.status]}</span>
                {p.payment && <span className="proof-request-status">{TXT.request} {requestStatusLabel(p.payment.status)}</span>}
                <small className="proof-time">{TXT.received} {formatProofReceived(p.createdAt)}</small>
              </div>
              <ProofFacts proof={p} />
              {p.status === 'REJECTED' && p.adminNote && <p className="proof-note">{TXT.rejected} {p.adminNote}</p>}
              <div className="proof-actions">
                <button type="button" className="proof-action" onClick={(e) => openViewer(p, e.currentTarget)}>
                  <Maximize2 size={14} /><span>{TXT.viewScreenshot}</span>
                </button>
                <button type="button" className="proof-action" onClick={() => onOpenShipmentDetail(p.trackingNumber)}>
                  <ExternalLink size={14} /><span>{TXT.viewShipment}</span>
                </button>
              </div>
              <ProofReviewControls proof={p} onReviewed={handleReviewed} />
            </div>
          </article>
        ))}
      </div>

      {viewing && (
        <ProofViewer src={viewing.fileUrl} title={TXT.paymentScreenshot(viewing.trackingNumber)} onClose={closeViewer}>
          <ProofFacts proof={viewing} />
          {viewing.status === 'REJECTED' && viewing.adminNote && <p className="proof-note">{TXT.rejected} {viewing.adminNote}</p>}
          <ProofReviewControls proof={viewing} onReviewed={handleReviewed} />
        </ProofViewer>
      )}
    </div>
  );
};
