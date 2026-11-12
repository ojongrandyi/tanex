// Blog studio (docs/BLOG_SPEC.md §4): the console's Blog view. Its own lazy chunk, loaded when the
// view is opened; the TipTap editor is a further chunk loaded when a post is opened.
import React, { useState } from 'react';
import { PostList } from './PostList';
import { PostEditor } from './PostEditor';
import { CategoriesManager } from './CategoriesManager';
import { MediaLibrary } from './MediaLibrary';
import { BLOG_TEXT } from './strings';
import './BlogStudio.css';

type Tab = 'posts' | 'categories' | 'media';

export const BlogStudio: React.FC = () => {
  const [tab, setTab] = useState<Tab>('posts');
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) {
    return <PostEditor key={openId} postId={openId} onBack={() => setOpenId(null)} onOpenPost={setOpenId} />;
  }
  return (
    <div className="tx-blog-studio animate-fade-in">
      <div className="tx-blog-tabs tx-blog-tabs--main" role="tablist" aria-label={BLOG_TEXT.menu}>
        {(['posts', 'categories', 'media'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tx-blog-tab${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
            {BLOG_TEXT.tabs[t]}
          </button>
        ))}
      </div>
      {tab === 'posts' && <PostList onOpen={setOpenId} />}
      {tab === 'categories' && <CategoriesManager />}
      {tab === 'media' && (
        <div className="tx-iam-card">
          <MediaLibrary />
        </div>
      )}
    </div>
  );
};
