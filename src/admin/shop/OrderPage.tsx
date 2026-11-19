// One shop order in the console (docs/SHOP_SPEC.md §7.6): customer with Call / WhatsApp, delivery
// details, lines with picture and product ID, totals, the status buttons the server allows
// (src/shared/shopOrderStatus.ts), Set delivery fee, the payment panel, Send to dispatch and the
// job's tracking ID, the timeline with internal notes, and a packing slip for the printer. The
// server checks every action again; buttons only appear for the permissions the user holds.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ImageOff, MessageCircle, Phone, Printer, Truck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { IamDialog } from '../components/IamDialog';
import { formatCurrencyAmount } from '../../shared/currency';
import { SIZE_CLASSES } from '../../shared/localPricing';
import { SHOP_PAYMENT_METHODS, type OrderStatus, type ShopPaymentMethod } from '../../shared/shopOrderStatus';
import { whatsAppDigits } from '../../shared/whatsapp';
import { formatPhone } from '../../config/brand';
import { pagePath } from '../../router/routes';
import { when } from '../blog/studioUtil';
import { shopOrdersApi, type ShopOrder } from './shopApi';
import { ORDER_TEXT } from './orderStrings';
import { SHOP_TEXT, fill } from './strings';
import { orderStatusChip, paymentChip } from './OrderList';

const T = ORDER_TEXT;
const D = ORDER_TEXT.dialogs;
const REFUND_METHODS = ['CASH', 'MTN_MOMO', 'ORANGE_MONEY'] as const;

type Dialog =
  | { kind: 'fee' }
  | { kind: 'status'; to: OrderStatus }
  | { kind: 'pay' }
  | { kind: 'unpay' }
  | { kind: 'refund' }
  | { kind: 'dispatch' }
  | null;

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const fieldOf = (e: unknown) => (e && typeof e === 'object' && 'field' in e ? String((e as { field?: string }).field ?? '') : '');

/** Shared shell for the small action dialogs: a form, an error line, Cancel + the action button. */
const ActionDialog: React.FC<{
  title: string; submit: string; busy: boolean; error: string | null; canSubmit?: boolean; danger?: boolean;
  onClose: () => void; onSubmit: () => void; children: React.ReactNode;
}> = ({ title, submit, busy, error, canSubmit = true, danger, onClose, onSubmit, children }) => (
  <IamDialog title={title} onClose={onClose}>
    <form className="tx-iam-form" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy && canSubmit) onSubmit(); }}>
      {children}
      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      <div className="tx-iam-dialog-actions">
        <button type="button" className="tx-iam-btn" onClick={onClose}>{D.cancel}</button>
        <button type="submit" className={`tx-iam-btn ${danger ? 'danger' : 'primary'}`} disabled={busy || !canSubmit}>{submit}</button>
      </div>
    </form>
  </IamDialog>
);

