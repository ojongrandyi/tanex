import React from 'react';
import { Home, PackageSearch } from 'lucide-react';
import { Button } from '../components/ui';
import { useAreaT } from '../i18n/I18nProvider';
import './NotFoundPage.css';

interface NotFoundPageProps {
  onNavigate: (page: string, param?: string) => void;
}

// Any address the site doesn't have (CONTENT §1.1a / CONTENT_FR §1.1a). The server answers these
// with status 404. Its text is the "notFound" area, loaded with this page.
export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  const t = useAreaT('notFound');
  return (
    <div className="tx-page-notfound">
      <section className="tx-container tx-notfound-inner">
        <p className="tx-notfound-eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className="tx-notfound-sub">{t('sub')}</p>
        <div className="tx-notfound-actions">
          <Button variant="primary" icon={<Home size={18} />} onClick={() => onNavigate('home')}>
            {t('home')}
          </Button>
          <Button variant="ghost" icon={<PackageSearch size={18} />} onClick={() => onNavigate('track')}>
            {t('track')}
          </Button>
        </div>
        <p className="tx-notfound-help">
          {t('needHelp')}{' '}
          <button type="button" className="tx-notfound-link" onClick={() => onNavigate('contact')}>
            {t('contact')}
          </button>
        </p>
      </section>
    </div>
  );
};
