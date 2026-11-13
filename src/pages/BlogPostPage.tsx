import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Facebook, Languages, Link2, Linkedin, MessageCircle, Twitter } from 'lucide-react';
import { BlogCard, articleClick } from '../components/BlogCard';
import { COMPANY } from '../config/brand';
import { Link, isPlainClick } from '../router/Link';
import { loadLocale } from '../i18n/runtime';
import type { Locale } from '../i18n/types';
import { navigate, setAlternateTargets } from '../router/navigation';
import { buildPath } from '../router/routes';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { formatDate } from '../i18n/format';
import { blogPublicApi, type PublicBlogPost } from '../services/blogPublic';
import '../styles/blogProse.css';
import './BlogPages.css';

// Public blog article (/blog/<slug>, /fr/blog/<slug>), BLOG_SPEC §6. The body is the server's
// sanitised HTML (server/blog/render.ts allow-list), so it is inserted as-is. The server already
// sent this article's title, description, Open Graph tags, JSON-LD and hreflang
// (server/blog/pageData.ts); this page keeps the tab title in step when it opens in the browser.
// Share buttons are plain links (no third-party scripts); "Copy link" uses the clipboard.

interface BlogPostPageProps {
  slug: string;
  onNavigate: (page: string, param?: string) => void;
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; post: PublicBlogPost };

function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return [
    { key: 'whatsapp', Icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { key: 'facebook', Icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'linkedin', Icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { key: 'x', Icon: Twitter, href: `https://x.com/intent/post?url=${u}&text=${text}` },
  ] as const;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and non-secure pages: a hidden text field and the copy command.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    field.remove();
    return ok;
  }
}

/** Opens the other-language version once its dictionary is loaded (as the header's language switch does). */
function openTranslation(path: string, target: Locale) {
  return async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    try {
      await loadLocale(target);
    } catch {
      window.location.assign(path);
      return;
    }
    navigate(path);
    window.scrollTo({ top: 0 });
  };
}

