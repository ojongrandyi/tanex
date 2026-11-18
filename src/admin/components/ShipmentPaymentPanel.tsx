import React, { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAdminData } from '../../context/AdminDataContext';
import { usePermission } from '../../auth/AuthContext';
import { PAYMENT_METHODS } from '../../shared/paymentMethods';
import { PAYMENT_STATUS_LABELS, ShipmentPayment, formatPaymentAmount } from '../../shared/paymentRequest';
import { PaymentIcon } from '../../components/PaymentIcon';
import {
  PaymentDraft, PaymentRequestEditor, draftFromPayment, draftToRequest, emptyPaymentDraft, paymentDraftErrors,
} from './PaymentRequestEditor';
import './ShipmentPaymentPanel.css';
import { SHIPMENT_PAYMENT_PANEL_TEXT as TXT } from './ShipmentPaymentPanel.text';
import { consoleIntlLocale, consoleLang } from '../i18n/consoleText';

// Shared status names (CONTENT §6.8), in the console language.
const statusLabel = (status: ShipmentPayment['status']) => PAYMENT_STATUS_LABELS[status][consoleLang()];

interface ShipmentPaymentPanelProps {
  trackingNumber: string;
}

/**
 * Edit Shipment: the shipment's payment request (docs/update.md D.2, D-9) with create, edit and
 * delete. Saves through /api/shipments/:id/payment on its own, independently of Save Changes.
 */
