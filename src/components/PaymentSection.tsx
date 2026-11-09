import React, { useEffect, useId, useRef, useState } from 'react';
import type { PaymentStatus, PublicPayment } from '../shared/paymentRequest';
import { formatPaymentAmount, paymentStatusLabel } from '../shared/paymentRequest';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { paymentTerm } from '../i18n/paymentTerms';
import { AlertCircle, CheckCircle2, ChevronDown, Clock, Upload, Wallet } from 'lucide-react';
import { PaymentMethodCard } from './PaymentMethodCard';
import { PaymentProofForm } from './PaymentProofForm';
import './PaymentSection.css';

interface PaymentSectionProps {
  trackingNumber: string;
  payment: PublicPayment;
}

// Status badge tone; the text is the shared status name in the page language (CONTENT §6.8).
const STATUS_BADGES: Record<PaymentStatus, { tone: string }> = {
  AWAITING_PAYMENT: { tone: 'awaiting' },
  UNDER_REVIEW: { tone: 'review' },
  PAID: { tone: 'paid' },
  CANCELLED: { tone: 'cancelled' },
};

/** Due dates are stored as YYYY-MM-DD; read them as calendar dates so no time zone shifts the day. */
function formatDueDate(value: string, lang?: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
}

function formatPaidDate(value: string | null, lang?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

/** "Oct 10, 2026" and "3:04 PM" in the visitor's own locale and time zone. */
function formatSubmitted(value: string, lang?: string): { date: string; time: string } | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat(lang, { timeStyle: 'short' }).format(d),
  };
}