export const BlogPostPage: React.FC<BlogPostPageProps> = ({ slug, onNavigate }) => {
  const t = useAreaT('blog');
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    blogPublicApi
      .post(locale, slug)
      .then((post) => {
        if (!live) return;
        // An old slug was redirected by the API: show the current address.
        if (post.path !== window.location.pathname) navigate(post.path, { replace: true });
        setState({ status: 'ready', post });
      })
      .catch((err) => {
        if (live) setState({ status: err?.status === 404 ? 'not-found' : 'error' });
      });
    return () => {
      live = false;
    };
  }, [locale, slug, attempt]);

  const post = state.status === 'ready' ? state.post : null;

  // Tab title and description, and the language switch to the linked translation (or the other
  // language's blog index when there is none, I18N_SPEC §2).
  useEffect(() => {
    if (!post) return;
    document.title = `${post.seoTitle} | ${COMPANY}`;
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = post.seoDescription;
    const other = locale === 'en' ? 'fr' : 'en';
    const translated = post.translations.find((tr) => tr.locale === other);
    setAlternateTargets(post.path, { [other]: translated?.path ?? buildPath('blog', undefined, other) });
    return () => setAlternateTargets(post.path, null);
  }, [post, locale]);

  // A missing article has no translation: the switch goes to the other language's blog index.
  useEffect(() => {
    if (state.status !== 'not-found') return;
    const path = window.location.pathname;
    const other = locale === 'en' ? 'fr' : 'en';
    setAlternateTargets(path, { [other]: buildPath('blog', undefined, other) });
    return () => setAlternateTargets(path, null);
  }, [state.status, locale]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (state.status === 'loading') {
    return (
      <div className="tx-blog tx-blog--article">
        <div className="tx-blog-post__loading" role="status" aria-busy="true">
          <span className="tx-visually-hidden">…</span>
        </div>
      </div>
    );
  }

  if (state.status === 'not-found' || state.status === 'error') {
    const missing = state.status === 'not-found';
    return (
      <div className="tx-blog tx-blog--article">
        <div className="tx-blog-post__wrap tx-blog-post__missing" role={missing ? undefined : 'alert'}>
          <h1 className="tx-h2">{missing ? t('article.notFoundTitle') : t('article.loadError')}</h1>
          {missing && <p>{t('article.notFoundBody')}</p>}
          <div className="tx-blog-post__missing-actions">
            {!missing && (
              <button type="button" className="tx-btn tx-btn--primary tx-btn--md" onClick={() => setAttempt((n) => n + 1)}>{t('index.retry')}</button>
            )}
            <Link page="blog" onNavigate={onNavigate} className={`tx-btn tx-btn--${missing ? 'primary' : 'secondary'} tx-btn--md`}>{t('article.back')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const p = state.post;
  const url = `${window.location.origin}${p.path}`;
  const other = locale === 'en' ? 'fr' : 'en';
  const translation = p.translations.find((tr) => tr.locale === other);
  const published = p.publishedAt ? new Date(p.publishedAt) : null;

  return (
    <div className="tx-blog tx-blog--article">
      <article className="tx-blog-post" lang={p.locale} aria-labelledby="blog-post-title">
        <header className="tx-blog-post__head">
          <div className="tx-blog-post__wrap">
            <Link page="blog" onNavigate={onNavigate} className="tx-blog__back">
              <ArrowLeft aria-hidden="true" />
              {t('article.back')}
            </Link>
            {p.categories.length > 0 && (
              <p className="tx-blog-post__cats">
                {p.categories.map((c) => (
                  <Link key={c.slug} page="blog-category" param={c.slug} onNavigate={onNavigate} className="tx-blog-card__cat">{c.name}</Link>
                ))}
              </p>
            )}
            <h1 className="tx-blog-post__title" id="blog-post-title">{p.title}</h1>
            <p className="tx-blog-post__lede">{p.excerpt}</p>
            <div className="tx-blog-post__byline">
              {p.author.avatarUrl && <img src={p.author.avatarUrl} alt="" width={52} height={52} />}
              <div>
                <strong>{t('article.by', { author: p.author.name })}</strong>
                {p.author.jobTitle && <span>{p.author.jobTitle}</span>}
                <span>
                  {published && <time dateTime={published.toISOString()}>{formatDate(published, locale, { dateStyle: 'long' })}</time>}
                  {published && ' · '}
                  {t('article.minRead', { n: p.readingMinutes })}
                </span>
              </div>
            </div>
            {translation && (
              <p className="tx-blog-post__translation">
                <a href={translation.path} hrefLang={other} lang={other} onClick={openTranslation(translation.path, other)}>
                  <Languages aria-hidden="true" />
                  {t('article.readTranslation')}
                </a>
              </p>
            )}
          </div>
        </header>

        {p.cover && (
          <div className="tx-blog-post__cover-wrap">
            <img
              className="tx-blog-post__cover"
              src={p.cover.url}
              srcSet={p.cover.smallUrl && p.cover.smallWidth && p.cover.width ? `${p.cover.smallUrl} ${p.cover.smallWidth}w, ${p.cover.url} ${p.cover.width}w` : undefined}
              sizes="(max-width: 1040px) 100vw, 1040px"
              alt={p.cover.alt}
              width={p.cover.width ?? undefined}
              height={p.cover.height ?? undefined}
              fetchPriority="high"
            />
          </div>
        )}

        <div className="tx-blog-post__wrap">
          {/* Sanitised on the server with the blog allow-list (server/blog/render.ts). */}
          <div className="tx-blog-prose tx-blog-post__body" dangerouslySetInnerHTML={{ __html: p.contentHtml }} />

          {p.tags.length > 0 && (
            <ul className="tx-blog-post__tags" aria-label={t('article.tags')}>
              {p.tags.map((tag) => <li key={tag}>#{tag}</li>)}
            </ul>
          )}

          <div className="tx-blog-post__share">
            <h2 className="tx-blog-post__share-h" id="blog-share">{t('article.share')}</h2>
            <ul aria-labelledby="blog-share">
              {shareLinks(url, p.title).map(({ key, Icon, href }) => (
                <li key={key}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="tx-blog-post__share-btn"
                    aria-label={t('article.shareOn', { network: t(`article.${key}`) })}>
                    <Icon aria-hidden="true" />
                    <span>{t(`article.${key}`)}</span>
                  </a>
                </li>
              ))}
              <li>
                <button type="button" className="tx-blog-post__share-btn" onClick={async () => setCopied(await copyText(url))}>
                  {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                  <span>{copied ? t('article.linkCopied') : t('article.copyLink')}</span>
                </button>
                <span className="tx-visually-hidden" role="status">{copied ? t('article.linkCopied') : ''}</span>
              </li>
            </ul>
          </div>

          {(p.previous || p.next) && (
            <nav className="tx-blog-post__pn" aria-label={t('article.moreArticles')}>
              {/* Previous = the older article, next = the newer one. */}
              {p.previous ? (
                <a href={p.previous.path} rel="prev" onClick={articleClick(p.previous.path, onNavigate, p.previous.slug)} className="tx-blog-post__pn-link">
                  <span className="tx-blog-post__pn-label"><ArrowLeft aria-hidden="true" />{t('article.previous')}</span>
                  <span className="tx-blog-post__pn-title">{p.previous.title}</span>
                </a>
              ) : <span />}
              {p.next ? (
                <a href={p.next.path} rel="next" onClick={articleClick(p.next.path, onNavigate, p.next.slug)} className="tx-blog-post__pn-link tx-blog-post__pn-link--end">
                  <span className="tx-blog-post__pn-label">{t('article.next')}<ArrowRight aria-hidden="true" /></span>
                  <span className="tx-blog-post__pn-title">{p.next.title}</span>
                </a>
              ) : <span />}
            </nav>
          )}
        </div>
      </article>

      {p.related.length > 0 && (
        <section className="tx-blog__section tx-blog__section--alt" aria-labelledby="blog-related">
          <div className="tx-blog__wrap">
            <h2 className="tx-h2 tx-blog__related-h" id="blog-related">{t('article.related')}</h2>
            <ul className="tx-blog__grid">
              {p.related.map((r) => (
                <li key={r.slug}>
                  <BlogCard post={r} locale={locale} minRead={t('index.minRead', { n: r.readingMinutes })} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="tx-blog__cta tx-dark" aria-labelledby="blog-cta">
        <div className="tx-blog__wrap tx-blog__cta-inner">
          <h2 className="tx-h2" id="blog-cta">{t('article.ctaText')}</h2>
          <Link page="quote" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">
            {t('article.ctaButton')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
};