export const ShipmentPaymentPanel: React.FC<ShipmentPaymentPanelProps> = ({ trackingNumber }) => {
  const { documents } = useAdminData();
  // payments.view shows the request; changing it needs payments.manage.
  const canManage = usePermission('payments.manage');
  const [payment, setPayment] = useState<ShipmentPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  // Bumped by "Try again" after a failed load (update I.6).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    api.getShipmentPayment(trackingNumber)
      .then((p) => { if (!cancelled) setPayment(p); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || TXT.couldNotLoadThePayment); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trackingNumber, reloadKey]);

  const invoices = useMemo(
    () => documents
      .filter((d) => d.docType === 'INVOICE' && d.shipmentTracking?.toUpperCase() === trackingNumber.toUpperCase())
      .map((d) => ({ id: d.id, label: `${d.id} – ${d.title}` })),
    [documents, trackingNumber]
  );

  const startEditing = () => {
    setErrors({});
    setMessage(null);
    setDraft(payment ? draftFromPayment(payment) : emptyPaymentDraft());
  };

  const save = async () => {
    if (!draft) return;
    const localErrors = paymentDraftErrors(draft);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setMessage({ text: TXT.somePaymentDetailsNeedFixing, error: true });
      return;
    }
    setBusy(true);
    try {
      const saved = await api.saveShipmentPayment(trackingNumber, draftToRequest(draft));
      setPayment(saved);
      setDraft(null);
      setErrors({});
      setMessage({ text: payment ? TXT.paymentRequestSaved : TXT.paymentRequestAddedTheCustomer });
    } catch (err: any) {
      setErrors(err.fieldErrors ?? {});
      setMessage({ text: err.message || TXT.couldNotSaveThePayment, error: true });
    } finally {
      setBusy(false);
    }
  };

  // D.3: manual status changes. Marking paid also marks a linked invoice paid (server side).
  const changeStatus = async (action: 'cancel' | 'mark_paid' | 'reopen') => {
    const prompts = TXT.confirmStatus;
    if (!window.confirm(prompts[action])) return;
    setBusy(true);
    try {
      const updated = await api.setShipmentPaymentStatus(trackingNumber, action);
      setPayment(updated);
      setMessage({ text: action === 'mark_paid' ? TXT.markedAsPaid : action === 'cancel' ? TXT.paymentRequestCancelled : TXT.paymentRequestReopened });
    } catch (err: any) {
      setMessage({ text: err.message || TXT.couldNotChangeTheStatus, error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(TXT.deleteThisPaymentRequestAnd)) return;
    setBusy(true);
    try {
      await api.deleteShipmentPayment(trackingNumber);
      setPayment(null);
      setDraft(null);
      setMessage({ text: TXT.paymentRequestDeleted });
    } catch (err: any) {
      setMessage({ text: err.message || TXT.couldNotDeleteThePayment, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tx-spp" aria-labelledby={`tx-spp-${trackingNumber}`}>
      <div className="tx-spp-head">
        <h4 id={`tx-spp-${trackingNumber}`}>{TXT.paymentRequest}</h4>
        {payment && !draft && <span className={`tx-spp-status s-${payment.status.toLowerCase()}`}>{statusLabel(payment.status)}</span>}
      </div>
      <p className="tx-spp-hint">{TXT.shownToTheCustomerOn}</p>

      <p className={`tx-spp-message${message?.error ? ' is-error' : ''}`} role="status" aria-live="polite">{message?.text}</p>

      {loading ? (
        <p className="tx-spp-empty">{TXT.loading}</p>
      ) : loadError ? (
        <div className="tx-load-error" role="alert">
          <p className="tx-spp-error">{loadError}</p>
          <button type="button" className="tx-load-retry" onClick={() => setReloadKey((k) => k + 1)}>{TXT.tryAgain}</button>
        </div>
      ) : draft ? (
        <>
          <PaymentRequestEditor value={draft} onChange={setDraft} errors={errors} invoices={invoices} idPrefix={`edit-${trackingNumber}`} compact />
          <div className="tx-spp-actions">
            <button type="button" className="tx-spp-btn" onClick={() => { setDraft(null); setErrors({}); setMessage(null); }} disabled={busy}>{TXT.cancel}</button>
            <button type="button" className="tx-spp-btn primary" onClick={save} disabled={busy}>
              {busy && <Loader2 size={14} className="tx-spp-spin" aria-hidden="true" />}
              <span>{payment ? TXT.savePaymentRequest : TXT.addPaymentRequest}</span>
            </button>
          </div>
        </>
      ) : payment ? (
        <div className="tx-spp-summary">
          <div className="tx-spp-amount">{formatPaymentAmount(payment.amount, payment.currency)}</div>
          <p className="tx-spp-reason">{payment.chargeReason}</p>
          {payment.dueDate && <p className="tx-spp-meta">{TXT.due} {payment.dueDate}</p>}
          {payment.paidAt && <p className="tx-spp-meta">{TXT.paid} {new Date(payment.paidAt).toLocaleString(consoleIntlLocale())}</p>}
          <ul className="tx-spp-accounts">
            {payment.methods.map((m) => (
              <li key={m.id}>
                <PaymentIcon type={m.type} size={16} />
                <span>{m.label || PAYMENT_METHODS[m.type]?.label || m.type}</span>
              </li>
            ))}
          </ul>
          {canManage && (
          <div className="tx-spp-actions">
            {(payment.status === 'AWAITING_PAYMENT' || payment.status === 'UNDER_REVIEW') && (
              <>
                <button type="button" className="tx-spp-btn" onClick={() => changeStatus('cancel')} disabled={busy}>
                  <Ban size={14} aria-hidden="true" />
                  <span>{TXT.cancelRequest}</span>
                </button>
                <button type="button" className="tx-spp-btn" onClick={() => changeStatus('mark_paid')} disabled={busy}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>{TXT.markPaid}</span>
                </button>
              </>
            )}
            {(payment.status === 'PAID' || payment.status === 'CANCELLED') && (
              <button type="button" className="tx-spp-btn" onClick={() => changeStatus('reopen')} disabled={busy}>
                <RotateCcw size={14} aria-hidden="true" />
                <span>{TXT.reopen}</span>
              </button>
            )}
            <button type="button" className="tx-spp-btn danger" onClick={remove} disabled={busy}>
              <Trash2 size={14} aria-hidden="true" />
              <span>{TXT.delete}</span>
            </button>
            <button type="button" className="tx-spp-btn" onClick={startEditing} disabled={busy}>
              <Pencil size={14} aria-hidden="true" />
              <span>{TXT.edit}</span>
            </button>
          </div>
          )}
        </div>
      ) : (
        <div className="tx-spp-none">
          <p className="tx-spp-empty">{TXT.noPaymentRequestForThis}</p>
          {canManage && (
            <button type="button" className="tx-spp-btn primary" onClick={startEditing}>
              <Plus size={14} aria-hidden="true" />
              <span>{TXT.addPaymentRequest}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
};
