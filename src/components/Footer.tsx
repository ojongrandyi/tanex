import React from 'react';
import { Camera, Facebook, Globe2, Instagram, Languages, Linkedin, MapPinned, Twitter, Youtube } from 'lucide-react';
import {
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
  formatOpeningHours,
  formatPhone,
} from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import { SITE_TEXT } from './siteText';
import { SpeedLines } from './ui';
import './Footer.css';

// Public site footer (CONTENT §1.3, design/direction.html): trust strip, then the dark footer
// with the brand block, four link columns, the offices block and the bottom line. Every link
// points at a real page; social icons only for networks with a real URL in brand.ts.

const T = SITE_TEXT.footer;

const SOCIAL_LINKS: { key: SocialNetwork; label: string; Icon: typeof Facebook }[] = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'x', label: 'X', Icon: Twitter },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
];

const TRUST_ICONS = [Globe2, MapPinned, Camera, Languages];

const hrefFor = (page: string, param?: string) => (page === 'home' ? '#/' : `#/${page}${param ? `/${param}` : ''}`);

interface FooterProps {
  onNavigate?: (page: string, param?: string) => void;
  showTrustStrip?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate = () => {}, showTrustStrip = true }) => {
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
            {T.trust.map((item, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <li key={item.title} className="tx-footer__trust-item">
                  <span className="tx-footer__trust-icon" aria-hidden="true"><Icon /></span>
                  <p>
                    <strong>{item.title}</strong> {item.body}
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
                <span>{TAGLINE}</span>
              </p>
              <p className="tx-footer__desc">{T.description}</p>
              {social.length > 0 && (
                <ul className="tx-footer__social" aria-label={T.social}>
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

            {T.columns.map(({ title, links }) => (
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
            <h2 className="tx-visually-hidden">{T.officesTitle}</h2>
            {OFFICES.map((office, i) => (
              <address key={office.city} className="tx-footer__office">
                <strong>{i === 0 ? T.headOffice : office.city}</strong>
                <span>{i === 0 && address ? address : office.address}</span>
              </address>
            ))}
            <div className="tx-footer__office">
              {phones.length > 0 && (
                <span>
                  {T.call('')}
                  {phones.map((p, i) => (
                    <React.Fragment key={p}>
                      {i > 0 && ' · '}
                      <a href={telFor(p)}>{p}</a>
                    </React.Fragment>
                  ))}
                </span>
              )}
              <span>{T.open(formatOpeningHours())}</span>
            </div>
          </div>

          <div className="tx-footer__bottom">
            <p>{T.copyright(new Date().getFullYear(), LEGAL_NAME)}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
