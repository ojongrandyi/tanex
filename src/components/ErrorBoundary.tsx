import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { COMPANY, EMAIL, PHONE, formatPhone, isAdminPathname } from '../config/brand';
import { currentLang, hrefFor, isLocalDevHost } from '../router/navigation';
import { messagesFor, translate } from '../i18n/runtime';
import type { Dict, Locale } from '../i18n/types';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Name used in console logs, e.g. the app or console section. */
  label?: string;
  /**
   * `site`: the outermost boundary, nothing else on screen (shows the logo).
   * `page`: the content area of a public page; header and footer keep working.
   * `console`: a staff console section; offers "try again" and the technical details.
   */
  variant?: 'site' | 'page' | 'console';
}

interface ErrorBoundaryState {
  error: Error | null;
}

const RELOAD_KEY = 'tx_crash_reload';
const RELOAD_WINDOW_MS = 30_000;

/**
 * Errors a fresh page load fixes: a code chunk that no longer exists after a deploy, or the DOM
 * changed underneath React (page translators, extensions).
 */
function isRecoverableByReload(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return (
    /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(text) ||
    /NotFoundError|removeChild|insertBefore|not a child of this node/i.test(text)
  );
}

/** Reloads once per 30 s at most, so a persistent error shows the fallback instead of looping. */
function reloadOnce(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false; // Storage blocked: can't guard against a loop, so don't auto-reload.
  }
  window.location.reload();
  return true;
}

function fallbackLocale(): Locale {
  if (typeof window === 'undefined' || isAdminPathname(window.location.pathname)) return 'en';
  const lang = currentLang();
  return messagesFor(lang) ? lang : 'en';
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  private reloading = false;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
    if (this.props.variant !== 'console' && isRecoverableByReload(error)) {
      this.reloading = reloadOnce();
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // A reload is on its way: keep the screen calm rather than flashing an error.
    if (this.reloading) return <div className="tx-crash tx-crash--blank" aria-busy="true" />;

    const variant = this.props.variant ?? 'page';
    const locale = fallbackLocale();
    const dict = messagesFor(locale)!.common as unknown as Dict;
    const t = (key: string, vars?: Record<string, string>) => translate(dict, `crash.${key}`, locale, vars);
    const showDetails = variant === 'console' || isLocalDevHost();
    const Heading = variant === 'console' ? 'h2' : 'h1';

    return (
      <div className={`tx-crash tx-crash--${variant}`} role="alert" lang={locale}>
        {variant === 'site' && <p className="tx-crash__brand">{COMPANY}</p>}
        <AlertTriangle className="tx-crash__icon" size={36} aria-hidden="true" />
        <Heading className="tx-crash__title">{t('title')}</Heading>
        <p className="tx-crash__body">{t('body')}</p>
        <div className="tx-crash__actions">
          {variant === 'console' ? (
            <Button variant="primary" icon={<RotateCcw size={18} />} onClick={this.retry}>
              {t('retry')}
            </Button>
          ) : (
            <Button variant="primary" icon={<RotateCcw size={18} />} onClick={() => window.location.reload()}>
              {t('reload')}
            </Button>
          )}
          {variant !== 'console' && (
            <Button variant="ghost" icon={<Home size={18} />} href={hrefFor('home')}>
              {t('home')}
            </Button>
          )}
        </div>
        {variant !== 'console' && (
          <p className="tx-crash__help">
            {t('help', { phone: '\u0000phone\u0000', email: '\u0000email\u0000' })
              .split('\u0000')
              .map((part, i) =>
                part === 'phone' ? (
                  <a key={i} className="tx-crash__link" href={`tel:${PHONE}`}>{formatPhone(PHONE)}</a>
                ) : part === 'email' ? (
                  <a key={i} className="tx-crash__link" href={`mailto:${EMAIL}`}>{EMAIL}</a>
                ) : (
                  part
                ),
              )}
          </p>
        )}
        {showDetails && (
          <details className="tx-crash__details">
            <summary>{t('details')}</summary>
            <pre>{`${error.name}: ${error.message}`}</pre>
          </details>
        )}
      </div>
    );
  }
}
