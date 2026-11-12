// Blog studio post list (BLOG_SPEC §4): tabs by status, language filter, search, "only my posts",
// the translation indicator, and a "New post" dialog. Writers without blog.view only get their
// own posts from the server, so the list needs no extra filtering here.
import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { IamDialog } from '../components/IamDialog';
import { blogApi, POST_STATUSES, type BlogLocale, type BlogPostSummary, type PostPage, type PostStatus } from './blogApi';
import { BLOG_TEXT, fill } from './strings';
import { errorText, seesAllPosts, statusChipClass, when } from './studioUtil';

const T = BLOG_TEXT;

const NewPostDialog: React.FC<{ onClose: () => void; onCreated: (id: string) => void }> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [locale, setLocale] = useState<BlogLocale>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const post = await blogApi.createPost({ locale, title: title.trim() });
      onCreated(post.id);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <IamDialog title={T.newPost.title} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={submit}>
        <label className="tx-iam-field">
          <span>{T.newPost.titleLabel}</span>
          <input type="text" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="tx-iam-field">
          <span>{T.newPost.language}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value as BlogLocale)}>
            <option value="en">{T.language.en}</option>
            <option value="fr">{T.language.fr}</option>
          </select>
        </label>
        {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{T.newPost.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={busy || !title.trim()}>{T.newPost.create}</button>
        </div>
      </form>
    </IamDialog>
  );
};

function translationLabel(p: BlogPostSummary): { text: string; missing: boolean } {
  const other = p.locale === 'en' ? 'fr' : 'en';
  if (p.translations.some((t) => t.locale === other)) return { text: T.list.translation.linked, missing: false };
  return { text: other === 'fr' ? T.list.translation.missingFr : T.list.translation.missingEn, missing: true };
}

export const PostList: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const { can } = useAuth();
  const [status, setStatus] = useState<PostStatus | 'ALL'>('ALL');
  const [locale, setLocale] = useState<BlogLocale | ''>('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PostPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const canCreate = can('blog.write') || can('blog.edit_any');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);
  useEffect(() => setPage(1), [status, locale, debounced, mine]);
  useEffect(() => {
    let live = true;
    setError(null);
    blogApi.listPosts({ status: status === 'ALL' ? undefined : status, locale: locale || undefined, q: debounced, mine, page })
      .then((r) => { if (live) setResult(r); })
      .catch((e) => { if (live) setError(errorText(e) || T.list.loadFailed); });
    return () => { live = false; };
  }, [status, locale, debounced, mine, page]);

  const filtered = status !== 'ALL' || !!locale || !!debounced || mine;

  return (
    <div className="tx-iam">
      <div className="tx-blog-tabs" role="tablist" aria-label={T.status.ALL}>
        {(['ALL', ...POST_STATUSES] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} className={`tx-blog-tab${status === s ? ' is-active' : ''}`} onClick={() => setStatus(s)}>
            {T.status[s]}
          </button>
        ))}
      </div>
      <div className="tx-iam-toolbar">
        <input type="search" className="tx-iam-input" placeholder={T.list.search} aria-label={T.list.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="tx-iam-input tx-blog-select" aria-label={T.panel.language} value={locale} onChange={(e) => setLocale(e.target.value as BlogLocale | '')}>
          <option value="">{T.language.all}</option>
          <option value="en">{T.language.en}</option>
          <option value="fr">{T.language.fr}</option>
        </select>
        {seesAllPosts(can) && (
          <label className="tx-iam-check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            <span>{T.list.mine}</span>
          </label>
        )}
        {canCreate && (
          <button type="button" className="tx-iam-btn primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {T.list.newPost}
          </button>
        )}
      </div>

      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      <div className="tx-iam-card tx-blog-table-wrap">
        {result === null ? (
          <p className="tx-iam-muted" role="status">…</p>
        ) : result.data.length === 0 ? (
          <p className="tx-iam-muted">{filtered ? T.list.emptyFiltered : T.list.empty}</p>
        ) : (
          <table className="tx-iam-table tx-blog-table">
            <thead>
              <tr>
                <th scope="col">{T.list.columns.title}</th>
                <th scope="col">{T.list.columns.language}</th>
                <th scope="col">{T.list.columns.author}</th>
                <th scope="col">{T.list.columns.category}</th>
                <th scope="col">{T.list.columns.status}</th>
                <th scope="col">{T.list.columns.date}</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((p) => {
                const tr = translationLabel(p);
                return (
                  <tr key={p.id}>
                    <td data-label={T.list.columns.title}>
                      <button type="button" className="tx-blog-link" onClick={() => onOpen(p.id)}>{p.title}</button>
                      <div className="tx-iam-sub">/{p.locale === 'fr' ? 'fr/' : ''}blog/{p.slug}</div>
                    </td>
                    <td data-label={T.list.columns.language}>
                      <span className="tx-blog-lang">{p.locale.toUpperCase()}</span>
                      <span className={`tx-blog-tr${tr.missing ? ' is-missing' : ''}`}>{tr.text}</span>
                    </td>
                    <td data-label={T.list.columns.author}>{p.author.name ?? '—'}</td>
                    <td data-label={T.list.columns.category}>{p.categories.map((c) => c.name).join(', ') || '—'}</td>
                    <td data-label={T.list.columns.status}><span className={statusChipClass(p.status)}>{T.status[p.status]}</span></td>
                    <td data-label={T.list.columns.date}>
                      {p.status === 'SCHEDULED' ? fill(T.list.scheduledFor, { date: when(p.publishedAt) })
                        : p.status === 'PUBLISHED' ? when(p.publishedAt)
                        : fill(T.list.updated, { date: when(p.updatedAt) })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {result && result.totalPages > 1 && (
        <nav className="tx-blog-pager" aria-label={fill(T.list.page, { page: result.page, pages: result.totalPages })}>
          <button type="button" className="tx-iam-btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>{T.list.prev}</button>
          <span>{fill(T.list.page, { page: result.page, pages: result.totalPages })}</span>
          <button type="button" className="tx-iam-btn small" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>{T.list.next}</button>
        </nav>
      )}
      {creating && <NewPostDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onOpen(id); }} />}
    </div>
  );
};
