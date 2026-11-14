// Console → Couriers (DISPATCH_SPEC §2–§3; tracker G.2). couriers.view lists riders and drivers;
// couriers.manage adds one (account + courier profile in one step, then the temporary password
// with a WhatsApp link), edits the profile and photo, issues a new temporary password and
// disables or enables the account. The server checks and audits every change.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AUTH_TEXT, IAM_TEXT } from '../../auth/strings';
import { IamDialog } from '../components/IamDialog';
import { TempPasswordDialog } from '../components/TempPasswordDialog';
import { compressImage } from '../../services/imageCompress';
import type { StaffUser } from '../../services/api';
import { VEHICLE_TYPES, VEHICLE_LABELS, type VehicleType } from '../../shared/dispatchStatus';
import { dispatchApi, type Courier, type CourierInput } from './dispatchApi';
import { DISPATCH_TEXT, dispatchErrorText } from './strings';
import '../pages/IamViews.css';
import './Dispatch.css';

const D = DISPATCH_TEXT;
const T = DISPATCH_TEXT.couriers;
type Notice = { kind: 'ok' | 'error'; text: string } | null;

const NoticeLine: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
};

const CourierAvatar: React.FC<{ courier: { photoUrl: string | null; user: { displayName: string } } | null; src?: string | null; size?: number }> = ({ courier, src, size = 40 }) => {
  const url = src ?? courier?.photoUrl ?? null;
  return url
    ? <img className="tx-courier-avatar" src={url} alt="" width={size} height={size} />
    : <span className="tx-courier-avatar is-initials" style={{ width: size, height: size }} aria-hidden="true">{initials(courier?.user.displayName ?? '?')}</span>;
};

/** Reads a chosen file as a compressed data URL (≤ 512 px, ≤ 1 MB; the server checks again). */
async function preparePhoto(file: File): Promise<string> {
  const img = await compressImage(file, { maxSide: 512, maxBytes: 1024 * 1024 });
  return `data:${img.mimeType};base64,${img.base64}`;
}

