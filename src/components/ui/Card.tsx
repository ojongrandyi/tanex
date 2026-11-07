import React from 'react';
import './ui.css';

// White card on light sections, Chocolate 900 inside .tx-dark (BRAND_GUIDE §4.4, §9). Optional
// icon tile, title, body and footer. `interactive` lifts on hover; pass `href`/`onClick` through
// `as` ('a' | 'button') to make the whole card a control.
interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'div' | 'article' | 'li' | 'a' | 'button';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** Heading level for the title (default h3). */
  titleAs?: 'h2' | 'h3' | 'h4';
  footer?: React.ReactNode;
  interactive?: boolean;
  href?: string;
  type?: 'button' | 'submit';
}

export const Card: React.FC<CardProps> = ({
  as = 'div', icon, title, titleAs: TitleTag = 'h3', footer, interactive, className = '', children, ...rest
}) => {
  const Tag = as as React.ElementType;
  const isControl = as === 'a' || as === 'button';
  const cls = ['tx-card', interactive || isControl ? 'tx-card--interactive' : '', className].filter(Boolean).join(' ');
  const extra = as === 'button' && !rest.type ? { type: 'button' } : {};
  return (
    <Tag className={cls} {...extra} {...rest}>
      {icon && <span className="tx-card__icon" aria-hidden="true">{icon}</span>}
      {title && (isControl ? <span className="tx-card__title" style={{ display: 'block' }}>{title}</span> : <TitleTag className="tx-card__title">{title}</TitleTag>)}
      {children && <div className="tx-card__body">{children}</div>}
      {footer && <div className="tx-card__footer">{footer}</div>}
    </Tag>
  );
};
