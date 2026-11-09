import React from 'react';
import { Camera, Facebook, Globe2, Instagram, Languages, Linkedin, MapPinned, Twitter, Youtube } from 'lucide-react';
import {
  HQ_ADDRESS,
  LEGAL_NAME,
  LOGO_ALT,
  LOGO_WORDMARK_WEB_HEIGHT,
  LOGO_WORDMARK_WEB_WIDTH,
  LOGO_WORDMARK_WHITE_WEB,
  OFFICES,
  PHONE,
  PHONE_2,
  SOCIAL,
  SocialNetwork,
  TAGLINE,
  TAGLINE_FR,
  formatPhone,
} from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import { hrefFor } from '../router/navigation';
import { useLocale, useT, type TFunction } from '../i18n/I18nProvider';
import { formatOpeningHoursIn } from '../i18n/format';
import { servicesLinks, type SiteLink } from './Header';
import { SpeedLines } from './ui';
import './Footer.css';

// Public site footer (CONTENT §1.3, design/direction.html): trust strip, then the dark footer
// with the brand block, four link columns, the offices block and the bottom line. Every link
// points at a real page; social icons only for networks with a real URL in brand.ts.
// Text: src/i18n common (CONTENT §1.3 / CONTENT_FR §1.3).

const TRUST_KEYS = ['world', 'live', 'photo', 'languages'] as const;

function footerColumns(t: TFunction): { title: string; links: SiteLink[] }[] {
  return [
    { title: t('footer.columns.services'), links: servicesLinks(t) },
    {
      title: t('footer.columns.company'),
      links: [
        { label: t('footer.links.about'), page: 'about' },
        { label: t('footer.links.network'), page: 'locations' },
        { label: t('footer.links.blog'), page: 'blog' },
        { label: t('footer.links.contact'), page: 'contact' },
      ],
    },
    {
      // 'Book a bike delivery' joins with the local-delivery booking page (G.6).
      title: t('footer.columns.support'),
      links: [
        { label: t('footer.links.track'), page: 'track' },
        { label: t('ship.bookShipment'), page: 'ship' },
        { label: t('footer.links.help'), page: 'help' },
        { label: t('footer.links.quote'), page: 'quote' },
      ],
    },
    {
      title: t('footer.columns.legal'),
      links: [
        { label: t('footer.links.privacy'), page: 'legal', param: 'privacy' },
        { label: t('footer.links.terms'), page: 'legal', param: 'terms' },
        { label: t('footer.links.shippingTerms'), page: 'legal', param: 'shipping-terms' },
        { label: t('footer.links.cookies'), page: 'legal', param: 'cookies' },
        { label: t('footer.links.accessibility'), page: 'legal', param: 'accessibility' },
      ],
    },
  ];
}

const SOCIAL_LINKS: { key: SocialNetwork; label: string; Icon: typeof Facebook }[] = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'x', label: 'X', Icon: Twitter },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
];

const TRUST_ICONS = [Globe2, MapPinned, Camera, Languages];

// Real paths in the current language (src/router); plain clicks route in-app through onNavigate.

interface FooterProps {
  onNavigate?: (page: string, param?: string) => void;
  showTrustStrip?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate = () => {}, showTrustStrip = true }) => {
  const t = useT();
  const locale = useLocale();
  // Admin Settings can override the head-office address and the support phone (useCompanyContact).
  const { phone, phoneHref, address } = useCompanyContact();
  // The admin Settings phone (if set) leads; the second brand number follows when it differs.
  const phones = [phone, formatPhone(PHONE), formatPhone(PHONE_2)]
    .filter((p, i, all) => p && all.indexOf(p) === i);
  const telFor = (display: string) => (display === phone && phoneHref ? phoneHref : `tel:${display.replace(/[^0-9+]/g, '')}`);
  const social = SOCIAL_LINKS.filter((s) => SOCIAL[s.key]);

  // Plain clicks route in-app; Ctrl/Cmd/Shift/middle-click keep the browser's open-in-new-tab
  // behaviour, since each link carries its real URL.
  const go = (page: string, param?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(page, param);
  };

  return (
    <footer className="tx-footer">
      {showTrustStrip && (
        <div className="tx-footer__trust">
          <ul className="tx-footer__container tx-footer__trust-grid">
            {TRUST_KEYS.map((key, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <li key={key} className="tx-footer__trust-item">
                  <span className="tx-footer__trust-icon" aria-hidden="true"><Icon /></span>
                  <p>
                    <strong>{t(`footer.trust.${key}.title`)}</strong> {t(`footer.trust.${key}.body`)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="tx-footer__main tx-dark">
        <div className="tx-footer__container">
          <div className="tx-footer__grid">
            <div className="tx-footer__brand">
              <a className="tx-footer__logo" href={hrefFor('home')} onClick={go('home')}>
                <img
                  src={LOGO_WORDMARK_WHITE_WEB}
                  width={LOGO_WORDMARK_WEB_WIDTH}
                  height={LOGO_WORDMARK_WEB_HEIGHT}
                  loading="lazy"
                  alt={LOGO_ALT}
                />
              </a>
              <p className="tx-footer__tagline">
                <SpeedLines />
                <span>{locale === 'fr' ? TAGLINE_FR : TAGLINE}</span>
              </p>
              <p className="tx-footer__desc">{t('footer.description')}</p>
              {social.length > 0 && (
                <ul className="tx-footer__social" aria-label={t('footer.social')}>
                  {social.map(({ key, label, Icon }) => (
                    <li key={key}>
                      <a href={SOCIAL[key]} aria-label={label} target="_blank" rel="noopener noreferrer">
                        <Icon aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {footerColumns(t).map(({ title, links }) => (
              <nav key={title} className="tx-footer__col" aria-label={title}>
                <h2 className="tx-footer__col-title">{title}</h2>
                <ul>
                  {links.map(({ label, page, param }) => (
                    <li key={label}>
                      <a href={hrefFor(page, param)} onClick={go(page, param)}>{label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="tx-footer__offices">
            <h2 className="tx-visually-hidden">{t('footer.officesTitle')}</h2>
            {OFFICES.map((office, i) => (
              <address key={office.city} className="tx-footer__office">
                <strong>{i === 0 ? t('footer.headOffice') : office.city}</strong>
                <span>{i === 0 && address !== HQ_ADDRESS ? address : locale === 'fr' ? office.addressFr : office.address}</span>
              </address>
            ))}
            <div className="tx-footer__office">
              {phones.length > 0 && (
                <span>
                  {t('footer.call')}{' '}
                  {phones.map((p, i) => (
                    <React.Fragment key={p}>
                      {i > 0 && ' · '}
                      <a href={telFor(p)}>{p}</a>
                    </React.Fragment>
                  ))}
                </span>
              )}
              <span>{t('footer.open', { hours: formatOpeningHoursIn(locale) })}</span>
            </div>
          </div>

          <div className="tx-footer__bottom">
            <p>{t('footer.copyright', { year: new Date().getFullYear(), legalName: LEGAL_NAME })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