const CourierEditor: React.FC<{
  courier: Courier | null;
  cities: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (courier: Courier, created?: { user: StaffUser; tempPassword: string }) => void;
}> = ({ courier, cities, onClose, onSaved }) => {
  const [name, setName] = useState(courier?.user.displayName ?? '');
  const [phone, setPhone] = useState(courier?.user.phone ?? '');
  const [email, setEmail] = useState(courier?.user.email ?? '');
  const [locale, setLocale] = useState<'en' | 'fr'>(courier?.user.locale === 'fr' ? 'fr' : 'en');
  const [vehicle, setVehicle] = useState<VehicleType>(courier?.vehicleType ?? 'BIKE');
  const [plate, setPlate] = useState(courier?.plateNumber ?? '');
  const [homeCityId, setHomeCityId] = useState(courier?.homeCityId ?? '');
  const [publicName, setPublicName] = useState(courier?.publicFirstName ?? '');
  const [publicNameTouched, setPublicNameTouched] = useState(!!courier);
  const [consent, setConsent] = useState(courier?.showPhotoPublicly ?? false);
  const [notes, setNotes] = useState(courier?.notes ?? '');
  // undefined = unchanged, null = remove, string = new photo (data URL)
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onName = (v: string) => {
    setName(v);
    setError(null);
    // The public first name follows the first word of the name until edited by hand.
    if (!publicNameTouched) setPublicName(v.trim().split(/\s+/)[0] ?? '');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await preparePhoto(file));
      setError(null);
    } catch {
      setError(T.photoError);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError(D.errors.INVALID_NAME); return; }
    if (!phone.trim()) { setError(D.errors.PHONE_REQUIRED); return; }
    if (!publicName.trim()) { setError(D.errors.INVALID_PUBLIC_NAME); return; }
    setBusy(true);
    setError(null);
    const input: CourierInput = {
      displayName: name.trim(), phone: phone.trim(), email: email.trim(), locale, vehicleType: vehicle, plateNumber: plate,
      homeCityId: homeCityId || null, publicFirstName: publicName.trim(), showPhotoPublicly: consent, notes,
    };
    try {
      if (!courier) {
        const created = await dispatchApi.createCourier({ ...input, ...(photo ? { photo } : {}) });
        onSaved(created.courier, { user: created.user, tempPassword: created.tempPassword });
        return;
      }
      let saved = await dispatchApi.updateCourier(courier.userId, input);
      if (typeof photo === 'string') saved = await dispatchApi.setCourierPhoto(courier.userId, photo);
      else if (photo === null && courier.photoUrl) saved = await dispatchApi.removeCourierPhoto(courier.userId);
      onSaved(saved);
    } catch (err) {
      setError(dispatchErrorText(err));
      setBusy(false);
    }
  };

  const shownPhoto = photo === undefined ? courier?.photoUrl ?? null : photo;

  return (
    <IamDialog title={courier ? T.editTitle : T.add} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <label className="tx-iam-field">
          <span>{T.fields.name}</span>
          <input type="text" value={name} maxLength={80} autoComplete="off" required onChange={(e) => onName(e.target.value)} />
        </label>
        <label className="tx-iam-field">
          <span>{T.fields.phone}</span>
          <input type="tel" value={phone} maxLength={40} autoComplete="off" inputMode="tel" required aria-describedby="tx-courier-phone-hint"
            onChange={(e) => { setPhone(e.target.value); setError(null); }} />
          <small id="tx-courier-phone-hint">{T.phoneHint}</small>
        </label>
        <label className="tx-iam-field">
          <span>{T.fields.email}</span>
          <input type="email" value={email} maxLength={200} autoComplete="off" inputMode="email"
            onChange={(e) => { setEmail(e.target.value); setError(null); }} />
        </label>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field">
            <span>{T.fields.vehicle}</span>
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleType)}>
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{VEHICLE_LABELS[v].en}</option>)}
            </select>
          </label>
          <label className="tx-iam-field">
            <span>{T.fields.plate}</span>
            <input type="text" value={plate} maxLength={20} autoComplete="off" autoCapitalize="characters" onChange={(e) => setPlate(e.target.value)} />
          </label>
        </div>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field">
            <span>{T.fields.homeCity}</span>
            <select value={homeCityId} onChange={(e) => setHomeCityId(e.target.value)}>
              <option value="">{T.fields.noCity}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="tx-iam-field">
            <span>{T.fields.language}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as 'en' | 'fr')}>
              <option value="en">{AUTH_TEXT.account.languages.en}</option>
              <option value="fr">{AUTH_TEXT.account.languages.fr}</option>
            </select>
          </label>
        </div>
        <label className="tx-iam-field">
          <span>{T.fields.publicName}</span>
          <input type="text" value={publicName} maxLength={30} autoComplete="off" required aria-describedby="tx-courier-public-hint"
            onChange={(e) => { setPublicName(e.target.value); setPublicNameTouched(true); setError(null); }} />
          <small id="tx-courier-public-hint">{T.fields.publicNameHint}</small>
        </label>

        <fieldset className="tx-courier-photo">
          <legend>{T.fields.photo}</legend>
          <div className="tx-courier-photo-row">
            <CourierAvatar courier={courier ?? { photoUrl: null, user: { displayName: name || '?' } }} src={shownPhoto} size={64} />
            <div className="tx-iam-row-actions">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <button type="button" className="tx-iam-btn small" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={13} aria-hidden="true" /><span>{shownPhoto ? T.fields.replacePhoto : T.fields.addPhoto}</span>
              </button>
              {shownPhoto && (
                <button type="button" className="tx-iam-btn small" onClick={() => setPhoto(null)}>{T.fields.removePhoto}</button>
              )}
            </div>
          </div>
          <label className="tx-iam-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{T.fields.consent}<span className="tx-iam-sub">{T.fields.consentHint}</span></span>
          </label>
        </fieldset>

        <label className="tx-iam-field">
          <span>{T.fields.notes}</span>
          <textarea value={notes} maxLength={500} rows={2} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <NoticeLine notice={error ? { kind: 'error', text: error } : null} />
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{D.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>{busy ? D.saving : courier ? D.save : T.create}</button>
        </div>
      </form>
    </IamDialog>
  );
};

