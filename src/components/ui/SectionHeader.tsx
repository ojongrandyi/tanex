import React from 'react';
import './ui.css';

// Eyebrow + heading + intro used at the top of every section (design/direction.html).
// Put the one emphasised word of the heading in <Em> (italic 800 with the speed lines).
interface SectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  /** Heading element; sections are h2 by default. Size follows `size`, not the level. */
  as?: 'h1' | 'h2' | 'h3';
  size?: 'display' | 'h1' | 'h2' | 'h3';
  align?: 'start' | 'center';
  id?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow, title, intro, as: Tag = 'h2', size = 'h2', align = 'start', id, className = '',
}) => (
  <header className={`tx-section-header${align === 'center' ? ' tx-section-header--center' : ''}${className ? ` ${className}` : ''}`}>
    {eyebrow && <p className="tx-eyebrow">{eyebrow}</p>}
    <Tag className={`tx-${size}`} id={id}>{title}</Tag>
    {intro && <p className="tx-lead">{intro}</p>}
  </header>
);

/** The one emphasised word of a headline. */
export const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => <em className="tx-em">{children}</em>;

/** The logo's three speed lines, decorative. */
export const SpeedLines: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`tx-speed${className ? ` ${className}` : ''}`} aria-hidden="true"><i /><i /><i /></span>
);
