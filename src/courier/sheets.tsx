// The forms that finish a step: payment at pickup, proof of delivery and "couldn't deliver"
// (DISPATCH_SPEC §4, §6; CONTENT §10.3). They only collect and check input; the app shell saves
// the step on the phone and syncs it.
import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { FAILURE_REASONS, type FailureReason } from '../shared/dispatchStatus';
import { compressImage } from '../services/imageCompress';
import { useCourierText } from './context';
import type { CashInput, CourierJob } from './courierApi';
import { deliveryCollect, pickupCollect } from './jobLogic';
import { SignaturePad } from './SignaturePad';
import { CashFields, Sheet, parseAmount, type CashDraft } from './ui';

export type CourierStep =
  | { action: 'accept' | 'decline' | 'start_delivery' }
  | { action: 'pick_up'; cash?: CashInput[] }
  | {
    action: 'deliver'; recipientName: string; deliveryCode?: string; cash?: CashInput[]; note?: string;
    photo: Blob | null; signature: Blob | null;
  }
  | { action: 'fail'; failureReason: FailureReason; note?: string };

const draftFor = (amount: number): CashDraft => ({ amount: amount > 0 ? String(amount) : '', method: 'CASH', reference: '' });

/** Draft → entry to send; null when nothing collected; a string when something is missing. */
function readCash(d: CashDraft): CashInput | null | 'amount' | 'reference' {
  const amount = parseAmount(d.amount);
  if (d.amount.trim() && amount === null) return 'amount';
  if (!amount) return null;
  if (d.method !== 'CASH' && !d.reference.trim()) return 'reference';
  return { amount, method: d.method, ...(d.method !== 'CASH' ? { momoReference: d.reference.trim() } : {}) };
}

// ---- Pickup with payment ----

export const PickupSheet: React.FC<{ job: CourierJob; onClose: () => void; onSubmit: (s: CourierStep) => void }> = ({ job, onClose, onSubmit }) => {
  const { t } = useCourierText();
  const [cash, setCash] = useState<CashDraft>(() => draftFor(pickupCollect(job)));
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = readCash(cash);
    if (c === 'amount') return setError(t('pod.needAmount'));
    if (c === 'reference') return setError(t('pod.needReference'));
    onSubmit({ action: 'pick_up', ...(c ? { cash: [c] } : {}) });
  };
  return (
    <Sheet title={t('pickupCash.title')} onClose={onClose}>
      <form onSubmit={submit} className="tx-cr-form" noValidate>
        <p className="tx-cr-note">{t('pickupCash.intro')}</p>
        <CashFields value={cash} onChange={setCash} currency={job.currency} idPrefix="pickup-cash" />
        {error && <p className="tx-cr-error" role="alert">{error}</p>}
        <button type="submit" className="tx-cr-btn tx-cr-btn--primary tx-cr-btn--block">{t('pickupCash.confirm')}</button>
      </form>
    </Sheet>
  );
};

// ---- Proof of delivery ----

