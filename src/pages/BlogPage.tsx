import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Rss } from 'lucide-react';
import { PageHero } from '../components/ui';
import { BlogCard } from '../components/BlogCard';
import { COMPANY } from '../config/brand';
import { Link, isPlainClick } from '../router/Link';
import { navigate, setAlternateTargets, useRoute } from '../router/navigation';
import { buildPath } from '../router/routes';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { pageMetaText } from '../shared/pageMeta';
import { blogPublicApi, type PublicBlogCategory, type PublicBlogList } from '../services/blogPublic';
import { NotFoundPage } from './NotFoundPage';
import './BlogPages.css';

// Public blog index (/blog, /fr/blog) and category pages (/blog/category/<slug>,
// /fr/blog/categorie/<slug>), BLOG_SPEC §6. Posts come from the public API: 12 per page, newest
// first; the newest post is featured on the first index page. No sample posts (CLAUDE.md rule 9):
// without any, the index shows its empty state (the server keeps it out of search meanwhile).
// Page 2+ is ?page=N, as the server's canonical URLs.

interface BlogPageProps {
  onNavigate: (page: string, param?: string) => void;
  /** Category slug: the page lists that category. */
  category?: string;
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; list: PublicBlogList };

function pageFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get('page') ?? '';
  const n = /^\d{1,5}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
}

const withPage = (path: string, page: number) => (page > 1 ? `${path}?page=${page}` : path);

