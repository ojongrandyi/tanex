// Console → Tariffs (DISPATCH_SPEC §3, §5, §8; tracker G.2), tariffs.manage. Delivery cities and their
// areas (other names, optional map pin, order, on/off), the suggested-areas import (names only), the
// rate sheet per city and size (price and express surcharge per pickup → drop-off cell, with
// "any other area" fallbacks), intercity weight bands per direction, and the average speeds used
// for ETAs. The server validates and audits every change; this screen only prepares them.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeftRight, ArrowUp, CheckCircle2, Download, MapPin, Plus, Trash2 } from 'lucide-react';
import { IamDialog } from '../components/IamDialog';
import { dispatchApi, type DeliveryCity, type DeliveryZone, type TariffState } from './dispatchApi';
import { DISPATCH_TEXT, dispatchErrorText } from './strings';
import { PinPicker, type Pin } from './PinPicker';
import { ANY, cellKey, isSymmetricSheet, parseAmount, setCellValue, sheetSignature, type Cell } from './rateSheet';
import { SIZE_CLASSES, SIZE_CLASS_LABELS, priceLocalDelivery, type SizeClass } from '../../shared/localPricing';
import { VEHICLE_TYPES, VEHICLE_LABELS } from '../../shared/dispatchStatus';
import { SPEED_MAX_KMH, SPEED_MIN_KMH } from '../../shared/dispatchSettings';
import { SUGGESTED_AREAS } from '../../shared/suggestedAreas';
import '../pages/IamViews.css';
import './Dispatch.css';

const D = DISPATCH_TEXT;
const T = DISPATCH_TEXT.tariffs;
type Tab = 'areas' | 'rates' | 'intercity' | 'speeds';
const TABS: Tab[] = ['areas', 'rates', 'intercity', 'speeds'];
type Notice = { kind: 'ok' | 'error'; text: string } | null;

const NoticeLine: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: currency === 'XAF' || currency === 'XOF' ? 0 : 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const validPin = (p: Pin) =>
  (p.lat === null && p.lng === null)
  || (p.lat !== null && p.lng !== null && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180);

// ---- Dialogs ---------------------------------------------------------------------------------

