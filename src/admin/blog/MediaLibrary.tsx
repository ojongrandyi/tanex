// Blog media library (BLOG_SPEC §4): upload, pick and delete images. Each upload is compressed in
// the browser (src/services/imageCompress.ts) to a 1600 px WebP and an 800 px WebP copy for
// srcset; the server checks both again. Used as the Media tab and as the picker in the editor.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Check } from 'lucide-react';
import { compressImage, ImageCompressError } from '../../services/imageCompress';
import { useAuth } from '../../auth/AuthContext';
import { blogApi, type BlogMedia } from './blogApi';
import { BLOG_TEXT } from './strings';

const T = BLOG_TEXT.media;
/** Server cap per file (MAX_BLOG_IMAGE_BYTES). */
const MAX_BYTES = 3 * 1024 * 1024;

export async function prepareAndUpload(file: File): Promise<BlogMedia> {
  const large = await compressImage(file, { maxSide: 1600, maxBytes: MAX_BYTES });
  const small = large.width > 800 ? await compressImage(file, { maxSide: 800, maxBytes: MAX_BYTES }) : null;
  return blogApi.uploadMedia(large, small);
}

function errorText(err: unknown): string {
  if (err instanceof ImageCompressError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

export const MediaLibrary: React.FC<{
  /** Picker mode: a click selects the image. */
  onPick?: (media: BlogMedia) => void;
  selectedId?: string | null;
}> = ({ onPick, selectedId }) => {
  const { user, can } = useAuth();
  const [items, setItems] = useState<BlogMedia[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canUpload = can('blog.write') || can('blog.edit_any');

  const load = useCallback(() => {
    blogApi.listMedia().then(setItems).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let last: BlogMedia | null = null;
      for (const file of Array.from(files)) last = await prepareAndUpload(file);
      load();
      if (last && onPick && files.length === 1) onPick(last);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (m: BlogMedia) => {
    if (!window.confirm(T.deleteConfirm)) return;
    setError(null);
    try {
      await blogApi.deleteMedia(m.id);
      setItems((list) => (list ?? []).filter((x) => x.id !== m.id));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const mayDelete = (m: BlogMedia) => canUpload && (can('blog.edit_any') || m.uploadedBy === user?.id);

  return (
    <div className="tx-blog-media">
      {canUpload && (
        <div className="tx-blog-media-bar">
          <button type="button" className="tx-iam-btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus size={16} aria-hidden="true" /> {busy ? T.uploading : T.upload}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
            multiple={!onPick}
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          <span className="tx-iam-hint">{T.hint}</span>
        </div>
      )}
      {error && <div className="tx-iam-notice error" role="alert">{error}</div>}
      {items === null ? (
        <p className="tx-iam-muted" role="status">…</p>
      ) : items.length === 0 ? (
        <p className="tx-iam-muted">{T.empty}</p>
      ) : (
        <ul className="tx-blog-media-grid">
          {items.map((m) => {
            const thumb = m.small?.url ?? m.url;
            const selected = selectedId === m.id;
            return (
              <li key={m.id} className={`tx-blog-media-item${selected ? ' is-selected' : ''}`}>
                {onPick ? (
                  <button type="button" className="tx-blog-media-pick" onClick={() => onPick(m)} aria-pressed={selected}
                    aria-label={`${T.select}${m.alt ? `: ${m.alt}` : ''} (${m.width}×${m.height})`}>
                    <img src={thumb} alt="" width={m.small?.width ?? m.width ?? undefined} height={m.small?.height ?? m.height ?? undefined} loading="lazy" />
                    {selected && <span className="tx-blog-media-check" aria-hidden="true"><Check size={16} /></span>}
                  </button>
                ) : (
                  <img src={thumb} alt={m.alt} width={m.small?.width ?? m.width ?? undefined} height={m.small?.height ?? m.height ?? undefined} loading="lazy" />
                )}
                <div className="tx-blog-media-meta">
                  <span>{m.width}×{m.height} · {Math.round(m.sizeBytes / 1024)} KB</span>
                  {!onPick && mayDelete(m) && (
                    <button type="button" className="tx-iam-btn small danger" onClick={() => remove(m)} aria-label={`${T.delete} ${m.width}×${m.height}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
