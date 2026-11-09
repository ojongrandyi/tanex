import React from 'react';
import { PageHero } from '../components/ui';
import { COMPANY } from '../config/brand';
import { Link } from '../router/Link';
import { useAreaT } from '../i18n/I18nProvider';

// /blog until the public blog (task F.3) exists: a "coming soon" page, served with noindex and
// left out of the sitemap (routes.ts `noindex`). No sample articles (CLAUDE.md rule 9).

interface BlogPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const BlogPage: React.FC<BlogPageProps> = ({ onNavigate }) => {
  const t = useAreaT('blog');
  return (
    <PageHero
      eyebrow={t('eyebrow')}
      title={t('title')}
      lead={t('sub', { company: COMPANY })}
      titleId="blog-title"
      className="tx-blog-soon"
      actions={
        <>
          <Link page="track" onNavigate={onNavigate} className="tx-btn tx-btn--primary tx-btn--lg">{t('track')}</Link>
          <Link page="contact" onNavigate={onNavigate} className="tx-btn tx-btn--on-dark tx-btn--lg">{t('contact')}</Link>
        </>
      }
    />
  );
};
