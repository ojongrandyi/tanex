// One post in the Blog studio (BLOG_SPEC §4): title, the TipTap body (lazy chunk), the side panel
// (slug, excerpt, cover + alt, categories, tags, author, SEO with a live Google/WhatsApp preview,
// reading time, language + translation) and the actions the user's permissions allow. Changes are
// saved with "Save draft" and every 20 s while there are unsaved changes; a save sends the
// version it started from, so a newer save by someone else is never overwritten (409).
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, Send, Globe2, CalendarClock, Undo, Archive, Trash2, Save, ImagePlus, X, Languages } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ADMIN_PATH, DOMAIN } from '../../config/brand';
import { slugify, isValidSlug } from '../../shared/blogSlug';
import { IamDialog } from '../components/IamDialog';
import { MediaLibrary } from './MediaLibrary';
import { blogApi, type BlogCategory, type BlogMedia, type BlogPost, type DocNode, type PostInput } from './blogApi';
import { BLOG_TEXT, fill } from './strings';
import { canEditPost, epochToOfficeInput, errorText, officeInputToEpoch, statusChipClass, when } from './studioUtil';

const RichEditor = lazy(() => import('./editor/RichEditor'));

const T = BLOG_TEXT;
const AUTOSAVE_MS = 20_000;
const EXCERPT_GUIDE = 160;
const LIMITS = { title: 160, excerpt: 300, seoTitle: 120, seoDescription: 300, alt: 300 };

interface Form {
  title: string;
  slug: string;
  excerpt: string;
  coverMediaId: string | null;
  coverUrl: string | null;
  coverAlt: string;
  categoryIds: string[];
  tags: string;
  authorUserId: string;
  seoTitle: string;
  seoDescription: string;
}

function formOf(post: BlogPost): Form {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverMediaId: post.coverMediaId,
    coverUrl: post.cover?.url ?? null,
    coverAlt: post.coverAlt,
    categoryIds: post.categories.map((c) => c.id),
    tags: post.tags.join(', '),
    authorUserId: post.author.id,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription
  };
}

function payloadOf(form: Form, doc: DocNode): PostInput {
  return {
    title: form.title,
    slug: form.slug || undefined,
    excerpt: form.excerpt,
    content: doc,
    coverMediaId: form.coverMediaId,
    coverAlt: form.coverAlt || null,
    categoryIds: form.categoryIds,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    authorUserId: form.authorUserId,
    seoTitle: form.seoTitle || null,
    seoDescription: form.seoDescription || null
  };
}

const Counter: React.FC<{ n: number; max: number; guide?: number }> = ({ n, max, guide }) => (
  <span className={`tx-blog-count${n > (guide ?? max) ? ' is-over' : ''}`} aria-hidden="true">{fill(T.panel.chars, { n, max: guide ?? max })}</span>
);

const SeoPreview: React.FC<{ title: string; description: string; path: string; coverUrl: string | null }> = ({ title, description, path, coverUrl }) => {
  const crumbs = path.split('/').filter(Boolean).join(' › ');
  const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  return (
    <div className="tx-blog-seo-previews">
      <figure className="tx-blog-serp" aria-label={T.panel.previewGoogle}>
        <figcaption>{T.panel.previewGoogle}</figcaption>
        <div className="tx-blog-serp-url">{DOMAIN} › {crumbs}</div>
        <div className="tx-blog-serp-title">{short(title, 60) || '—'}</div>
        <div className="tx-blog-serp-desc">{short(description, 160) || '—'}</div>
      </figure>
      <figure className="tx-blog-wa" aria-label={T.panel.previewWhatsApp}>
        <figcaption>{T.panel.previewWhatsApp}</figcaption>
        <div className="tx-blog-wa-card">
          {coverUrl ? <img src={coverUrl} alt="" /> : <div className="tx-blog-wa-noimg" />}
          <div className="tx-blog-wa-text">
            <strong>{short(title, 70) || '—'}</strong>
            <span>{short(description, 100)}</span>
            <small>{DOMAIN}</small>
          </div>
        </div>
      </figure>
    </div>
  );
};

type Busy = null | 'save' | 'action';

