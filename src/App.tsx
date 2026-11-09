import { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LanguageSuggestion } from './components/LanguageSuggestion';
import { I18nProvider } from './i18n/I18nProvider';
import { HomePage } from './pages/HomePage';
// Every other public page is its own chunk, fetched when it opens, so the landing page only
// downloads its own code. Their stylesheets stay in the main bundle, in the original order.
import './pages/pageStyles';
// The admin console's code and stylesheets are their own chunk, fetched only when the admin page
// opens, so public visitors never download them (MOTION_3D_SPEC §2, #138). The console rules that
// public pages also use, and the `admin-login-shell` placeholder shown while the session check and
// the chunk load, are copied here, where the console stylesheets used to sit in the cascade.
import './styles/legacy-shared.css';
import { TrackingLoadingScreen } from './components/TrackingLoadingScreen';
import { AdminDataProvider, useAdminData } from './context/AdminDataContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { PERMISSIONS, hasPermission } from './shared/permissions';
import { Shipment } from './types/shipment';
import { QuoteRequest } from './types/admin';
import { api } from './services/api';
import { simulationEngine } from './services/simulationEngine';
import { ADMIN_CONSOLE_NAME, ADMIN_PATH, COMPANY, COMPANY_SHORT, isAdminPathname } from './config/brand';
import { ROUTES, matchPath, pagePath } from './router/routes';
import { FRENCH_PAGES_INDEXABLE, NOT_FOUND_TITLE, pageMetaText, type PageMetaText } from './shared/pageMeta';
import { hrefFor, isLocalAdminHash, navigate, subscribe, useRoute } from './router/navigation';
import './styles/global.css';

const loadAdminApp = () => import('./admin/AdminApp');
const loadAdminLogin = () => import('./admin/AdminLogin');
const loadAuthScreens = () => import('./admin/AuthScreens');
const AdminApp = lazy(() => loadAdminApp().then((m) => ({ default: m.AdminApp })));
const AdminLogin = lazy(() => loadAdminLogin().then((m) => ({ default: m.AdminLogin })));
const ForcedPasswordChange = lazy(() => loadAuthScreens().then((m) => ({ default: m.ForcedPasswordChange })));
const CourierComingSoon = lazy(() => loadAuthScreens().then((m) => ({ default: m.CourierComingSoon })));
const NoAccess = lazy(() => loadAuthScreens().then((m) => ({ default: m.NoAccess })));

/** What a signed-in account opens at the console path (IAM_RBAC_SPEC §9). */
function consoleKind(permissions: readonly string[]): 'console' | 'courier' | 'none' {
  const staffKeys = PERMISSIONS.map((p) => p.key).filter((k) => k !== 'courier.app');
  if (staffKeys.some((k) => hasPermission(permissions, k))) return 'console';
  return hasPermission(permissions, 'courier.app') ? 'courier' : 'none';
}

