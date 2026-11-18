import React, { useState, useEffect } from 'react';
import {
  Compass,
  Package,
  PlusCircle,
  QrCode,
  Calculator,
  FileText,
  Settings,
  Search,
  Bell,
  ExternalLink,
  Menu,
  X,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  Inbox,
  Wallet,
  UserCircle,
  Users,
  ShieldCheck,
  History,
  Newspaper,
  Tags,
  Bike,
  Route
} from 'lucide-react';
import { useAdminData } from '../context/AdminDataContext';
import { useAuth } from '../auth/AuthContext';
import { AUTH_TEXT, IAM_TEXT } from '../auth/strings';
import { BLOG_MENU } from './blog/menuText';
import { DISPATCH_MENU } from './dispatch/menuText';
import { LOGO_ALT, LOGO_WORDMARK_HEIGHT, LOGO_WORDMARK_WHITE, LOGO_WORDMARK_WIDTH, TAGLINE } from '../config/brand';
import { Button } from '../components/ui';
import { canOpenView, firstAllowedView, type AdminViewType } from './views';
import './AdminLayout.css';
import { ADMIN_LAYOUT_TEXT as TXT } from './AdminLayout.text';

export type { AdminViewType };

/** Up to two initials from the display name, for the avatar chips. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}

interface AdminLayoutProps {
  currentView: AdminViewType;
  onSelectView: (view: AdminViewType) => void;
  onNavigatePublic: (page: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  newMessagesCount?: number;
  /** Proofs of payment waiting for review (update G.1). */
  newProofsCount?: number;
  /** Dispatch jobs waiting for dispatch: requested, to assign, problems (G.5). */
  dispatchAttentionCount?: number;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentView,
  onSelectView,
  onNavigatePublic,
  searchQuery,
  onSearchChange,
  newMessagesCount = 0,
  newProofsCount = 0,
  dispatchAttentionCount = 0,
  children
}) => {
  const { notifications, markNotificationRead, quoteRequests, shipments } = useAdminData();
  const { user, can, logout } = useAuth();
  const displayName = user?.displayName ?? '';
  const roleNames = (user?.roles ?? []).map((r) => r.name).join(', ');
  const initials = initialsOf(displayName);
  const homeView = firstAllowedView(can) ?? 'account';
  // Sidebar entries: only the views this user may open (IAM_RBAC_SPEC §9).
  const allowed = (view: AdminViewType) => canOpenView(view, can);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // The bell counts unread alerts plus proofs of payment waiting for review (update G.1).
  // Quote/delay alerts come from lists the user may not be allowed to see; keep only theirs.
  const visibleNotifications = notifications.filter((n) =>
    n.type === 'QUOTE' ? can('quotes.view') : can('shipments.view'));
  const unreadCount = visibleNotifications.filter(n => !n.read).length + newProofsCount;
  const pendingQuotesCount = quoteRequests.filter(q => q.status === 'NEW' || q.status === 'UNDER_REVIEW').length;

  const currentMeta = TXT.views[currentView] || TXT.views['operations-center'];

  return (
    <div className="tx-admin-root">
      {/* =========================================================================
          SIDEBAR: Chocolate 950, a .tx-dark context for the role tokens (I.1)
          ========================================================================= */}
      <aside className={`tx-admin-sidebar tx-dark ${mobileSidebarOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="admin-sidebar-header">
          <div className="admin-brand-card" onClick={() => onSelectView(homeView)}>
            <img
              src={LOGO_WORDMARK_WHITE}
              width={LOGO_WORDMARK_WIDTH}
              height={LOGO_WORDMARK_HEIGHT}
              alt={LOGO_ALT}
              className="admin-brand-logo"
              onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="admin-brand-console">{TXT.operationsConsole}</span>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileSidebarOpen(false)} aria-label={TXT.closeMenu}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Groupings */}
        <nav className="admin-sidebar-nav">
          {/* SECTION 1: OPERATIONS */}
          {(['operations-center', 'all-shipments', 'create-shipment', 'tracking-events'] as const).some(allowed) && (
          <div className="admin-nav-section">
            <span className="section-label">{TXT.sections.operations}</span>

            {/* Dashboard */}
            {allowed('operations-center') && (
              <button
                className={`admin-nav-btn ${currentView === 'operations-center' ? 'active' : ''}`}
                onClick={() => { onSelectView('operations-center'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Compass size={18} />
                </div>
                <span className="nav-title">{TXT.dashboard}</span>
              </button>
            )}

            {/* Shipments */}
            {allowed('all-shipments') && (
              <button
                className={`admin-nav-btn ${currentView === 'all-shipments' ? 'active' : ''}`}
                onClick={() => { onSelectView('all-shipments'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Package size={18} />
                </div>
                <span className="nav-title">{TXT.shipments}</span>
                <span className="nav-count-badge font-mono">{shipments.length}</span>
              </button>
            )}

            {/* New Shipment */}
            {allowed('create-shipment') && (
              <button
                className={`admin-nav-btn ${currentView === 'create-shipment' ? 'active' : ''}`}
                onClick={() => { onSelectView('create-shipment'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <PlusCircle size={18} />
                </div>
                <span className="nav-title">{TXT.newShipment}</span>
              </button>
            )}

            {/* Scanner */}
            {allowed('tracking-events') && (
              <button
                className={`admin-nav-btn ${currentView === 'tracking-events' ? 'active' : ''}`}
                onClick={() => { onSelectView('tracking-events'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <QrCode size={18} />
                </div>
                <span className="nav-title">{TXT.scanner}</span>
              </button>
            )}
          </div>

          )}

          {/* SECTION 2: COMMERCIAL */}
          {(['quote-requests', 'messages', 'payments'] as const).some(allowed) && (
          <div className="admin-nav-section">
            <span className="section-label">{TXT.sections.commercial}</span>

            {/* Quote Requests */}
            {allowed('quote-requests') && (
              <button
                className={`admin-nav-btn ${currentView === 'quote-requests' ? 'active' : ''}`}
                onClick={() => { onSelectView('quote-requests'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Calculator size={18} />
                </div>
                <span className="nav-title">{TXT.quoteRequests}</span>
                {pendingQuotesCount > 0 ? (
                  <span className="nav-badge-amber font-mono">{TXT.newBadge(pendingQuotesCount)}</span>
                ) : (
                  <span className="nav-count-badge muted font-mono">{quoteRequests.length}</span>
                )}
              </button>
            )}

            {/* Messages (Contact page) */}
            {allowed('messages') && (
              <button
                className={`admin-nav-btn ${currentView === 'messages' ? 'active' : ''}`}
                onClick={() => { onSelectView('messages'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Inbox size={18} />
                </div>
                <span className="nav-title">{TXT.messages}</span>
                {newMessagesCount > 0 && (
                  <span className="nav-badge-amber font-mono">{TXT.newBadge(newMessagesCount)}</span>
                )}
              </button>
            )}

            {/* Payments: proofs of payment from the track page (update F.5) */}
            {allowed('payments') && (
              <button
                className={`admin-nav-btn ${currentView === 'payments' ? 'active' : ''}`}
                onClick={() => { onSelectView('payments'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Wallet size={18} />
                </div>
                <span className="nav-title">{TXT.payments}</span>
                {newProofsCount > 0 && (
                  <span className="nav-badge-amber font-mono" aria-label={TXT.toReview(newProofsCount)}>{TXT.newBadge(newProofsCount)}</span>
                )}
              </button>
            )}
          </div>

          )}

          {/* DELIVERY: dispatch board, tariffs and couriers (DISPATCH_SPEC §3, §5, §7) */}
          {(['dispatch', 'tariffs', 'couriers', 'cash'] as const).some(allowed) && (
          <div className="admin-nav-section">
            <span className="section-label">{DISPATCH_MENU.section}</span>
            {allowed('dispatch') && (
              <button
                className={`admin-nav-btn ${currentView === 'dispatch' ? 'active' : ''}`}
                onClick={() => { onSelectView('dispatch'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Route size={18} />
                </div>
                <span className="nav-title">{DISPATCH_MENU.dispatch.menu}</span>
                {dispatchAttentionCount > 0 && (
                  <span className="nav-badge-amber font-mono" aria-label={DISPATCH_MENU.dispatch.attention(dispatchAttentionCount)}>{dispatchAttentionCount}</span>
                )}
              </button>
            )}
            {allowed('tariffs') && (
              <button
                className={`admin-nav-btn ${currentView === 'tariffs' ? 'active' : ''}`}
                onClick={() => { onSelectView('tariffs'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Tags size={18} />
                </div>
                <span className="nav-title">{DISPATCH_MENU.tariffs.menu}</span>
              </button>
            )}
            {allowed('couriers') && (
              <button
                className={`admin-nav-btn ${currentView === 'couriers' ? 'active' : ''}`}
                onClick={() => { onSelectView('couriers'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Bike size={18} />
                </div>
                <span className="nav-title">{DISPATCH_MENU.couriers.menu}</span>
              </button>
            )}
            {allowed('cash') && (
              <button
                className={`admin-nav-btn ${currentView === 'cash' ? 'active' : ''}`}
                onClick={() => { onSelectView('cash'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Wallet size={18} />
                </div>
                <span className="nav-title">{DISPATCH_MENU.cash.menu}</span>
              </button>
            )}
          </div>
          )}

          {/* SECTION 3: SYSTEM */}
          <div className="admin-nav-section">
            <span className="section-label">{TXT.sections.system}</span>

            {/* Documents */}
            {allowed('document-center') && (
              <button
                className={`admin-nav-btn ${currentView === 'document-center' ? 'active' : ''}`}
                onClick={() => { onSelectView('document-center'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <FileText size={18} />
                </div>
                <span className="nav-title">{TXT.documents}</span>
              </button>
            )}

            {/* Blog studio (BLOG_SPEC §4) */}
            {allowed('blog') && (
              <button
                className={`admin-nav-btn ${currentView === 'blog' ? 'active' : ''}`}
                onClick={() => { onSelectView('blog'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Newspaper size={18} />
                </div>
                <span className="nav-title">{BLOG_MENU.menu}</span>
              </button>
            )}

            {/* Settings */}
            {allowed('settings') && (
              <button
                className={`admin-nav-btn ${currentView === 'settings' ? 'active' : ''}`}
                onClick={() => { onSelectView('settings'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Settings size={18} />
                </div>
                <span className="nav-title">{TXT.settings}</span>
              </button>
            )}

            {/* Users, Roles, Audit log (IAM_RBAC_SPEC §9) */}
            {allowed('users') && (
              <button
                className={`admin-nav-btn ${currentView === 'users' ? 'active' : ''}`}
                onClick={() => { onSelectView('users'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <Users size={18} />
                </div>
                <span className="nav-title">{IAM_TEXT.users.title}</span>
              </button>
            )}
            {allowed('roles') && (
              <button
                className={`admin-nav-btn ${currentView === 'roles' ? 'active' : ''}`}
                onClick={() => { onSelectView('roles'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <ShieldCheck size={18} />
                </div>
                <span className="nav-title">{IAM_TEXT.roles.title}</span>
              </button>
            )}
            {allowed('audit') && (
              <button
                className={`admin-nav-btn ${currentView === 'audit' ? 'active' : ''}`}
                onClick={() => { onSelectView('audit'); setMobileSidebarOpen(false); }}
              >
                <div className="nav-btn-icon-wrap">
                  <History size={18} />
                </div>
                <span className="nav-title">{IAM_TEXT.audit.title}</span>
              </button>
            )}

            {/* My account: every signed-in user */}
            <button
              className={`admin-nav-btn ${currentView === 'account' ? 'active' : ''}`}
              onClick={() => { onSelectView('account'); setMobileSidebarOpen(false); }}
            >
              <div className="nav-btn-icon-wrap">
                <UserCircle size={18} />
              </div>
              <span className="nav-title">{AUTH_TEXT.account.menu}</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer: Return to Public & Dispatcher Card */}
        <div className="admin-sidebar-footer">
          <Button
            variant="onDark"
            size="sm"
            block
            className="admin-sidebar-site-link"
            onClick={() => onNavigatePublic('home')}
            title={TXT.switchToPublicCustomerView}
            iconEnd={<ArrowUpRight size={16} />}
          >
            {TXT.viewPublicWebsite}
          </Button>

          <div className="sidebar-operator-card">
            <div className="operator-avatar" aria-hidden="true">
              <span>{initials}</span>
              <span className="operator-online-dot" />
            </div>
            <div className="operator-info">
              <strong>{displayName}</strong>
              <small>{roleNames}</small>
            </div>
          </div>

          <div className="sidebar-brand-motto">
            <span className="motto-text">{TAGLINE.toUpperCase()}</span>
            <span className="motto-line" />
          </div>
        </div>
      </aside>

      {/* =========================================================================
          MAIN WORKSPACE WRAPPER
          ========================================================================= */}
      <div className="tx-admin-main-wrapper">
        {/* TOP DISPATCH HEADER */}
        <header className="tx-admin-top-header">
          {/* Left Column: Clean View Title */}
          <div className="header-titles-column">
            <button className="mobile-menu-trigger" onClick={() => setMobileSidebarOpen(true)} aria-label={TXT.openMenu}>
              <Menu size={20} />
            </button>
            <h1 className="header-view-title">{currentMeta.title}</h1>
          </div>

          {/* Right Column: Universal Search & Quick Dispatch Actions */}
          <div className="header-actions-column">
            {/* Universal Search Input */}
            <div className="admin-universal-search">
              <Search size={15} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={TXT.searchTrackingQuoteIdCustomer}
                className="universal-search-input"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => onSearchChange('')}
                  aria-label={TXT.clearSearchQuery}
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="search-shortcut-badge font-mono" title={TXT.keyboardShortcutCtrlKOr}>
                  ⌘K
                </span>
              )}
            </div>

            {/* Notification Drawer Button */}
            <div className="notification-wrap">
              <button
                type="button"
                className={`btn-notification-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setShowNotifications(!showNotifications)}
                title={TXT.operationalAlerts}
              >
                <Bell size={17} />
                {unreadCount > 0 && <span className="notification-count-badge font-mono">{unreadCount}</span>}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="admin-notification-popover animate-scale-in">
                  <div className="popover-header">
                    <div>
                      <strong>{TXT.operationalAlerts}</strong>
                      <small>{unreadCount} {TXT.unreadItems}</small>
                    </div>
                    <button className="popover-close" onClick={() => setShowNotifications(false)}>
                      <X size={14} />
                    </button>
                  </div>

                  <div className="popover-list">
                    {newProofsCount > 0 && (
                      <div
                        className="popover-item unread"
                        role="button"
                        tabIndex={0}
                        onClick={() => { onSelectView('payments'); setShowNotifications(false); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectView('payments');
                            setShowNotifications(false);
                          }
                        }}
                      >
                        <div className="item-dot payment" />
                        <div className="item-content">
                          <strong>{TXT.newProofs(newProofsCount)}</strong>
                          <p>{TXT.proofsWaiting(newProofsCount)}</p>
                        </div>
                      </div>
                    )}
                    {visibleNotifications.length === 0 && newProofsCount === 0 ? (
                      <div className="popover-empty">
                        <CheckCircle2 size={24} className="text-emerald" />
                        <span>{TXT.allCorridorsOperatingNominally}</span>
                      </div>
                    ) : (
                      visibleNotifications.slice(0, 6).map((notif) => (
                        <div
                          key={notif.id}
                          className={`popover-item ${notif.read ? 'read' : 'unread'}`}
                          onClick={() => {
                            markNotificationRead(notif.id);
                            if (notif.type === 'QUOTE') onSelectView('quote-requests');
                            if (notif.type === 'DELAY' && allowed('operations-center')) onSelectView('operations-center');
                          }}
                        >
                          <div className={`item-dot ${notif.type.toLowerCase()}`} />
                          <div className="item-content">
                            <strong>{notif.title}</strong>
                            <p>{notif.message}</p>
                            <span className="item-time">{notif.timestamp}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Operator Profile Pill */}
            <div className="user-profile-wrap">
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="avatar-chip" aria-hidden="true">{initials}</div>
                <div className="profile-text">
                  <span className="profile-name">{displayName}</span>
                  <span className="profile-role">{roleNames}</span>
                </div>
                <ChevronDown size={14} className="chevron-icon" />
              </button>

              {showUserMenu && (
                <div className="user-menu-popover animate-scale-in">
                  <div className="menu-popover-header">
                    <strong>{displayName}</strong>
                    <small>{user?.email || user?.phone || ''}</small>
                  </div>
                  <div className="menu-popover-links">
                    <button onClick={() => { onSelectView('account'); setShowUserMenu(false); }}>
                      <UserCircle size={15} />
                      <span>{AUTH_TEXT.account.menu}</span>
                    </button>
                    {allowed('settings') && (
                      <button onClick={() => { onSelectView('settings'); setShowUserMenu(false); }}>
                        <Settings size={15} />
                        <span>{TXT.settings}</span>
                      </button>
                    )}
                    {allowed('document-center') && (
                      <button onClick={() => { onSelectView('document-center'); setShowUserMenu(false); }}>
                        <FileText size={15} />
                        <span>{TXT.documentCenter}</span>
                      </button>
                    )}
                    <div className="menu-divider" />
                    <button className="menu-exit-link" onClick={() => onNavigatePublic('home')}>
                      <ExternalLink size={15} />
                      <span>{TXT.viewPublicWebsite}</span>
                    </button>
                    <button
                      className="menu-exit-link"
                      onClick={() => { logout(); }}
                    >
                      <LogOut size={15} />
                      <span>{AUTH_TEXT.signOut}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* DYNAMIC VIEW BODY */}
        <main className="tx-admin-page-content">
          {children}
        </main>
      </div>
    </div>
  );
};
