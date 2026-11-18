import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink, Info, QrCode } from 'lucide-react';
import type { CustomerMethodView } from '../shared/paymentMethods';
import { PaymentIcon } from './PaymentIcon';
import { PaymentQr } from './PaymentQr';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { paymentTerm } from '../i18n/paymentTerms';
import './PaymentMethodCard.css';

interface PaymentMethodCardProps {
  view: CustomerMethodView;
  instructions?: string | null;
  /** Accordion mode (track page on mobile): the name becomes a button that shows or hides the details. */
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** When set, copy results go here (the track page's toast) instead of the card's own announcement. */
  onCopyMessage?: (message: string) => void;
}

/**
 * What the customer sees for one payment account (CONTENT.md §6.7): icon and name, each detail
 * with a Copy button, the method's link button, network warning and note, and the admin's
 * instructions, and a QR code on request. Used by the admin live previews and the track page payment section.
 */
export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  view, instructions, collapsible = false, expanded = true, onToggle, onCopyMessage,
}) => {
  const t = useAreaT('payment');
  const locale = useLocale();
  const term = (text: string) => paymentTerm(text, locale);
  const [copied, setCopied] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [showQr, setShowQr] = useState(false);
  const timer = useRef<number>();
  const bodyId = useId();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const announce = (message: string) => (onCopyMessage ? onCopyMessage(message) : setAnnouncement(message));

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      announce(t('card.copiedField', { field: term(label) }));
    } catch {
      announce(t('card.copyFailed', { field: term(label) }));
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2000);
  };

  const headContent = (
    <>
      <span className="tx-pm-card-icon"><PaymentIcon type={view.type} size={22} /></span>
      <strong className="tx-pm-card-name">{term(view.label)}</strong>
    </>
  );
  const open = !collapsible || expanded;

  return (
    <div className={`tx-pm-card${collapsible ? ' is-collapsible' : ''}${open ? ' is-open' : ''}`}>
      {collapsible ? (
        <h4 className="tx-pm-card-heading">
          <button
            type="button"
            className="tx-pm-card-head tx-pm-card-toggle"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={onToggle}
          >
            {headContent}
            <span className="tx-sr-only">{expanded ? t('card.hideDetails') : t('card.showDetails')}</span>
            <ChevronDown className="tx-pm-card-chevron" size={18} aria-hidden="true" />
          </button>
        </h4>
      ) : (
        <div className="tx-pm-card-head">{headContent}</div>
      )}

      <div id={bodyId} className="tx-pm-card-body" hidden={!open}>
        {view.warning && (
          <p className="tx-pm-card-warning">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{term(view.warning)}</span>
          </p>
        )}

        {view.fields.length > 0 && (
          <dl className="tx-pm-card-fields">
            {view.fields.map((field) => (
              <div className="tx-pm-card-field" key={field.label}>
                <dt>{term(field.label)}</dt>
                <dd>
                  <span className="tx-pm-card-value">{field.value}</span>
                  {field.copyable && (
                    <button
                      type="button"
                      className={`tx-pm-copy${copied === field.label ? ' is-copied' : ''}`}
                      onClick={() => copy(field.label, field.value)}
                      aria-label={t('card.copyField', { field: term(field.label) })}
                    >
                      {copied === field.label ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      <span>{copied === field.label ? t('card.copied') : t('card.copy')}</span>
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {view.link && (
          <a className="tx-pm-card-link" href={view.link.url} target="_blank" rel="noopener noreferrer">
            <span>{term(view.link.label)}</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}

        {view.note && (
          <p className="tx-pm-card-note">
            <Info size={15} aria-hidden="true" />
            <span>{term(view.note)}</span>
          </p>
        )}

        {view.qr && (
          <div className="tx-pm-card-qr">
            <button
              type="button"
              className="tx-pm-qr-toggle"
              aria-expanded={showQr}
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCode size={15} aria-hidden="true" />
              <span>{showQr ? t('card.hideQr') : t('card.showQr')}</span>
            </button>
            {showQr && <PaymentQr value={view.qr} methodLabel={term(view.label)} alt={t('card.qrAlt', { method: term(view.label) })} caption={t('card.qrCaption')} />}
          </div>
        )}

        {instructions && <p className="tx-pm-card-instructions">{instructions}</p>}
      </div>

      {!onCopyMessage && <span className="tx-sr-only" role="status" aria-live="polite">{announcement}</span>}
    </div>
  );
};