export const PostEditor: React.FC<{
  postId: string;
  onBack: () => void;
  onOpenPost: (id: string) => void;
}> = ({ postId, onBack, onOpenPost }) => {
  const { user, can } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [doc, setDoc] = useState<DocNode | null>(null);
  const [words, setWords] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [slugLinked, setSlugLinked] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [authors, setAuthors] = useState<{ id: string; name: string; jobTitle: string }[]>([]);
  const [coverPicker, setCoverPicker] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const docReady = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const p = await blogApi.getPost(postId);
      const f = formOf(p);
      setPost(p);
      setForm(f);
      setDoc(p.content);
      docReady.current = false;
      setSavedSnapshot(JSON.stringify(payloadOf(f, p.content)));
      setSlugLinked(p.publishedAt === null && p.slug === slugify(p.title));
      setConflict(false);
      setSaveError(null);
      setEditorKey((k) => k + 1);
      blogApi.listCategories(p.locale).then(setCategories).catch(() => setCategories([]));
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (can('blog.edit_any')) blogApi.authors().then(setAuthors).catch(() => setAuthors([]));
  }, [can]);

  const editable = !!post && canEditPost(post, user?.id, can) && !conflict;
  const payload = useMemo(() => (form && doc ? payloadOf(form, doc) : null), [form, doc]);
  const snapshot = useMemo(() => (payload ? JSON.stringify(payload) : ''), [payload]);
  const dirty = !!payload && snapshot !== savedSnapshot;

  const setField = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const onTitle = (title: string) => {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, title };
      if (slugLinked) next.slug = slugify(title) || f.slug;
      return next;
    });
  };

  const onDocChange = useCallback((d: DocNode, w: number) => {
    setWords(w);
    // The editor reports its first state on creation; that is the loaded post, not a change.
    if (!docReady.current) {
      docReady.current = true;
      return;
    }
    setDoc(d);
  }, []);

  /** Saves pending changes. Resolves true when nothing is left unsaved. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!post || !payload || !editable) return !dirty;
    if (!dirty) return true;
    if (payload.slug && !isValidSlug(payload.slug)) {
      setSaveError(T.panel.slugHint);
      return false;
    }
    const sent = snapshot;
    setBusy((b) => b ?? 'save');
    setSaveError(null);
    try {
      const saved = await blogApi.updatePost(post.id, { ...payload, expectedUpdatedAt: post.updatedAt });
      setPost(saved);
      setSavedSnapshot(sent);
      setLastSavedAt(Date.now());
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'BLOG_POST_CHANGED') setConflict(true);
      else setSaveError(errorText(e));
      return false;
    } finally {
      setBusy((b) => (b === 'save' ? null : b));
    }
  }, [post, payload, editable, dirty, snapshot]);

  // Autosave every 20 s while there are unsaved changes.
  const saveRef = useRef(save);
  saveRef.current = save;
  const stateRef = useRef({ dirty, busy, editable });
  stateRef.current = { dirty, busy, editable };
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = stateRef.current;
      if (s.dirty && !s.busy && s.editable) saveRef.current();
    }, AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const leave = async (go: () => void) => {
    if (dirty && editable && !(await save()) && !window.confirm(T.editor.leaveConfirm)) return;
    go();
  };

  const run = async (fn: () => Promise<BlogPost>, done: string) => {
    if (!post) return;
    setNotice(null);
    if (editable && dirty && !(await save())) return;
    setBusy('action');
    try {
      const updated = await fn();
      setPost(updated);
      setNotice({ kind: 'ok', text: done });
    } catch (e) {
      setNotice({ kind: 'error', text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const preview = async () => {
    if (!post) return;
    setNotice(null);
    // Opened before any await so the browser treats it as a click, not a pop-up.
    const win = window.open('', '_blank');
    if (!win) { setNotice({ kind: 'error', text: T.actions.previewBlocked }); return; }
    try {
      if (editable && dirty && !(await save())) { win.close(); return; }
      const { token } = await blogApi.previewToken(post.id);
      win.opener = null;
      win.location.href = `${ADMIN_PATH}#blog-preview=${encodeURIComponent(token)}`;
    } catch (e) {
      win.close();
      setNotice({ kind: 'error', text: errorText(e) });
    }
  };

  const remove = async () => {
    if (!post || !window.confirm(T.actions.deleteConfirm)) return;
    setBusy('action');
    try {
      await blogApi.deletePost(post.id);
      onBack();
    } catch (e) {
      setNotice({ kind: 'error', text: errorText(e) });
      setBusy(null);
    }
  };

  const createTranslation = async () => {
    if (!post || !form) return;
    if (editable && dirty && !(await save())) return;
    setBusy('action');
    try {
      const created = await blogApi.createPost({ translationOf: post.id, title: form.title });
      onOpenPost(created.id);
    } catch (e) {
      setNotice({ kind: 'error', text: errorText(e) });
      setBusy(null);
    }
  };

  const pickCover = (m: BlogMedia) => {
    setForm((f) => (f ? { ...f, coverMediaId: m.id, coverUrl: m.url, coverAlt: f.coverAlt || m.alt } : f));
    setCoverPicker(false);
  };

  if (loadError) {
    return (
      <div className="tx-iam">
        <button type="button" className="tx-iam-btn" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> {T.editor.back}</button>
        <div className="tx-iam-notice error" role="alert">{loadError}</div>
      </div>
    );
  }
  if (!post || !form || !doc) return <p className="tx-iam-muted" role="status">…</p>;

  const other = post.locale === 'en' ? 'fr' : 'en';
  const translation = post.translations.find((t) => t.locale === other);
  const canWrite = can('blog.write') || can('blog.edit_any');
  const canPublish = can('blog.publish');
  const live = post.status === 'PUBLISHED' || post.status === 'SCHEDULED';
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const lockedForWriter = !canEditPost(post, user?.id, can) && post.author.id === user?.id && can('blog.write');
  const saveState = busy === 'save' ? T.editor.saving
    : saveError ? fill(T.editor.saveFailed, { error: saveError })
    : dirty ? T.editor.unsaved
    : lastSavedAt ? fill(T.editor.saved, { time: when(lastSavedAt) }) : '';

  return (
    <div className="tx-blog-edit animate-fade-in">
      <div className="tx-blog-edit-bar">
        <button type="button" className="tx-iam-btn" onClick={() => leave(onBack)}>
          <ArrowLeft size={16} aria-hidden="true" /> {T.editor.back}
        </button>
        <span className={statusChipClass(post.status)}>{T.status[post.status]}</span>
        {post.status === 'SCHEDULED' && <span className="tx-iam-muted">{fill(T.list.scheduledFor, { date: when(post.publishedAt) })}</span>}
        <span className={`tx-blog-savestate${saveError ? ' is-error' : ''}`} role="status" aria-live="polite">{saveState}</span>
        <div className="tx-blog-edit-actions">
          {editable && (
            <button type="button" className="tx-iam-btn" onClick={() => save()} disabled={!dirty || !!busy}>
              <Save size={16} aria-hidden="true" /> {T.actions.save}
            </button>
          )}
          <button type="button" className="tx-iam-btn" onClick={preview} disabled={!!busy}>
            <Eye size={16} aria-hidden="true" /> {T.actions.preview}
          </button>
          {editable && post.status === 'DRAFT' && !canPublish && (
            <button type="button" className="tx-iam-btn primary" onClick={() => run(() => blogApi.submit(post.id), T.actions.done.submit)} disabled={!!busy}>
              <Send size={16} aria-hidden="true" /> {T.actions.submit}
            </button>
          )}
          {canPublish && post.status !== 'PUBLISHED' && (
            <>
              <button type="button" className="tx-iam-btn" onClick={() => { setScheduleAt(epochToOfficeInput(Date.now() + 3600_000)); setScheduleOpen(true); }} disabled={!!busy}>
                <CalendarClock size={16} aria-hidden="true" /> {T.actions.schedule}
              </button>
              <button type="button" className="tx-iam-btn primary" onClick={() => run(() => blogApi.publish(post.id), T.actions.done.publish)} disabled={!!busy}>
                <Globe2 size={16} aria-hidden="true" /> {T.actions.publish}
              </button>
            </>
          )}
          {canPublish && live && (
            <button type="button" className="tx-iam-btn" disabled={!!busy}
              onClick={() => window.confirm(T.actions.unpublishConfirm) && run(() => blogApi.unpublish(post.id), T.actions.done.unpublish)}>
              <Undo size={16} aria-hidden="true" /> {T.actions.unpublish}
            </button>
          )}
          {canPublish && post.status !== 'ARCHIVED' && (
            <button type="button" className="tx-iam-btn" disabled={!!busy}
              onClick={() => window.confirm(T.actions.archiveConfirm) && run(() => blogApi.archive(post.id), T.actions.done.archive)}>
              <Archive size={16} aria-hidden="true" /> {T.actions.archive}
            </button>
          )}
          {canEditPost(post, user?.id, can) && !live && (
            <button type="button" className="tx-iam-btn danger" onClick={remove} disabled={!!busy}>
              <Trash2 size={16} aria-hidden="true" /> {T.actions.delete}
            </button>
          )}
        </div>
      </div>

      {notice && <div className={`tx-iam-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
      {conflict && (
        <div className="tx-iam-notice error" role="alert">
          {T.editor.conflict}{' '}
          <button type="button" className="tx-iam-btn small" onClick={load}>{T.editor.reload}</button>
        </div>
      )}
      {!editable && !conflict && (
        <div className="tx-iam-notice" role="note">{lockedForWriter ? T.editor.locked : T.editor.readOnly}</div>
      )}

      <div className="tx-blog-edit-grid">
        <div className="tx-blog-edit-main">
          <label className="tx-blog-title-field">
            <span className="tx-sr-only">{T.editor.title}</span>
            <textarea
              rows={1}
              value={form.title}
              maxLength={LIMITS.title}
              placeholder={T.editor.titlePlaceholder}
              onChange={(e) => onTitle(e.target.value.replace(/\n/g, ' '))}
              readOnly={!editable}
            />
          </label>
          <Suspense fallback={<p className="tx-iam-muted" role="status">…</p>}>
            <RichEditor key={editorKey} content={post.content} editable={editable} onChange={onDocChange} />
          </Suspense>
          <p className="tx-blog-wordcount tx-iam-muted">
            {fill(T.editor.words, { n: words })} · {fill(T.editor.readingTime, { n: readingMinutes })}
          </p>
        </div>

        <aside className="tx-blog-panel" aria-label={T.panel.label}>
          <fieldset disabled={!editable} className="tx-blog-panel-fields">
            <section className="tx-iam-card">
              <label className="tx-iam-field">
                <span>{T.panel.slug}</span>
                <input type="text" value={form.slug} maxLength={80} spellCheck={false}
                  onChange={(e) => { setSlugLinked(false); setField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-')); }}
                  aria-invalid={form.slug !== '' && !isValidSlug(form.slug) ? true : undefined} aria-describedby="tx-blog-slug-hint" />
                <small id="tx-blog-slug-hint">/{post.locale === 'fr' ? 'fr/' : ''}blog/{form.slug || '…'} · {T.panel.slugHint}</small>
              </label>
              {!slugLinked && editable && (
                <button type="button" className="tx-iam-btn small" onClick={() => { setSlugLinked(true); setField('slug', slugify(form.title)); }}>
                  {T.panel.slugFromTitle}
                </button>
              )}
              <label className="tx-iam-field">
                <span>{T.panel.excerpt} <Counter n={form.excerpt.length} max={LIMITS.excerpt} guide={EXCERPT_GUIDE} /></span>
                <textarea rows={3} value={form.excerpt} maxLength={LIMITS.excerpt} onChange={(e) => setField('excerpt', e.target.value)} aria-describedby="tx-blog-excerpt-hint" />
                <small id="tx-blog-excerpt-hint">{T.panel.excerptHint}</small>
              </label>
            </section>

            <section className="tx-iam-card">
              <h3 className="tx-blog-panel-h">{T.panel.cover}</h3>
              {form.coverUrl ? (
                <img className="tx-blog-cover-thumb" src={form.coverUrl} alt="" />
              ) : null}
              <div className="tx-blog-row">
                <button type="button" className="tx-iam-btn small" onClick={() => setCoverPicker(true)}>
                  <ImagePlus size={14} aria-hidden="true" /> {T.panel.coverChoose}
                </button>
                {form.coverMediaId && (
                  <button type="button" className="tx-iam-btn small" onClick={() => setForm((f) => (f ? { ...f, coverMediaId: null, coverUrl: null, coverAlt: '' } : f))}>
                    <X size={14} aria-hidden="true" /> {T.panel.coverRemove}
                  </button>
                )}
              </div>
              {form.coverMediaId && (
                <label className="tx-iam-field">
                  <span>{T.panel.coverAlt}</span>
                  <input type="text" value={form.coverAlt} maxLength={LIMITS.alt} onChange={(e) => setField('coverAlt', e.target.value)}
                    aria-invalid={!form.coverAlt.trim() ? true : undefined} aria-describedby="tx-blog-coveralt-hint" />
                  <small id="tx-blog-coveralt-hint">{T.editor.image.altHint}</small>
                </label>
              )}
            </section>

            <section className="tx-iam-card">
              <fieldset className="tx-blog-cats">
                <legend className="tx-blog-panel-h">{T.panel.categories}</legend>
                {categories.length === 0 ? <p className="tx-iam-hint">{T.panel.noCategories}</p> : categories.map((c) => (
                  <label key={c.id} className="tx-iam-check">
                    <input type="checkbox" checked={form.categoryIds.includes(c.id)}
                      onChange={(e) => setField('categoryIds', e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((x) => x !== c.id))} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </fieldset>
              <label className="tx-iam-field">
                <span>{T.panel.tags}</span>
                <input type="text" value={form.tags} onChange={(e) => setField('tags', e.target.value)} aria-describedby="tx-blog-tags-hint" />
                <small id="tx-blog-tags-hint">{T.panel.tagsHint}</small>
              </label>
              <label className="tx-iam-field">
                <span>{T.panel.author}</span>
                {can('blog.edit_any') && authors.length > 0 ? (
                  <select value={form.authorUserId} onChange={(e) => setField('authorUserId', e.target.value)}>
                    {!authors.some((a) => a.id === form.authorUserId) && <option value={form.authorUserId}>{post.author.name ?? '—'}</option>}
                    {authors.map((a) => <option key={a.id} value={a.id}>{a.name}{a.jobTitle ? ` · ${a.jobTitle}` : ''}</option>)}
                  </select>
                ) : (
                  <input type="text" value={post.author.name ?? ''} readOnly />
                )}
              </label>
            </section>

            <section className="tx-iam-card">
              <h3 className="tx-blog-panel-h">{T.panel.seo}</h3>
              <label className="tx-iam-field">
                <span>{T.panel.seoTitle} <Counter n={form.seoTitle.length} max={LIMITS.seoTitle} guide={60} /></span>
                <input type="text" value={form.seoTitle} maxLength={LIMITS.seoTitle} placeholder={form.title} onChange={(e) => setField('seoTitle', e.target.value)} aria-describedby="tx-blog-seot-hint" />
                <small id="tx-blog-seot-hint">{T.panel.seoTitleHint}</small>
              </label>
              <label className="tx-iam-field">
                <span>{T.panel.seoDescription} <Counter n={form.seoDescription.length} max={LIMITS.seoDescription} guide={EXCERPT_GUIDE} /></span>
                <textarea rows={3} value={form.seoDescription} maxLength={LIMITS.seoDescription} placeholder={form.excerpt} onChange={(e) => setField('seoDescription', e.target.value)} aria-describedby="tx-blog-seod-hint" />
                <small id="tx-blog-seod-hint">{T.panel.seoDescriptionHint}</small>
              </label>
              <SeoPreview
                title={form.seoTitle || form.title}
                description={form.seoDescription || form.excerpt}
                path={`/${post.locale === 'fr' ? 'fr/' : ''}blog/${form.slug}`}
                coverUrl={form.coverUrl}
              />
            </section>
          </fieldset>

          <section className="tx-iam-card">
            <dl className="tx-blog-facts">
              <div><dt>{T.panel.readingTime}</dt><dd>{fill(T.editor.readingTime, { n: readingMinutes })}</dd></div>
              <div><dt>{T.panel.language}</dt><dd>{T.language[post.locale]}</dd></div>
              <div>
                <dt>{T.panel.translation}</dt>
                <dd>
                  {translation ? (
                    <button type="button" className="tx-iam-btn small" onClick={() => leave(() => onOpenPost(translation.id))}>
                      <Languages size={14} aria-hidden="true" /> {fill(T.panel.openTranslation, { lang: T.language[other] })}
                    </button>
                  ) : canWrite ? (
                    <button type="button" className="tx-iam-btn small" onClick={createTranslation} disabled={!!busy}>
                      <Languages size={14} aria-hidden="true" /> {other === 'fr' ? T.panel.createFrench : T.panel.createEnglish}
                    </button>
                  ) : '—'}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      {coverPicker && (
        <IamDialog title={T.panel.cover} onClose={() => setCoverPicker(false)}>
          <MediaLibrary onPick={pickCover} selectedId={form.coverMediaId} />
          <div className="tx-iam-dialog-actions">
            <button type="button" className="tx-iam-btn" onClick={() => setCoverPicker(false)}>{T.media.close}</button>
          </div>
        </IamDialog>
      )}
      {scheduleOpen && (
        <IamDialog title={T.actions.schedule} onClose={() => setScheduleOpen(false)}>
          <form className="tx-iam-form" onSubmit={(e) => {
            e.preventDefault();
            const at = officeInputToEpoch(scheduleAt);
            if (!at) return;
            setScheduleOpen(false);
            run(() => blogApi.publish(post.id, at), T.actions.done.schedule);
          }}>
            <label className="tx-iam-field">
              <span>{T.actions.scheduleAt}</span>
              <input type="datetime-local" value={scheduleAt} min={epochToOfficeInput(Date.now())} onChange={(e) => setScheduleAt(e.target.value)} required />
            </label>
            <div className="tx-iam-dialog-actions">
              <button type="button" className="tx-iam-btn" onClick={() => setScheduleOpen(false)}>{T.actions.cancel}</button>
              <button type="submit" className="tx-iam-btn primary" disabled={!officeInputToEpoch(scheduleAt)}>{T.actions.scheduleConfirm}</button>
            </div>
          </form>
        </IamDialog>
      )}
    </div>
  );
};
