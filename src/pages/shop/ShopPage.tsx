import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, Store } from 'lucide-react';
import { PageHero } from '../../components/ui';
import { COMPANY } from '../../config/brand';
import { Link, isPlainClick } from '../../router/Link';
import { navigate, setAlternateTargets, useRoute } from '../../router/navigation';
import { buildPath } from '../../router/routes';
import { useAreaT, useLocale } from '../../i18n/I18nProvider';
import { pageMetaText } from '../../shared/pageMeta';
import { DEFAULT_SHOP_SORT, SHOP_SEARCH_MAX, isShopSort, shopListPage, type ShopSort } from '../../shared/shopPublic';
import { shopPublicApi, type PublicProductList, type PublicShopCategory } from '../../services/shopPublic';
import { NotFoundPage } from '../NotFoundPage';
import { CartToast, ProductCard, type CartNotice } from './ShopParts';
import './ShopPages.css';

// Public shop (/shop, /fr/boutique) and category pages (/shop/category/<slug>,
// /fr/boutique/categorie/<slug>), SHOP_SPEC §8. Products come from the public API, 24 per page.
// Search, sort, "in stock only" and the page number live in the address (?q=&sort=&stock=in&page=),
// so every list has a real link. No sample products (CLAUDE.md rule 9): while none is published
// the page says the shop is opening soon. While the shop is switched off the API answers 404 and
// this page shows "page not found", as the server does.

interface ShopPageProps {
  onNavigate: (page: string, param?: string) => void;
  /** Category slug: the page lists that category (and its sub-categories). */
  category?: string;
}

interface Filters {
  q: string;
  sort: ShopSort;
  inStock: boolean;
  page: number;
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; list: PublicProductList };

const SORT_LABELS: Record<ShopSort, 'index.sortFeatured' | 'index.sortNewest' | 'index.sortPriceAsc' | 'index.sortPriceDesc'> = {
  featured: 'index.sortFeatured',
  newest: 'index.sortNewest',
  'price-asc': 'index.sortPriceAsc',
  'price-desc': 'index.sortPriceDesc',
};

function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  return {
    q: (p.get('q') ?? '').slice(0, SHOP_SEARCH_MAX),
    sort: isShopSort(sort) ? sort : DEFAULT_SHOP_SORT,
    inStock: p.get('stock') === 'in',
    page: shopListPage(p.get('page') ?? ''),
  };
}

function filtersQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.sort !== DEFAULT_SHOP_SORT) p.set('sort', f.sort);
  if (f.inStock) p.set('stock', 'in');
  if (f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Parents first, each followed by its own sub-categories. */
function orderCategories(list: PublicShopCategory[]): PublicShopCategory[] {
  const top = list.filter((c) => !c.parentSlug || !list.some((p) => p.slug === c.parentSlug));
  return top.flatMap((c) => [c, ...list.filter((s) => s.parentSlug === c.slug)]);
}

export const ShopPage: React.FC<ShopPageProps> = ({ onNavigate, category }) => {
  const t = useAreaT('shop');
  const locale = useLocale();
  useRoute(); // re-render when the query changes
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const filters = useMemo(() => readFilters(search), [search]);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [categories, setCategories] = useState<PublicShopCategory[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(filters.q);
  const [notice, setNotice] = useState<CartNotice>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  const basePath = category ? buildPath('shop-category', category, locale) : buildPath('shop', undefined, locale);

  useEffect(() => setDraft(filters.q), [filters.q]);

  useEffect(() => {
    let live = true;
    shopPublicApi.categories(locale).then((c) => live && setCategories(orderCategories(c))).catch(() => live && setCategories([]));
    return () => {
      live = false;
    };
  }, [locale]);

  useEffect(() => {
    let live = true;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    shopPublicApi
      .products(locale, { category, q: filters.q, sort: filters.sort, inStock: filters.inStock, page: filters.page })
      .then((list) => {
        if (!live) return;
        if (filters.page > list.totalPages && list.total > 0) {
          // Past the last page (an old link): the first page instead.
          navigate(basePath + filtersQuery({ ...filters, page: 1 }), { replace: true });
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
  }, [locale, category, filters, attempt, basePath]);

  const list = state.status === 'ready' ? state.list : null;
  const cat = list?.category ?? null;

  // A category's language switch goes to the same category in the other language.
  useEffect(() => {
    if (!category || !cat || typeof window === 'undefined') return;
    const path = window.location.pathname;
    const other = locale === 'en' ? 'fr' : 'en';
    setAlternateTargets(path, { [other]: cat.paths[other] });
    return () => setAlternateTargets(path, null);
  }, [category, cat, locale]);

  // Title and description of a category or a later page.
  useEffect(() => {
    if (!list) return;
    const meta = pageMetaText('shop', locale);
    const base = cat ? `${cat.name} | ${t('index.eyebrow', { company: COMPANY })}` : meta.title;
    document.title = filters.page > 1 ? base.replace(/(\s*\|[^|]*)$/, `, ${t('index.pageOf', { n: filters.page, total: list.totalPages })}$1`) : base;
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = cat?.description || meta.description;
  }, [list, cat, filters.page, t, locale]);

  if (state.status === 'not-found') return <NotFoundPage onNavigate={onNavigate} />;

  const go = (next: Partial<Filters>) => {
    navigate(basePath + filtersQuery({ ...filters, page: 1, ...next }));
  };
  const filtered = filters.q.trim() !== '' || filters.inStock;
  const products = list?.data ?? [];

  const pageLink = (target: number, label: string, rel: 'prev' | 'next', icon: React.ReactNode, iconAfter = false) => {
    const href = basePath + filtersQuery({ ...filters, page: target });
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
    <div className="tx-shop">
      <PageHero
        eyebrow={t('index.eyebrow', { company: COMPANY })}
        title={category ? (cat?.name ?? ' ') : t('index.title', { company: COMPANY })}
        lead={category ? cat?.description || undefined : t('index.sub', { company: COMPANY })}
        titleId="shop-title"
        className="tx-shop__hero"
      >
        {category && (
          <Link page="shop" onNavigate={onNavigate} className="tx-shop__back">
            <ArrowLeft aria-hidden="true" />
            {t('product.marketplace')}
          </Link>
        )}
      </PageHero>

      <section className="tx-shop__section" aria-labelledby="shop-title">
        <div className="tx-shop__wrap">
          {categories.length > 0 && (
            <nav className="tx-shop__chips" aria-label={t('index.categories')}>
              <Link page="shop" onNavigate={onNavigate} className={`tx-chip tx-chip--outline${!category ? ' tx-chip--active' : ''}`} aria-current={!category ? 'page' : undefined}>
                {t('index.all')}
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  page="shop-category"
                  param={c.slug}
                  onNavigate={onNavigate}
                  className={`tx-chip tx-chip--outline${c.parentSlug ? ' tx-chip--sub' : ''}${category === c.slug ? ' tx-chip--active' : ''}`}
                  aria-current={category === c.slug ? 'page' : undefined}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          )}

          <div className="tx-shop__tools">
            <form
              className="tx-shop__search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                go({ q: draft });
              }}
            >
              <label htmlFor="shop-search" className="tx-visually-hidden">{t('index.search')}</label>
              <input
                id="shop-search"
                type="search"
                className="tx-input"
                placeholder={t('index.search')}
                value={draft}
                maxLength={SHOP_SEARCH_MAX}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="tx-btn tx-btn--secondary tx-btn--md tx-shop__search-btn">
                <Search aria-hidden="true" />
                <span className="tx-shop__search-label">{t('index.searchButton')}</span>
              </button>
            </form>
            <div className="tx-shop__sort">
              <label htmlFor="shop-sort">{t('index.sortBy')}</label>
              <select id="shop-sort" className="tx-input" value={filters.sort} onChange={(e) => go({ sort: isShopSort(e.target.value) ? e.target.value : DEFAULT_SHOP_SORT })}>
                {(Object.keys(SORT_LABELS) as ShopSort[]).map((s) => (
                  <option key={s} value={s}>{t(SORT_LABELS[s])}</option>
                ))}
              </select>
            </div>
            <label className="tx-shop__instock">
              <input type="checkbox" checked={filters.inStock} onChange={(e) => go({ inStock: e.target.checked })} />
              {t('index.inStockOnly')}
            </label>
          </div>

          {list && list.total > 0 && (
            <p className="tx-shop__count" aria-live="polite">
              {list.total === 1 ? t('index.countOne') : t('index.count', { n: list.total })}
            </p>
          )}

          {state.status === 'loading' && (
            <div role="status" aria-busy="true">
              <span className="tx-visually-hidden">…</span>
              <ul className="tx-shop__grid" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <li key={i} className="tx-shop__skeleton" />)}
              </ul>
            </div>
          )}

          {state.status === 'error' && (
            <div className="tx-shop__message" role="alert">
              <p>{t('index.loadError')}</p>
              <button type="button" className="tx-btn tx-btn--secondary tx-btn--md" onClick={() => setAttempt((n) => n + 1)}>{t('index.retry')}</button>
            </div>
          )}

          {list && products.length === 0 && (filtered ? (
            <div className="tx-shop__message">
              <p className="tx-shop__message-title">{t('index.noResultsTitle')}</p>
              <p>{t('index.noResultsBody')}</p>
              <a
                href={basePath}
                className="tx-btn tx-btn--secondary tx-btn--md"
                onClick={(e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  navigate(basePath);
                }}
              >
                {t('index.clearFilters')}
              </a>
            </div>
          ) : (
            <div className="tx-shop__message tx-shop__message--empty">
              <Store aria-hidden="true" />
              <p className="tx-shop__message-title">{t('index.emptyTitle')}</p>
              <p>{t('index.emptyBody')}</p>
            </div>
          ))}

          {products.length > 0 && (
            <ul className="tx-shop__grid">
              {products.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} onNavigate={onNavigate} onNotice={setNotice} eager={i < 4} />
                </li>
              ))}
            </ul>
          )}

          {list && list.totalPages > 1 && (
            <nav className="tx-shop__pager" aria-label={t('index.pagination')}>
              <span className="tx-shop__pager-side">
                {filters.page > 1 && pageLink(filters.page - 1, t('index.previous'), 'prev', <ArrowLeft aria-hidden="true" />)}
              </span>
              <span className="tx-shop__pager-pos">{t('index.pageOf', { n: filters.page, total: list.totalPages })}</span>
              <span className="tx-shop__pager-side tx-shop__pager-side--end">
                {filters.page < list.totalPages && pageLink(filters.page + 1, t('index.next'), 'next', <ArrowRight aria-hidden="true" />, true)}
              </span>
            </nav>
          )}
        </div>
      </section>
      <CartToast notice={notice} onClose={closeNotice} onNavigate={onNavigate} />
    </div>
  );
};
