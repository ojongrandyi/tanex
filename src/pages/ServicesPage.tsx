import React, { useEffect } from 'react';
import { ArrowRight, Bike, Check, KeyRound, Package, Plane, Ship, TrainFront, Truck, Wallet, Warehouse, Zap } from 'lucide-react';
import { PageHero, SectionHeader, Em } from '../components/ui';
import { Link } from '../router/Link';
import { BIKE_BOOKING } from '../router/bookingLinks';
import { useAreaT } from '../i18n/I18nProvider';
import './ServicesPage.css';

// Services page (CONTENT §3, §3.6, §3.7): the six services, each with a stable anchor that the
// header menu, footer and homepage link to (/services/air … /services/local-delivery, or #id on
// this page), then compare, how it works, add-ons and the CTA. Every detail is a [confirm] draft
// from CONTENT pending the owner (#104).

interface ServicesPageProps {
  onNavigate: (page: string, param?: string) => void;
  /** Service to scroll to on arrival (/services/<id>, e.g. from the header menu). */
  initialServiceId?: string;
  /** Changes on every navigation request, so the same service link works twice in a row. */
  serviceRequest?: number;
}

type ItemKey = 'air' | 'maritime' | 'rail' | 'road' | 'warehousing' | 'local';

/** Service id (URL segment, element id, quote preselection) → dictionary key and icon. */
const SERVICES: { id: string; key: ItemKey; icon: React.ElementType }[] = [
  { id: 'air', key: 'air', icon: Plane },
  { id: 'maritime', key: 'maritime', icon: Ship },
  { id: 'rail', key: 'rail', icon: TrainFront },
  { id: 'road', key: 'road', icon: Truck },
  { id: 'warehousing', key: 'warehousing', icon: Warehouse },
  { id: 'local-delivery', key: 'local', icon: Bike },
];
const HIGHLIGHTS = ['h1', 'h2', 'h3', 'h4'] as const;
const COMPARE_ROWS = ['local', 'road', 'air', 'maritime', 'rail', 'warehousing'] as const;
const STEPS = ['book', 'collect', 'move', 'deliver'] as const;
const ADDONS = [
  { key: 'express', icon: Zap },
  { key: 'cod', icon: Wallet },
  { key: 'code', icon: KeyRound },
  { key: 'packing', icon: Package },
] as const;

