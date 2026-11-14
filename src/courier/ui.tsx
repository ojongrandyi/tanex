// Small building blocks shared by the courier screens: bottom sheet, status chip, cash fields,
// and the text of an error answer in the courier's language.
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { DispatchStatus } from '../shared/dispatchStatus';
import { useCourierText, type CourierKey, type CourierT } from './context';
import type { CashMethod } from './courierApi';

/** Error answer → sentence. Codes the app knows get its own wording; others fall back. */
export function errorText(t: CourierT, code: string | undefined, details?: Record<string, unknown>, serverMessage?: string, lang?: string): string {
  const known: Record<string, CourierKey> = {
    NETWORK: 'errors.NETWORK', INVALID_TRANSITION: 'errors.INVALID_TRANSITION', NOT_YOUR_JOB: 'errors.NOT_YOUR_JOB',
    NOT_FOUND: 'errors.NOT_FOUND', POD_REQUIRED: 'errors.POD_REQUIRED', DELIVERY_CODE_WRONG: 'errors.DELIVERY_CODE_WRONG',
    DELIVERY_CODE_LOCKED: 'errors.DELIVERY_CODE_LOCKED', NO_ACTIVE_JOB: 'errors.NO_ACTIVE_JOB', INVALID_CASH: 'errors.INVALID_CASH',
    MOMO_REFERENCE_REQUIRED: 'errors.MOMO_REFERENCE_REQUIRED', INVALID_PHOTO: 'errors.INVALID_PHOTO',
    WRONG_PASSWORD: 'errors.WRONG_PASSWORD', SAME_AS_IDENTIFIER: 'errors.SAME_AS_IDENTIFIER', NO_COURIER_PROFILE: 'app.noProfile',
  };
  const key = code ? known[code] : undefined;
  if (key) return t(key, { n: typeof details?.triesLeft === 'number' ? details.triesLeft : 0 });
  if (lang === 'en' && serverMessage) return serverMessage;
  return t('errors.SERVER_ERROR');
}

export const StatusChip: React.FC<{ status: DispatchStatus }> = ({ status }) => {
  const { t } = useCourierText();
  return <span className={`tx-cr-chip tx-cr-chip--${status.toLowerCase()}`}>{t(`statuses.${status}`)}</span>;
};

export const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  const { t } = useCourierText();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="tx-cr-sheet-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="tx-cr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tx-cr-sheet__head">
          <h2>{title}</h2>
          <button type="button" className="tx-cr-icon-btn" onClick={onClose} aria-label={t('app.close')}><X size={22} /></button>
        </div>
        <div className="tx-cr-sheet__body">{children}</div>
      </div>
    </div>
  );
};

export interface CashDraft { amount: string; method: CashMethod; reference: string }

export const CASH_METHODS: CashMethod[] = ['CASH', 'MTN_MOMO', 'ORANGE_MONEY'];

/** Amount + method + transaction ID (mobile money only). */
export const CashFields: React.FC<{ value: CashDraft; onChange: (v: CashDraft) => void; currency: string; idPrefix: string }> = ({ value, onChange, currency, idPrefix }) => {
  const { t } = useCourierText();
  return (
    <div className="tx-cr-cash-fields">
      <label className="tx-cr-field" htmlFor={`${idPrefix}-amount`}>
        <span>{t('pod.amount')} ({currency})</span>
        <input
          id={`${idPrefix}-amount`}
          inputMode="numeric"
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/[^\d.,]/g, '') })}
        />
      </label>
      <fieldset className="tx-cr-field">
        <legend>{t('pod.method')}</legend>
        <div className="tx-cr-segment">
          {CASH_METHODS.map((m) => (
            <label key={m} className={`tx-cr-segment__opt${value.method === m ? ' is-on' : ''}`}>
              <input type="radio" name={`${idPrefix}-method`} checked={value.method === m} onChange={() => onChange({ ...value, method: m })} />
              {t(`methods.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {value.method !== 'CASH' && (
        <label className="tx-cr-field" htmlFor={`${idPrefix}-ref`}>
          <span>{t('pod.reference')}</span>
          <input id={`${idPrefix}-ref`} value={value.reference} autoComplete="off" onChange={(e) => onChange({ ...value, reference: e.target.value })} />
        </label>
      )}
    </div>
  );
};

/** Parsed amount (XAF has no decimals; a comma is read as a decimal point), or null when empty/invalid. */
export function parseAmount(s: string): number | null {
  const v = s.trim().replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
