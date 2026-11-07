import React from 'react';
import { SpeedLines } from './SectionHeader';
import './ui.css';

// Hero for inner pages (Services, About, Network, Contact, Help, Legal, Track, Quote, Ship).
// Dark by default (Chocolate 950, cream text) as in the approved direction; `tone="light"` for a
// cream hero. The homepage hero is the Journey's first chapter (phases E/H), not this component.
interface PageHeroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional image or illustration beside the copy (stacks under it on small screens). */
  media?: React.ReactNode;
  tone?: 'dark' | 'light';
  /** Id for the h1, e.g. for aria-labelledby on the page's <main>. */
  titleId?: string;
  className?: string;
  children?: React.ReactNode;
}

export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow, title, lead, actions, media, tone = 'dark', titleId, className = '', children,
}) => (
  <section
    className={['tx-page-hero', tone === 'dark' ? 'tx-dark' : 'tx-light', media ? 'tx-page-hero--with-media' : '', className].filter(Boolean).join(' ')}
    aria-labelledby={titleId}
  >
    <div className="tx-page-hero__inner">
      <div className="tx-page-hero__copy">
        {eyebrow && <p className="tx-eyebrow">{eyebrow}</p>}
        <h1 className="tx-h1" id={titleId}>{title}</h1>
        {lead && <p className="tx-lead">{lead}</p>}
        {actions && <div className="tx-page-hero__actions">{actions}</div>}
        {children}
      </div>
      {media && <div className="tx-page-hero__media">{media}</div>}
    </div>
    <SpeedLines className="tx-page-hero__speed" />
  </section>
);
