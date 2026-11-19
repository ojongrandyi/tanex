// Shop settings (docs/SHOP_SPEC.md §7.7, shop.settings): shop on/off, order email, ship-from
// point, pickup offices, payment methods, low-stock level, most per order, test email. The server
// checks everything again (server/shop/orderAdmin.ts saveSettings).
import React, { useEffect, useState } from 'react';
import type { ShopSettings } from '../../shared/shopSettings';
import type { ShopPaymentMethod } from '../../shared/shopOrderStatus';
import { shopOrdersApi, type ShopSettingsView } from './shopApi';
import { ORDER_TEXT } from './orderStrings';

const S = ORDER_TEXT.settings;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const ShopSettingsPanel: React.FC = () => {
  const [view, setView] = useState<ShopSettingsView | null>(null);
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    shopOrdersApi.getSettings().then((v) => { setView(v); setForm(v.settings); }).catch((e) => setError(errText(e)));
  }, []);

  if (!view || !form) return error ? <div className="tx-iam-notice error" role="alert">{error}</div> : <p className="tx-iam-muted" role="status">{ORDER_TEXT.list.loading}</p>;

  const set = <K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) => { setForm({ ...form, [k]: v }); setNotice(null); };
  const setShip = (patch: Partial<ShopSettings['shipFrom']>) => set('shipFrom', { ...form.shipFrom, ...patch });
  const toggle = <T extends string>(list: T[], item: T, on: boolean): T[] => (on ? [...new Set([...list, item])] : list.filter((x) => x !== item));
  const zones = view.zones.filter((z) => z.cityId === form.shipFrom.cityId);
  const cls = (name: string) => `tx-iam-field${field === name ? ' has-error' : ''}`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setField('');
    setNotice(null);
    try {
      const v = await shopOrdersApi.saveSettings(form);
      setView(v);
      setForm(v.settings);
      setNotice(S.saved);
    } catch (err) {
      setError(errText(err));
      setField(String((err as { field?: string }).field ?? ''));
    } finally {
      setBusy(false);
    }
  };
  const testEmail = async () => {
    setBusy(true);
    setError(null);
    try {
      await shopOrdersApi.testEmail();
      setNotice(S.testSent);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="tx-iam tx-shop-settings" onSubmit={save} noValidate>
      <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-settings-state">
        <h3 id="tx-shop-settings-state">{S.title}</h3>
        <p><span className={`tx-iam-chip ${form.enabled ? 'ok' : 'off'}`}>{form.enabled ? S.shopOn : S.shopOff}</span></p>
        <label className="tx-iam-check">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          <span>{S.enabled}</span>
        </label>
        <p className="tx-iam-muted tx-shop-editor__meta">{S.enabledHint}</p>
        {!view.mailEnabled && <div className="tx-iam-notice" role="status">{S.mailOff}</div>}
        <label className={cls('orderEmail')}>
          <span>{S.orderEmail}</span>
          <input type="email" maxLength={254} value={form.orderEmail} onChange={(e) => set('orderEmail', e.target.value)} />
          <small className="tx-iam-muted">{S.orderEmailHint}</small>
        </label>
        <div><button type="button" className="tx-iam-btn" disabled={busy || !view.mailEnabled} onClick={testEmail}>{S.testEmail}</button></div>
      </section>

      <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-settings-ship">
        <h3 id="tx-shop-settings-ship">{S.shipFrom}</h3>
        <p className="tx-iam-muted tx-shop-editor__meta">{S.shipFromHint}</p>
        {view.cities.length === 0 && <div className="tx-iam-notice">{S.noCities}</div>}
        <div className="tx-shop-grid">
          <label className={cls('cityId')}>
            <span>{S.city}</span>
            <select value={form.shipFrom.cityId ?? ''} onChange={(e) => setShip({ cityId: e.target.value || null, zoneId: null })}>
              <option value="">{S.chooseCity}</option>
              {view.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className={cls('zoneId')}>
            <span>{S.area}</span>
            <select value={form.shipFrom.zoneId ?? ''} disabled={!form.shipFrom.cityId} onChange={(e) => setShip({ zoneId: e.target.value || null })}>
              <option value="">{S.noArea}</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
          <label className={cls('landmark')}>
            <span>{S.landmark}</span>
            <input type="text" maxLength={view.limits.landmarkMax} value={form.shipFrom.landmark} onChange={(e) => setShip({ landmark: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="tx-iam-card tx-shop-section" aria-labelledby="tx-shop-settings-orders">
        <h3 id="tx-shop-settings-orders">{S.orders}</h3>
        <div className="tx-shop-grid">
          <fieldset className={`tx-shop-radios${field === 'pickupOffices' ? ' has-error' : ''}`}>
            <legend>{S.pickupOffices}</legend>
            {view.pickupOfficeKeys.map((k) => (
              <label key={k} className="tx-iam-check">
                <input type="checkbox" checked={form.pickupOffices.includes(k)} onChange={(e) => set('pickupOffices', toggle(form.pickupOffices, k, e.target.checked))} />
                <span>{ORDER_TEXT.offices[k] ?? k}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className={`tx-shop-radios${field === 'paymentMethods' ? ' has-error' : ''}`}>
            <legend>{S.paymentMethods}</legend>
            {view.paymentMethods.map((m: ShopPaymentMethod) => (
              <label key={m} className="tx-iam-check">
                <input type="checkbox" checked={form.paymentMethods.includes(m)} onChange={(e) => set('paymentMethods', toggle(form.paymentMethods, m, e.target.checked))} />
                <span>{ORDER_TEXT.methods[m]}</span>
              </label>
            ))}
          </fieldset>
          <label className={cls('lowStockAt')}>
            <span>{S.lowStockAt}</span>
            <input type="number" inputMode="numeric" min={0} max={view.limits.lowStockMax} step={1} value={form.lowStockAt}
              onChange={(e) => set('lowStockAt', e.target.value === '' ? NaN : Number(e.target.value))} />
          </label>
          <label className={cls('maxPerOrder')}>
            <span>{S.maxPerOrder}</span>
            <input type="number" inputMode="numeric" min={1} max={view.limits.maxPerOrderMax} step={1} value={form.maxPerOrder}
              onChange={(e) => set('maxPerOrder', e.target.value === '' ? NaN : Number(e.target.value))} />
          </label>
        </div>
      </section>

      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      {notice && <div className="tx-iam-notice success" role="status">{notice}</div>}
      <div><button type="submit" className="tx-iam-btn primary" disabled={busy}>{S.save}</button></div>
    </form>
  );
};