export const PodSheet: React.FC<{ job: CourierJob; onClose: () => void; onSubmit: (s: CourierStep) => void }> = ({ job, onClose, onSubmit }) => {
  const { t, money } = useCourierText();
  const due = deliveryCollect(job);
  const [name, setName] = useState(job.pod.recipientName ?? '');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [code, setCode] = useState('');
  const [cash, setCash] = useState<CashDraft>(() => draftFor(due.total));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasPhotoOnFile = !!job.pod.photoUrl;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPreparing(true);
    setError(null);
    try {
      // Resized to 1600 px and re-encoded in the browser (EXIF and GPS dropped) before saving.
      const c = await compressImage(file);
      const bytes = Uint8Array.from(atob(c.base64), (ch) => ch.charCodeAt(0));
      const blob = new Blob([bytes], { type: c.mimeType });
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError(t('errors.INVALID_PHOTO'));
    } finally {
      setPreparing(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t('pod.needName'));
    if (!photo && !hasPhotoOnFile) return setError(t('pod.needPhoto'));
    if (job.hasDeliveryCode && !/^\d{4}$/.test(code.trim())) return setError(t('pod.needCode'));
    const c = readCash(cash);
    if (c === 'amount') return setError(t('pod.needAmount'));
    if (c === 'reference') return setError(t('pod.needReference'));
    onSubmit({
      action: 'deliver',
      recipientName: name.trim(),
      ...(job.hasDeliveryCode ? { deliveryCode: code.trim() } : {}),
      ...(c ? { cash: [c] } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      photo,
      signature,
    });
  };

  return (
    <Sheet title={t('pod.title')} onClose={onClose}>
      <form onSubmit={submit} className="tx-cr-form" noValidate>
        <label className="tx-cr-field" htmlFor="pod-name">
          <span>{t('pod.recipientName')}</span>
          <input id="pod-name" value={name} autoComplete="off" autoCapitalize="words" onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="tx-cr-field">
          <span>{t('pod.photo')}</span>
          {preview ? <img className="tx-cr-photo" src={preview} alt="" width={320} height={240} />
            : hasPhotoOnFile ? <p className="tx-cr-note">{t('pod.photoOnFile')}</p> : null}
          <label className="tx-cr-btn tx-cr-btn--secondary tx-cr-btn--block tx-cr-file">
            <Camera size={22} aria-hidden="true" />
            {preparing ? t('pod.photoPreparing') : photo || hasPhotoOnFile ? t('pod.retake') : t('pod.takePhoto')}
            <input type="file" accept="image/*" capture="environment" onChange={pick} disabled={preparing} />
          </label>
        </div>

        <div className="tx-cr-field">
          <span>{t('pod.signature')}</span>
          <SignaturePad label={t('pod.signHere')} clearLabel={t('pod.clearSignature')} onChange={setSignature} />
        </div>

        {job.hasDeliveryCode && (
          <label className="tx-cr-field" htmlFor="pod-code">
            <span>{t('pod.deliveryCode')}</span>
            <input
              id="pod-code" className="tx-cr-code" inputMode="numeric" autoComplete="one-time-code" maxLength={4}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <small>{t('pod.codeHint')}{job.deliveryCodeTriesLeft !== null ? ` · ${t('pod.triesLeft', { n: job.deliveryCodeTriesLeft })}` : ''}</small>
          </label>
        )}

        <fieldset className="tx-cr-field tx-cr-box">
          <legend>{t('pod.cashCollected')}</legend>
          {due.total > 0
            ? <p className="tx-cr-note"><strong>{t('job.cashToCollect', { amount: money(due.total, job.currency) })}</strong></p>
            : <p className="tx-cr-note">{t('pod.noCash')}</p>}
          <CashFields value={cash} onChange={setCash} currency={job.currency} idPrefix="pod-cash" />
        </fieldset>

        <label className="tx-cr-field" htmlFor="pod-note">
          <span>{t('pod.note')}</span>
          <textarea id="pod-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p className="tx-cr-error" role="alert">{error}</p>}
        <button type="submit" className="tx-cr-btn tx-cr-btn--primary tx-cr-btn--block" disabled={preparing}>{t('pod.confirm')}</button>
      </form>
    </Sheet>
  );
};

// ---- Couldn't deliver ----

export const FailSheet: React.FC<{ onClose: () => void; onSubmit: (s: CourierStep) => void }> = ({ onClose, onSubmit }) => {
  const { t } = useCourierText();
  const [reason, setReason] = useState<FailureReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return setError(t('fail.needReason'));
    if (reason === 'OTHER' && !note.trim()) return setError(t('fail.needNote'));
    onSubmit({ action: 'fail', failureReason: reason, ...(note.trim() ? { note: note.trim() } : {}) });
  };
  return (
    <Sheet title={t('fail.title')} onClose={onClose}>
      <form onSubmit={submit} className="tx-cr-form" noValidate>
        <fieldset className="tx-cr-field">
          <legend>{t('fail.reason')}</legend>
          <div className="tx-cr-options">
            {FAILURE_REASONS.map((r) => (
              <label key={r} className={`tx-cr-option${reason === r ? ' is-on' : ''}`}>
                <input type="radio" name="fail-reason" checked={reason === r} onChange={() => setReason(r)} />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="tx-cr-field" htmlFor="fail-note">
          <span>{reason === 'OTHER' ? t('fail.noteRequired') : t('fail.note')}</span>
          <textarea id="fail-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="tx-cr-error" role="alert">{error}</p>}
        <button type="submit" className="tx-cr-btn tx-cr-btn--danger tx-cr-btn--block">{t('fail.confirm')}</button>
      </form>
    </Sheet>
  );
};
