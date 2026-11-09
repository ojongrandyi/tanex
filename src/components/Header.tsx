import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import {
  COMPANY,
  LOGO_ALT,
  LOGO_WORDMARK_WEB,
  LOGO_WORDMARK_WEB_HEIGHT,
  LOGO_WORDMARK_WEB_WIDTH,
} from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import { useEscapeKey } from '../utils/useEscapeKey';
import { hrefFor, navigate } from '../router/navigation';
import { alternatePath } from '../router/routes';
import { isPlainClick } from '../router/Link';
import { useLocale, useT, type TFunction } from '../i18n/I18nProvider';
import { formatOpeningHoursIn } from '../i18n/format';
import { loadLocale, storeLocale } from '../i18n/runtime';
import { LOCALES, type Locale } from '../i18n/types';
import { buttonClass } from './ui';
import './Header.css';

// Public site header (CONTENT §1.2, design/direction.html): dark utility bar on desktop, then a
// sticky cream bar with a backdrop blur: logo, main navigation with the Services menu, the
// EN | FR language switch and Get a Quote. Below 1100 px the navigation moves into a drawer
// (dialog with focus trap; Escape, backdrop and every link close it). Text: src/i18n common.

/** A link to an App.tsx page, with an optional param (service tier ID, legal section ID). */
export interface SiteLink {
  label: string;
  page: string;
  param?: string;
}

// Moves keyboard focus past the header to the page content. A button, not an in-page "#main"
// link: the address bar should keep the page path, not gain a fragment.
function skipToContent() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  main.setAttribute('tabindex', '-1');
  main.focus();
}

// Real paths in the current language (src/router); plain clicks route in-app through onNavigate.

interface NavItem {
  key: string;
  label: string;
  page: string;
  /** Pages that mark this item as current. */
  pages: string[];
  menu?: SiteLink[];
  /** Last menu entry, opening the section page itself. */
  allLabel?: string;
}

/** CONTENT §1.2 Services menu, in the owner's order (also the footer's Services column). */
export function servicesLinks(t: TFunction): SiteLink[] {
  return [
    { label: t('services.air'), page: 'services', param: 'air' },
    { label: t('services.road'), page: 'services', param: 'road' },
    { label: t('services.warehousing'), page: 'services', param: 'warehousing' },
    { label: t('services.maritime'), page: 'services', param: 'maritime' },
    { label: t('services.rail'), page: 'services', param: 'rail' },
    { label: t('services.localDelivery'), page: 'services', param: 'local-delivery' },
  ];
}

// The owner's menu (2026-11-09): Home, About Us, Track Shipment, Our Services, Blog, Contact Us.
// Ship and Network moved to the footer. A Marketplace button joins once the owner supplies its URL.
function navItems(t: TFunction): NavItem[] {
  return [
    { key: 'home', label: t('header.home'), page: 'home', pages: ['home'] },
    { key: 'about', label: t('header.about'), page: 'about', pages: ['about'] },
    { key: 'track', label: t('header.track'), page: 'track', pages: ['track', 'track-result'] },
    { key: 'services', label: t('header.services'), page: 'services', pages: ['services'], menu: servicesLinks(t), allLabel: t('header.allServices') },
    { key: 'blog', label: t('header.blog'), page: 'blog', pages: ['blog'] },
    { key: 'contact', label: t('header.contact'), page: 'contact', pages: ['contact'] },
  ];
}

const hasMenu = (item: NavItem) => (item.menu?.length ?? 0) > 1;

interface HeaderProps {
  activePage?: string;
  onNavigate?: (page: string, param?: string) => void;
}

/**
 * EN | FR (I18N_SPEC §2–3). The other language is a real link to the same page in that language
 * (tracking ID, tier or policy tab kept); choosing it is remembered in tx_locale.
 */
