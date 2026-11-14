// Cash (DISPATCH_SPEC §6 screen 4, §9): balance by currency (collected − confirmed handovers),
// handovers waiting for Finance, recent entries, and "Record handover", saved on the phone and
// synced like the job steps.
import React, { useState } from 'react';
import { useCourierText } from './context';
import type { CashState } from './courierApi';
import type { QueueItem } from './offlineQueue';
import { Sheet, parseAmount } from './ui';

export const CashScreen: React.FC<{
  cash: CashState | null;
  error: boolean;
  queued: QueueItem[];
  onHandover: (amount: number, currency: string, note: string) => void;
}> = ({ cash, error, queued, onHandover }) => {
  const { t, money, dateTime } = useCourierText();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const balances = cash?.balances.length ? cash.balances : [{ currency: 'XAF', collected: 0, handedOver: 0, pendingHandover: 0, balance: 0 }];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseAmount(amount);
    if (!n || n <= 0) return setFormError(t('cash.needAmount'));
    onHandover(n, 'XAF', note.trim());
    setOpen(false);
    setAmount('');
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
                    <strong>{typeText(e.type)}{e.method !== 'CASH' ? ` · ${t(`methods.${e.method as 'CASH'}`)}` : ''}</strong>
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
            <label className="tx-cr-field" htmlFor="handover-amount">
              <span>{t('cash.amount')} (XAF)</span>
              <input id="handover-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
            </label>
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