const TrackPage = lazy(() => import('./pages/TrackPage').then((m) => ({ default: m.TrackPage })));
const TrackResultPage = lazy(() => import('./pages/TrackResultPage').then((m) => ({ default: m.TrackResultPage })));
const PublicQuoteResultPage = lazy(() => import('./pages/PublicQuoteResultPage').then((m) => ({ default: m.PublicQuoteResultPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const QuotePage = lazy(() => import('./pages/QuotePage').then((m) => ({ default: m.QuotePage })));
const ShipPage = lazy(() => import('./pages/ShipPage').then((m) => ({ default: m.ShipPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const LocationsPage = lazy(() => import('./pages/LocationsPage').then((m) => ({ default: m.LocationsPage })));
const CareersPage = lazy(() => import('./pages/CompanyPages').then((m) => ({ default: m.CareersPage })));
const CsrPage = lazy(() => import('./pages/CompanyPages').then((m) => ({ default: m.CsrPage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

// Admin lives at ADMIN_PATH (/private-user/, src/config/brand.ts) on the same host, app and API
// as the public site. Deliberately not /admin, one of the most commonly probed paths. An exact
// path match (trailing slash and case ignored), so look-alikes such as /private-users never open
// the console. Works on any host, so localhost:3000/private-user/ opens it too; localhost is also
// exempted separately so local dev can keep using the plain #/admin hash (isLocalAdminHash).
function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return isAdminPathname(window.location.pathname);
}

// Search engines must never index the console. Added at runtime (not in index.html) because the
// public site and the admin path share the same index.html (the server also sends X-Robots-Tag).
function setRobotsNoIndex(enabled: boolean) {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-admin]');
  if (enabled && !tag) {
    tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    tag.setAttribute('data-admin', '');
    document.head.appendChild(tag);
  } else if (!enabled && tag) {
    tag.remove();
  }
}

// Page titles and meta descriptions (CONTENT §1.1 / CONTENT_FR §1.1) come from the shared table
// src/shared/pageMeta.ts, which the server also injects into index.html (server/render/pageMeta.ts)
// so crawlers and link previews see them before the app runs. This keeps the tab title right
// when the page changes in the browser.
type PageMeta = PageMetaText;

function setPageMeta({ title, description }: PageMeta) {
  document.title = title;
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.appendChild(tag);
  }
  tag.content = description;
}

// Reads the current address synchronously, before the first paint, so the initial render
// already shows the right page (without this the public home page flashed before the admin
// console after the login reload). Pages are real paths from the route table
// (src/router/routes.ts); any other path except the admin path is a 404 (the server answers it
// with status 404 too). /track/:id and /quote/:id need an async lookup to know what to show, so
// they start on 'track' as a neutral holding page and the location effect below resolves them.
// Legacy `/#/…` links were already rewritten to paths by startRouter() (main.tsx).
function getInitialPage(): string {
  if (typeof window === 'undefined') return 'home';
  if (isAdminPath() || isLocalAdminHash()) return 'admin';
  const route = matchPath(window.location.pathname);
  if (!route) return 'not-found';
  if (route.param && (route.id === 'track' || route.id === 'quote')) return 'track';
  return route.id;
}

function MainAppContent() {
  const [currentPage, setCurrentPage] = useState<string>(getInitialPage);
  const [currentShipment, setCurrentShipment] = useState<Shipment | null>(null);
  const [currentQuote, setCurrentQuote] = useState<QuoteRequest | null>(null);
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [preselectedService, setPreselectedService] = useState<string>('Priority');
  const [legalSection, setLegalSection] = useState<string>('privacy');
  // `n` bumps on every request so repeating the same footer link re-opens that tier.
  const [serviceTier, setServiceTier] = useState<{ id: string; n: number }>({ id: '', n: 0 });
  const [contactGateway, setContactGateway] = useState<string>('');
  const auth = useAuth();
  const [isTrackSearching, setIsTrackSearching] = useState(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const { getShipment, quoteRequests, shipments } = useAdminData();
  // Re-renders on every navigation (also back/forward).
  const route = useRoute();

  // The session is read once by AuthProvider. On the console path, fetch the console code
  // while that check runs, so the split adds no wait.
  useEffect(() => {
    if (currentPage === 'admin') {
      loadAdminLogin().catch(() => {});
      loadAdminApp().catch(() => {});
    }
  }, [currentPage]);

  // Keep tracked shipment in continuous live synchronization with simulation engine
  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((simUpdated) => {
      setCurrentShipment(prev => {
        if (prev && prev.trackingNumber.toUpperCase() === simUpdated.trackingNumber.toUpperCase()) {
          return { ...prev, ...simUpdated };
        }
        return prev;
      });
    });
    return () => unsubscribe();
  }, []);

  const liveShipment = currentShipment
    ? (shipments.find(s => s.trackingNumber.toUpperCase() === currentShipment.trackingNumber.toUpperCase()) || currentShipment)
    : null;

  // Per-page <title> and meta description (CONTENT.md §1.1)
  useEffect(() => {
    const lang = route?.lang ?? 'en';
    const home = pageMetaText('home', lang);
    let meta: PageMeta;
    if (currentPage === 'track-result') {
      const track = pageMetaText('track', lang);
      meta = { title: liveShipment ? `Tracking ${liveShipment.trackingNumber} | ${COMPANY}` : track.title, description: track.description };
    } else if (currentPage === 'quote-result') {
      const quote = pageMetaText('quote', lang);
      meta = { title: currentQuote ? `Quote ${currentQuote.id} | ${COMPANY}` : quote.title, description: quote.description };
    } else if (currentPage === 'admin') {
      meta = { title: ADMIN_CONSOLE_NAME, description: home.description };
    } else if (currentPage === 'not-found') {
      meta = { title: NOT_FOUND_TITLE[lang], description: home.description };
    } else {
      const known = ROUTES.find((r) => r.id === currentPage);
      meta = known ? pageMetaText(known.id, lang) : home;
    }
    setPageMeta(meta);
    // French paths stay out of the index until their page bodies are translated (phase E sets
    // FRENCH_PAGES_INDEXABLE); since D.3 only the header, footer and 404 page are French.
    const hidden = ROUTES.find((r) => r.id === currentPage)?.noindex === true;
    setRobotsNoIndex(hidden || currentPage === 'admin' || currentPage === 'not-found' || isAdminPath() || (lang === 'fr' && !FRENCH_PAGES_INDEXABLE));
  }, [currentPage, liveShipment, currentQuote, route?.lang]);

  // Page from the address: first load, every navigate(), back/forward (src/router/navigation.ts).
  useEffect(() => {
    const handleLocation = async () => {
      if (isAdminPath() || isLocalAdminHash()) {
        // isLocalAdminHash: the localhost-only #/admin shortcut. The console lives at ADMIN_PATH.
        setCurrentPage('admin');
        return;
      }
      const route = matchPath(window.location.pathname);
      if (!route) {
        setCurrentPage('not-found');
        return;
      }
      // /services/ → /services, /fr → /fr/, /index.html → / (the server answers those with a 301).
      if (window.location.pathname !== route.canonical) {
        window.history.replaceState(null, '', route.canonical + window.location.search + window.location.hash);
      }

      if (route.id === 'track' && route.param) {
        const trk = route.param;
        if (trk.toUpperCase().startsWith('QR')) {
          handleTrackShipment(trk);
          return;
        }
        const found = getShipment(trk);
        if (found) {
          setCurrentShipment(found);
          setNotFoundQuery(null);
          setCurrentPage('track-result');
        } else {
          try {
            const apiShipment = await api.trackShipment(trk);
            if (apiShipment) {
              setCurrentShipment(apiShipment);
              setNotFoundQuery(null);
              setCurrentPage('track-result');
              return;
            }
          } catch (e) {
            // Not found
          }
          setNotFoundQuery(trk);
          setCurrentPage('track');
        }
      } else if (route.id === 'quote' && route.param) {
        handleTrackShipment(route.param);
      } else {
        // Deep links from the footer: /services/<tier-id>, /legal/<section>
        if (route.id === 'services') {
          const sub = route.param || '';
          setServiceTier(prev => (prev.id === sub ? prev : { id: sub, n: prev.n + 1 }));
        }
        if (route.id === 'legal' && route.param) setLegalSection(route.param);
        setCurrentPage(route.id);
      }
    };

    handleLocation();
    return subscribe(handleLocation);
  }, [getShipment, quoteRequests, shipments, currentShipment]);

  const handleNavigate = (page: string, param?: string) => {
    // Leaving the console path is a full page load, so no console data stays in memory on the
    // public site (relative URLs, so this also works on localhost).
    if (isAdminPath() && page !== 'admin') {
      window.location.assign(pagePath(page, param));
      return;
    }
    if (page === 'quote' && param) {
      setPreselectedService(param);
    }
    if (page === 'legal' && param) {
      setLegalSection(param);
    }
    if (page === 'contact') {
      // Gateway code from "Contact this gateway"; plain Contact links clear it.
      setContactGateway(param || '');
    }
    if (page === 'services') {
      // A tier ID opens that tier; ServicesPage scrolls to it, so skip the scroll to top.
      setServiceTier(prev => ({ id: param || '', n: prev.n + 1 }));
    }
    setCurrentPage(page);
    if (!(page === 'services' && param)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Only track/quote results, service tiers and legal tabs carry the parameter in the URL
    // (pagePath); a quote's preselected service and a contact gateway stay page state.
    navigate(page === 'admin' ? ADMIN_PATH : hrefFor(page, param));
  };

  const handleTrackShipment = async (inputQuery: string) => {
    const query = inputQuery.trim();
    if (!query) return;

    // A local cache hit used to resolve this whole function synchronously, so the result
    // page just appeared instantly with zero transition — genuinely fast, but it read as
    // "did that even do anything?" rather than as a live lookup. Every exit path below now
    // goes through finishSearch, which guarantees the loading screen stays up for at least
    // MIN_LOADING_MS regardless of how fast the underlying lookup actually was, then commits
    // the real state change. A slow lookup (the real API path) is unaffected — it already
    // takes longer than this floor, so the extra wait is 0.
    const MIN_LOADING_MS = 900;
    const searchStartedAt = Date.now();
    setIsTrackSearching(true);
    setTrackSearchQuery(query);
    // Without this, the loading screen renders wherever the page happened to already be
    // scrolled to (e.g. down at the search box on TrackPage) — on mobile especially, that cut
    // the truck icon and heading off above the fold, leaving only the progress bar visible.
    // Scroll to top immediately, not just after the result is ready.
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const finishSearch = async (commit: () => void) => {
      const elapsed = Date.now() - searchStartedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      commit();
      setIsTrackSearching(false);
    };

    // 1. CHECK IF THIS IS A QUOTE ID (e.g. QR-2026-88752)
    if (query.toUpperCase().startsWith('QR') || quoteRequests.some(q => q.id.toUpperCase() === query.toUpperCase())) {
      const match = quoteRequests.find(q => q.id.toUpperCase() === query.toUpperCase());
      if (match) {
        await finishSearch(() => {
          setCurrentQuote(match);
          setCurrentPage('quote-result');
          navigate(hrefFor('quote-result', match.id));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return;
      }

      // Try fetching from backend API — a single, scoped lookup by this exact ID, not the
      // full admin quotes list (that endpoint now requires an admin session anyway, and
      // even before it did, pulling every customer's quote data into a public visitor's
      // browser just to check one ID was never right).
      try {
        const apiMatch = await api.getPublicQuote(query.toUpperCase());
        if (apiMatch) {
          await finishSearch(() => {
            setCurrentQuote(apiMatch);
            setCurrentPage('quote-result');
            navigate(hrefFor('quote-result', apiMatch.id));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
          return;
        }
      } catch (err) {
        console.error('Error fetching quote:', err);
      }
    }

    // 2. CHECK IF THIS IS A REAL SHIPMENT
    const foundShipment = getShipment(query);
    if (foundShipment) {
      await finishSearch(() => {
        setCurrentShipment(foundShipment);
        setNotFoundQuery(null);
        setCurrentPage('track-result');
        navigate(hrefFor('track-result', foundShipment.trackingNumber));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    // Try backend API for shipment
    try {
      const apiShipment = await api.trackShipment(query);
      if (apiShipment) {
        await finishSearch(() => {
          setCurrentShipment(apiShipment);
          setNotFoundQuery(null);
          setCurrentPage('track-result');
          navigate(hrefFor('track-result', apiShipment.trackingNumber));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return;
      }
    } catch (e) {
      // not found
    }

    // 3. NOT FOUND STATE
    await finishSearch(() => {
      setNotFoundQuery(query);
      setCurrentPage('track');
      navigate(hrefFor('track'));
    });
  };

  // If on Admin page, render dedicated Admin Command Center layout — gated behind the
  // session check above so no admin data ever loads into the page before login succeeds.
  if (currentPage === 'admin') {
    const adminPlaceholder = <div className="admin-login-shell" />;
    if (!auth.ready) {
      return adminPlaceholder;
    }
    const kind = auth.user ? consoleKind(auth.user.permissions) : null;
    return (
      <Suspense fallback={adminPlaceholder}>
        {!auth.user ? (
          <AdminLogin onNavigatePublic={handleNavigate} />
        ) : auth.user.mustChangePassword ? (
          // A temporary password is replaced before anything else (IAM_RBAC_SPEC §5.5).
          <ForcedPasswordChange />
        ) : kind === 'courier' ? (
          <CourierComingSoon />
        ) : kind === 'none' ? (
          <NoAccess />
        ) : (
          <AdminApp
            onNavigatePublic={handleNavigate}
            onViewPublicTracking={(trk) => {
              if (isAdminPath()) {
                window.location.assign(pagePath('track-result', trk));
              } else {
                handleTrackShipment(trk);
              }
            }}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div className="ngf-app-shell">
      <LanguageSuggestion />
      <Header
        activePage={currentPage}
        onNavigate={handleNavigate}
      />

      <main className="ngf-main-view">
        {isTrackSearching ? (
          <TrackingLoadingScreen query={trackSearchQuery} />
        ) : (
          <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
        {currentPage === 'home' && (
          <HomePage
            onTrack={handleTrackShipment}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'track' && (
          <TrackPage
            onTrack={handleTrackShipment}
            onNavigate={handleNavigate}
            notFoundQuery={notFoundQuery}
          />
        )}

        {currentPage === 'track-result' && (currentShipment || liveShipment) && (
          <TrackResultPage
            shipment={liveShipment || currentShipment!}
            onTrackAnother={handleTrackShipment}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'quote-result' && currentQuote && (
          <PublicQuoteResultPage
            quote={currentQuote}
            onTrackShipment={handleTrackShipment}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'services' && (
          <ServicesPage onNavigate={handleNavigate} initialServiceId={serviceTier.id} serviceRequest={serviceTier.n} />
        )}

        {currentPage === 'quote' && (
          <QuotePage onNavigate={handleNavigate} initialService={preselectedService} />
        )}

        {currentPage === 'ship' && (
          <ShipPage onTrack={(tn) => handleTrackShipment(tn)} onNavigate={handleNavigate} />
        )}

        {currentPage === 'about' && (
          <AboutPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'help' && (
          <HelpPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'contact' && (
          <ContactPage key={contactGateway} onNavigate={handleNavigate} initialGateway={contactGateway} />
        )}

        {currentPage === 'legal' && (
          <LegalPage initialSection={legalSection} onNavigate={handleNavigate} />
        )}

        {currentPage === 'locations' && (
          <LocationsPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'blog' && (
          <BlogPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'careers' && (
          <CareersPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'csr' && (
          <CsrPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'not-found' && (
          <NotFoundPage onNavigate={handleNavigate} />
        )}
          </Suspense>
        )}
      </main>

      <Footer
        onNavigate={handleNavigate}
        showTrustStrip={currentPage !== 'track-result'}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AdminDataProvider>
        <I18nProvider>
          <MainAppContent />
        </I18nProvider>
      </AdminDataProvider>
    </AuthProvider>
  );
}

export default App;

