// My account → Author profile (tracker F.2; IAM_RBAC_SPEC §9): photo, job title and short bio,
// shown with the user's name on the blog. The photo is compressed in the browser
// (src/services/imageCompress.ts) to 512 px WebP; the server checks it again.
import React, { useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, PenLine, ImagePlus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { compressImage, ImageCompressError } from '../../services/imageCompress';
import { useAuth } from '../../auth/AuthContext';
import { AUTH_TEXT } from '../../auth/strings';
import { profileApi } from '../blog/blogApi';

const T = AUTH_TEXT.account;
const A = T.author;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
}

export const AuthorProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [busy, setBusy] = useState<null | 'save' | 'photo'>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const changed = jobTitle.trim() !== (user.jobTitle ?? '') || bio.trim() !== (user.bio ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy('save');
    setNotice(null);
    try {
      const updated = await api.updateMyAccount({ jobTitle: jobTitle.trim(), bio: bio.trim() });
      if (updated) {
        setUser(updated);
        setJobTitle(updated.jobTitle ?? '');
        setBio(updated.bio ?? '');
      }
      setNotice({ kind: 'ok', text: T.saved });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    setNotice(null);
    try {
      const image = await compressImage(file, { maxSide: 512, maxBytes: 1024 * 1024 });
      const updated = await profileApi.uploadAvatar(image);
      if (updated) setUser(updated);
      setNotice({ kind: 'ok', text: T.saved });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ImageCompressError || err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setBusy('photo');
    setNotice(null);
    try {
      const updated = await profileApi.removeAvatar();
      if (updated) setUser(updated);
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="tx-account-card" aria-labelledby="tx-account-author">
      <header className="tx-account-card-head">
        <PenLine size={18} aria-hidden="true" />
        <h2 id="tx-account-author">{A.title}</h2>
      </header>
      <p className="tx-account-meta">{A.intro}</p>

      <div className="tx-account-avatar-row">
        {user.avatarUrl ? (
          <img className="tx-account-avatar" src={user.avatarUrl} alt={A.photo} width={72} height={72} />
        ) : (
          <span className="tx-account-avatar tx-account-avatar--initials" aria-hidden="true">{initialsOf(user.displayName)}</span>
        )}
        <div className="tx-account-avatar-actions">
          <button type="button" className="tx-account-btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <ImagePlus size={15} aria-hidden="true" />
            <span>{busy === 'photo' ? A.uploading : user.avatarUrl ? A.replace : A.upload}</span>
          </button>
          {user.avatarUrl && (
            <button type="button" className="tx-account-btn" onClick={removePhoto} disabled={!!busy}>
              <Trash2 size={15} aria-hidden="true" />
              <span>{A.remove}</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden
            aria-label={A.upload} onChange={(e) => onPhoto(e.target.files?.[0])} />
          <small>{A.photoHint}</small>
        </div>
      </div>

      <form onSubmit={save} className="tx-account-form">
        <label className="tx-account-field">
          <span>{A.jobTitle}</span>
          <input type="text" value={jobTitle} maxLength={80} autoComplete="organization-title"
            onChange={(e) => { setJobTitle(e.target.value); setNotice(null); }} />
        </label>
        <label className="tx-account-field">
          <span>{A.bio}</span>
          <textarea rows={4} value={bio} maxLength={500} onChange={(e) => { setBio(e.target.value); setNotice(null); }} />
          <small>{A.bioHint} {bio.length}/500</small>
        </label>
        {notice && (
          <div className={`tx-account-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            {notice.kind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
            <span>{notice.text}</span>
          </div>
        )}
        <div className="tx-account-actions">
          <button type="submit" className="tx-account-btn primary" disabled={!changed || !!busy}>
            {busy === 'save' ? T.saving : T.save}
          </button>
        </div>
      </form>
    </section>
  );
};
