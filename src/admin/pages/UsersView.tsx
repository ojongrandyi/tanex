// Users (docs/IAM_RBAC_SPEC.md §9): staff accounts with roles, status and last sign-in; create
// and edit, reset password (temporary password shown once), disable/enable, sign out
// everywhere. The server enforces every rule; this screen only hides what can't be done.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { api, type StaffRole, type StaffUser, type StaffUserInput } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { AUTH_TEXT, IAM_TEXT, iamErrorText } from '../../auth/strings';
import { IamDialog } from '../components/IamDialog';
import { TempPasswordDialog } from '../components/TempPasswordDialog';
import { formatEventTimestamp } from '../../shared/timeZones';
import { OFFICE_TIME_ZONE } from '../../config/brand';
import './IamViews.css';

const T = IAM_TEXT.users;

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const NoticeLine: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

/** True when someone holding `granted` holds every key in `keys` ('*' holds everything). */
function holdsAll(granted: readonly string[], keys: Iterable<string>): boolean {
  if (granted.includes('*')) return true;
  for (const k of keys) if (k === '*' || !granted.includes(k)) return false;
  return true;
}

const UserEditor: React.FC<{
  user: StaffUser | null;
  roles: StaffRole[];
  canGrantRole: (role: StaffRole) => boolean;
  onClose: () => void;
  onSaved: (user: StaffUser, tempPassword?: string) => void;
}> = ({ user, roles, canGrantRole, onClose, onSaved }) => {
  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [locale, setLocale] = useState<'en' | 'fr'>(user?.locale ?? 'en');
  const [roleIds, setRoleIds] = useState<string[]>(user?.roles.map((r) => r.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (id: string) =>
    setRoleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError(IAM_TEXT.errors.INVALID_NAME); return; }
    if (!email.trim() && !phone.trim()) { setError(IAM_TEXT.errors.IDENTIFIER_REQUIRED); return; }
    setBusy(true);
    setError(null);
    const input: StaffUserInput = { displayName: name.trim(), email: email.trim(), phone: phone.trim(), locale, roleIds };
    try {
      if (user) onSaved(await api.updateUser(user.id, input));
      else {
        const created = await api.createUser(input);
        onSaved(created.user, created.tempPassword);
      }
    } catch (err) {
      setError(iamErrorText(err));
      setBusy(false);
    }
  };

  return (
    <IamDialog title={user ? T.edit : T.add} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit} noValidate>
        <label className="tx-iam-field">
          <span>{T.fields.name}</span>
          <input type="text" value={name} maxLength={80} autoComplete="off" required
            onChange={(e) => { setName(e.target.value); setError(null); }} />
        </label>
        <div className="tx-iam-form-row">
          <label className="tx-iam-field">
            <span>{T.fields.email}</span>
            <input type="email" value={email} maxLength={200} autoComplete="off" inputMode="email"
              onChange={(e) => { setEmail(e.target.value); setError(null); }} />
          </label>
          <label className="tx-iam-field">
            <span>{T.fields.phone}</span>
            <input type="tel" value={phone} maxLength={40} autoComplete="off" inputMode="tel"
              onChange={(e) => { setPhone(e.target.value); setError(null); }} />
          </label>
        </div>
        <small className="tx-iam-hint">{T.contactHint}</small>
        <label className="tx-iam-field">
          <span>{T.fields.language}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value as 'en' | 'fr')}>
            <option value="en">{AUTH_TEXT.account.languages.en}</option>
            <option value="fr">{AUTH_TEXT.account.languages.fr}</option>
          </select>
        </label>
        <fieldset className="tx-roles-group" style={{ borderTop: 0, paddingTop: 0 }}>
          <legend>{T.fields.roles}</legend>
          {roles.map((role) => {
            const grantable = canGrantRole(role);
            return (
              <label key={role.id} className={`tx-iam-check${grantable ? '' : ' is-unavailable'}`}
                title={grantable ? undefined : T.roleNotGrantable}>
                <input type="checkbox" checked={roleIds.includes(role.id)} disabled={!grantable}
                  onChange={() => toggleRole(role.id)} />
                <span>
                  {role.name}
                  {role.description && <span className="tx-iam-sub">{role.description}</span>}
                  {!grantable && <span className="tx-iam-sub">{T.roleNotGrantable}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
        {error && <NoticeLine notice={{ kind: 'error', text: error }} />}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy}>
            {busy ? T.saving : user ? T.save : T.create}
          </button>
        </div>
      </form>
    </IamDialog>
  );
};

export const UsersView: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user: me, can, refresh } = useAuth();
  const canManage = can('users.manage');
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState<{ user: StaffUser | null } | null>(null);
  const [temp, setTemp] = useState<{ user: StaffUser; tempPassword: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, roleList] = await Promise.all([
        api.listUsers(),
        canManage ? api.listRoles() : Promise.resolve([] as StaffRole[])
      ]);
      setUsers(list);
      setRoles(roleList);
      setLoadError(null);
    } catch (err) {
      setLoadError(iamErrorText(err));
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const granted = me?.permissions ?? [];
  const rolePerms = useMemo(() => new Map(roles.map((r) => [r.id, r.permissions])), [roles]);
  const canGrantRole = useCallback((role: StaffRole) => holdsAll(granted, role.permissions), [granted]);
  // Mirrors the server: only accounts holding nothing the signed-in user lacks can be changed.
  const canManageUser = (u: StaffUser) =>
    canManage && holdsAll(granted, u.roles.flatMap((r) => rolePerms.get(r.id) ?? ['*']));

  const query = (filter || searchQuery).trim().toLowerCase();
  const shown = (users ?? []).filter((u) =>
    !query || [u.displayName, u.email ?? '', u.phone ?? ''].some((v) => v.toLowerCase().includes(query)));

  const replace = (updated: StaffUser) =>
    setUsers((list) => (list ?? []).map((u) => (u.id === updated.id ? updated : u)));

  const run = async (u: StaffUser, action: () => Promise<void>) => {
    setBusyId(u.id);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice({ kind: 'error', text: iamErrorText(err) });
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = (u: StaffUser) => {
    const disabling = u.status === 'ACTIVE';
    if (disabling && !window.confirm(T.confirmDisable(u.displayName))) return;
    run(u, async () => {
      replace(await api.updateUser(u.id, { status: disabling ? 'DISABLED' : 'ACTIVE' }));
      setNotice({ kind: 'ok', text: T.saved });
    });
  };

  const resetPassword = (u: StaffUser) => {
    if (!window.confirm(T.confirmReset(u.displayName))) return;
    run(u, async () => {
      const result = await api.resetUserPassword(u.id);
      replace(result.user);
      setTemp(result);
    });
  };

  const signOutEverywhere = (u: StaffUser) => {
    if (!window.confirm(T.confirmSignOut(u.displayName))) return;
    run(u, async () => {
      const n = await api.signOutUserEverywhere(u.id);
      setNotice({ kind: 'ok', text: T.signedOut(n) });
    });
  };

  const when = (ts: number | null) => (ts ? formatEventTimestamp(ts, OFFICE_TIME_ZONE) : T.never);

  return (
    <div className="tx-iam animate-fade-in">
      <div className="tx-iam-toolbar">
        <input type="search" className="tx-iam-input" placeholder={T.search} aria-label={T.search}
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        {canManage && (
          <button type="button" className="tx-iam-btn primary" onClick={() => setEditor({ user: null })}>
            <UserPlus size={15} aria-hidden="true" />
            <span>{T.add}</span>
          </button>
        )}
      </div>

      <NoticeLine notice={notice} />
      {loadError && <NoticeLine notice={{ kind: 'error', text: loadError }} />}

      <div className="tx-iam-card">
        {users === null && !loadError && <p className="tx-iam-muted">{T.loading}</p>}
        {users !== null && shown.length === 0 && <p className="tx-iam-muted">{T.empty}</p>}
        {shown.length > 0 && (
          <table className="tx-iam-table">
            <thead>
              <tr>
                <th scope="col">{T.columns.name}</th>
                <th scope="col">{T.columns.contact}</th>
                <th scope="col">{T.columns.roles}</th>
                <th scope="col">{T.columns.status}</th>
                <th scope="col">{T.columns.lastSignIn}</th>
                {canManage && <th scope="col">{T.columns.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const manageable = canManageUser(u);
                const isMe = u.id === me?.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className={u.status === 'DISABLED' ? 'is-disabled' : undefined}>
                    <td data-label={T.columns.name}>
                      <strong>{u.displayName}</strong>
                      {isMe && <span className="tx-iam-sub">{T.you}</span>}
                    </td>
                    <td data-label={T.columns.contact}>
                      {u.email && <span style={{ display: 'block' }}>{u.email}</span>}
                      {u.phone && <span style={{ display: 'block' }}>{u.phone}</span>}
                    </td>
                    <td data-label={T.columns.roles}>
                      {u.roles.length ? u.roles.map((r) => <span key={r.id} className="tx-iam-chip">{r.name}</span>) : <span className="tx-iam-muted">{T.noRoles}</span>}
                    </td>
                    <td data-label={T.columns.status}>
                      <span className={`tx-iam-chip ${u.status === 'ACTIVE' ? 'ok' : 'off'}`}>{T.status[u.status]}</span>
                      {u.locked && <span className="tx-iam-chip warn">{T.locked}</span>}
                      {u.mustChangePassword && u.status === 'ACTIVE' && <span className="tx-iam-sub">{T.firstSignInPending}</span>}
                    </td>
                    <td data-label={T.columns.lastSignIn}>{when(u.lastLoginAt)}</td>
                    {canManage && (
                      <td data-label={T.columns.actions}>
                        {manageable && (
                          <div className="tx-iam-row-actions">
                            <button type="button" className="tx-iam-btn small" disabled={busy}
                              onClick={() => setEditor({ user: u })}>{T.actions.edit}</button>
                            {!isMe && (
                              <button type="button" className="tx-iam-btn small" disabled={busy}
                                onClick={() => resetPassword(u)}>{T.actions.resetPassword}</button>
                            )}
                            {!isMe && (
                              <button type="button" className={`tx-iam-btn small${u.status === 'ACTIVE' ? ' danger' : ''}`} disabled={busy}
                                onClick={() => toggleStatus(u)}>
                                {u.status === 'ACTIVE' ? T.actions.disable : T.actions.enable}
                              </button>
                            )}
                            {u.status === 'ACTIVE' && (
                              <button type="button" className="tx-iam-btn small" disabled={busy}
                                onClick={() => signOutEverywhere(u)}>{T.actions.signOutEverywhere}</button>
                            )}
                          </div>
                        )}
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
        <UserEditor
          user={editor.user}
          roles={roles}
          canGrantRole={canGrantRole}
          onClose={() => setEditor(null)}
          onSaved={(saved, tempPassword) => {
            setEditor(null);
            if (editor.user) {
              // Own name, language or roles changed: reload the session so the console follows.
              if (saved.id === me?.id) refresh();
              replace(saved);
              setNotice({ kind: 'ok', text: T.saved });
            } else {
              setUsers((list) => [...(list ?? []), saved].sort((a, b) => a.displayName.localeCompare(b.displayName)));
              if (tempPassword) setTemp({ user: saved, tempPassword });
            }
          }}
        />
      )}

      {temp && <TempPasswordDialog user={temp.user} tempPassword={temp.tempPassword} onClose={() => setTemp(null)} />}
    </div>
  );
};