export const LanguageSwitch: React.FC<{ onSwitched?: () => void }> = ({ onSwitched }) => {
  const t = useT();
  const locale = useLocale();
  const names: Record<Locale, string> = { en: t('language.enName'), fr: t('language.frName') };
  const codes: Record<Locale, string> = { en: t('language.en'), fr: t('language.fr') };
  const hrefIn = (target: Locale) =>
    typeof window === 'undefined' ? '/' : alternatePath(window.location.pathname, target) + window.location.search;

  const choose = (target: Locale) => async (e: React.MouseEvent<HTMLAnchorElement>) => {
    storeLocale(target);
    if (!isPlainClick(e)) return;
    e.preventDefault();
    const href = hrefIn(target);
    try {
      await loadLocale(target);
    } catch {
      // Dictionary couldn't load: a full page load still shows the right language from the server.
      window.location.assign(href);
      return;
    }
    onSwitched?.();
    navigate(href);
  };

  return (
    <div className="tx-lang" role="group" aria-label={t('language.label')}>
      {LOCALES.map((code, i) => (
        <React.Fragment key={code}>
          {i > 0 && <span className="tx-lang__sep" aria-hidden="true">|</span>}
          {code === locale ? (
            <span className="tx-lang__opt is-current" aria-current="true" lang={code} title={names[code]}>
              {codes[code]}
            </span>
          ) : (
            <a className="tx-lang__opt" href={hrefIn(code)} hrefLang={code} lang={code} title={names[code]} aria-label={names[code]} onClick={choose(code)}>
              {codes[code]}
            </a>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ activePage = 'home', onNavigate = () => {} }) => {
  const t = useT();
  const locale = useLocale();
  const NAV = useMemo(() => navItems(t), [t]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerSection, setDrawerSection] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { phone, phoneHref, email } = useCompanyContact();
  const hours = formatOpeningHoursIn(locale);
  const uid = useId().replace(/:/g, '');

  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const hoverOpened = useRef<string | null>(null);

  // Solid edge once the page scrolls under the header.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Drawer: lock page scroll, move focus in, keep Tab inside, give focus back on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const drawer = drawerRef.current;
    const focusables = () =>
      Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const toggle = toggleRef.current;
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      toggle?.focus();
    };
  }, [drawerOpen]);

  // Desktop menu: close on a click outside the navigation.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openMenu]);

  useEscapeKey(drawerOpen, () => setDrawerOpen(false));
  useEscapeKey(Boolean(openMenu) && !drawerOpen, () => {
    const key = openMenu;
    setOpenMenu(null);
    if (key) document.getElementById(`tx-nav-btn-${key}-${uid}`)?.focus();
  });

  // The drawer is for small screens; close it if the window grows past the breakpoint.
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia('(min-width: 1100px)');
    const onChange = () => { if (mq.matches) setDrawerOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [drawerOpen]);

  // Plain clicks route in-app; Ctrl/Cmd/Shift/middle-click keep the browser's open-in-new-tab
  // behaviour, since every link carries its real URL.
  const go = (page: string, param?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpenMenu(null);
    setDrawerOpen(false);
    onNavigate(page, param);
  };

  const isCurrent = (item: NavItem) => item.pages.includes(activePage);

  const hoverOpen = (key: string | null) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      hoverOpened.current = key;
      setOpenMenu(key);
    }, key ? 60 : 160);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const onMenuKeyDown = (key: string) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpenMenu(key);
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLAnchorElement>(`#tx-nav-menu-${key}-${uid} a`)?.focus());
    }
  };

  const onMenuListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % links.length : (i - 1 + links.length) % links.length;
    links[next]?.focus();
  };

  return (
    <header className={`tx-header${scrolled ? ' is-scrolled' : ''}`}>
      <button type="button" className="ngf-skip-link" onClick={skipToContent}>
        {t('skipLink')}
      </button>

      {/* Utility bar (desktop): phone · email · hours · cities */}
      <div className="tx-utility tx-dark">
        <div className="tx-header__container tx-utility__inner">
          <ul className="tx-utility__list" aria-label={t('header.utilityLabel')}>
            {phone && (
              <li>
                <a href={phoneHref} className="tx-utility__item">
                  <Phone aria-hidden="true" />
                  <span>{phone}</span>
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="tx-utility__item">
                  <Mail aria-hidden="true" />
                  <span>{email}</span>
                </a>
              </li>
            )}
            <li className="tx-utility__item">
              <Clock aria-hidden="true" />
              <span>{t('header.open', { hours })}</span>
            </li>
            <li className="tx-utility__item">
              <MapPin aria-hidden="true" />
              <span>{t('header.cities')}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Main bar */}
      <div className="tx-header__bar">
        <div className="tx-header__container tx-header__inner">
          <a href={hrefFor('home')} className="tx-header__logo" onClick={go('home')} aria-label={t('homeLabel', { company: COMPANY })}>
            <img
              src={LOGO_WORDMARK_WEB}
              width={LOGO_WORDMARK_WEB_WIDTH}
              height={LOGO_WORDMARK_WEB_HEIGHT}
              alt={LOGO_ALT}
              className="tx-header__logo-img"
            />
          </a>

          <nav className="tx-nav" aria-label={t('header.navLabel')} ref={navRef}>
            <ul className="tx-nav__list">
              {NAV.map((item) => {
                const current = isCurrent(item);
                if (!hasMenu(item)) {
                  return (
                    <li key={item.key} className="tx-nav__item">
                      <a
                        href={hrefFor(item.page)}
                        className={`tx-nav__link${current ? ' is-current' : ''}`}
                        aria-current={current ? 'page' : undefined}
                        onClick={go(item.page)}
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                }
                const open = openMenu === item.key;
                const menuId = `tx-nav-menu-${item.key}-${uid}`;
                return (
                  <li
                    key={item.key}
                    className={`tx-nav__item has-menu${open ? ' is-open' : ''}`}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') hoverOpen(item.key); }}
                    onPointerLeave={(e) => { if (e.pointerType === 'mouse') hoverOpen(null); }}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenMenu((k) => (k === item.key ? null : k));
                    }}
                  >
                    <button
                      type="button"
                      id={`tx-nav-btn-${item.key}-${uid}`}
                      className={`tx-nav__link tx-nav__trigger${current ? ' is-current' : ''}`}
                      aria-expanded={open}
                      aria-controls={menuId}
                      onClick={(e) => {
                        // A mouse click right after hover opened the menu keeps it open.
                        if (open && e.detail > 0 && hoverOpened.current === item.key) { hoverOpened.current = null; return; }
                        hoverOpened.current = null;
                        setOpenMenu(open ? null : item.key);
                      }}
                      onKeyDown={onMenuKeyDown(item.key)}
                    >
                      {item.label}
                      <ChevronDown className="tx-nav__chevron" aria-hidden="true" />
                    </button>
                    <div className="tx-nav__panel" id={menuId} hidden={!open}>
                      <ul className="tx-nav__menu" aria-label={t('header.submenu', { name: item.label })} onKeyDown={onMenuListKeyDown}>
                        {item.menu!.map((link) => (
                          <li key={link.label}>
                            <a href={hrefFor(link.page, link.param)} className="tx-nav__menu-link" onClick={go(link.page, link.param)}>
                              {link.label}
                            </a>
                          </li>
                        ))}
                        {item.allLabel && (
                          <li className="tx-nav__menu-all">
                            <a
                              href={hrefFor(item.page)}
                              className="tx-nav__menu-link"
                              aria-current={current ? 'page' : undefined}
                              onClick={go(item.page)}
                            >
                              {item.allLabel}
                            </a>
                          </li>
                        )}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="tx-header__actions">
            <div className="tx-header__lang">
              <LanguageSwitch />
            </div>
            <a href={hrefFor('quote')} className={buttonClass('primary', 'sm', false, 'tx-header__quote')} onClick={go('quote')}>
              {t('header.quote')}
            </a>
            <button
              ref={toggleRef}
              type="button"
              className="tx-header__toggle"
              aria-label={t('header.openMenu')}
              aria-expanded={drawerOpen}
              aria-controls={`tx-drawer-${uid}`}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer (below 1100 px) */}
      {drawerOpen && (
        <div className="tx-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div
            ref={drawerRef}
            id={`tx-drawer-${uid}`}
            className="tx-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('header.menu')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tx-drawer__head">
              <a href={hrefFor('home')} className="tx-header__logo" onClick={go('home')} aria-label={t('homeLabel', { company: COMPANY })}>
                <img src={LOGO_WORDMARK_WEB} width={LOGO_WORDMARK_WEB_WIDTH} height={LOGO_WORDMARK_WEB_HEIGHT} alt={LOGO_ALT} className="tx-header__logo-img" />
              </a>
              <button type="button" className="tx-header__toggle" aria-label={t('header.closeMenu')} onClick={() => setDrawerOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>

            <nav className="tx-drawer__nav" aria-label={t('header.navLabel')}>
              <ul className="tx-drawer__list">
                {NAV.map((item) => {
                  const current = isCurrent(item);
                  if (!hasMenu(item)) {
                    return (
                      <li key={item.key}>
                        <a href={hrefFor(item.page)} className="tx-drawer__link" aria-current={current ? 'page' : undefined} onClick={go(item.page)}>
                          {item.label}
                        </a>
                      </li>
                    );
                  }
                  const open = drawerSection === item.key;
                  const subId = `tx-drawer-sub-${item.key}-${uid}`;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        className={`tx-drawer__link tx-drawer__trigger${current ? ' is-current' : ''}`}
                        aria-expanded={open}
                        aria-controls={subId}
                        onClick={() => setDrawerSection(open ? null : item.key)}
                      >
                        {item.label}
                        <ChevronDown className="tx-nav__chevron" aria-hidden="true" />
                      </button>
                      <ul className="tx-drawer__sub" id={subId} hidden={!open}>
                        {item.menu!.map((link) => (
                          <li key={link.label}>
                            <a href={hrefFor(link.page, link.param)} className="tx-drawer__sublink" onClick={go(link.page, link.param)}>
                              {link.label}
                            </a>
                          </li>
                        ))}
                        {item.allLabel && (
                          <li>
                            <a href={hrefFor(item.page)} className="tx-drawer__sublink" aria-current={current ? 'page' : undefined} onClick={go(item.page)}>
                              {item.allLabel}
                            </a>
                          </li>
                        )}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <a href={hrefFor('quote')} className={buttonClass('primary', 'lg', true)} onClick={go('quote')}>
              {t('header.quote')}
            </a>

            <div className="tx-drawer__lang">
              <LanguageSwitch onSwitched={() => setDrawerOpen(false)} />
            </div>

            {(email || phone) && (
              <div className="tx-drawer__help">
                <p className="tx-drawer__help-title">{t('header.needHelp')}</p>
                {email && (
                  <a href={`mailto:${email}`} className="tx-drawer__help-link">
                    <Mail aria-hidden="true" />
                    <span>{email}</span>
                  </a>
                )}
                {phone && (
                  <a href={phoneHref} className="tx-drawer__help-link">
                    <Phone aria-hidden="true" />
                    <span>{phone}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