const CityDialog: React.FC<{ city: DeliveryCity | null; onClose: () => void; onSaved: (s: TariffState) => void }> = ({ city, onClose, onSaved }) => {
  const [name, setName] = useState(city?.name ?? '');
  const [active, setActive] = useState(city?.isActive ?? true);
  const [pin, setPin] = useState<Pin>({ lat: city?.lat ?? null, lng: city?.lng ?? null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError(D.errors.INVALID_NAME); return; }
    if (!validPin(pin)) { setError(D.errors.INVALID_PIN); return; }
    setBusy(true);
    setError(null);
    try {
      onSaved(city
        ? await dispatchApi.updateCity(city.id, { name: name.trim(), isActive: active, ...pin })
        : await dispatchApi.createCity({ name: name.trim(), ...pin }));
    } catch (err) {
      setError(dispatchErrorText(err));
      setBusy(false);
    }
  };

  return (
    <IamDialog title={city ? T.editCity : T.addCity} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <label className="tx-iam-field">
          <span>{T.cityName}</span>
          <input type="text" value={name} maxLength={60} required onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        {city && (
          <label className="tx-iam-check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>{T.cityActive}<span className="tx-iam-sub">{T.cityActiveHint}</span></span>
          </label>
        )}
        <PinPicker value={pin} onChange={(p) => { setPin(p); setError(null); }} />
        <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{D.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? D.saving : D.save}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const ZoneDialog: React.FC<{
  city: DeliveryCity; zone: DeliveryZone | null; onClose: () => void; onSaved: (s: TariffState) => void;
}> = ({ city, zone, onClose, onSaved }) => {
  const [name, setName] = useState(zone?.name ?? '');
  const [aliases, setAliases] = useState(zone?.aliases ?? '');
  const [active, setActive] = useState(zone?.isActive ?? true);
  const [pin, setPin] = useState<Pin>({ lat: zone?.lat ?? null, lng: zone?.lng ?? null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError(D.errors.INVALID_NAME); return; }
    if (!validPin(pin)) { setError(D.errors.INVALID_PIN); return; }
    setBusy(true);
    setError(null);
    try {
      onSaved(zone
        ? await dispatchApi.updateZone(zone.id, { name: name.trim(), aliases, isActive: active, ...pin })
        : await dispatchApi.createZone(city.id, { name: name.trim(), aliases, ...pin }));
    } catch (err) {
      setError(dispatchErrorText(err));
      setBusy(false);
    }
  };

  return (
    <IamDialog title={`${zone ? T.editArea : T.addArea} · ${city.name}`} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <label className="tx-iam-field">
          <span>{T.areaName}</span>
          <input type="text" value={name} maxLength={60} required onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        <label className="tx-iam-field">
          <span>{T.aliases}</span>
          <input type="text" value={aliases} maxLength={500} aria-describedby="tx-zone-aliases-hint"
            onChange={(e) => { setAliases(e.target.value); setError(null); }} />
          <small id="tx-zone-aliases-hint">{T.aliasesHint}</small>
        </label>
        {zone && (
          <label className="tx-iam-check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>{T.areaActive}</span>
          </label>
        )}
        <PinPicker value={pin} near={{ lat: city.lat, lng: city.lng }} onChange={(p) => { setPin(p); setError(null); }} />
        <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{D.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? D.saving : D.save}</button>
        </div>
      </form>
    </IamDialog>
  );
};

const ImportDialog: React.FC<{ onClose: () => void; onDone: (s: TariffState, cities: number, areas: number) => void }> = ({ onClose, onDone }) => {
  const [picked, setPicked] = useState<string[]>(SUGGESTED_AREAS.map((c) => c.name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || picked.length === 0) return;
    setBusy(true);
    try {
      const result = await dispatchApi.importSuggested(picked);
      onDone(result, result.imported.cities, result.imported.areas);
    } catch (err) {
      setError(dispatchErrorText(err));
      setBusy(false);
    }
  };

  return (
    <IamDialog title={T.importTitle} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit}>
        <p className="tx-iam-muted" style={{ margin: 0 }}>{T.importIntro}</p>
        <fieldset className="tx-roles-group" style={{ borderTop: 0, paddingTop: 0 }}>
          <legend>{T.importCities}</legend>
          {SUGGESTED_AREAS.map((c) => (
            <label key={c.name} className="tx-iam-check">
              <input type="checkbox" checked={picked.includes(c.name)} onChange={() => toggle(c.name)} />
              <span>
                {c.name} <span className="tx-iam-sub">{T.importAreas(c.areas.length)}: {c.areas.join(', ')}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{D.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy || picked.length === 0}>{busy ? D.saving : T.importSubmit}</button>
        </div>
      </form>
    </IamDialog>
  );
};

// ---- Areas -----------------------------------------------------------------------------------

const AreasPanel: React.FC<{
  city: DeliveryCity; zones: DeliveryZone[]; onState: (s: TariffState, msg?: string) => void; onError: (msg: string) => void;
}> = ({ city, zones, onState, onError }) => {
  const [editor, setEditor] = useState<{ zone: DeliveryZone | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<TariffState>) => {
    setBusy(true);
    try { onState(await fn(), D.saved); } catch (err) { onError(dispatchErrorText(err)); } finally { setBusy(false); }
  };
  const move = (i: number, by: -1 | 1) => {
    const ids = zones.map((z) => z.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    run(() => dispatchApi.reorderZones(city.id, ids));
  };

  return (
    <div className="tx-iam-card tx-tariff-panel">
      <div className="tx-tariff-panel-head">
        <h3>{T.areasOf(city.name)}</h3>
        <button type="button" className="tx-iam-btn primary" onClick={() => setEditor({ zone: null })}>
          <Plus size={15} aria-hidden="true" /><span>{T.addArea}</span>
        </button>
      </div>
      {zones.length === 0 ? <p className="tx-iam-muted">{T.noAreas}</p> : (
        <table className="tx-iam-table">
          <thead>
            <tr>
              <th scope="col">{T.columns.name}</th>
              <th scope="col">{T.columns.aliases}</th>
              <th scope="col">{T.columns.pin}</th>
              <th scope="col">{T.columns.status}</th>
              <th scope="col">{T.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => (
              <tr key={z.id} className={z.isActive ? undefined : 'is-disabled'}>
                <td data-label={T.columns.name}><strong>{z.name}</strong></td>
                <td data-label={T.columns.aliases}>{z.aliases || <span className="tx-iam-muted">-</span>}</td>
                <td data-label={T.columns.pin}>
                  {z.lat !== null ? <span className="tx-iam-chip ok"><MapPin size={11} aria-hidden="true" /> {T.pinSet}</span> : <span className="tx-iam-muted">{T.noPin}</span>}
                </td>
                <td data-label={T.columns.status}>
                  <span className={`tx-iam-chip ${z.isActive ? 'ok' : 'off'}`}>{z.isActive ? D.on : D.off}</span>
                </td>
                <td data-label={T.columns.actions}>
                  <div className="tx-iam-row-actions">
                    <button type="button" className="tx-iam-btn small" disabled={busy || i === 0} aria-label={T.moveUp(z.name)} onClick={() => move(i, -1)}>
                      <ArrowUp size={13} aria-hidden="true" />
                    </button>
                    <button type="button" className="tx-iam-btn small" disabled={busy || i === zones.length - 1} aria-label={T.moveDown(z.name)} onClick={() => move(i, 1)}>
                      <ArrowDown size={13} aria-hidden="true" />
                    </button>
                    <button type="button" className="tx-iam-btn small" disabled={busy} onClick={() => setEditor({ zone: z })}>{D.edit}</button>
                    <button type="button" className="tx-iam-btn small" disabled={busy}
                      onClick={() => run(() => dispatchApi.updateZone(z.id, { isActive: !z.isActive }))}>
                      {z.isActive ? T.turnOff : T.turnOn}
                    </button>
                    <button type="button" className="tx-iam-btn small danger" disabled={busy}
                      onClick={() => { if (window.confirm(T.deleteArea(z.name))) run(() => dispatchApi.deleteZone(z.id)); }}>
                      <Trash2 size={13} aria-hidden="true" /><span>{D.delete}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editor && (
        <ZoneDialog city={city} zone={editor.zone} onClose={() => setEditor(null)}
          onSaved={(s) => { setEditor(null); onState(s, D.saved); }} />
      )}
    </div>
  );
};

// ---- Rates -----------------------------------------------------------------------------------

function sheetFromState(state: TariffState, cityId: string, size: SizeClass): { cells: Record<string, Cell>; currency: string } {
  const cells: Record<string, Cell> = {};
  let currency = 'XAF';
  for (const r of state.rates) {
    if (r.cityId !== cityId || r.sizeClass !== size) continue;
    cells[cellKey(r.fromZoneId, r.toZoneId)] = { price: String(r.price), express: r.expressSurcharge === null ? '' : String(r.expressSurcharge) };
    currency = r.currency;
  }
  return { cells, currency };
}

const RatesPanel: React.FC<{
  state: TariffState; city: DeliveryCity; zones: DeliveryZone[];
  onState: (s: TariffState, msg?: string) => void; onDirty: (dirty: boolean) => void;
}> = ({ state, city, zones, onState, onDirty }) => {
  const [size, setSize] = useState<SizeClass>('SMALL');
  const [mode, setMode] = useState<'price' | 'express'>('price');
  const saved = useMemo(() => sheetFromState(state, city.id, size), [state, city.id, size]);
  const [cells, setCells] = useState<Record<string, Cell>>(saved.cells);
  const [currency, setCurrency] = useState(saved.currency);
  const [expressAll, setExpressAll] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two-way pricing (tracker #155, decided 2026-11-14): on by default; a sheet saved with one-way
  // prices opens with it off so nothing is overwritten by surprise.
  const [twoWay, setTwoWay] = useState(() => isSymmetricSheet(saved.cells));

  // Reload the sheet when the city, the size or the saved rates change.
  useEffect(() => {
    setCells(saved.cells); setCurrency(saved.currency); setError(null); setTwoWay(isSymmetricSheet(saved.cells));
  }, [saved]);
  const dirty = sheetSignature(cells, currency) !== sheetSignature(saved.cells, saved.currency);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  const axis: { id: string | null; name: string; off: boolean }[] = [
    ...zones.map((z) => ({ id: z.id, name: z.name, off: !z.isActive })),
    { id: null, name: T.anyOtherArea, off: false },
  ];
  const savedCount = state.rates.filter((r) => r.cityId === city.id && r.sizeClass === size).length;

  const setCell = (key: string, field: keyof Cell, value: string) => {
    setError(null);
    setCells((c) => setCellValue(c, key, field, value, twoWay));
  };

  const changeSize = (next: SizeClass) => {
    if (dirty && !window.confirm(T.discardChanges)) return;
    setSize(next);
  };

  const applyExpressAll = () => {
    const v = parseAmount(expressAll);
    if (v === null || Number.isNaN(v) || v < 0) { setError(T.invalidNumber); return; }
    setCells((c) => {
      const out: Record<string, Cell> = {};
      for (const [k, cell] of Object.entries(c)) out[k] = cell.price.trim() ? { ...cell, express: String(v) } : cell;
      return out;
    });
  };

  const save = async () => {
    const rates: { fromZoneId: string | null; toZoneId: string | null; price: number; expressSurcharge: number | null }[] = [];
    for (const from of axis) {
      for (const to of axis) {
        const cell = cells[cellKey(from.id, to.id)];
        if (!cell) continue;
        const price = parseAmount(cell.price);
        const express = parseAmount(cell.express);
        if (price === null && express === null) continue;
        if (price === null) { setError(T.expressNeedsPrice); return; }
        if (Number.isNaN(price) || price < 0 || (express !== null && (Number.isNaN(express) || express < 0))) { setError(T.invalidNumber); return; }
        rates.push({ fromZoneId: from.id, toZoneId: to.id, price, expressSurcharge: express });
      }
    }
    setBusy(true);
    setError(null);
    try {
      onState(await dispatchApi.saveRates(city.id, size, currency.trim().toUpperCase() || 'XAF', rates), D.saved);
    } catch (err) {
      setError(dispatchErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tx-iam-card tx-tariff-panel">
      <div className="tx-tariff-controls">
        <label className="tx-iam-field">
          <span>{T.size}</span>
          <select value={size} onChange={(e) => changeSize(e.target.value as SizeClass)}>
            {SIZE_CLASSES.map((s) => <option key={s} value={s}>{SIZE_CLASS_LABELS[s].en}</option>)}
          </select>
        </label>
        <label className="tx-iam-field tx-tariff-currency">
          <span>{T.currency}</span>
          <input type="text" value={currency} maxLength={3} autoCapitalize="characters"
            onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </label>
        <div className="tx-tariff-mode" role="group" aria-label={T.editing}>
          <button type="button" className={`tx-iam-btn small${mode === 'price' ? ' primary' : ''}`} aria-pressed={mode === 'price'} onClick={() => setMode('price')}>{T.price}</button>
          <button type="button" className={`tx-iam-btn small${mode === 'express' ? ' primary' : ''}`} aria-pressed={mode === 'express'} onClick={() => setMode('express')}>{T.expressSurcharge}</button>
        </div>
      </div>
      <label className="tx-iam-check">
        <input type="checkbox" checked={twoWay} onChange={(e) => setTwoWay(e.target.checked)} />
        <span>{T.twoWay}<span className="tx-iam-sub">{twoWay ? T.twoWayOn : T.twoWayOff}</span></span>
      </label>
      <p className="tx-iam-muted tx-tariff-help">{mode === 'price' ? T.ratesIntro : T.expressIntro}</p>
      {zones.length === 0 && <p className="tx-iam-muted tx-tariff-help">{T.needAreas}</p>}
      {mode === 'express' && (
        <div className="tx-tariff-controls">
          <label className="tx-iam-field">
            <span>{T.expressAll}</span>
            <input type="text" inputMode="decimal" value={expressAll} onChange={(e) => setExpressAll(e.target.value)} />
          </label>
          <button type="button" className="tx-iam-btn" onClick={applyExpressAll}>{T.apply}</button>
        </div>
      )}

      <div className="tx-rate-scroll" tabIndex={0} role="region" aria-label={`${T.tabs.rates}: ${city.name}, ${SIZE_CLASS_LABELS[size].en}`}>
        <table className="tx-rate-grid">
          <thead>
            <tr>
              <th scope="col" className="tx-rate-corner"><span>{T.fromArea} ↓</span><span>{T.toArea} →</span></th>
              {axis.map((to) => <th key={to.id ?? ANY} scope="col" className={to.id ? undefined : 'is-any'}>{to.name}{to.off && <span className="tx-iam-sub">{D.off}</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {axis.map((from) => (
              <tr key={from.id ?? ANY}>
                <th scope="row" className={from.id ? undefined : 'is-any'}>{from.name}{from.off && <span className="tx-iam-sub">{D.off}</span>}</th>
                {axis.map((to) => {
                  const key = cellKey(from.id, to.id);
                  const cell = cells[key] ?? { price: '', express: '' };
                  const value = mode === 'price' ? cell.price : cell.express;
                  const bad = value.trim() !== '' && (Number.isNaN(parseAmount(value)) || (parseAmount(value) ?? 0) < 0);
                  return (
                    <td key={key} className={cell.price.trim() ? 'has-price' : undefined}>
                      <input type="text" inputMode="decimal" value={value} aria-invalid={bad || undefined}
                        disabled={mode === 'express' && !cell.price.trim() && !cell.express.trim()}
                        aria-label={T.cellLabel(mode === 'price' ? T.price : T.expressSurcharge, from.name, to.name)}
                        onChange={(e) => setCell(key, mode, e.target.value)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tx-iam-hint">{T.ratesOrder}</p>
      <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
      <div className="tx-tariff-save">
        <span className="tx-iam-muted">{dirty ? <strong className="tx-tariff-dirty">{D.unsaved}</strong> : T.ratesCount(savedCount)}</span>
        <button type="button" className="tx-iam-btn" disabled={!dirty || busy} onClick={() => { setCells(saved.cells); setCurrency(saved.currency); }}>{D.cancel}</button>
        <button type="button" className="tx-iam-btn primary" disabled={!dirty || busy} onClick={save}>{busy ? D.saving : D.save}</button>
      </div>
      <PriceCheck state={state} city={city} zones={zones} />
    </div>
  );
};

const PriceCheck: React.FC<{ state: TariffState; city: DeliveryCity; zones: DeliveryZone[] }> = ({ state, city, zones }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [size, setSize] = useState<SizeClass>('SMALL');
  const [express, setExpress] = useState(false);
  const result = priceLocalDelivery({ cityId: city.id, fromZoneId: from || null, toZoneId: to || null, sizeClass: size, express }, state.rates);
  const zoneSelect = (label: string, value: string, set: (v: string) => void) => (
    <label className="tx-iam-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{T.anyOtherArea}</option>
        {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
      </select>
    </label>
  );
  return (
    <section className="tx-price-check" aria-labelledby="tx-price-check-title">
      <h4 id="tx-price-check-title">{T.check}</h4>
      <div className="tx-tariff-controls">
        {zoneSelect(T.checkPickup, from, setFrom)}
        {zoneSelect(T.checkDropoff, to, setTo)}
        <label className="tx-iam-field">
          <span>{T.size}</span>
          <select value={size} onChange={(e) => setSize(e.target.value as SizeClass)}>
            {SIZE_CLASSES.map((s) => <option key={s} value={s}>{SIZE_CLASS_LABELS[s].en}</option>)}
          </select>
        </label>
        <label className="tx-iam-check tx-price-check-express">
          <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
          <span>{T.checkExpress}</span>
        </label>
      </div>
      <p className="tx-price-check-result" role="status" aria-live="polite">
        {result.ok
          ? T.checkResult(formatMoney(result.price, result.currency), T.match[result.match ?? 'ANY_ZONE'])
          : result.reason === 'NO_EXPRESS_RATE' ? T.checkNoExpress : T.checkNone}
        <span className="tx-iam-sub">{T.checkUses}</span>
      </p>
    </section>
  );
};

// ---- Intercity -------------------------------------------------------------------------------

const IntercityPanel: React.FC<{
  state: TariffState; onState: (s: TariffState, msg?: string) => void; onDirty: (dirty: boolean) => void;
}> = ({ state, onState, onDirty }) => {
  const cities = state.cities;
  const [fromId, setFromId] = useState(cities[0]?.id ?? '');
  const [toId, setToId] = useState(cities[1]?.id ?? '');
  const saved = useMemo(() => {
    const rows = state.intercity.filter((r) => r.fromCityId === fromId && r.toCityId === toId);
    return { bands: rows.map((r) => ({ weight: String(r.maxWeightKg), price: String(r.price) })), currency: rows[0]?.currency ?? 'XAF' };
  }, [state, fromId, toId]);
  const [bands, setBands] = useState(saved.bands);
  const [currency, setCurrency] = useState(saved.currency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setBands(saved.bands); setCurrency(saved.currency); setError(null); }, [saved]);
  const dirty = JSON.stringify([bands, currency]) !== JSON.stringify([saved.bands, saved.currency]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? id;
  const pairs = useMemo(() => {
    const map = new Map<string, { from: string; to: string; n: number }>();
    for (const r of state.intercity) {
      const k = `${r.fromCityId}>${r.toCityId}`;
      map.set(k, { from: r.fromCityId, to: r.toCityId, n: (map.get(k)?.n ?? 0) + 1 });
    }
    return [...map.values()];
  }, [state.intercity]);

  const pick = (from: string, to: string) => {
    if (dirty && !window.confirm(T.discardChanges)) return;
    setFromId(from);
    setToId(to);
  };

  const save = async () => {
    const parsed = bands.map((b) => ({ maxWeightKg: parseAmount(b.weight), price: parseAmount(b.price) }));
    const ok = parsed.every((b) => b.maxWeightKg !== null && !Number.isNaN(b.maxWeightKg) && b.maxWeightKg > 0
      && b.price !== null && !Number.isNaN(b.price) && b.price >= 0)
      && new Set(parsed.map((b) => b.maxWeightKg)).size === parsed.length;
    if (!ok) { setError(T.bandError); return; }
    setBusy(true);
    setError(null);
    try {
      onState(await dispatchApi.saveIntercity(fromId, toId, currency.trim().toUpperCase() || 'XAF',
        parsed as { maxWeightKg: number; price: number }[]), D.saved);
    } catch (err) {
      setError(dispatchErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (cities.length < 2) return <div className="tx-iam-card"><p className="tx-iam-muted">{T.needTwoCities}</p></div>;

  return (
    <div className="tx-iam-card tx-tariff-panel">
      <p className="tx-iam-muted tx-tariff-help">{T.intercityIntro}</p>
      <div className="tx-tariff-controls">
        <label className="tx-iam-field">
          <span>{T.fromCity}</span>
          <select value={fromId} onChange={(e) => pick(e.target.value, toId)}>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="button" className="tx-iam-btn" aria-label={T.swap} title={T.swap} onClick={() => pick(toId, fromId)}>
          <ArrowLeftRight size={15} aria-hidden="true" />
        </button>
        <label className="tx-iam-field">
          <span>{T.toCity}</span>
          <select value={toId} onChange={(e) => pick(fromId, e.target.value)}>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="tx-iam-field tx-tariff-currency">
          <span>{T.currency}</span>
          <input type="text" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </label>
      </div>
      {fromId === toId ? <p className="tx-iam-muted">{D.errors.SAME_CITY}</p> : (
        <>
          {bands.length === 0 && <p className="tx-iam-muted">{T.noBands}</p>}
          {bands.map((b, i) => (
            <div key={i} className="tx-band-row">
              <label className="tx-iam-field">
                <span>{T.maxWeight}</span>
                <input type="text" inputMode="decimal" value={b.weight}
                  onChange={(e) => setBands((list) => list.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
              </label>
              <label className="tx-iam-field">
                <span>{T.price} ({currency || 'XAF'})</span>
                <input type="text" inputMode="decimal" value={b.price}
                  onChange={(e) => setBands((list) => list.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              </label>
              <button type="button" className="tx-iam-btn small danger" aria-label={`${T.removeBand} ${i + 1}`}
                onClick={() => setBands((list) => list.filter((_, j) => j !== i))}>
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="tx-iam-btn small" onClick={() => setBands((list) => [...list, { weight: '', price: '' }])}>
              <Plus size={13} aria-hidden="true" /><span>{T.addBand}</span>
            </button>
          </div>
          <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
          <div className="tx-tariff-save">
            {dirty && <strong className="tx-tariff-dirty">{D.unsaved}</strong>}
            <button type="button" className="tx-iam-btn" disabled={!dirty || busy} onClick={() => { setBands(saved.bands); setCurrency(saved.currency); }}>{D.cancel}</button>
            <button type="button" className="tx-iam-btn primary" disabled={!dirty || busy} onClick={save}>{busy ? D.saving : D.save}</button>
          </div>
        </>
      )}
      <h4 className="tx-tariff-subhead">{T.pairs}</h4>
      {pairs.length === 0 ? <p className="tx-iam-muted">{T.noPairs}</p> : (
        <ul className="tx-pair-list">
          {pairs.map((p) => (
            <li key={`${p.from}>${p.to}`}>
              <button type="button" className="tx-iam-btn small" aria-current={p.from === fromId && p.to === toId ? 'true' : undefined}
                onClick={() => pick(p.from, p.to)}>
                {cityName(p.from)} → {cityName(p.to)} · {T.bands(p.n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---- Speeds ----------------------------------------------------------------------------------

const SpeedsPanel: React.FC<{ state: TariffState; onState: (s: TariffState, msg?: string) => void }> = ({ state, onState }) => {
  const [speeds, setSpeeds] = useState(() => Object.fromEntries(VEHICLE_TYPES.map((v) => [v, String(state.settings.avgSpeedKmh[v])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Object.fromEntries(VEHICLE_TYPES.map((v) => [v, parseAmount(speeds[v])])) as Record<string, number | null>;
    if (!VEHICLE_TYPES.every((v) => { const n = parsed[v]; return n !== null && !Number.isNaN(n) && n >= SPEED_MIN_KMH && n <= SPEED_MAX_KMH; })) {
      setError(T.speedError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onState(await dispatchApi.saveSettings({ avgSpeedKmh: parsed as Record<(typeof VEHICLE_TYPES)[number], number> }), D.saved);
    } catch (err) {
      setError(dispatchErrorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="tx-iam-card tx-tariff-panel" onSubmit={save} noValidate>
      <p className="tx-iam-muted tx-tariff-help">{T.speedsIntro}</p>
      <div className="tx-tariff-controls">
        {VEHICLE_TYPES.map((v) => (
          <label key={v} className="tx-iam-field">
            <span>{VEHICLE_LABELS[v].en} ({T.kmh})</span>
            <input type="text" inputMode="decimal" value={speeds[v]} onChange={(e) => { setSpeeds((s) => ({ ...s, [v]: e.target.value })); setError(null); }} />
          </label>
        ))}
      </div>
      <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
      <div className="tx-tariff-save">
        <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? D.saving : D.save}</button>
      </div>
    </form>
  );
};

// ---- View ------------------------------------------------------------------------------------

export const TariffsView: React.FC = () => {
  const [state, setState] = useState<TariffState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('areas');
  const [dialog, setDialog] = useState<'add-city' | 'edit-city' | 'import' | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    dispatchApi.tariffs().then(setState, (err) => setLoadError(dispatchErrorText(err)));
  }, []);

  const city = state?.cities.find((c) => c.id === cityId) ?? state?.cities[0] ?? null;
  const zones = useMemo(() => (state && city ? state.zones.filter((z) => z.cityId === city.id) : []), [state, city]);

  const onState = useCallback((s: TariffState, msg?: string) => {
    setState(s);
    setNotice(msg ? { kind: 'ok', text: msg } : null);
  }, []);
  const onError = useCallback((text: string) => setNotice({ kind: 'error', text }), []);
  const onDirty = useCallback((d: boolean) => setDirty(d), []);
  const guard = () => !dirty || window.confirm(T.discardChanges);

  const deleteCity = async (c: DeliveryCity) => {
    if (!window.confirm(T.deleteCity(c.name))) return;
    try {
      const s = await dispatchApi.deleteCity(c.id);
      setCityId(null);
      onState(s, D.saved);
    } catch (err) {
      onError(dispatchErrorText(err));
    }
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    if (!guard()) return;
    setTab(next);
    document.getElementById(`tx-tariff-tab-${next}`)?.focus();
  };

  if (!state) {
    return (
      <div className="tx-iam animate-fade-in">
        {loadError ? <NoticeLine notice={{ kind: 'error', text: loadError }} /> : <p className="tx-iam-muted" role="status">{D.loading}</p>}
      </div>
    );
  }

  const cityScoped = tab === 'areas' || tab === 'rates';

  return (
    <div className="tx-iam tx-tariffs animate-fade-in">
      <div className="tx-iam-toolbar">
        <div className="tx-city-picker" role="group" aria-label={T.cities}>
          {state.cities.map((c) => (
            <button key={c.id} type="button" className={`tx-iam-btn small${city?.id === c.id ? ' primary' : ''}`}
              aria-pressed={city?.id === c.id} onClick={() => { if (guard()) setCityId(c.id); }}>
              {c.name}{!c.isActive && <span className="tx-iam-sub tx-inline-sub">· {T.cityOff}</span>}
            </button>
          ))}
        </div>
        <div className="tx-iam-row-actions">
          <button type="button" className="tx-iam-btn" onClick={() => setDialog('import')}>
            <Download size={15} aria-hidden="true" /><span>{T.importSuggested}</span>
          </button>
          <button type="button" className="tx-iam-btn primary" onClick={() => setDialog('add-city')}>
            <Plus size={15} aria-hidden="true" /><span>{T.addCity}</span>
          </button>
        </div>
      </div>

      <NoticeLine notice={notice} />

      {state.cities.length === 0 ? (
        <div className="tx-iam-card"><p className="tx-iam-muted">{T.noCities}</p></div>
      ) : (
        <>
          <div className="tx-tariff-tabs" role="tablist" aria-label={T.cities}>
            {TABS.map((t, i) => (
              <button key={t} id={`tx-tariff-tab-${t}`} type="button" role="tab" aria-selected={tab === t}
                aria-controls="tx-tariff-panel" tabIndex={tab === t ? 0 : -1}
                className={`tx-tariff-tab${tab === t ? ' is-active' : ''}`}
                onKeyDown={(e) => onTabKey(e, i)}
                onClick={() => { if (tab !== t && guard()) setTab(t); }}>
                {T.tabs[t]}
              </button>
            ))}
          </div>

          <div id="tx-tariff-panel" role="tabpanel" aria-labelledby={`tx-tariff-tab-${tab}`} className="tx-tariff-body">
            {cityScoped && city && (
              <div className="tx-city-head">
                <h2>{city.name}</h2>
                <span className={`tx-iam-chip ${city.isActive ? 'ok' : 'off'}`}>{city.isActive ? D.on : T.cityOff}</span>
                {city.lat !== null && <span className="tx-iam-chip"><MapPin size={11} aria-hidden="true" /> {T.pinSet}</span>}
                <div className="tx-iam-row-actions">
                  <button type="button" className="tx-iam-btn small" onClick={() => setDialog('edit-city')}>{T.editCity}</button>
                  <button type="button" className="tx-iam-btn small danger" onClick={() => deleteCity(city)}>
                    <Trash2 size={13} aria-hidden="true" /><span>{D.delete}</span>
                  </button>
                </div>
              </div>
            )}
            {tab === 'areas' && city && <AreasPanel city={city} zones={zones} onState={onState} onError={onError} />}
            {tab === 'rates' && city && <RatesPanel state={state} city={city} zones={zones} onState={onState} onDirty={onDirty} />}
            {tab === 'intercity' && <IntercityPanel state={state} onState={onState} onDirty={onDirty} />}
            {tab === 'speeds' && <SpeedsPanel state={state} onState={onState} />}
          </div>
        </>
      )}

      {dialog === 'add-city' && (
        <CityDialog city={null} onClose={() => setDialog(null)}
          onSaved={(s) => {
            setDialog(null);
            const created = s.cities.find((c) => !state.cities.some((o) => o.id === c.id));
            if (created) setCityId(created.id);
            onState(s, D.saved);
          }} />
      )}
      {dialog === 'edit-city' && city && (
        <CityDialog city={city} onClose={() => setDialog(null)} onSaved={(s) => { setDialog(null); onState(s, D.saved); }} />
      )}
      {dialog === 'import' && (
        <ImportDialog onClose={() => setDialog(null)}
          onDone={(s, cities, areas) => { setDialog(null); onState(s, T.importDone(cities, areas)); }} />
      )}
    </div>
  );
};
