import React from 'react';
import './ui.css';

// TanEx button (BRAND_GUIDE §4.4, design/direction.html). Renders a <button>, or an <a> when
// `href` is given. Primary = orange with chocolate text; secondary = chocolate; ghost = chocolate
// outline (cream outline inside .tx-dark); onDark = cream outline for dark surfaces.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'onDark';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Icon before the label (decorative: hidden from screen readers). */
  icon?: React.ReactNode;
  /** Icon after the label, e.g. an arrow (decorative). */
  iconEnd?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

type ButtonAsButton = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };
export type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'tx-btn--primary',
  secondary: 'tx-btn--secondary',
  ghost: 'tx-btn--ghost',
  onDark: 'tx-btn--on-dark',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false, extra = ''): string {
  return ['tx-btn', VARIANT_CLASS[variant], size !== 'md' ? `tx-btn--${size}` : '', block ? 'tx-btn--block' : '', extra]
    .filter(Boolean)
    .join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'primary', size = 'md', block = false, icon, iconEnd, className = '', children, ...rest } = props;
  const cls = buttonClass(variant, size, block, className);
  const content = (
    <>
      {icon && <span aria-hidden="true" style={{ display: 'contents' }}>{icon}</span>}
      <span>{children}</span>
      {iconEnd && <span aria-hidden="true" style={{ display: 'contents' }}>{iconEnd}</span>}
    </>
  );
  if (typeof (rest as ButtonAsLink).href === 'string') {
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} className={cls} {...(rest as Omit<ButtonAsLink, keyof CommonProps>)}>
        {content}
      </a>
    );
  }
  const { type = 'button', ...buttonRest } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={type} className={cls} {...buttonRest}>
      {content}
    </button>
  );
});
