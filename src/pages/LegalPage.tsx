import React, { useEffect, useState } from 'react';
import { Cookie, Eye, FileText, Lock, Shield } from 'lucide-react';
import { useCompanyContact } from '../utils/useCompanyContact';
import { HQ_ADDRESS, HQ_ADDRESS_FR } from '../config/brand';
import { LEGAL_LAST_UPDATED, legalDocs, type LegalDocId } from '../data/legalDocs';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { formatDate } from '../i18n/format';
import { hrefFor } from '../router/navigation';
import { isPlainClick } from '../router/Link';
import './LegalPage.css';

// Legal (CONTENT §13.1 / CONTENT_FR §13): Privacy · Terms · Shipping Terms · Cookies · Accessibility,
// one address per policy (/legal/<id>, /fr/mentions-legales/<id>). Drafts pending the lawyer (#112).

interface LegalPageProps {
  initialSection?: string;
  onNavigate?: (page: string, param?: string) => void;
}

const DOC_ICONS: Record<LegalDocId, React.ElementType> = {
  privacy: Lock,
  terms: FileText,
  'shipping-terms': Shield,
  cookies: Cookie,
  accessibility: Eye,
};

export const LegalPage: React.FC<LegalPageProps> = ({ initialSection = 'privacy', onNavigate }) => {
  const t = useAreaT('legal');
  const locale = useLocale();
  // Contact values from Settings/brand.ts; an empty address leaves its sentence out. The French
  // text uses the French form of the head-office address when it is the default one.
  const { email, address } = useCompanyContact();
  const localAddress = locale === 'fr' && address === HQ_ADDRESS ? HQ_ADDRESS_FR : address;
  const docs = legalDocs({ email, address: localAddress }, locale);
  const known = (id: string) => docs.some((d) => d.id === id);
  const [activeDoc, setActiveDoc] = useState(known(initialSection) ? initialSection : 'privacy');

  useEffect(() => {
    if (initialSection && known(initialSection)) setActiveDoc(initialSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  const doc = docs.find((d) => d.id === activeDoc) || docs[0];
  const updated = formatDate(`${LEGAL_LAST_UPDATED}T12:00:00Z`, locale, { dateStyle: 'long' });

  return (
    <div className="tx-legal">
      <section className="tx-legal__hero tx-dark" aria-labelledby="legal-title">
        <div className="tx-legal__wrap">
          <h1 className="tx-h1" id="legal-title">{t('title')}</h1>
        </div>
      </section>

      <div className="tx-legal__wrap tx-legal__layout">
        <nav className="tx-legal__nav" aria-label={t('navLabel')}>
          <ul>
            {docs.map((d) => {
              const Icon = DOC_ICONS[d.id];
              return (
                <li key={d.id}>
                  <a
                    href={hrefFor('legal', d.id)}
                    aria-current={d.id === doc.id ? 'page' : undefined}
                    className={d.id === doc.id ? 'is-current' : ''}
                    onClick={(e) => {
                      if (!isPlainClick(e)) return;
                      e.preventDefault();
                      setActiveDoc(d.id);
                      // Keep the URL (/legal/<id>) in step, so each policy has its own link.
                      onNavigate?.('legal', d.id);
                    }}
                  >
                    <Icon aria-hidden="true" />
                    <span>{d.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <article className="tx-legal__doc" aria-labelledby="legal-doc-title">
          <header className="tx-legal__doc-head">
            <h2 className="tx-h2" id="legal-doc-title">{doc.title}</h2>
            <p className="tx-legal__updated">{t('updated', { date: updated })}</p>
          </header>
          {doc.sections.map((section, i) => (
            <section key={section.heading} className="tx-legal__section">
              <h3>{i + 1}. {section.heading}</h3>
              {section.body.map((block, j) =>
                Array.isArray(block) ? (
                  <ul key={j}>{block.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : (
                  <p key={j}>{block}</p>
                ),
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
};
