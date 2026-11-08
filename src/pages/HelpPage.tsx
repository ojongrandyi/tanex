import React, { useId, useMemo, useState } from 'react';
import { ArrowRight, Calculator, Headphones, PackageSearch, Phone, Plus, Search, Truck, X } from 'lucide-react';
import { Chip } from '../components/ui';
import { Link } from '../router/Link';
import { useAreaT } from '../i18n/I18nProvider';
import { useCompanyContact } from '../utils/useCompanyContact';
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpCategory } from '../data/helpArticles';
import './HelpPage.css';

// Help Centre (CONTENT §8.1, §8.2, §8.4, §8.5): quick links, a searchable knowledge base filtered
// by topic, and a support banner. Text in both languages from the "help" area.

interface HelpPageProps {
  onNavigate: (page: string, param?: string) => void;
}

/** Lower-case, accents removed: "Douane" matches "douané". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const HelpPage: React.FC<HelpPageProps> = ({ onNavigate }) => {
  const t = useAreaT('help');
  const { phone, phoneHref } = useCompanyContact();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategory | 'all'>('all');
  const searchId = useId();

  const articles = useMemo(() => HELP_ARTICLES.map((a) => ({
    ...a,
    q: t(`articles.${a.key}.q`),
    a: t(`articles.${a.key}.a`),
    topic: t(`categories.${a.category}`),
  })), [t]);

  const words = fold(query).split(/\s+/).filter(Boolean);
  const visible = articles.filter((a) =>
    (category === 'all' || a.category === category) &&
    words.every((w) => fold(`${a.q} ${a.a} ${a.topic}`).includes(w)));

  const quickLinks = [
    { page: 'track', label: t('quick.track'), icon: PackageSearch },
    { page: 'ship', label: t('quick.collect'), icon: Truck },
    { page: 'quote', label: t('quick.quote'), icon: Calculator },
    { page: 'contact', label: t('quick.desk'), icon: Headphones },
  ];

  return (
    <div className="tx-help">
      <section className="tx-help__hero tx-dark" aria-labelledby="help-title">
        <div className="tx-help__wrap">
          <h1 className="tx-h1" id="help-title">{t('hero.title')}</h1>
          <form className="tx-help__search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label className="tx-visually-hidden" htmlFor={searchId}>{t('hero.searchLabel')}</label>
            <Search aria-hidden="true" />
            <input id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('hero.searchPlaceholder')} autoComplete="off" />
          </form>
          <nav aria-label={t('quick.label')}>
            <ul className="tx-help__quick">
              {quickLinks.map(({ page, label, icon: Icon }) => (
                <li key={page}>
                  <Link page={page} onNavigate={onNavigate} className="tx-help__quick-link"><Icon aria-hidden="true" />{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <section className="tx-help__kb" aria-labelledby="help-kb">
        <div className="tx-help__wrap">
          <h2 className="tx-h2" id="help-kb">{t('kb.title')}</h2>
          <div className="tx-help__filters" role="group" aria-label={t('kb.filterLabel')}>
            <Chip pressed={category === 'all'} onClick={() => setCategory('all')}>{t('kb.all', { n: articles.length })}</Chip>
            {HELP_CATEGORIES.map((c) => (
              <Chip key={c} pressed={category === c} onClick={() => setCategory(c)}>{t(`categories.${c}`)}</Chip>
            ))}
          </div>
          <p className="tx-visually-hidden" aria-live="polite">{t('kb.results', { n: visible.length })}</p>

          {visible.length === 0 ? (
            <div className="tx-help__empty">
              <p className="tx-help__empty-title">{t('kb.emptyTitle')}</p>
              <p>{t('kb.emptyBody')}</p>
              <div className="tx-help__empty-actions">
                <button type="button" className="tx-btn tx-btn--ghost" onClick={() => { setQuery(''); setCategory('all'); }}>
                  <X aria-hidden="true" /><span>{t('kb.clear')}</span>
                </button>
                <Link page="contact" onNavigate={onNavigate} className="tx-btn tx-btn--secondary">{t('banner.contact')}</Link>
              </div>
            </div>
          ) : (
            <div className="tx-help__list">
              {HELP_CATEGORIES.filter((c) => visible.some((a) => a.category === c)).map((c) => (
                <section key={c} className="tx-help__group" aria-labelledby={`help-cat-${c}`}>
                  <h3 className="tx-help__group-title" id={`help-cat-${c}`}>{t(`categories.${c}`)}</h3>
                  {visible.filter((a) => a.category === c).map((a) => (
                    <details key={a.id} id={a.id} className="tx-help__item" open={words.length > 0 || undefined}>
                      <summary>{a.q}<Plus aria-hidden="true" /></summary>
                      <p>{a.a}</p>
                    </details>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="tx-help__banner tx-dark" aria-labelledby="help-banner">
        <div className="tx-help__wrap tx-help__banner-inner">
          <h2 className="tx-h3" id="help-banner">{t('banner.title')}</h2>
          <div className="tx-help__banner-actions">
            <Link page="contact" onNavigate={onNavigate} className="tx-btn tx-btn--primary">{t('banner.contact')}<ArrowRight aria-hidden="true" /></Link>
            {phone && phoneHref && (
              <a href={phoneHref} className="tx-btn tx-btn--on-dark"><Phone aria-hidden="true" /><span>{t('banner.call', { phone })}</span></a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
