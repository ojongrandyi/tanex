import React, { useId, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { usePermission } from '../../auth/AuthContext';
import { PROOF_LIMITS, type AdminPaymentProof } from '../../shared/paymentProof';
import './ProofReviewControls.css';
import { PROOF_REVIEW_CONTROLS_TEXT as TXT } from './ProofReviewControls.text';

interface ProofReviewControlsProps {
  proof: AdminPaymentProof;
  onReviewed: (updated: AdminPaymentProof) => void;
}

/**
 * Approve / Reject for a submitted proof (docs/update.md F.6). Approving marks the request and its
 * linked invoice paid and, unless unticked, adds a public "Payment confirmed" event (D-8).
 * Rejecting needs a reason, which the customer sees on the track page.
 */
export const ProofReviewControls: React.FC<ProofReviewControlsProps> = ({ proof, onReviewed }) => {
  const id = useId();
  const [addEvent, setAddEvent] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Approve/reject need payments.manage; payments.view alone sees the proof only.
  const canManage = usePermission('payments.manage');

  if (proof.status !== 'SUBMITTED' || !canManage) return null;

  const approve = async () => {
    if (!window.confirm(TXT.approveThisProofAndMark(proof.trackingNumber))) return;
    setBusy(true);
    setError('');
    try {
      onReviewed(await api.approvePaymentProof(proof.id, addEvent));
    } catch (err: any) {
      setError(err?.message || TXT.couldNotApproveTheProof);
    } finally {
      setBusy(false);
    }
  };

  const reject = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < PROOF_LIMITS.rejectReasonMin) {
      setError(TXT.tellTheCustomerWhyThe);
      return;
    }
    setBusy(true);
    setError('');
    try {
      onReviewed(await api.rejectPaymentProof(proof.id, text));
    } catch (err: any) {
      setError(err?.fieldErrors?.reason || err?.message || TXT.couldNotRejectTheProof);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proof-review">
      {!rejecting ? (
        <>
          <label className="proof-review-check">
            <input type="checkbox" checked={addEvent} onChange={(e) => setAddEvent(e.target.checked)} disabled={busy} />
            <span>{TXT.addAPaymentConfirmedEvent}</span>
          </label>
          <div className="proof-review-buttons">
            <button type="button" className="proof-review-btn approve" onClick={approve} disabled={busy}>
              <CheckCircle2 size={15} aria-hidden="true" /><span>{TXT.approve}</span>
            </button>
            <button type="button" className="proof-review-btn reject" onClick={() => { setRejecting(true); setError(''); }} disabled={busy}>
              <XCircle size={15} aria-hidden="true" /><span>{TXT.reject}</span>
            </button>
          </div>
        </>
      ) : (
        <form className="proof-review-reject" onSubmit={reject}>
          <label htmlFor={`${id}-reason`}>{TXT.reasonTheCustomerWillSee}</label>
          <textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={PROOF_LIMITS.rejectReasonMax}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={TXT.eGTheAmountOn}
            disabled={busy}
            autoFocus
          />
          <div className="proof-review-buttons">
            <button type="submit" className="proof-review-btn reject" disabled={busy}>
              <XCircle size={15} aria-hidden="true" /><span>{TXT.rejectProof}</span>
            </button>
            <button type="button" className="proof-review-btn" onClick={() => { setRejecting(false); setError(''); }} disabled={busy}>
              {TXT.cancel}
            </button>
          </div>
        </form>
      )}
      {error && <p className="proof-review-error" role="alert">{error}</p>}
    </div>
  );
};
