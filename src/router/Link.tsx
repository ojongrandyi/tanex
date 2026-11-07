// A real <a href> for in-app pages (I18N_SPEC §2): middle-click, Ctrl/Cmd-click, "copy link",
// crawlers and no-JS all get the actual URL; a plain left click routes in-app.
import React from 'react';
import { hrefFor, navigate } from './navigation';

/** True for a plain left click the app should handle itself. */
export function isPlainClick(e: React.MouseEvent<HTMLAnchorElement>): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export interface LinkProps extends AnchorProps {
  /** App.tsx page name ('services', 'track-result', …). */
  page: string;
  param?: string;
  /**
   * Called instead of navigate() on a plain click (App.tsx's onNavigate, which also sets page
   * state such as the open service tier). Without it the link calls navigate() itself.
   */
  onNavigate?: (page: string, param?: string) => void;
}

export const Link: React.FC<LinkProps> = ({ page, param, onNavigate, onClick, children, ...rest }) => {
  const href = hrefFor(page, param);
  return (
    <a
      {...rest}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (!isPlainClick(e) || rest.target === '_blank') return;
        e.preventDefault();
        if (onNavigate) onNavigate(page, param);
        else navigate(href);
      }}
    >
      {children}
    </a>
  );
};
