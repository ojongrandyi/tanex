import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import type { PublicPayment } from '../shared/paymentRequest';
import { validateProofSubmission } from '../shared/paymentProof';
import { compressImage } from '../services/imageCompress';
import { api } from '../services/api';
import { useApiErrorText, useAreaT, useLocale } from '../i18n/I18nProvider';
import { paymentTerm } from '../i18n/paymentTerms';

interface PaymentProofFormProps {
  trackingNumber: string;
  payment: PublicPayment;
  /** Called with the submission time once the server has accepted the proof. */
  onSent: (submittedAt: string) => void;
  /** Inside the "Send proof of payment" tab (I.3): the tab shows the title, so no heading or card frame here. */
  embedded?: boolean;
}


// Same check as the compressor: some browsers give HEIC photos an empty type.
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

type Field = 'methodId' | 'payerName' | 'amountSent' | 'reference' | 'image';
const FIELD_ORDER: Field[] = ['methodId', 'payerName', 'amountSent', 'reference', 'image'];

/**
 * "Send proof of payment" form (docs/update.md F.3): the account used (this shipment's accounts
 * only), payer name, amount sent, optional reference and a screenshot that is compressed and
 * stripped of EXIF data in the browser before upload, with a preview.
 */
export const PaymentProofForm: React.FC<PaymentProofFormProps> = ({ trackingNumber, payment, onSent, embedded = false }) => {
  // API errors in the page language (codes, I18N_SPEC §5); English keeps the server text.
  const apiErrorText = useApiErrorText();
  const t = useAreaT('payment');
  const locale = useLocale();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [methodId, setMethodId] = useState(payment.methods.length === 1 ? payment.methods[0].id : '');
  const [payerName, setPayerName] = useState('');
  const [amountSent, setAmountSent] = useState(String(payment.amount));
  const [reference, setReference] = useState('');
  const [image, setImage] = useState<{ dataUrl: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');

  const fieldId = (f: Field) => `${id}-${f}`;
  // Editing a field clears its own error; the rest stay until the next submit.
  const edit = (f: Field, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    if (errors[f]) setErrors((prev) => ({ ...prev, [f]: undefined }));
  };
  const errorId = (f: Field) => `${id}-${f}-error`;

  const focusFirstError = (errs: Partial<Record<Field, string>>) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    const target = first === 'image' ? document.getElementById(`${id}-image-button`) : document.getElementById(fieldId(first));
    target?.focus();
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setErrors((e) => ({ ...e, image: undefined }));
    if (!file.type.startsWith('image/') && !IMAGE_FILE.test(file.name)) {
      setErrors((e) => ({ ...e, image: t('proof.notImage') }));
      return;
    }
    setPreparing(true);
    try {
      const compressed = await compressImage(file);
      setImage({ dataUrl: `data:${compressed.mimeType};base64,${compressed.base64}` });
    } catch {
      setImage(null);
      setErrors((e) => ({ ...e, image: t('proof.unreadable') }));
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || preparing) return;
    setFormError('');
    const body = { methodId, payerName, amountSent, reference };
    const checked = validateProofSubmission(body, payment.methods.map((m) => m.id));
    const errs: Partial<Record<Field, string>> = checked.ok ? {} : { ...checked.errors };
    if (!image) errs.image = t('proof.noImage');
    setErrors(errs);
    if (!checked.ok || !image) {
      focusFirstError(errs);
      return;
    }

    setSending(true);
    try {
      const result = await api.submitPaymentProof(trackingNumber, { ...checked.value, reference: checked.value.reference ?? undefined, image: image.dataUrl });
      onSent(result.submittedAt);
    } catch (err: any) {
      if (err?.fieldErrors) {
        setErrors(err.fieldErrors);
        focusFirstError(err.fieldErrors);
      } else if (err?.status === 409 || err?.status === 429) {
        // The server's own text: no longer awaiting, too many open proofs, or too many attempts.
        setFormError(apiErrorText(err));
      } else {
        setFormError(t('proof.network'));
      }
    } finally {
      setSending(false);
    }
  };

  const describedBy = (f: Field, hint?: string) => [hint, errors[f] ? errorId(f) : null].filter(Boolean).join(' ') || undefined;
  const errorText = (f: Field) => errors[f] && <p id={errorId(f)} className="ngf-proof-error">{paymentTerm(errors[f]!, locale)}</p>;

  return (
    <form
      className={`ngf-proof-form${embedded ? ' is-embedded' : ''}`}
      onSubmit={submit}
      noValidate
      {...(embedded ? { 'aria-label': t('section.sendProof') } : { 'aria-labelledby': `${id}-title` })}
    >
      {!embedded && <h4 id={`${id}-title`} className="ngf-pay-methods-title">{t('section.sendProof')}</h4>}
      <p className="ngf-pay-methods-sub">{t('proof.intro')}</p>

      <div className="ngf-proof-grid">
        <div className="ngf-proof-field">
          <label htmlFor={fieldId('methodId')}>{t('proof.account')}</label>
          <select
            id={fieldId('methodId')}
            value={methodId}
            onChange={edit('methodId', setMethodId)}
            aria-invalid={!!errors.methodId}
            aria-describedby={describedBy('methodId')}
          >
            <option value="">{t('proof.chooseAccount')}</option>
            {payment.methods.filter((m) => m.type !== 'cash_on_delivery').map((m) => <option key={m.id} value={m.id}>{paymentTerm(m.label, locale)}</option>)}
          </select>
          {errorText('methodId')}
        </div>

        <div className="ngf-proof-field">
          <label htmlFor={fieldId('payerName')}>{t('proof.name')}</label>
          <input
            id={fieldId('payerName')}
            type="text"
            autoComplete="name"
            maxLength={100}
            value={payerName}
            onChange={edit('payerName', setPayerName)}
            aria-invalid={!!errors.payerName}
            aria-describedby={describedBy('payerName', `${id}-payerName-hint`)}
          />
          <p id={`${id}-payerName-hint`} className="ngf-proof-hint">{t('proof.nameHint')}</p>
          {errorText('payerName')}
        </div>

        <div className="ngf-proof-field">
          <label htmlFor={fieldId('amountSent')}>{t('proof.amount')}</label>
          <div className="ngf-proof-amount">
            <input
              id={fieldId('amountSent')}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountSent}
              onChange={edit('amountSent', setAmountSent)}
              aria-invalid={!!errors.amountSent}
              aria-describedby={describedBy('amountSent')}
            />
            <span aria-hidden="true">{payment.currency}</span>
          </div>
          {errorText('amountSent')}
        </div>

        <div className="ngf-proof-field">
          <label htmlFor={fieldId('reference')}>{t('proof.reference')}</label>
          <input
            id={fieldId('reference')}
            type="text"
            maxLength={120}
            value={reference}
            onChange={edit('reference', setReference)}
            aria-invalid={!!errors.reference}
            aria-describedby={describedBy('reference', `${id}-reference-hint`)}
          />
          <p id={`${id}-reference-hint`} className="ngf-proof-hint">{t('proof.referenceHint')}</p>
          {errorText('reference')}
        </div>
      </div>

      <div className="ngf-proof-field ngf-proof-image">
        <span className="ngf-proof-label" id={`${id}-image-label`}>{t('proof.image')}</span>
        <p id={`${id}-image-hint`} className="ngf-proof-hint">{t('proof.imageHint')}</p>
        <input
          ref={fileInput}
          id={fieldId('image')}
          type="file"
          accept="image/*,.heic,.heif"
          className="ngf-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
        {image && <img className="ngf-proof-preview" src={image.dataUrl} alt={t('proof.imageAlt')} />}
        <div className="ngf-proof-image-actions">
          <button
            id={`${id}-image-button`}
            type="button"
            className="ngf-proof-secondary"
            onClick={() => fileInput.current?.click()}
            disabled={preparing}
            aria-describedby={describedBy('image', `${id}-image-label ${id}-image-hint`)}
          >
            {preparing ? <Loader2 size={15} className="ngf-proof-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
            <span>{image ? t('proof.change') : t('proof.choose')}</span>
          </button>
          {image && (
            <button type="button" className="ngf-proof-link" onClick={() => setImage(null)}>{t('proof.remove')}</button>
          )}
        </div>
        {errorText('image')}
      </div>

      {formError && <p className="ngf-proof-form-error" role="alert">{formError}</p>}

      <button type="submit" className="ngf-btn-primary ngf-proof-submit" disabled={sending || preparing}>
        {sending && <Loader2 size={16} className="ngf-proof-spin" aria-hidden="true" />}
        <span>{sending ? t('proof.sending') : t('proof.send')}</span>
      </button>
    </form>
  );
};
