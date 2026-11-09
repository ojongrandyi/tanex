import React from 'react';
import { ArrowRight, Camera, Clock, Languages, MapPin, ScanBarcode, UserCheck } from 'lucide-react';
import { PageHero } from '../components/ui';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { Link } from '../router/Link';
import { BIKE_BOOKING } from '../router/bookingLinks';
import { HEAD_OF_OPERATIONS_NAME, MD_NAME, OFFICES, REGIONAL_MANAGER_NAME, SLOGAN } from '../config/brand';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { formatOpeningHoursIn } from '../i18n/format';
import './AboutPage.css';

// About page (CONTENT §4, §4.1). Facts only from CONTENT and brand.ts: the founding story, the
// wall-sign line and team photos are hidden until the owner sends them (#102, #103); nothing is
// written on their behalf. Leadership names come from brand.ts.

interface AboutPageProps {
  onNavigate: (page: string, param?: string) => void;
}

const APPROACH = [
  { key: 'id', icon: ScanBarcode },
  { key: 'couriers', icon: UserCheck },
  { key: 'proof', icon: Camera },
  { key: 'languages', icon: Languages },
] as const;

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const t = useAreaT('about');
  const locale = useLocale();
  const hours = formatOpeningHoursIn(locale);
  const address = (city: string) => {
    const office = OFFICES.find((o) => o.city === city);
    return office ? (locale === 'fr' ? office.addressFr : office.address) : '';
  };
  const portraitAlt = MD_NAME ? t('leadership.altNamed', { name: MD_NAME }) : t('leadership.alt');
  // Rest of the leadership team, shown once a name is set in brand.ts.
  const team = [
    { name: HEAD_OF_OPERATIONS_NAME, role: t('leadership.headOfOperations') },
    { name: REGIONAL_MANAGER_NAME, role: t('leadership.regionalManager') },
  ].filter((m) => m.name);

  return (
    <div className="tx-about">
      <PageHero eyebrow={t('hero.eyebrow')} title={t('hero.title')} lead={t('hero.sub')} titleId="about-title">
        <p className="tx-about__slogan">{t('hero.slogan', { slogan: SLOGAN })}</p>
      </PageHero>

      {/* Our approach (CONTENT §4) */}
      <section className="tx-about__section" aria-labelledby="about-approach">
        <div className="tx-about__wrap">
          <header className="tx-section-header">
            <p className="tx-eyebrow">{t('approach.eyebrow')}</p>
            <h2 className="tx-h2" id="about-approach">{t('approach.title')}</h2>
          </header>
          <ul className="tx-about__approach">
            {APPROACH.map(({ key, icon: Icon }) => (
              <li key={key} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><Icon /></span>
                <h3 className="tx-card__title">{t(`approach.${key}.title`)}</h3>
                <p className="tx-card__body">{t(`approach.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Leadership and team */}
      <section className="tx-about__section tx-about__section--alt" aria-labelledby="about-leadership">
        <div className="tx-about__wrap tx-about__leader">
          <figure className="tx-about__portrait">
            <ResponsiveImage name="about-md" alt={portraitAlt} sizes="(max-width: 760px) calc(100vw - 32px), 400px" imgClassName="tx-about__portrait-img" />
          </figure>
          <div className="tx-about__leader-copy">
            <p className="tx-eyebrow">{t('leadership.eyebrow')}</p>
            {/* With no name yet, the role is the heading; the name becomes the heading when supplied. */}
            <h2 className="tx-h2" id="about-leadership">{MD_NAME || t('leadership.role')}</h2>
            {MD_NAME && <p className="tx-about__role">{t('leadership.role')}</p>}
            {team.length > 0 && (
              <ul className="tx-about__people">
                {team.map((m) => (
                  <li key={m.role}>
                    <strong>{m.name}</strong>
                    <span className="tx-about__role">{m.role}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="tx-about__team">
              <p className="tx-eyebrow">{t('team.eyebrow')}</p>
              <p className="tx-about__team-body">{t('team.body')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Offices (CONTENT §4.1) */}
      <section className="tx-about__section" aria-labelledby="about-offices">
        <div className="tx-about__wrap">
          <header className="tx-section-header">
            <h2 className="tx-h2" id="about-offices">{t('offices.eyebrow')}</h2>
          </header>
          <ul className="tx-about__offices">
            {[{ city: 'Buea', label: t('offices.buea') }, { city: 'Douala', label: t('offices.douala') }].map((o) => (
              <li key={o.city} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><MapPin /></span>
                <h3 className="tx-card__title">{o.label}</h3>
                <p className="tx-card__body">{address(o.city)}</p>
                <p className="tx-about__hours"><Clock aria-hidden="true" />{t('offices.hours', { hours })}</p>
              </li>
            ))}
          </ul>
          <Link page="contact" onNavigate={onNavigate} className="tx-link tx-about__contact">{t('offices.contact')}<ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      {/* CTA (CONTENT §3.6) */}
      <section className="tx-about__cta tx-dark" aria-labelledby="about-cta">
        <div className="tx-about__wrap tx-about__cta-inner">
          <div>
            <h2 className="tx-h2" id="about-cta">{t('cta.title')}</h2>
            <p className="tx-lead">{t('cta.body')}</p>
          </div>
          <div className="tx-about__cta-actions">
            <Link page="quote" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('cta.quote')}</Link>
            <Link page={BIKE_BOOKING.page} param={BIKE_BOOKING.param} onNavigate={onNavigate} className="tx-btn tx-btn--on-dark tx-btn--lg">{t('cta.bike')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
};