export const BlogPage: React.FC<BlogPageProps> = ({ onNavigate, category }) => {
  const t = useAreaT('blog');
  const locale = useLocale();
  useRoute(); // re-render on ?page= changes
  const page = typeof window === 'undefined' ? 1 : pageFromSearch(window.location.search);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [categories, setCategories] = useState<PublicBlogCategory[]>([]);
  const [attempt, setAttempt] = useState(0);
  const basePath = category ? buildPath('blog-category', category, locale) : buildPath('blog', undefined, locale);

  useEffect(() => {
    let live = true;
    blogPublicApi.categories(locale).then((c) => live && setCategories(c)).catch(() => live && setCategories([]));
    return () => {
      live = false;
    };
  }, [locale]);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    blogPublicApi
      .list(locale, page, category)
      .then((list) => {
        if (!live) return;
        if (category && list.total === 0) return setState({ status: 'not-found' });
        if (page > list.totalPages && list.total > 0) {
          // Past the last page (an old link): the first page instead.
          navigate(basePath, { replace: true });
          return;
        }
        setState({ status: 'ready', list });
      })
      .catch((err) => {
        if (!live) return;
        setState({ status: err?.status === 404 ? 'not-found' : 'error' });
      });
    return () => {
      live = false;
    };
  }, [locale, page, category, attempt, basePath]);

  const list = state.status === 'ready' ? state.list : null;
  const cat = list?.category ?? null;

  // A category's language switch goes to its translation, or to the other blog index.
  useEffect(() => {
    if (!category || typeof window === 'undefined') return;
    const path = window.location.pathname;
    const other = locale === 'en' ? 'fr' : 'en';
    const translated = cat?.translations.find((tr) => tr.locale === other);
    setAlternateTargets(path, { [other]: translated?.path ?? buildPath('blog', undefined, other) });
    return () => setAlternateTargets(path, null);
  }, [category, cat, locale]);

  // Title and description of a category or a later page (the server sent the same ones).
  useEffect(() => {
    if (!list) return;
    const base = cat ? `${cat.name} | ${t('index.eyebrow', { company: COMPANY })}` : pageMetaText('blog', locale).title;
    document.title = page > 1 ? base.replace(/(\s*\|[^|]*)$/, `, page ${page}$1`) : base;
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = cat?.description || pageMetaText('blog', locale).description;
  }, [list, cat, page, t, locale]);

  if (state.status === 'not-found') return <NotFoundPage onNavigate={onNavigate} />;

  const posts = list?.data ?? [];
  const featured = !category && page === 1 && posts.length > 0 ? posts[0] : null;
  const grid = featured ? posts.slice(1) : posts;
  const minRead = (n: number) => t('index.minRead', { n });

  const pageLink = (target: number, label: string, rel: 'prev' | 'next', icon: React.ReactNode, iconAfter = false) => {
    const href = withPage(basePath, target);
    return (
      <a
        href={href}
        rel={rel}
        className="tx-btn tx-btn--secondary tx-btn--md"
        onClick={(e) => {
          if (!isPlainClick(e)) return;
          e.preventDefault();
          navigate(href);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        {!iconAfter && icon}
        {label}
        {iconAfter && icon}
      </a>
    );
  };

  return (
    <div className="tx-blog">
      <PageHero
        eyebrow={t('index.eyebrow', { company: COMPANY })}
        title={category ? (cat?.name ?? ' ') : t('index.title')}
        lead={category ? cat?.description || undefined : t('index.sub', { company: COMPANY })}
        titleId="blog-title"
        className="tx-blog__hero"
      >
        {category && (
          <Link page="blog" onNavigate={onNavigate} className="tx-blog__back">
            <ArrowLeft aria-hidden="true" />
            {t('category.back')}
          </Link>
        )}
      </PageHero>

      <section className="tx-blog__section" aria-labelledby="blog-title">
        <div className="tx-blog__wrap">
          {categories.length > 0 && (
            <nav className="tx-blog__chips" aria-label={t('index.categories')}>
              <Link page="blog" onNavigate={onNavigate} className={`tx-chip tx-chip--outline${!category ? ' tx-chip--active' : ''}`} aria-current={!category ? 'page' : undefined}>
                {t('index.all')}
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  page="blog-category"
                  param={c.slug}
                  onNavigate={onNavigate}
                  className={`tx-chip tx-chip--outline${category === c.slug ? ' tx-chip--active' : ''}`}
                  aria-current={category === c.slug ? 'page' : undefined}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          )}

          {state.status === 'loading' && (
            <div className="tx-blog__loading" role="status" aria-busy="true">
              <span className="tx-visually-hidden">…</span>
              <ul className="tx-blog__grid" aria-hidden="true">
                {[0, 1, 2].map((i) => <li key={i} className="tx-blog__skeleton" />)}
              </ul>
            </div>
          )}

          {state.status === 'error' && (
            <div className="tx-blog__message" role="alert">
              <p>{t('index.loadError')}</p>
              <button type="button" className="tx-btn tx-btn--secondary tx-btn--md" onClick={() => setAttempt((n) => n + 1)}>{t('index.retry')}</button>
            </div>
          )}

          {list && posts.length === 0 && (
            <div className="tx-blog__message">
              <p>{t('index.empty')}</p>
              <Link page="track" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--md">{t('index.track')}</Link>
            </div>
          )}

          {featured && (
            <div className="tx-blog__featured">
              <BlogCard post={featured} locale={locale} minRead={minRead(featured.readingMinutes)} featured headingLevel={2} kicker={t('index.latest')} onNavigate={onNavigate} />
            </div>
          )}

          {grid.length > 0 && (
            <ul className="tx-blog__grid">
              {grid.map((p) => (
                <li key={p.slug}>
                  <BlogCard post={p} locale={locale} minRead={minRead(p.readingMinutes)} headingLevel={2} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          )}

          {list && list.totalPages > 1 && (
            <nav className="tx-blog__pager" aria-label={t('index.pagination')}>
              <span className="tx-blog__pager-side">
                {page > 1 && pageLink(page - 1, t('index.newer'), 'prev', <ArrowLeft aria-hidden="true" />)}
              </span>
              <span className="tx-blog__pager-pos">{t('index.pageOf', { n: page, total: list.totalPages })}</span>
              <span className="tx-blog__pager-side tx-blog__pager-side--end">
                {page < list.totalPages && pageLink(page + 1, t('index.older'), 'next', <ArrowRight aria-hidden="true" />, true)}
              </span>
            </nav>
          )}

          {list && posts.length > 0 && (
            <p className="tx-blog__rss">
              <a href={`${buildPath('blog', undefined, locale)}/rss.xml`} type="application/rss+xml">
                <Rss aria-hidden="true" />
                {t('index.rss')}
              </a>
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
