// Blog categories (BLOG_SPEC §2–§3): one list per language, each linked to its other-language
// version. Changing them needs blog.categories; others see the list read-only.
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Languages } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { slugify } from '../../shared/blogSlug';
import { IamDialog } from '../components/IamDialog';
import { blogApi, type BlogCategory, type BlogLocale } from './blogApi';
import { BLOG_TEXT, fill } from './strings';
import { errorText } from './studioUtil';

const T = BLOG_TEXT.categories;
const L = BLOG_TEXT.language;

interface Draft {
  id?: string;
  locale: BlogLocale;
  translationOf?: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

const CategoryDialog: React.FC<{ draft: Draft; onClose: () => void; onSaved: () => void }> = ({ draft, onClose, onSaved }) => {
  const [d, setD] = useState(draft);
  const [slugTouched, setSlugTouched] = useState(!!draft.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: d.name.trim(), slug: d.slug || undefined, description: d.description, sortOrder: d.sortOrder };
      if (d.id) await blogApi.updateCategory(d.id, body);
      else await blogApi.createCategory({ ...body, locale: d.locale, translationOf: d.translationOf });
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <IamDialog title={`${d.id ? T.edit : T.add} · ${L[d.locale]}`} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit}>
        <label className="tx-iam-field">
          <span>{T.name}</span>
          <input type="text" value={d.name} maxLength={80} required
            onChange={(e) => setD({ ...d, name: e.target.value, slug: slugTouched ? d.slug : slugify(e.target.value) })} />
        </label>
        <label className="tx-iam-field">
          <span>{T.slug}</span>
          <input type="text" value={d.slug} maxLength={80} spellCheck={false}
            onChange={(e) => { setSlugTouched(true); setD({ ...d, slug: e.target.value.toLowerCase() }); }} />
          <small>{BLOG_TEXT.panel.slugHint}</small>
        </label>
        <label className="tx-iam-field">
          <span>{T.description}</span>
          <textarea rows={2} value={d.description} maxLength={300} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </label>
        <label className="tx-iam-field">
          <span>{T.order}</span>
          <input type="number" step={1} value={d.sortOrder} onChange={(e) => setD({ ...d, sortOrder: Number.parseInt(e.target.value, 10) || 0 })} />
        </label>
        {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy || !d.name.trim()}>{T.save}</button>
        </div>
      </form>
    </IamDialog>
  );
};

export const CategoriesManager: React.FC = () => {
  const { can } = useAuth();
  const manage = can('blog.categories');
  const [items, setItems] = useState<BlogCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(() => {
    blogApi.listCategories().then(setItems).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const remove = async (c: BlogCategory) => {
    if (!window.confirm(fill(T.deleteConfirm, { name: c.name }))) return;
    try {
      await blogApi.deleteCategory(c.id);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const byGroup = new Map<string, BlogCategory[]>();
  for (const c of items ?? []) byGroup.set(c.translationGroupId, [...(byGroup.get(c.translationGroupId) ?? []), c]);

  return (
    <div className="tx-iam">
      {!manage && <div className="tx-iam-notice" role="note">{T.noPermission}</div>}
      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      {(['en', 'fr'] as const).map((locale) => {
        const list = (items ?? []).filter((c) => c.locale === locale);
        const other: BlogLocale = locale === 'en' ? 'fr' : 'en';
        return (
          <section key={locale} className="tx-iam-card">
            <div className="tx-blog-section-head">
              <h3 className="tx-blog-panel-h">{T.title} · {L[locale]}</h3>
              {manage && (
                <button type="button" className="tx-iam-btn small primary"
                  onClick={() => setDraft({ locale, name: '', slug: '', description: '', sortOrder: list.length })}>
                  <Plus size={14} aria-hidden="true" /> {T.add}
                </button>
              )}
            </div>
            {items === null ? <p className="tx-iam-muted" role="status">…</p> : list.length === 0 ? <p className="tx-iam-muted">{T.empty}</p> : (
              <table className="tx-iam-table tx-blog-table">
                <thead>
                  <tr>
                    <th scope="col">{T.name}</th>
                    <th scope="col">{T.slug}</th>
                    <th scope="col">{T.order}</th>
                    <th scope="col">{T.posts}</th>
                    <th scope="col">{T.translation}</th>
                    {manage && <th scope="col"><span className="tx-sr-only">{T.edit}</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const twin = (byGroup.get(c.translationGroupId) ?? []).find((x) => x.locale === other);
                    return (
                      <tr key={c.id}>
                        <td data-label={T.name}><strong>{c.name}</strong>{c.description && <div className="tx-iam-sub">{c.description}</div>}</td>
                        <td data-label={T.slug}><code>{c.slug}</code></td>
                        <td data-label={T.order}>{c.sortOrder}</td>
                        <td data-label={T.posts}>{c.postCount ?? 0}</td>
                        <td data-label={T.translation}>
                          {twin ? twin.name : manage ? (
                            <button type="button" className="tx-iam-btn small"
                              onClick={() => setDraft({ locale: other, translationOf: c.id, name: '', slug: '', description: '', sortOrder: c.sortOrder })}>
                              <Languages size={14} aria-hidden="true" /> {fill(T.addTranslation, { lang: L[other] })}
                            </button>
                          ) : <span className="tx-blog-tr is-missing">{other.toUpperCase()} —</span>}
                        </td>
                        {manage && (
                          <td className="tx-iam-row-actions">
                            <button type="button" className="tx-iam-btn small" aria-label={`${T.edit}: ${c.name}`}
                              onClick={() => setDraft({ id: c.id, locale: c.locale, name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder })}>
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                            <button type="button" className="tx-iam-btn small danger" aria-label={`${T.delete}: ${c.name}`} onClick={() => remove(c)}>
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
      {draft && <CategoryDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />}
    </div>
  );
};
