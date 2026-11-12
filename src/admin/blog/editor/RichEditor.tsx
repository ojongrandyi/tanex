// TipTap editor for blog posts (BLOG_SPEC §4). Its own chunk inside the Blog studio chunk, so the
// post list opens without loading the editor. The parent owns the document: this component reports
// every change (JSON + word count) and never saves by itself.
import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import {
  Bold, Italic, Link2, Unlink, List, ListOrdered, Quote, Minus, ImagePlus, Table2, MessageSquareWarning,
  Undo2, Redo2, Heading2, Heading3, Heading4, Pilcrow, Rows3, Columns3, Trash2
} from 'lucide-react';
import { IamDialog } from '../../components/IamDialog';
import { MediaLibrary } from '../MediaLibrary';
import type { BlogMedia, DocNode } from '../blogApi';
import { BLOG_TEXT } from '../strings';
import { CALLOUT_TONES, blogExtensions, safeHref, type CalloutTone } from './extensions';
import '../blogProse.css';

const T = BLOG_TEXT.editor;

export interface RichEditorProps {
  content: DocNode;
  editable: boolean;
  onChange: (doc: DocNode, words: number) => void;
}

/** Counts words the way the server does (letters/digits runs). */
function wordsOf(editor: Editor): number {
  return (editor.getText({ blockSeparator: '\n' }).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

const ToolButton: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, active, disabled, children }) => (
  <button
    type="button"
    className={`tx-blog-tool${active ? ' is-active' : ''}`}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    aria-label={label}
    title={label}
    aria-pressed={active === undefined ? undefined : active}
    disabled={disabled}
  >
    {children}
  </button>
);

const LinkDialog: React.FC<{ editor: Editor; onClose: () => void }> = ({ editor, onClose }) => {
  const current = editor.getAttributes('link') as { href?: string; nofollow?: boolean };
  const [href, setHref] = useState(current.href ?? '');
  const [nofollow, setNofollow] = useState(current.nofollow === true);
  const [error, setError] = useState<string | null>(null);
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const safe = safeHref(href);
    if (!safe) { setError(T.link.invalid); return; }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: safe, marks: [{ type: 'link', attrs: { href: safe, nofollow } }] }).run();
    } else {
      chain.setLink({ href: safe, nofollow } as { href: string }).run();
    }
    onClose();
  };
  return (
    <IamDialog title={T.link.title} onClose={onClose}>
      <form className="tx-iam-form" onSubmit={apply} noValidate>
        <label className="tx-iam-field">
          <span>{T.link.url}</span>
          <input type="text" inputMode="url" value={href} onChange={(e) => { setHref(e.target.value); setError(null); }}
            aria-invalid={error ? true : undefined} aria-describedby="tx-blog-link-hint" autoFocus />
          <small id="tx-blog-link-hint">{error ?? T.link.urlHint}</small>
        </label>
        <label className="tx-iam-check">
          <input type="checkbox" checked={nofollow} onChange={(e) => setNofollow(e.target.checked)} />
          <span>{T.link.nofollow}</span>
        </label>
        <div className="tx-iam-dialog-actions">
          {editor.isActive('link') && (
            <button type="button" className="tx-iam-btn danger" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onClose(); }}>
              {T.link.remove}
            </button>
          )}
          <button type="button" className="tx-iam-btn" onClick={onClose}>{BLOG_TEXT.actions.cancel}</button>
          <button type="submit" className="tx-iam-btn primary">{T.link.apply}</button>
        </div>
      </form>
    </IamDialog>
  );
};

/** Pick or upload an image, then give it alt text and an optional caption. */
const ImageDialog: React.FC<{ editor: Editor; onClose: () => void }> = ({ editor, onClose }) => {
  const editing = editor.isActive('image');
  const attrs = editing ? (editor.getAttributes('image') as { src?: string; alt?: string; caption?: string }) : {};
  const [media, setMedia] = useState<{ id?: string; url: string } | null>(attrs.src ? { url: attrs.src } : null);
  const [alt, setAlt] = useState(attrs.alt ?? '');
  const [caption, setCaption] = useState(attrs.caption ?? '');
  const pick = (m: BlogMedia) => {
    setMedia({ id: m.id, url: m.url });
    if (!alt.trim() && m.alt) setAlt(m.alt);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!media || !alt.trim()) return;
    const values = { src: media.url, alt: alt.trim(), caption: caption.trim() };
    if (editing) editor.chain().focus().updateAttributes('image', values).run();
    else editor.chain().focus().insertBlogImage(values).run();
    onClose();
  };
  return (
    <IamDialog title={editing ? T.image.edit : T.image.title} onClose={onClose}>
      <form className="tx-iam-form tx-blog-image-form" onSubmit={submit} noValidate>
        {!editing && <MediaLibrary onPick={pick} selectedId={media?.id ?? null} />}
        {media && <img className="tx-blog-image-preview" src={media.url} alt="" />}
        <label className="tx-iam-field">
          <span>{T.image.alt}</span>
          <input type="text" value={alt} maxLength={300} onChange={(e) => setAlt(e.target.value)} required aria-describedby="tx-blog-alt-hint" />
          <small id="tx-blog-alt-hint">{T.image.altHint}</small>
        </label>
        <label className="tx-iam-field">
          <span>{T.image.caption}</span>
          <input type="text" value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} />
        </label>
        <div className="tx-iam-dialog-actions">
          <button type="button" className="tx-iam-btn" onClick={onClose}>{BLOG_TEXT.actions.cancel}</button>
          <button type="submit" className="tx-iam-btn primary" disabled={!media || !alt.trim()}>
            {editing ? T.image.update : T.image.insert}
          </button>
        </div>
      </form>
    </IamDialog>
  );
};