export const OrderPage: React.FC<{ orderId: string; onBack: () => void; onChanged?: () => void }> = ({ orderId, onBack, onChanged }) => {
  const { can } = useAuth();
  const canManage = can('orders.manage');
  const canPay = can('orders.payment');
  const canDispatch = canManage && can('dispatch.manage');
  const canNote = canManage || canPay;

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  // Dialog fields.
  const [fee, setFee] = useState('');
  const [reason, setReason] = useState('');
  const [putBack, setPutBack] = useState(true);
  const [method, setMethod] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [sizeClass, setSizeClass] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    let live = true;
    shopOrdersApi.get(orderId).then((o) => { if (live) setOrder(o); }).catch((e) => { if (live) setLoadError(errText(e)); });
    return () => { live = false; };
  }, [orderId]);

  const money = useCallback((n: number | null) => (order && n !== null ? formatCurrencyAmount(n, order.currency) : '—'), [order]);

  const open = (d: Exclude<Dialog, null>) => {
    if (!order) return;
    setError(null);
    setField('');
    setReason('');
    setPutBack(true);
    setReference('');
    if (d.kind === 'fee') setFee(order.deliveryFee !== null ? String(order.deliveryFee) : '');
    if (d.kind === 'pay') { setMethod(order.payment.method); setAmount(String(order.total)); }
    if (d.kind === 'refund') { setMethod('CASH'); setAmount(String(order.payment.amount ?? order.total)); }
    if (d.kind === 'dispatch') { setSizeClass(order.dispatch?.sizeClass ?? 'SMALL'); setWeight(order.dispatch?.weightKg ? String(order.dispatch.weightKg) : ''); }
    setDialog(d);
  };

  const run = async (action: () => Promise<ShopOrder>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setOrder(updated);
      setDialog(null);
      onChanged?.();
    } catch (e) {
      setError(errText(e));
      setField(fieldOf(e));
    } finally {
      setBusy(false);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !note.trim() || busy) return;
    setBusy(true);
    setNoteError(null);
    try {
      setOrder(await shopOrdersApi.note(order.id, note.trim()));
      setNote('');
    } catch (err) {
      setNoteError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="tx-iam">
        <button type="button" className="tx-iam-btn" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> {T.page.back}</button>
        <div className="tx-iam-notice error" role="alert">{T.page.loadFailed} {loadError}</div>
      </div>
    );
  }
  if (!order) return <p className="tx-iam-muted" role="status">{T.list.loading}</p>;

  const o = order;
  const office = T.offices[o.pickupOffice ?? ''] ?? o.pickupOffice ?? '';
  const feeText = o.deliveryFeeStatus === 'NONE' ? T.page.freePickup : o.deliveryFee === null ? T.page.feeToConfirm : money(o.deliveryFee);
  const wa = o.customer.whatsapp ? whatsAppDigits(o.customer.whatsapp) : null;
  const jobClosed = o.job?.status === 'RETURNED' || o.job?.status === 'CANCELLED';
  const statusLabel = (to: OrderStatus) => (o.status === 'OUT_FOR_DELIVERY' && to === 'READY' ? T.page.backToReady : T.page.moveTo[to]);
  const isMomo = (m: string) => m === 'MTN_MOMO' || m === 'ORANGE_MONEY';
  const fieldClass = (name: string) => `tx-iam-field${field === name ? ' has-error' : ''}`;

  const moveStatus = (to: OrderStatus) => {
    // Simple forward steps go straight through; cancel, return and back-to-ready ask first.
    if (to === 'CONFIRMED' || to === 'READY' && o.status === 'CONFIRMED' || to === 'COLLECTED') {
      void run(() => shopOrdersApi.setStatus(o.id, { status: to }));
    } else open({ kind: 'status', to });
  };

  return (
    <div className="tx-iam tx-shop-order">
      <div className="tx-shop-editor__head tx-order-noprint">
        <button type="button" className="tx-iam-btn" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> {T.page.back}</button>
        <div className="tx-shop-editor__title">
          <h2 className="tx-shop-nowrap">{o.orderNumber}</h2>
          <p className="tx-iam-muted tx-shop-editor__meta">{fill(T.page.placed, { when: when(o.createdAt) })}</p>
          <p>
            <span className={orderStatusChip(o.status)}>{T.status[o.status]}</span>
            <span className={paymentChip(o.payment.status)}>{T.payment[o.payment.status]}</span>
          </p>
        </div>
        <button type="button" className="tx-iam-btn tx-order-print" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> {T.page.print}
        </button>
      </div>

      {error && !dialog && <div className="tx-iam-notice error tx-order-noprint" role="alert">{error}</div>}
      {o.deliveryProblem && (
        <div className="tx-iam-notice error tx-order-noprint" role="status">
          <AlertTriangle size={16} aria-hidden="true" /> {jobClosed ? T.page.problem : T.page.problemWaiting}
        </div>
      )}
      {o.status === 'CANCELLED' && o.cancelReason && <div className="tx-iam-notice tx-order-noprint">{fill(T.page.cancelReason, { reason: o.cancelReason })}</div>}

      <div className="tx-order-grid tx-order-noprint">
        <div className="tx-order-main">
          <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-order-customer">
            <h3 id="tx-order-customer">{T.page.customer}</h3>
            {o.anonymised ? <p className="tx-iam-muted">{T.page.removed}</p> : (
              <>
                <p className="tx-order-name">{o.customer.name}</p>
                <dl className="tx-order-dl">
                  {o.customer.phone && <><dt>{T.page.call}</dt><dd className="tx-shop-nowrap">{formatPhone(o.customer.phone)}</dd></>}
                  {o.customer.whatsapp && <><dt>{T.page.whatsapp}</dt><dd className="tx-shop-nowrap">{formatPhone(o.customer.whatsapp)}</dd></>}
                  {o.customer.email && <><dt>{T.page.email}</dt><dd className="tx-order-wrap">{o.customer.email}</dd></>}
                </dl>
                <p className="tx-iam-muted">{fill(T.page.language, { lang: o.locale === 'fr' ? 'Français' : 'English' })}</p>
                <div className="tx-order-actions">
                  {o.customer.phone && <a className="tx-iam-btn" href={`tel:${o.customer.phone}`}><Phone size={16} aria-hidden="true" /> {T.page.call}</a>}
                  {wa && <a className="tx-iam-btn" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" /> {T.page.whatsapp}</a>}
                </div>
              </>
            )}
          </section>

          <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-order-delivery">
            <h3 id="tx-order-delivery">{o.deliveryMethod === 'PICKUP' ? fill(T.page.pickupAt, { office }) : T.page.delivery}</h3>
            {o.deliveryMethod === 'DELIVERY' && (
              <dl className="tx-order-dl">
                <dt>{T.page.city}</dt><dd>{o.city?.name ?? '—'}</dd>
                <dt>{T.page.area}</dt><dd>{o.zone?.name ?? T.page.areaNotListed}</dd>
                {o.address && <><dt>{T.page.address}</dt><dd className="tx-order-wrap">{o.address}</dd></>}
              </dl>
            )}
            {o.customerNote && <><h4 className="tx-shop-subhead">{T.page.customerNote}</h4><p className="tx-order-wrap">{o.customerNote}</p></>}
          </section>

          <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-order-items">
            <h3 id="tx-order-items">{T.page.items}</h3>
            <div className="tx-shop-table-wrap">
              <table className="tx-iam-table tx-order-items">
                <thead>
                  <tr>
                    <th scope="col">{T.page.columns.product}</th>
                    <th scope="col">{T.page.columns.code}</th>
                    <th scope="col" className="tx-shop-num">{T.page.columns.unit}</th>
                    <th scope="col" className="tx-shop-num">{T.page.columns.qty}</th>
                    <th scope="col" className="tx-shop-num">{T.page.columns.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.code}>
                      <td data-label={T.page.columns.product}>
                        <div className="tx-shop-product-cell">
                          <span className="tx-shop-thumb">
                            {i.image ? <img src={i.image} width={48} height={48} alt="" loading="lazy" /> : <ImageOff size={18} aria-hidden="true" />}
                          </span>
                          <span>{i.nameEn}</span>
                        </div>
                      </td>
                      <td data-label={T.page.columns.code}><code className="tx-shop-nowrap">{i.code}</code></td>
                      <td data-label={T.page.columns.unit} className="tx-shop-num tx-shop-nowrap">{money(i.unitPrice)}</td>
                      <td data-label={T.page.columns.qty} className="tx-shop-num">{i.qty}</td>
                      <td data-label={T.page.columns.total} className="tx-shop-num tx-shop-nowrap">{money(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="tx-order-totals">
              <dt>{T.page.subtotal}</dt><dd>{money(o.subtotal)}</dd>
              <dt>{T.page.deliveryFee}</dt><dd>{feeText}</dd>
              <dt className="is-total">{o.deliveryFeeStatus === 'TO_CONFIRM' ? T.page.totalToConfirm : T.page.total}</dt><dd className="is-total">{money(o.total)}</dd>
            </dl>
            {canManage && o.canSetFee && (
              <button type="button" className={`tx-iam-btn${o.deliveryFeeStatus === 'TO_CONFIRM' ? ' primary' : ''}`} onClick={() => open({ kind: 'fee' })}>
                {o.deliveryFeeStatus === 'TO_CONFIRM' ? T.page.setFee : T.page.changeFee}
              </button>
            )}
          </section>
        </div>

        <aside className="tx-order-side">
          <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-order-status">
            <h3 id="tx-order-status">{T.page.status}</h3>
            <p><span className={orderStatusChip(o.status)}>{T.status[o.status]}</span></p>
            {canManage && o.nextStatuses.length > 0 && (
              <div className="tx-order-actions">
                {o.nextStatuses.map((to) => {
                  const needsFee = to === 'CONFIRMED' && o.deliveryFeeStatus === 'TO_CONFIRM';
                  const danger = to === 'CANCELLED' || to === 'RETURNED';
                  return (
                    <button key={to} type="button" disabled={busy || needsFee} title={needsFee ? T.page.confirmNeedsFee : undefined}
                      className={`tx-iam-btn${danger ? ' danger' : ' primary'}`} onClick={() => moveStatus(to)}>
                      {statusLabel(to)}
                    </button>
                  );
                })}
              </div>
            )}
            {canManage && o.nextStatuses.includes('CONFIRMED') && o.deliveryFeeStatus === 'TO_CONFIRM' && (
              <p className="tx-iam-muted">{T.page.confirmNeedsFee}</p>
            )}
          </section>

          {(o.dispatch || o.job) && (
            <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-order-dispatch">
              <h3 id="tx-order-dispatch">{T.page.dispatch}</h3>
              {o.job && (
                <dl className="tx-order-dl">
                  <dt>{T.page.trackingId}</dt>
                  <dd><a className="tx-shop-link tx-shop-nowrap" href={pagePath('track-result', o.job.trackingId ?? '')} target="_blank" rel="noopener noreferrer">{o.job.trackingId}</a></dd>
                  {o.job.status && <><dt>{T.page.jobStatus}</dt><dd>{o.job.status.toLowerCase().replace(/_/g, ' ')}</dd></>}
                </dl>
              )}
              {o.dispatch && (
                <>
                  {o.dispatch.scope && <p>{T.page.scope[o.dispatch.scope]} · {money(o.dispatch.price)}</p>}
                  <p className="tx-iam-muted">{o.dispatch.codAmount ? fill(T.page.cod, { amount: money(o.dispatch.codAmount) }) : T.page.noCod}</p>
                  {!o.dispatch.ok && (
                    <div className="tx-iam-notice" role="status">
                      <strong>{T.page.blocked}</strong>
                      <ul className="tx-order-list">{o.dispatch.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                    </div>
                  )}
                  {canDispatch ? (
                    <button type="button" className="tx-iam-btn primary" disabled={busy || !o.dispatch.ok} onClick={() => open({ kind: 'dispatch' })}>
                      <Truck size={16} aria-hidden="true" /> {T.page.sendToDispatch}
                    </button>
                  ) : canManage && <p className="tx-iam-muted">{T.page.needsDispatchPermission}</p>}
                  <p className="tx-iam-muted tx-shop-editor__meta">{T.page.sendHint}</p>
                </>
              )}
            </section>
          )}

          <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-order-payment">
            <h3 id="tx-order-payment">{T.page.payment}</h3>
            <dl className="tx-order-dl">
              <dt>{T.page.method}</dt><dd>{T.methods[o.payment.method]}</dd>
              <dt>{T.page.paymentStatus}</dt><dd><span className={paymentChip(o.payment.status)}>{T.payment[o.payment.status]}</span></dd>
              {o.payment.reference && <><dt>{T.page.reference}</dt><dd className="tx-order-wrap">{o.payment.reference}</dd></>}
            </dl>
            {o.payment.paidAt && <p className="tx-iam-muted">{fill(T.page.paidOn, { when: when(o.payment.paidAt), who: o.payment.paidBy ?? T.page.systemActor })}</p>}
            {o.payment.refund && (
              <p className="tx-iam-muted">
                {fill(T.page.refundedOn, { amount: money(o.payment.refund.amount), when: when(o.payment.refund.at), who: o.payment.refund.by ?? '' })}
                {o.payment.refund.reference ? ` · ${o.payment.refund.reference}` : ''}
              </p>
            )}
            {canPay && (
              <div className="tx-order-actions">
                {o.payment.status === 'UNPAID' && o.status !== 'CANCELLED' && (
                  <button type="button" className="tx-iam-btn primary" disabled={busy || o.deliveryFeeStatus === 'TO_CONFIRM'} onClick={() => open({ kind: 'pay' })}>{T.page.recordPayment}</button>
                )}
                {o.payment.status === 'PAID' && (
                  <>
                    <button type="button" className="tx-iam-btn" disabled={busy} onClick={() => open({ kind: 'refund' })}>{T.page.refund}</button>
                    <button type="button" className="tx-iam-btn danger" disabled={busy} onClick={() => open({ kind: 'unpay' })}>{T.page.markUnpaid}</button>
                  </>
                )}
              </div>
            )}
            {o.payment.status === 'UNPAID' && o.payment.method === 'CASH_ON_DELIVERY' && <p className="tx-iam-muted tx-shop-editor__meta">{T.page.paidHint}</p>}
          </section>
        </aside>
      </div>

      <section className="tx-iam-card tx-shop-section tx-order-noprint" aria-labelledby="tx-order-timeline">
        <h3 id="tx-order-timeline">{T.page.timeline}</h3>
        <ol className="tx-order-timeline">
          {o.events.map((e, i) => (
            <li key={i} className={`is-${e.kind.toLowerCase()}`}>
              <div className="tx-order-timeline__head">
                <strong>{T.page.events[e.kind] ?? e.kind}</strong>
                {e.kind === 'STATUS' && e.to && <span className={orderStatusChip(e.to as OrderStatus)}>{T.status[e.to as OrderStatus] ?? e.to}</span>}
                <span className="tx-iam-muted">{when(e.at)} · {e.by ?? T.page.systemActor}</span>
              </div>
              {e.note && <p className="tx-order-wrap">{e.note}</p>}
            </li>
          ))}
        </ol>
        {canNote && (
          <form className="tx-iam-form tx-order-note" onSubmit={addNote}>
            <label className="tx-iam-field">
              <span>{T.page.addNote}</span>
              <textarea rows={2} maxLength={1000} value={note} placeholder={T.page.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
            </label>
            {noteError && <div className="tx-iam-notice error" role="alert">{noteError}</div>}
            <div><button type="submit" className="tx-iam-btn" disabled={busy || !note.trim()}>{T.page.saveNote}</button></div>
          </form>
        )}
      </section>

      <PackingSlip order={o} />

      {dialog?.kind === 'fee' && (
        <ActionDialog title={D.feeTitle} submit={D.saveFee} busy={busy} error={error} canSubmit={/^\d+$/.test(fee.trim())}
          onClose={() => setDialog(null)} onSubmit={() => void run(() => shopOrdersApi.setFee(o.id, Number(fee)))}>
          <label className={fieldClass('fee')}>
            <span>{D.fee}</span>
            <input type="number" inputMode="numeric" min={0} step={1} value={fee} onChange={(e) => setFee(e.target.value)} autoFocus />
            <small className="tx-iam-muted">{D.feeHint}</small>
          </label>
        </ActionDialog>
      )}

      {dialog?.kind === 'status' && (() => {
        const to = dialog.to;
        const needsReason = to === 'CANCELLED' || to === 'RETURNED';
        return (
          <ActionDialog title={fill(D.statusTitle, { action: statusLabel(to), order: o.orderNumber })} submit={statusLabel(to)} busy={busy} error={error}
            danger={needsReason} canSubmit={!needsReason || !!reason.trim()} onClose={() => setDialog(null)}
            onSubmit={() => void run(() => shopOrdersApi.setStatus(o.id, { status: to, reason: reason.trim() || undefined, ...(to === 'RETURNED' ? { putBackInStock: putBack } : {}) }))}>
            <label className={fieldClass('reason')}>
              <span>{needsReason ? D.reason : D.reasonOptional}</span>
              <textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required={needsReason} />
              {to === 'CANCELLED' && <small className="tx-iam-muted">{D.reasonCancelHint} {D.cancelStock}</small>}
            </label>
            {to === 'RETURNED' && (
              <label className="tx-iam-check">
                <input type="checkbox" checked={putBack} onChange={(e) => setPutBack(e.target.checked)} />
                <span>{D.putBack}<small className="tx-iam-muted"> {D.putBackHint}</small></span>
              </label>
            )}
          </ActionDialog>
        );
      })()}

      {dialog?.kind === 'pay' && (
        <ActionDialog title={D.payTitle} submit={D.save} busy={busy} error={error}
          canSubmit={/^\d+$/.test(amount.trim()) && (!isMomo(method) || !!reference.trim())} onClose={() => setDialog(null)}
          onSubmit={() => void run(() => shopOrdersApi.pay(o.id, { method: method as ShopPaymentMethod, amount: Number(amount), reference: reference.trim() || undefined }))}>
          <label className={fieldClass('method')}>
            <span>{T.page.method}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {SHOP_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{T.methods[m]}</option>)}
            </select>
          </label>
          <label className={fieldClass('amount')}>
            <span>{D.amount}</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <small className="tx-iam-muted">{fill(D.amountHint, { total: money(o.total) })}</small>
          </label>
          <label className={fieldClass('reference')}>
            <span>{T.page.reference}</span>
            <input type="text" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
            <small className="tx-iam-muted">{D.referenceHint}</small>
          </label>
        </ActionDialog>
      )}

      {dialog?.kind === 'unpay' && (
        <ActionDialog title={D.unpayTitle} submit={T.page.markUnpaid} busy={busy} error={error} danger canSubmit={!!reason.trim()}
          onClose={() => setDialog(null)} onSubmit={() => void run(() => shopOrdersApi.unpay(o.id, reason.trim()))}>
          <p className="tx-iam-muted">{D.unpayHint}</p>
          <label className={fieldClass('reason')}>
            <span>{D.reason}</span>
            <textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
        </ActionDialog>
      )}

      {dialog?.kind === 'refund' && (
        <ActionDialog title={D.refundTitle} submit={T.page.refund} busy={busy} error={error}
          canSubmit={/^\d+$/.test(amount.trim()) && !!reason.trim() && (method === 'CASH' || !!reference.trim())} onClose={() => setDialog(null)}
          onSubmit={() => void run(() => shopOrdersApi.refund(o.id, { method, amount: Number(amount), reference: reference.trim() || undefined, reason: reason.trim() }))}>
          <label className={fieldClass('method')}>
            <span>{D.refundMethod}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {REFUND_METHODS.map((m) => <option key={m} value={m}>{T.refundMethods[m]}</option>)}
            </select>
          </label>
          <label className={fieldClass('amount')}>
            <span>{D.amount}</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <small className="tx-iam-muted">{fill(D.refundAmountHint, { paid: money(o.payment.amount ?? o.total) })}</small>
          </label>
          <label className={fieldClass('reference')}>
            <span>{T.page.reference}</span>
            <input type="text" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
            <small className="tx-iam-muted">{D.referenceHint}</small>
          </label>
          <label className={fieldClass('reason')}>
            <span>{D.reason}</span>
            <textarea rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </ActionDialog>
      )}

      {dialog?.kind === 'dispatch' && o.dispatch && (
        <ActionDialog title={fill(D.dispatchTitle, { order: o.orderNumber })} submit={D.send} busy={busy} error={error}
          canSubmit={o.dispatch.scope !== 'INTERCITY' || Number(weight) > 0} onClose={() => setDialog(null)}
          onSubmit={() => void run(() => shopOrdersApi.dispatch(o.id, { sizeClass, weightKg: weight.trim() ? Number(weight) : null }))}>
          {o.dispatch.scope && <p>{T.page.scope[o.dispatch.scope]} · {money(o.dispatch.price)}</p>}
          <p className="tx-iam-muted">{o.dispatch.codAmount ? fill(T.page.cod, { amount: money(o.dispatch.codAmount) }) : T.page.noCod}</p>
          <label className={fieldClass('sizeClass')}>
            <span>{D.size}</span>
            <select value={sizeClass} onChange={(e) => setSizeClass(e.target.value)}>
              {SIZE_CLASSES.map((s) => <option key={s} value={s}>{SHOP_TEXT.editor.sizes[s] ?? s}</option>)}
            </select>
          </label>
          <label className={fieldClass('weightKg')}>
            <span>{D.weight}</span>
            <input type="number" inputMode="decimal" min={0} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            {o.dispatch.scope === 'INTERCITY' && <small className="tx-iam-muted">{D.weightHint}</small>}
          </label>
        </ActionDialog>
      )}
    </div>
  );
};

/** Printed with "Print packing slip": hidden on screen, the only thing on the page when printing. */
const PackingSlip: React.FC<{ order: ShopOrder }> = ({ order: o }) => {
  const S = T.slip;
  const office = T.offices[o.pickupOffice ?? ''] ?? o.pickupOffice ?? '';
  return (
    <div className="tx-order-slip" aria-hidden="true">
      <h1>{S.title}</h1>
      <table className="tx-order-slip__meta">
        <tbody>
          <tr><th>{S.order}</th><td><strong>{o.orderNumber}</strong></td></tr>
          <tr><th>{S.date}</th><td>{when(o.createdAt)}</td></tr>
          <tr>
            <th>{o.deliveryMethod === 'PICKUP' ? S.pickupAt : S.deliverTo}</th>
            <td>
              {o.customer.name}<br />
              {o.deliveryMethod === 'PICKUP' ? office : [o.address, o.zone?.name, o.city?.name].filter(Boolean).join(', ')}
            </td>
          </tr>
          {o.customer.phone && <tr><th>{S.phone}</th><td>{formatPhone(o.customer.phone)}</td></tr>}
        </tbody>
      </table>
      <table className="tx-order-slip__items">
        <thead><tr><th>{S.code}</th><th>{S.product}</th><th>{S.qty}</th><th aria-label="✓" /></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.code}><td>{i.code}</td><td>{i.nameEn}</td><td>{i.qty}</td><td className="tx-order-slip__box" /></tr>
          ))}
        </tbody>
      </table>
      {o.customerNote && <p><strong>{S.note}:</strong> {o.customerNote}</p>}
      <p className="tx-order-slip__sign">{S.packed}: ____________________ &nbsp; {S.checked}: ____________________</p>
    </div>
  );
};
