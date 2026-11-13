import React from 'react';
import { Link } from '../router/Link';
import { navigate } from '../router/navigation';
import { isPlainClick } from '../router/Link';
import { formatDate } from '../i18n/format';
import type { Locale } from '../i18n/types';
import type { PublicBlogCard } from '../services/blogPublic';
import { SpeedLines } from './ui';
import './BlogCard.css';

// A blog post card (BLOG_SPEC §6): cover, category, title, excerpt, date and reading time. Used
// by the blog index, category pages, related articles and the homepage "From the blog" section.
// The title is the card's one link to the article (the cover repeats it for pointers only).

interface BlogCardProps {
  post: PublicBlogCard;
  locale: Locale;
  minRead: string;
  /** Large horizontal card for the latest post on the index. */
  featured?: boolean;
  /** Heading level of the title (h2 on the index, h3 inside a section). */
  headingLevel?: 2 | 3;
  /** Text above the title for the featured card ("Latest article"). */
  kicker?: string;
  onNavigate?: (page: string, param?: string) => void;
}

/** A plain in-app link to an article path (paths come from the API). */
export function articleClick(path: string, onNavigate?: (page: string, param?: string) => void, slug?: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    if (onNavigate && slug) onNavigate('blog-post', slug);
    else navigate(path);
  };
}

export const BlogCard: React.FC<BlogCardProps> = ({ post, locale, minRead, featured, headingLevel = 3, kicker, onNavigate }) => {
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  const cover = post.cover;
  const open = articleClick(post.path, onNavigate, post.slug);
  return (
    <article className={`tx-blog-card${featured ? ' tx-blog-card--featured' : ''}`}>
      <a href={post.path} className="tx-blog-card__media" tabIndex={-1} aria-hidden="true" onClick={open}>
        {cover ? (
          <img
            src={cover.smallUrl && !featured ? cover.smallUrl : cover.url}
            srcSet={cover.smallUrl && cover.smallWidth && cover.width ? `${cover.smallUrl} ${cover.smallWidth}w, ${cover.url} ${cover.width}w` : undefined}
            sizes={featured ? '(max-width: 760px) 100vw, 640px' : '(max-width: 760px) 100vw, 400px'}
            width={cover.width ?? undefined}
            height={cover.height ?? undefined}
            alt=""
            loading={featured ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <span className="tx-blog-card__ph"><SpeedLines /></span>
        )}
      </a>
      <div className="tx-blog-card__body">
        {kicker && <p className="tx-blog-card__kicker">{kicker}</p>}
        {post.categories.length > 0 && (
          <p className="tx-blog-card__cats">
            {post.categories.slice(0, 2).map((c) => (
              <Link key={c.slug} page="blog-category" param={c.slug} onNavigate={onNavigate} className="tx-blog-card__cat">{c.name}</Link>
            ))}
          </p>
        )}
        <Heading className="tx-blog-card__title">
          <a href={post.path} onClick={open}>{post.title}</a>
        </Heading>
        <p className="tx-blog-card__excerpt">{post.excerpt}</p>
        <p className="tx-blog-card__meta">
          {post.publishedAt && <time dateTime={new Date(post.publishedAt).toISOString()}>{formatDate(post.publishedAt, locale, { dateStyle: 'medium' })}</time>}
          {post.publishedAt && <span aria-hidden="true"> · </span>}
          <span>{minRead}</span>
        </p>
      </div>
    </article>
  );
};
