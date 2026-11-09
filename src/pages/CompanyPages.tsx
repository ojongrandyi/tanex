import React from 'react';
import { Bike, Building2, Clock, HandHeart, Leaf, Mail, ShieldCheck, Smile, Truck, Users } from 'lucide-react';
import { PageHero } from '../components/ui';
import { COMPANY } from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import { Link } from '../router/Link';
import { useAreaT } from '../i18n/I18nProvider';
import './CompanyPages.css';

// Careers and CSR Policy (footer only, owner's note 2026-11-09). Text: "company" area, approved
// by the owner 2026-11-10 (CONTENT §16). No open positions, figures or certifications are claimed.

const EMAIL_MARK = '[[email]]';

/** A translated sentence with the email shown as a mailto link where {email} stands. */
function withEmailLink(text: (email: string) => string, email: string): React.ReactNode {
  const [before, after = ''] = text(EMAIL_MARK).split(EMAIL_MARK);
  return <>{before}<a href={`mailto:${email}`}>{email}</a>{after}</>;
}

interface PageProps {
  onNavigate: (page: string, param?: string) => void;
}

const TEAMS = [
  { key: 'riders', icon: Bike },
  { key: 'drivers', icon: Truck },
  { key: 'operations', icon: Building2 },
] as const;

const VALUES = [
  { key: 'reliable', icon: Clock },
  { key: 'care', icon: HandHeart },
  { key: 'service', icon: Smile },
] as const;

export const CareersPage: React.FC<PageProps> = () => {
  const t = useAreaT('company');
  const { email } = useCompanyContact();
  return (
    <div className="tx-company">
      <PageHero
        eyebrow={t('careers.hero.eyebrow')}
        title={t('careers.hero.title', { company: COMPANY })}
        lead={t('careers.hero.sub')}
        titleId="careers-title"
      />

      <section className="tx-company__section" aria-labelledby="careers-teams">
        <div className="tx-company__wrap">
          <header className="tx-section-header">
            <p className="tx-eyebrow">{t('careers.teams.eyebrow')}</p>
            <h2 className="tx-h2" id="careers-teams">{t('careers.teams.title', { company: COMPANY })}</h2>
          </header>
          <ul className="tx-company__grid">
            {TEAMS.map(({ key, icon: Icon }) => (
              <li key={key} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                <h3 className="tx-card__title">{t(`careers.teams.${key}.title`)}</h3>
                <p className="tx-card__body">{t(`careers.teams.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tx-company__section tx-company__section--alt" aria-labelledby="careers-values">
        <div className="tx-company__wrap">
          <header className="tx-section-header">
            <p className="tx-eyebrow">{t('careers.values.eyebrow')}</p>
            <h2 className="tx-h2" id="careers-values">{t('careers.values.title')}</h2>
          </header>
          <ul className="tx-company__grid">
            {VALUES.map(({ key, icon: Icon }) => (
              <li key={key} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                <h3 className="tx-card__title">{t(`careers.values.${key}.title`)}</h3>
                <p className="tx-card__body">{t(`careers.values.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="tx-company__cta tx-dark" aria-labelledby="careers-apply">
        <div className="tx-company__wrap tx-company__cta-inner">
          <div>
            <h2 className="tx-h2" id="careers-apply">{t('careers.apply.title')}</h2>
            <p className="tx-lead">{withEmailLink((e) => t('careers.apply.body', { email: e }), email)}</p>
          </div>
          {email && (
            <a className="tx-btn tx-btn--primary tx-btn--lg" href={`mailto:${email}?subject=${encodeURIComponent(t('careers.apply.subject'))}`}>
              <Mail size={18} aria-hidden="true" />
              {t('careers.apply.button')}
            </a>
          )}
        </div>
      </section>
    </div>
  );
};

const CSR_SECTIONS = [
  { key: 'safety', icon: ShieldCheck },
  { key: 'people', icon: Users },
  { key: 'customers', icon: Smile },
  { key: 'environment', icon: Leaf },
  { key: 'community', icon: HandHeart },
] as const;

export const CsrPage: React.FC<PageProps> = ({ onNavigate }) => {
  const t = useAreaT('company');
  const { email } = useCompanyContact();
  return (
    <div className="tx-company">
      <PageHero
        eyebrow={t('csr.hero.eyebrow')}
        title={t('csr.hero.title')}
        lead={t('csr.hero.sub', { company: COMPANY })}
        titleId="csr-title"
      />

      <section className="tx-company__section" aria-label={t('csr.sectionsLabel')}>
        <div className="tx-company__wrap tx-company__policy">
          {CSR_SECTIONS.map(({ key, icon: Icon }) => (
            <article key={key} className="tx-company__item">
              <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
              <div>
                <h2 className="tx-company__item-title">{t(`csr.${key}.title`)}</h2>
                <p>{t(`csr.${key}.body`)}</p>
                {key === 'customers' && (
                  <Link page="legal" param="privacy" onNavigate={onNavigate} className="tx-link">
                    {t('csr.customers.link')}
                  </Link>
                )}
              </div>
            </article>
          ))}
          {email && <p className="tx-company__contact">{withEmailLink((e) => t('csr.contact', { email: e }), email)}</p>}
        </div>
      </section>
    </div>
  );
};
