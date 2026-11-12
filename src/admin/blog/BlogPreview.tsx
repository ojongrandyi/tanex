// Preview of a blog post from a signed, short-lived link (BLOG_SPEC §4): /private-user/#blog-preview=<token>.
// The token alone authorises the read (GET /api/blog/preview/:token); the page is never indexed.
// Until the public article page exists (task F.3) this shows the post with the article typography;
// F.3 can move the preview onto the public page and reuse the same API.
import React, { useEffect, useState } from 'react';
import { COMPANY } from '../../config/brand';
import { blogApi, type PreviewPost } from './blogApi';
import { BLOG_TEXT, fill } from './strings';
import { when } from './studioUtil';
import './blogProse.css';
import './BlogPreview.css';

const T = BLOG_TEXT.preview;
function expiryOf(token: string): number | null {
  const exp = Number(token.split('.')[1]);
  return Number.isFinite(exp) ? exp : null;
}

export const BlogPreview: React.FC<{ token: string }> = ({ token }) => {
  const [post, setPost] = useState<PreviewPost | null>(null);
  const [failed, setFailed] = useState(false);
  const expires = expiryOf(token);

  useEffect(() => {
    blogApi.getPreview(token).then(setPost).catch(() => setFailed(true));
  }, [token]);
  useEffect(() => {
    document.title = post ? `${post.title} · ${BLOG_TEXT.actions.preview} · ${COMPANY}` : `${BLOG_TEXT.actions.preview} · ${COMPANY}`;
  }, [post]);

  return (
    <div className="tx-blog-preview-page" lang={post?.locale ?? undefined}>
      <div className="tx-blog-preview-banner" role="note">
        {failed ? T.expired : fill(post?.isPublic ? T.bannerPublic : T.banner, { time: expires ? when(expires) : '' })}
      </div>
      {!failed && !post && <p className="tx-blog-preview-loading" role="status">{T.loading}</p>}
      {post && (
        <article className="tx-blog-article">
          <header className="tx-blog-article-head">
            {post.categories.length > 0 && <p className="tx-blog-article-eyebrow">{post.categories.map((c) => c.name).join(' · ')}</p>}
            <h1>{post.title}</h1>
            {post.excerpt && <p className="tx-blog-article-lede">{post.excerpt}</p>}
            <div className="tx-blog-article-byline">
              {post.author.avatarUrl && <img src={post.author.avatarUrl} alt="" width={48} height={48} />}
              <div>
                <strong>{fill(T.by, { author: post.author.name })}</strong>
                {post.author.jobTitle && <span>{post.author.jobTitle}</span>}
                <span>
                  {post.publishedAt ? `${when(post.publishedAt)} · ` : ''}
                  {fill(BLOG_TEXT.editor.readingTime, { n: post.readingMinutes })}
                </span>
              </div>
            </div>
          </header>
          {post.cover && (
            <img className="tx-blog-article-cover" src={post.cover.url} alt={post.cover.alt}
              width={post.cover.width ?? undefined} height={post.cover.height ?? undefined} />
          )}
          {/* Sanitised on the server (server/blog/render.ts) with the blog allow-list. */}
          <div className="tx-blog-prose" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
          {post.tags.length > 0 && (
            <ul className="tx-blog-article-tags">{post.tags.map((t) => <li key={t}>#{t}</li>)}</ul>
          )}
        </article>
      )}
    </div>
  );
};