const Toolbar: React.FC<{ editor: Editor; onLink: () => void; onImage: () => void }> = ({ editor, onLink, onImage }) => {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      p: e.isActive('paragraph'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      h4: e.isActive('heading', { level: 4 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      table: e.isActive('table'),
      callout: e.isActive('callout'),
      tone: (e.getAttributes('callout').tone as CalloutTone | undefined) ?? 'info',
      image: e.isActive('image'),
      undo: e.can().undo(),
      redo: e.can().redo()
    })
  });
  const c = () => editor.chain().focus();
  const tb = T.toolbar;
  return (
    <div className="tx-blog-toolbar" role="toolbar" aria-label={tb.label}>
      <div className="tx-blog-toolgroup">
        <ToolButton label={tb.paragraph} active={s.p} onClick={() => c().setParagraph().run()}><Pilcrow size={16} /></ToolButton>
        <ToolButton label={tb.h2} active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolButton>
        <ToolButton label={tb.h3} active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolButton>
        <ToolButton label={tb.h4} active={s.h4} onClick={() => c().toggleHeading({ level: 4 }).run()}><Heading4 size={16} /></ToolButton>
      </div>
      <div className="tx-blog-toolgroup">
        <ToolButton label={tb.bold} active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></ToolButton>
        <ToolButton label={tb.italic} active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></ToolButton>
        <ToolButton label={tb.link} active={s.link} onClick={onLink}><Link2 size={16} /></ToolButton>
        {s.link && <ToolButton label={tb.unlink} onClick={() => c().extendMarkRange('link').unsetLink().run()}><Unlink size={16} /></ToolButton>}
      </div>
      <div className="tx-blog-toolgroup">
        <ToolButton label={tb.bullet} active={s.bullet} onClick={() => c().toggleBulletList().run()}><List size={16} /></ToolButton>
        <ToolButton label={tb.ordered} active={s.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
        <ToolButton label={tb.quote} active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></ToolButton>
        <ToolButton label={tb.callout} active={s.callout} onClick={() => c().toggleCallout().run()}><MessageSquareWarning size={16} /></ToolButton>
        <ToolButton label={tb.rule} onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></ToolButton>
      </div>
      <div className="tx-blog-toolgroup">
        <ToolButton label={s.image ? T.image.edit : tb.image} active={s.image} onClick={onImage}><ImagePlus size={16} /></ToolButton>
        <ToolButton label={tb.table} active={s.table} disabled={s.table}
          onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></ToolButton>
      </div>
      <div className="tx-blog-toolgroup">
        <ToolButton label={tb.undo} disabled={!s.undo} onClick={() => c().undo().run()}><Undo2 size={16} /></ToolButton>
        <ToolButton label={tb.redo} disabled={!s.redo} onClick={() => c().redo().run()}><Redo2 size={16} /></ToolButton>
      </div>
      {s.table && (
        <div className="tx-blog-toolgroup tx-blog-toolgroup--context" aria-label={tb.table}>
          <button type="button" className="tx-iam-btn small" onClick={() => c().addRowAfter().run()}><Rows3 size={14} aria-hidden="true" /> {T.table.addRow}</button>
          <button type="button" className="tx-iam-btn small" onClick={() => c().addColumnAfter().run()}><Columns3 size={14} aria-hidden="true" /> {T.table.addColumn}</button>
          <button type="button" className="tx-iam-btn small" onClick={() => c().deleteRow().run()}>{T.table.deleteRow}</button>
          <button type="button" className="tx-iam-btn small" onClick={() => c().deleteColumn().run()}>{T.table.deleteColumn}</button>
          <button type="button" className="tx-iam-btn small danger" onClick={() => c().deleteTable().run()}><Trash2 size={14} aria-hidden="true" /> {T.table.deleteTable}</button>
        </div>
      )}
      {s.callout && (
        <div className="tx-blog-toolgroup tx-blog-toolgroup--context" role="group" aria-label={tb.callout}>
          {CALLOUT_TONES.map((tone) => (
            <button key={tone} type="button" className={`tx-iam-btn small${s.tone === tone ? ' primary' : ''}`}
              aria-pressed={s.tone === tone} onClick={() => c().setCalloutTone(tone).run()}>
              {T.callout[tone]}
            </button>
          ))}
          <button type="button" className="tx-iam-btn small" onClick={() => c().toggleCallout().run()}>{T.callout.remove}</button>
        </div>
      )}
    </div>
  );
};

export const RichEditor: React.FC<RichEditorProps> = ({ content, editable, onChange }) => {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);

  const editor = useEditor({
    extensions: blogExtensions(T.bodyPlaceholder),
    content,
    editable,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'tx-blog-prose tx-blog-editor-surface', 'aria-label': T.bodyPlaceholder, role: 'textbox', 'aria-multiline': 'true' }
    },
    onCreate: ({ editor: e }) => changeRef.current(e.getJSON() as DocNode, wordsOf(e)),
    onUpdate: ({ editor: e }) => changeRef.current(e.getJSON() as DocNode, wordsOf(e))
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <div className="tx-blog-editor">
      {editable && <Toolbar editor={editor} onLink={() => setDialog('link')} onImage={() => setDialog('image')} />}
      <EditorContent editor={editor} />
      {dialog === 'link' && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
      {dialog === 'image' && <ImageDialog editor={editor} onClose={() => setDialog(null)} />}
    </div>
  );
};

export default RichEditor;
