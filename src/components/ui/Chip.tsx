import React from 'react';
import type { StatusTone } from '../../shared/shipmentStatus';
import './ui.css';

// Chips (BRAND_GUIDE §9). `Chip` is a neutral label or, with onClick, a filter toggle
// (aria-pressed). `StatusChip` shows a shipment state in its semantic colour, always with text.
interface ChipProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'neutral' | 'outline';
  /** For filter chips: renders a toggle button with aria-pressed. */
  pressed?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({ variant = 'neutral', pressed, onClick, icon, className = '', children, ...rest }) => {
  const cls = ['tx-chip', variant === 'outline' ? 'tx-chip--outline' : '', pressed ? 'tx-chip--active' : '', className].filter(Boolean).join(' ');
  const inner = <>{icon && <span aria-hidden="true" style={{ display: 'contents' }}>{icon}</span>}{children}</>;
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={pressed ?? undefined} onClick={onClick} {...(rest as React.HTMLAttributes<HTMLButtonElement>)}>
        {inner}
      </button>
    );
  }
  return <span className={cls} {...rest}>{inner}</span>;
};

export type StatusChipTone = 'delivered' | 'transit' | 'delayed' | 'hold' | 'neutral';

/** Maps the shared shipment status tones (src/shared/shipmentStatus.ts) onto the four semantic colours. */
export function statusChipTone(tone: StatusTone): StatusChipTone {
  switch (tone) {
    case 'delivered': return 'delivered';
    case 'transit':
    case 'out': return 'transit';
    case 'delayed':
    case 'returning': return 'delayed';
    case 'hold': return 'hold';
    default: return 'neutral';
  }
}

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusChipTone;
  children: React.ReactNode;
}

export const StatusChip: React.FC<StatusChipProps> = ({ tone, className = '', children, ...rest }) => (
  <span className={`tx-chip tx-status tx-status--${tone}${className ? ` ${className}` : ''}`} {...rest}>{children}</span>
);
