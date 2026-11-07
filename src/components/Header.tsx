import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Clock, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import {
  COMPANY,
  LOGO_ALT,
  LOGO_WORDMARK_WEB,
  LOGO_WORDMARK_WEB_HEIGHT,
  LOGO_WORDMARK_WEB_WIDTH,
  formatOpeningHours,
} from '../config/brand';
import { useCompanyContact } from '../utils/useCompanyContact';
import { useEscapeKey } from '../utils/useEscapeKey';
import { SITE_TEXT, type SiteLink } from './siteText';
import { buttonClass } from './ui';
import './Header.css';

// Public site header (CONTENT §1.2, design/direction.html): dark utility bar on desktop, then a
// sticky cream bar with a backdrop blur: logo, main navigation with the Services menu, the
// language switch (EN active; FR arrives with D.3) and Get a Quote. Below 1100 px the navigation
// moves into a drawer (dialog with focus trap; Escape, backdrop and every link close it).

const T = SITE_TEXT.header;

// Moves keyboard focus past the header to the page content. A button, not an in-page "#main"
// link: the site uses hash routing, so changing the hash would change the page.
function skipToContent() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  main.setAttribute('tabindex', '-1');
  main.focus();
}

const hrefFor = (page: string, param?: string) => (page === 'home' ? '#/' : `#/${page}${param ? `/${param}` : ''}`);

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

// Blog (F.3) joins the list when the public blog exists. A menu with a single entry is shown as a
// plain link (Ship, until the bike-delivery booking page arrives with G.6).
const NAV: NavItem[] = [
  { key: 'track', label: T.track, page: 'track', pages: ['track', 'track-result'] },
  { key: 'services', label: T.services, page: 'services', pages: ['services'], menu: T.servicesMenu, allLabel: T.allServices },
  { key: 'ship', label: T.ship, page: 'ship', pages: ['ship'], menu: T.shipMenu },
  { key: 'network', label: T.network, page: 'locations', pages: ['locations'] },
  { key: 'about', label: T.about, page: 'about', pages: ['about'] },
  { key: 'contact', label: T.contact, page: 'contact', pages: ['contact'] },
];

const hasMenu = (item: NavItem) => (item.menu?.length ?? 0) > 1;

interface HeaderProps {
  activePage?: string;
  onNavigate?: (page: string, param?: string) => void;
}

/** EN | FR. French is shown but not selectable until the i18n foundation (D.3). */
const LanguageSwitch: React.FC<{ idSuffix: string }> = ({ idSuffix }) => {
  const hintId = `tx-lang-hint-${idSuffix}`;
  return (
    <div className="tx-lang" role="group" aria-label={T.language}>
      <span className="tx-lang__opt is-current" aria-current="true" lang="en" title={T.englishName}>
        {T.english}
      </span>
      <span className="tx-lang__sep" aria-hidden="true">|</span>
      <button
        type="button"
        className="tx-lang__opt"
        lang="fr"
        aria-disabled="true"
        aria-describedby={hintId}
        title={T.frenchSoon}
        onClick={(e) => e.preventDefault()}
      >
        {T.french}
      </button>
      <span id={hintId} className="tx-visually-hidden">{T.frenchSoon}</span>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ activePage = 'home', onNavigate = () => {} }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerSection, setDrawerSection] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { phone, phoneHref, email } = useCompanyContact();
  const hours = formatOpeningHours();
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
        {SITE_TEXT.skipLink}
      </button>

      {/* Utility bar (desktop): phone · email · hours · cities */}
      <div className="tx-utility tx-dark">
        <div className="tx-header__container tx-utility__inner">
          <ul className="tx-utility__list" aria-label={T.utilityLabel}>
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
              <span>{T.open(hours)}</span>
            </li>
            <li className="tx-utility__item">
              <MapPin aria-hidden="true" />
              <span>{T.cities}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Main bar */}
      <div className="tx-header__bar">
        <div className="tx-header__container tx-header__inner">
          <a href="#/" className="tx-header__logo" onClick={go('home')} aria-label={SITE_TEXT.homeLabel(COMPANY)}>
            <img
              src={LOGO_WORDMARK_WEB}
              width={LOGO_WORDMARK_WEB_WIDTH}
              height={LOGO_WORDMARK_WEB_HEIGHT}
              alt={LOGO_ALT}
              className="tx-header__logo-img"
            />
          </a>

          <nav className="tx-nav" aria-label={T.navLabel} ref={navRef}>
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
                      <ul className="tx-nav__menu" aria-label={T.submenu(item.label)} onKeyDown={onMenuListKeyDown}>
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
              <LanguageSwitch idSuffix={`bar-${uid}`} />
            </div>
            <a href={hrefFor('quote')} className={buttonClass('primary', 'sm', false, 'tx-header__quote')} onClick={go('quote')}>
              {T.quote}
            </a>
            <button
              ref={toggleRef}
              type="button"
              className="tx-header__toggle"
              aria-label={T.openMenu}
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
            aria-label={T.menu}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tx-drawer__head">
              <a href="#/" className="tx-header__logo" onClick={go('home')} aria-label={SITE_TEXT.homeLabel(COMPANY)}>
                <img src={LOGO_WORDMARK_WEB} width={LOGO_WORDMARK_WEB_WIDTH} height={LOGO_WORDMARK_WEB_HEIGHT} alt={LOGO_ALT} className="tx-header__logo-img" />
              </a>
              <button type="button" className="tx-header__toggle" aria-label={T.closeMenu} onClick={() => setDrawerOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>

            <nav className="tx-drawer__nav" aria-label={T.navLabel}>
              <ul className="tx-drawer__list">
                <li>
                  <a href="#/" className="tx-drawer__link" aria-current={activePage === 'home' ? 'page' : undefined} onClick={go('home')}>
                    {T.home}
                  </a>
                </li>
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
              {T.quote}
            </a>

            <div className="tx-drawer__lang">
              <LanguageSwitch idSuffix={`drawer-${uid}`} />
            </div>

            {(email || phone) && (
              <div className="tx-drawer__help">
                <p className="tx-drawer__help-title">{T.needHelp}</p>
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