export const CouriersView: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user: me, can } = useAuth();
  const canManage = can('couriers.manage');
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState<{ courier: Courier | null } | null>(null);
  const [temp, setTemp] = useState<{ user: StaffUser; tempPassword: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCouriers(await dispatchApi.couriers());
      setLoadError(null);
    } catch (err) {
      setLoadError(dispatchErrorText(err));
    }
    // Home cities for the form: the active delivery cities (the same list as the booking form, so
    // managing couriers doesn't need tariffs.manage).
    dispatchApi.activeCities().then(setCities, () => setCities([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Active cities, plus the courier's current city if it has since been turned off. */
  const citiesFor = (courier: Courier | null): { id: string; name: string }[] =>
    courier?.homeCityId && courier.homeCityName && !cities.some((c) => c.id === courier.homeCityId)
      ? [...cities, { id: courier.homeCityId, name: courier.homeCityName }]
      : cities;

  const replace = (c: Courier) => setCouriers((list) => (list ?? []).map((x) => (x.userId === c.userId ? c : x)));

  const run = async (c: Courier, action: () => Promise<void>) => {
    setBusyId(c.userId);
    setNotice(null);
    try { await action(); } catch (err) { setNotice({ kind: 'error', text: dispatchErrorText(err) }); } finally { setBusyId(null); }
  };

  const toggleStatus = (c: Courier) => {
    const disabling = c.user.status === 'ACTIVE';
    if (disabling && !window.confirm(T.confirmDisable(c.user.displayName))) return;
    run(c, async () => {
      replace(await dispatchApi.updateCourier(c.userId, { status: disabling ? 'DISABLED' : 'ACTIVE' }));
      setNotice({ kind: 'ok', text: D.saved });
    });
  };

  const resetPassword = (c: Courier) => {
    if (!window.confirm(T.confirmReset(c.user.displayName))) return;
    run(c, async () => {
      const result = await dispatchApi.resetCourierPassword(c.userId);
      replace(result.courier);
      setTemp({ user: result.user, tempPassword: result.tempPassword });
    });
  };

  const query = (filter || searchQuery).trim().toLowerCase();
  const shown = (couriers ?? []).filter((c) => !query
    || [c.user.displayName, c.publicFirstName, c.user.phone ?? '', c.user.email ?? '', c.plateNumber ?? '']
      .some((v) => v.toLowerCase().includes(query)));

  return (
    <div className="tx-iam animate-fade-in">
      <div className="tx-iam-toolbar">
        <input type="search" className="tx-iam-input" placeholder={T.search} aria-label={T.search}
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        {canManage && (
          <button type="button" className="tx-iam-btn primary" onClick={() => setEditor({ courier: null })}>
            <UserPlus size={15} aria-hidden="true" /><span>{T.add}</span>
          </button>
        )}
      </div>

      {!canManage && <p className="tx-iam-hint" style={{ margin: 0 }}>{T.viewOnly}</p>}
      <NoticeLine notice={notice} />
      {loadError && <NoticeLine notice={{ kind: 'error', text: loadError }} />}

      <div className="tx-iam-card">
        {couriers === null && !loadError && <p className="tx-iam-muted" role="status">{D.loading}</p>}
        {couriers !== null && couriers.length === 0 && <p className="tx-iam-muted">{T.empty}</p>}
        {couriers !== null && couriers.length > 0 && shown.length === 0 && <p className="tx-iam-muted">{T.noMatch}</p>}
        {shown.length > 0 && (
          <table className="tx-iam-table">
            <thead>
              <tr>
                <th scope="col">{T.columns.courier}</th>
                <th scope="col">{T.columns.phone}</th>
                <th scope="col">{T.columns.vehicle}</th>
                <th scope="col">{T.columns.city}</th>
                <th scope="col">{T.columns.status}</th>
                {canManage && <th scope="col">{T.columns.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const busy = busyId === c.userId;
                const active = c.user.status === 'ACTIVE';
                return (
                  <tr key={c.userId} className={active ? undefined : 'is-disabled'}>
                    <td data-label={T.columns.courier}>
                      <div className="tx-courier-cell">
                        <CourierAvatar courier={c} />
                        <span>
                          <strong>{c.user.displayName}</strong>
                          <span className="tx-iam-sub">
                            “{c.publicFirstName}”{c.photoUrl ? ` · ${c.showPhotoPublicly ? T.photoPublic : T.photoPrivate}` : ''}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td data-label={T.columns.phone}>
                      <span style={{ display: 'block' }}>{c.user.phone}</span>
                      {c.user.email && <span className="tx-iam-sub">{c.user.email}</span>}
                    </td>
                    <td data-label={T.columns.vehicle}>
                      {VEHICLE_LABELS[c.vehicleType]?.en ?? c.vehicleType}
                      {c.plateNumber && <span className="tx-iam-sub">{c.plateNumber}</span>}
                    </td>
                    <td data-label={T.columns.city}>{c.homeCityName ?? <span className="tx-iam-muted">{T.fields.noCity}</span>}</td>
                    <td data-label={T.columns.status}>
                      <span className={`tx-iam-chip ${active ? 'ok' : 'off'}`}>{IAM_TEXT.users.status[c.user.status as 'ACTIVE' | 'DISABLED'] ?? c.user.status}</span>
                      {active && <span className={`tx-iam-chip ${c.isOnDuty ? 'ok' : ''}`}>{c.isOnDuty ? T.onDuty : T.offDuty}</span>}
                      {c.user.locked && <span className="tx-iam-chip warn">{IAM_TEXT.users.locked}</span>}
                      {c.user.mustChangePassword && active && <span className="tx-iam-sub">{IAM_TEXT.users.firstSignInPending}</span>}
                    </td>
                    {canManage && (
                      <td data-label={T.columns.actions}>
                        <div className="tx-iam-row-actions">
                          <button type="button" className="tx-iam-btn small" disabled={busy} onClick={() => setEditor({ courier: c })}>{T.actions.edit}</button>
                          {c.userId !== me?.id && (
                            <button type="button" className="tx-iam-btn small" disabled={busy} onClick={() => resetPassword(c)}>{T.actions.resetPassword}</button>
                          )}
                          {c.userId !== me?.id && (
                            <button type="button" className={`tx-iam-btn small${active ? ' danger' : ''}`} disabled={busy} onClick={() => toggleStatus(c)}>
                              {active ? T.actions.disable : T.actions.enable}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editor && (
        <CourierEditor
          courier={editor.courier}
          cities={citiesFor(editor.courier)}
          onClose={() => setEditor(null)}
          onSaved={(saved, created) => {
            setEditor(null);
            if (created) {
              setCouriers((list) => [...(list ?? []), saved].sort((a, b) => a.user.displayName.localeCompare(b.user.displayName)));
              setTemp(created);
            } else {
              replace(saved);
              setNotice({ kind: 'ok', text: D.saved });
            }
          }}
        />
      )}

      {temp && <TempPasswordDialog user={temp.user} tempPassword={temp.tempPassword} onClose={() => setTemp(null)} />}
    </div>
  );
};