/** Accepts a service id or the short anchor "#local" used in older links. */
function serviceElementId(value: string): string | null {
  const v = value.replace(/^#/, '').toLowerCase();
  if (v === 'local') return 'local-delivery';
  return SERVICES.some((s) => s.id === v) ? v : null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigate, initialServiceId = '', serviceRequest = 0 }) => {
  const t = useAreaT('services');

  // Arriving on /services/<id> (or /services#id): scroll that service into view.
  useEffect(() => {
    const target = serviceElementId(initialServiceId) ?? serviceElementId(window.location.hash);
    if (!target) return;
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }, [initialServiceId, serviceRequest]);

  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="tx-services">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={<>{t('hero.titleStart')} <Em>{t('hero.titleEm')}</Em></>}
        lead={t('hero.sub')}
        titleId="services-title"
        actions={
          <>
            <Link page="quote" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('hero.quote')}</Link>
            <Link page="track" onNavigate={onNavigate} className="tx-btn tx-btn--on-dark tx-btn--lg">{t('hero.track')}</Link>
          </>
        }
      />

      {/* The six services */}
      <section className="tx-services__section" aria-labelledby="services-list">
        <div className="tx-services__wrap">
          <SectionHeader eyebrow={t('eyebrows.services')} title={t('headings.services')} id="services-list" />
          <div className="tx-services__layout">
            <nav className="tx-services__nav" aria-label={t('headings.nav')}>
              <ul>
                {SERVICES.map(({ id, key, icon: Icon }) => (
                  <li key={id}>
                    <a href={`#${id}`} onClick={jump(id)}><Icon aria-hidden="true" />{t(`items.${key}.name`)}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="tx-services__panels">
              {SERVICES.map(({ id, key, icon: Icon }) => {
                const isLocal = key === 'local';
                return (
                  <article key={id} id={id} className="tx-services__panel" tabIndex={-1} aria-labelledby={`${id}-name`}>
                    <header className="tx-services__panel-head">
                      <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                      <div>
                        <h3 className="tx-h3" id={`${id}-name`}>{t(`items.${key}.name`)}</h3>
                        <p className="tx-services__summary">{t(`items.${key}.summary`)}</p>
                      </div>
                    </header>
                    <div className="tx-services__panel-body">
                      <div>
                        <h4 className="tx-services__label">{t('labels.highlights')}</h4>
                        <ul className="tx-services__checks">
                          {HIGHLIGHTS.map((h) => {
                            const text = t(`items.${key}.${h}`);
                            return text ? <li key={h}><Check aria-hidden="true" />{text}</li> : null;
                          })}
                        </ul>
                      </div>
                      <div>
                        <h4 className="tx-services__label">{t('labels.goodFor')}</h4>
                        <p className="tx-services__goodfor">{t(`items.${key}.goodFor`)}</p>
                      </div>
                    </div>
                    <div className="tx-services__panel-actions">
                      {/* Bike booking opens this very section until G.6; until then this panel asks for a quote. */}
                      {isLocal && BIKE_BOOKING.page !== 'services' ? (
                        <Link page={BIKE_BOOKING.page} onNavigate={onNavigate} className="tx-btn tx-btn--primary">{t('labels.bike')}</Link>
                      ) : (
                        <Link page="quote" param={id} onNavigate={onNavigate} className="tx-btn tx-btn--primary">{t('labels.quote')}</Link>
                      )}
                      <Link page="track" onNavigate={onNavigate} className="tx-link">{t('labels.track')}<ArrowRight aria-hidden="true" /></Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="tx-services__section tx-services__section--alt" aria-labelledby="services-compare">
        <div className="tx-services__wrap">
          <SectionHeader eyebrow={t('eyebrows.compare')} title={t('headings.compare')} id="services-compare" />
          <div className="tx-services__table-wrap">
            <table className="tx-services__table">
              <caption className="tx-visually-hidden">{t('compare.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('compare.service')}</th>
                  <th scope="col">{t('compare.bestFor')}</th>
                  <th scope="col">{t('compare.speed')}</th>
                  <th scope="col">{t('compare.tracking')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((r) => (
                  <tr key={r}>
                    <th scope="row">{t(`compare.rows.${r}.name`)}</th>
                    <td data-label={t('compare.bestFor')}>{t(`compare.rows.${r}.bestFor`)}</td>
                    <td data-label={t('compare.speed')}>{t(`compare.rows.${r}.speed`)}</td>
                    <td data-label={t('compare.tracking')}>{t(`compare.rows.${r}.tracking`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works (CONTENT §3.3) */}
      <section className="tx-services__section" aria-labelledby="services-how">
        <div className="tx-services__wrap">
          <SectionHeader eyebrow={t('eyebrows.how')} title={t('headings.how')} id="services-how" />
          <ol className="tx-services__steps">
            {STEPS.map((s, i) => (
              <li key={s}>
                <span className="tx-services__step-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="tx-services__step-title">{t(`how.${s}.title`)}</h3>
                <p>{t(`how.${s}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Add-ons (CONTENT §3.4) */}
      <section className="tx-services__section tx-services__section--alt" aria-labelledby="services-addons">
        <div className="tx-services__wrap">
          <SectionHeader eyebrow={t('eyebrows.addons')} title={t('headings.addons')} id="services-addons" />
          <ul className="tx-services__addons">
            {ADDONS.map(({ key, icon: Icon }) => (
              <li key={key} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                <h3 className="tx-card__title">{t(`addons.${key}.title`)}</h3>
                <p className="tx-card__body">{t(`addons.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA (CONTENT §3.6) */}
      <section className="tx-services__cta tx-dark" aria-labelledby="services-cta">
        <div className="tx-services__wrap tx-services__cta-inner">
          <div>
            <h2 className="tx-h2" id="services-cta">{t('cta.title')}</h2>
            <p className="tx-lead">{t('cta.body')}</p>
          </div>
          <div className="tx-services__cta-actions">
            <Link page="quote" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('cta.quote')}</Link>
            <Link page={BIKE_BOOKING.page} param={BIKE_BOOKING.param} onNavigate={onNavigate} className="tx-btn tx-btn--on-dark tx-btn--lg">{t('cta.bike')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
};
