// Roles (docs/IAM_RBAC_SPEC.md §9): list of roles; editor with the permission checklist grouped
// by area, "Users with this role" count, system roles marked, Super Admin read-only. The
// catalogue comes from src/shared/permissions.ts (the same list the server syncs at boot).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Plus } from 'lucide-react';
import { api, type StaffRole } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { IAM_TEXT, iamErrorText } from '../../auth/strings';
import { PERMISSIONS, PERMISSION_GROUPS, hasPermission, type PermissionKey } from '../../shared/permissions';
import './IamViews.css';

const T = IAM_TEXT.roles;
const NEW = '__new__';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const NoticeLine: React.FC<{ notice: Notice }> = ({ notice }) =>
  notice ? (
    <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  ) : null;

interface Draft { name: string; description: string; permissions: string[] }

const sameKeys = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export const RolesView: React.FC = () => {
  const { user: me, refresh } = useAuth();
  const granted = me?.permissions ?? [];
  const [roles, setRoles] = useState<StaffRole[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', description: '', permissions: [] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.listRoles();
      setRoles(list);
      return list;
    } catch (err) {
      setNotice({ kind: 'error', text: iamErrorText(err) });
      return null;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const role = roles?.find((r) => r.id === selected) ?? null;
  const creating = selected === NEW;

  const editorRef = useRef<HTMLDivElement>(null);
  const select = (id: string, list = roles, reveal = false) => {
    setSelected(id);
    setNotice(null);
    // One column (≤ 900 px): the editor sits under the list, so bring it into view.
    if (reveal && window.matchMedia('(max-width: 900px)').matches) {
      window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
    const r = list?.find((x) => x.id === id);
    setDraft(r ? { name: r.name, description: r.description, permissions: [...r.permissions] }
      : { name: '', description: '', permissions: [] });
  };

  // Only keys the signed-in user holds can be added or removed (the server checks this too).
  const canToggle = (key: PermissionKey) => hasPermission(granted, key);
  const toggle = (key: string) => setDraft((d) => ({
    ...d,
    permissions: d.permissions.includes(key) ? d.permissions.filter((k) => k !== key) : [...d.permissions, key]
  }));

  const dirty = creating
    ? draft.name.trim() !== ''
    : !!role && (draft.name.trim() !== role.name || draft.description.trim() !== role.description || !sameKeys(draft.permissions, role.permissions));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    if (!draft.name.trim()) { setNotice({ kind: 'error', text: IAM_TEXT.errors.INVALID_NAME }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const body = { name: draft.name.trim(), description: draft.description.trim(), permissions: draft.permissions };
      const saved = creating ? await api.createRole(body) : await api.updateRole(role!.id, body);
      const list = await load();
      select(saved.id, list);
      setNotice({ kind: 'ok', text: T.saved });
      // The signed-in user's own permissions may have changed.
      if (me?.roles.some((r) => r.id === saved.id)) refresh();
    } catch (err) {
      setNotice({ kind: 'error', text: iamErrorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!role || busy || !window.confirm(T.confirmDelete(role.name))) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.deleteRole(role.id);
      setSelected(null);
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: iamErrorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => PERMISSION_GROUPS.map((g) => ({
    ...g,
    items: PERMISSIONS.filter((p) => p.group === g.key)
  })), []);

  return (
    <div className="tx-roles animate-fade-in">
      <div className="tx-iam-card">
        <div className="tx-iam-toolbar" style={{ marginBottom: '0.75rem' }}>
          <strong>{T.title}</strong>
          <button type="button" className="tx-iam-btn small primary" onClick={() => select(NEW, roles, true)}>
            <Plus size={14} aria-hidden="true" />
            <span>{T.add}</span>
          </button>
        </div>
        {roles === null ? <p className="tx-iam-muted">{T.loading}</p> : (
          <ul className="tx-roles-list">
            {roles.map((r) => (
              <li key={r.id}>
                <button type="button" className="tx-roles-item" aria-current={r.id === selected ? 'true' : undefined}
                  onClick={() => select(r.id, roles, true)}>
                  <strong>
                    {r.isLocked && <Lock size={12} aria-hidden="true" style={{ marginRight: 4 }} />}
                    {r.name}
                  </strong>
                  <span className="tx-iam-sub">{T.usersWithRole(r.userCount)}</span>
                  {r.isSystem && <span className="tx-iam-chip" style={{ marginTop: 4 }}>{T.system}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="tx-iam-card" ref={editorRef} style={{ scrollMarginTop: '4.5rem' }}>
        {!creating && !role && <p className="tx-iam-muted">{T.selectPrompt}</p>}

        {role?.isLocked && (
          <div className="tx-iam-form">
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{role.name}</h2>
            {role.description && <p className="tx-iam-muted" style={{ margin: 0 }}>{role.description}</p>}
            <p className="tx-iam-muted" style={{ margin: 0 }}>{T.usersWithRole(role.userCount)}</p>
            <div className="tx-iam-notice ok" role="note">
              <Lock size={14} aria-hidden="true" />
              <span>{T.locked} {T.allPermissions}</span>
            </div>
          </div>
        )}

        {(creating || (role && !role.isLocked)) && (
          <form className="tx-iam-form" onSubmit={save} noValidate>
            <div className="tx-iam-form-row">
              <label className="tx-iam-field">
                <span>{T.name}</span>
                <input type="text" value={draft.name} maxLength={60} required
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="tx-iam-field">
                <span>{T.description}</span>
                <input type="text" value={draft.description} maxLength={200}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
            </div>
            {role && (
              <p className="tx-iam-muted" style={{ margin: 0 }}>
                {T.usersWithRole(role.userCount)}
                {role.isSystem && <span className="tx-iam-chip" style={{ marginLeft: 8 }}>{T.system}</span>}
              </p>
            )}

            <div>
              <strong style={{ fontSize: '0.85rem' }}>{T.permissions}</strong>
              <div className="tx-roles-groups">
                {groups.map((g) => (
                  <fieldset key={g.key} className="tx-roles-group">
                    <legend>{g.label.en}</legend>
                    {g.items.map((p) => {
                      const allowed = canToggle(p.key);
                      return (
                        <label key={p.key} className={`tx-iam-check${allowed ? '' : ' is-unavailable'}`}
                          title={allowed ? undefined : T.notGrantable}>
                          <input type="checkbox" checked={draft.permissions.includes(p.key)} disabled={!allowed}
                            onChange={() => toggle(p.key)} />
                          <span>
                            {p.description.en}
                            <code style={{ display: 'block' }}>{p.key}</code>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
            </div>

            <NoticeLine notice={notice} />
            <div className="tx-iam-dialog-actions" style={{ justifyContent: 'space-between' }}>
              <div>
                {role && !role.isSystem && role.userCount === 0 && (
                  <button type="button" className="tx-iam-btn danger" onClick={remove} disabled={busy}>{T.delete}</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="tx-iam-btn" disabled={busy}
                  onClick={() => (creating ? setSelected(null) : select(role!.id))}>{T.cancel}</button>
                <button type="submit" className="tx-iam-btn primary" disabled={busy || !dirty}>
                  {busy ? T.saving : creating ? T.create : T.save}
                </button>
              </div>
            </div>
          </form>
        )}
        {!creating && !role?.isLocked && !role && notice && <NoticeLine notice={notice} />}
      </div>
    </div>
  );
};
