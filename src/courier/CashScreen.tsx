// Cash (DISPATCH_SPEC §6 screen 4, §9): balance by currency (collected − confirmed handovers),
// handovers waiting for Finance, recent entries, and "Record handover", saved on the phone and
// synced like the job steps.
import React, { useState } from 'react';
import { useCourierText } from './context';
import type { CashMethod, CashState } from './courierApi';
import type { QueueItem } from './offlineQueue';
import { CashFields, Sheet, parseAmount, type CashDraft } from './ui';
import { HANDOVER_DEADLINE_DAYS } from '../shared/cashHandover';

const EMPTY: CashDraft = { amount: '', method: 'CASH', reference: '' };

export const CashScreen: React.FC<{
  cash: CashState | null;
  error: boolean;
  queued: QueueItem[];
  onHandover: (amount: number, currency: string, method: CashMethod, momoReference: string | null, note: string) => void;
}> = ({ cash, error, queued, onHandover }) => {
  const { t, money, dateTime, date } = useCourierText();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CashDraft>(EMPTY);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const balances = cash?.balances.length ? cash.balances
    : [{ currency: 'XAF', collected: 0, handedOver: 0, pendingHandover: 0, balance: 0, outstanding: 0, dueBy: null, overdue: false }];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseAmount(draft.amount);
    if (!n || n <= 0) return setFormError(t('cash.needAmount'));
    if (draft.method !== 'CASH' && !draft.reference.trim()) return setFormError(t('pod.needReference'));
    onHandover(n, 'XAF', draft.method, draft.method === 'CASH' ? null : draft.reference.trim(), note.trim());
    setOpen(false);
    setDraft(EMPTY);
    setNote('');
    setFormError(null);
  };

  const statusText = (s: string) => (s === 'CONFIRMED' ? t('cash.confirmed') : s === 'REJECTED' ? t('cash.rejected') : t('cash.waiting'));
  const typeText = (s: string) => (s === 'HANDOVER' ? t('cash.typeHandover') : s === 'ADJUSTMENT' ? t('cash.typeAdjustment') : t('cash.typeCollected'));

  return (
    <section className="tx-cr-screen" aria-labelledby="cr-cash">
      <h1 id="cr-cash" className="tx-cr-h1">{t('cash.title')}</h1>
      {error && !cash && <p className="tx-cr-note">{t('cash.unavailableOffline')}</p>}
      {cash && balances.map((b) => (
        <div key={b.currency} className="tx-cr-balance">
          <span className="tx-cr-balance__label">{t('cash.balance')}</span>
          <strong className="tx-cr-balance__value">{money(b.balance, b.currency)}</strong>
          <dl className="tx-cr-balance__rows">
            <div><dt>{t('cash.collected')}</dt><dd>{money(b.collected, b.currency)}</dd></div>
            <div><dt>{t('cash.handedOver')}</dt><dd>{money(b.handedOver, b.currency)}</dd></div>
          </dl>
          {b.dueBy !== null && b.outstanding > 0 && (
            <p className={b.overdue ? 'tx-cr-due tx-cr-due--late' : 'tx-cr-due'} role={b.overdue ? 'alert' : undefined}>
              {b.overdue
                ? t('cash.overdue', { amount: money(b.outstanding, b.currency), date: date(b.dueBy) })
                : t('cash.dueBy', { amount: money(b.outstanding, b.currency), date: date(b.dueBy) })}
            </p>
          )}
          {b.pendingHandover > 0 && <p className="tx-cr-pending">{t('cash.pendingHandover', { amount: money(b.pendingHandover, b.currency) })}</p>}
        </div>
      ))}
      {queued.map((q) => (
        <p key={q.key} className="tx-cr-pending" role="status">
          {t('cash.typeHandover')} · {money(Number(q.body?.amount) || 0, String(q.body?.currency ?? 'XAF'))} · {t('sync.pending')}
        </p>
      ))}
      <button type="button" className="tx-cr-btn tx-cr-btn--primary tx-cr-btn--block tx-cr-btn--large" onClick={() => setOpen(true)}>{t('cash.recordHandover')}</button>

      {cash && (
        <>
          <h2 className="tx-cr-h2">{t('cash.entries')}</h2>
          {cash.entries.length === 0 ? <p className="tx-cr-empty">{t('cash.none')}</p> : (
            <ul className="tx-cr-entries">
              {cash.entries.map((e) => (
                <li key={e.id} className={`tx-cr-entry tx-cr-entry--${e.type.toLowerCase()}`}>
                  <div>
                    <strong>{typeText(e.type)}{e.method !== 'CASH' ? ` · ${t(`methods.${e.method as CashMethod}`)}` : ''}</strong>
                    {e.momoReference && <span className="tx-cr-muted">{t('cash.referenceLine', { ref: e.momoReference })}</span>}
                    <span className="tx-cr-muted">{dateTime(e.createdAt)}{e.trackingNumber ? ` · ${e.trackingNumber}` : ''} · {e.ref}</span>
                  </div>
                  <div className="tx-cr-entry__right">
                    <strong>{e.type === 'HANDOVER' ? '−' : ''}{money(e.amount, e.currency)}</strong>
                    <span className={`tx-cr-entry__status is-${e.status.toLowerCase()}`}>{statusText(e.status)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {open && (
        <Sheet title={t('cash.recordHandover')} onClose={() => setOpen(false)}>
          <form className="tx-cr-form" onSubmit={submit} noValidate>
            <p className="tx-cr-note">{t('cash.handoverIntro')}</p>
            <p className="tx-cr-muted">{t('cash.deadlineRule', { n: HANDOVER_DEADLINE_DAYS })}</p>
            <CashFields value={draft} onChange={setDraft} currency="XAF" idPrefix="handover" />
            <label className="tx-cr-field" htmlFor="handover-note">
              <span>{t('cash.note')}</span>
              <textarea id="handover-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {formError && <p className="tx-cr-error" role="alert">{formError}</p>}
            <button type="submit" className="tx-cr-btn tx-cr-btn--primary tx-cr-btn--block">{t('cash.send')}</button>
          </form>
        </Sheet>
      )}
    </section>
  );
};