interface PaymentTabProps {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Full-width tab that opens its panel underneath (update I.2, I.3). Closed until the customer opens it. */
const PaymentTab: React.FC<PaymentTabProps> = ({ icon, title, sub, open, onToggle, children }) => {
  const panelId = useId();
  return (
    <div className={`ngf-pay-tab${open ? ' is-open' : ''}`}>
      <button type="button" className="ngf-pay-tab-btn" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="ngf-pay-tab-icon" aria-hidden="true">{icon}</span>
        <span className="ngf-pay-tab-text">
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </span>
        <ChevronDown size={18} className="ngf-pay-tab-chevron" aria-hidden="true" />
      </button>
      <div id={panelId} className="ngf-pay-tab-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
};

// Below this width the accounts are an accordion (one open at a time); above it, a grid.
const NARROW_QUERY = '(max-width: 767px)';
const TOAST_MS = 2000;

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

/**
 * Track Result "Payment" section (CONTENT.md §6.8): what is due, what it is for, its status,
 * and this shipment's payment accounts with copy buttons and QR codes.
 */
export const PaymentSection: React.FC<PaymentSectionProps> = ({ trackingNumber, payment }) => {
  // Set when this visitor's proof was accepted; the request counts as under review until the
  // next track refresh brings the server's own status.
  const [sentAt, setSentAt] = useState<string | null>(null);
  const status: PaymentStatus = sentAt && payment.status === 'AWAITING_PAYMENT' ? 'UNDER_REVIEW' : payment.status;
  const badgeStatus: PaymentStatus = STATUS_BADGES[status] ? status : 'AWAITING_PAYMENT';
  const locale = useLocale();
  const t = useAreaT('payment');
  const lang = locale === 'fr' ? 'fr-CM' : 'en-US';
  const badge = { tone: STATUS_BADGES[badgeStatus].tone, label: paymentStatusLabel(badgeStatus, locale) };
  const narrow = useIsNarrow();
  const [openId, setOpenId] = useState<string | null>(payment.methods[0]?.id ?? null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // Once paid, the accounts are collapsed behind a toggle (E.4).
  const isPaid = payment.status === 'PAID';
  // The accounts and the proof form each sit behind a tab, closed until opened (I.2, I.3).
  const [showMethods, setShowMethods] = useState(false);
  const [showProofForm, setShowProofForm] = useState(false);

  const showToast = (message: string) => {
    // Clear first so the same message is announced again on a second copy.
    setToast('');
    window.clearTimeout(toastTimer.current);
    requestAnimationFrame(() => setToast(message));
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  };

  // A cancelled request is not shown to the customer (the track page doesn't render this either).
  if (payment.status === 'CANCELLED') return null;

  const paidDate = formatPaidDate(payment.paidAt, lang);
  // Proof states from the server (F.4); this visitor's own just-sent proof shows the thank-you line instead.
  const latest = payment.proof;
  const underReview = !sentAt && status === 'UNDER_REVIEW';
  const submitted = underReview && latest?.status === 'SUBMITTED' ? formatSubmitted(latest.submittedAt, lang) : null;
  const rejected = !sentAt && status === 'AWAITING_PAYMENT' && latest?.status === 'REJECTED' ? latest : null;
  const count = payment.methods.length;
  // Cash on delivery is paid to the rider: no proof to upload for it.
  const proofAccounts = payment.methods.filter((m) => m.type !== 'cash_on_delivery').length;

  return (
    <section className="ngf-pay-section" aria-labelledby="track-payment-title">
      <div className="ngf-pay-summary">
        <div className="ngf-pay-summary-head">
          <h3 id="track-payment-title" className="card-section-title ngf-pay-title">{t('section.title')}</h3>
          <span className={`ngf-pay-badge is-${badge.tone}`}>{badge.label}</span>
        </div>

        {status === 'AWAITING_PAYMENT' && (
          <p className="ngf-pay-intro">
            {t('section.intro')}
          </p>
        )}

        {isPaid && (
          <div className="ngf-pay-received">
            <CheckCircle2 size={20} aria-hidden="true" />
            <div>
              <strong>{t('section.received')}</strong>
              <p>{paidDate ? t('section.receivedOn', { date: paidDate }) : t('section.receivedNoDate')}</p>
            </div>
          </div>
        )}

        <dl className="ngf-pay-facts">
          <div className="ngf-pay-fact ngf-pay-fact-amount">
            <dt>{t('section.amountDue')}</dt>
            <dd className="ngf-pay-amount">{formatPaymentAmount(payment.amount, payment.currency, lang)}</dd>
          </div>
          <div className="ngf-pay-fact">
            <dt>{t('section.for')}</dt>
            <dd>{payment.chargeReason}</dd>
          </div>
          {payment.dueDate && (
            <div className="ngf-pay-fact">
              <dt>{t('section.dueBy')}</dt>
              <dd>{formatDueDate(payment.dueDate, lang)}</dd>
            </div>
          )}
        </dl>

        {payment.customerNote && (
          <div className="ngf-pay-note">
            <strong>{t('section.note')}</strong>
            <p>{payment.customerNote}</p>
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="ngf-pay-methods">
          <PaymentTab
            icon={<Wallet size={18} />}
            title={isPaid ? (showMethods ? t('section.hideAccounts') : t('section.showAccounts')) : t('section.howToPay')}
            sub={isPaid ? undefined : count === 1 ? t('section.oneOption') : t('section.options', { n: count })}
            open={showMethods}
            onToggle={() => setShowMethods((v) => !v)}
          >
            {!isPaid && <p className="ngf-pay-methods-sub">{t('section.chooseOne')}</p>}
            <ul className={`ngf-pay-methods-list${narrow ? ' is-accordion' : ''}`}>
              {payment.methods.map((method) => (
                <li key={method.id}>
                  <PaymentMethodCard
                    view={method}
                    instructions={method.instructions}
                    collapsible={narrow}
                    expanded={openId === method.id}
                    onToggle={() => setOpenId((current) => (current === method.id ? null : method.id))}
                    onCopyMessage={showToast}
                  />
                </li>
              ))}
            </ul>
          </PaymentTab>
        </div>
      )}

      {underReview && (
        <div className="ngf-proof-state is-review">
          <Clock size={18} aria-hidden="true" />
          <div>
            <strong>{t('section.underReview')}</strong>
            {submitted && <p>{t('section.receivedProof', { date: submitted.date, time: submitted.time })}</p>}
          </div>
        </div>
      )}

      {rejected && (
        <div className="ngf-proof-state is-rejected">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>{rejected.rejectionReason ? t('section.rejectedReason', { reason: rejected.rejectionReason }) : t('section.rejected')}</strong>
            <p>{t('section.rejectedHelp')}</p>
          </div>
        </div>
      )}

      {sentAt && (
        <p className="ngf-proof-sent" role="status">
          {t('section.sent')}
        </p>
      )}

      {status === 'AWAITING_PAYMENT' && proofAccounts > 0 && (
        <div className="ngf-pay-proof">
          <PaymentTab
            icon={<Upload size={18} />}
            title={t('section.sendProof')}
            sub={t('section.sendProofSub')}
            open={showProofForm}
            onToggle={() => setShowProofForm((v) => !v)}
          >
            <PaymentProofForm trackingNumber={trackingNumber} payment={payment} onSent={setSentAt} embedded />
          </PaymentTab>
        </div>
      )}

      <div className={`ngf-pay-toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </section>
  );
};
