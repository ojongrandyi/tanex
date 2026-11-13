// Client-side navigation with the History API (I18N_SPEC §2). No router library (CLAUDE.md §3).
import { useSyncExternalStore } from 'react';
import { Lang, RouteMatch, alternatePath, langOfPath, legacyHashToPath, matchPath, pagePath } from './routes';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function currentUrl(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

/**
 * Go to a path inside the app. Like a hash change before, nothing happens when the address is
 * already this path, so listeners never re-run for a no-op.
 */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  if (path === currentUrl()) return;
  if (options.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  notify();
}

/** Runs `fn` after every in-app navigation, back/forward and legacy hash link. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/** True when the address is the localhost-only `#/admin` console shortcut. */
export function isLocalAdminHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  return isLocalDevHost() && (hash === '#/admin' || hash.startsWith('#/admin/') || hash === '#admin');
}

/**
 * Rewrites a legacy hash link (`/#/track/TX…`, shared before path routing) to its path, in
 * place, without a reload. Returns true when it changed the address. `#/admin` stays as it is on
 * localhost and becomes `/` elsewhere, as before (the console only lives at ADMIN_PATH).
 */
export function convertLegacyHash(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, hash, search } = window.location;
  if (pathname !== '/' && pathname !== '/index.html') return false;
  if (!hash.startsWith('#/') && hash !== '#admin') return false;
  if (isLocalAdminHash()) return false;
  const path = legacyHashToPath(hash) ?? '/';
  window.history.replaceState(null, '', path + search);
  return true;
}

let started = false;

/** Wires the browser events once (called from main.tsx before the first render). */
export function startRouter(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  convertLegacyHash();
  window.addEventListener('popstate', notify);
  // A pasted `/#/…` link on an open page, or the localhost #/admin shortcut typed in.
  window.addEventListener('hashchange', () => {
    convertLegacyHash();
    notify();
  });
}

/** The page at the current address, or null (unknown path or the console path). */
export function currentRoute(): RouteMatch | null {
  if (typeof window === 'undefined') return null;
  return matchPath(window.location.pathname);
}

/** Language of the current address; English outside the /fr/ tree (also on unknown paths). */
export function currentLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  return currentRoute()?.lang ?? langOfPath(window.location.pathname);
}

/** Path for an App.tsx page name in the current address's language. */
export function hrefFor(page: string, param?: string): string {
  return pagePath(page, param, currentLang());
}

function snapshot(): string {
  return typeof window === 'undefined' ? '/' : currentUrl();
}

/** Re-renders on every navigation; returns the current route (null for unknown paths). */
export function useRoute(): RouteMatch | null {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return currentRoute();
}

// ---- Language switch targets set by a page (blog posts and categories) ----
//
// The route table maps a page to the same sub-path in the other language, which is right for a
// tracking ID or a policy tab but not for a blog post: its French version has its own slug, or
// doesn't exist. A blog page that knows its translations registers them here for its path; the
// language switch reads them (I18N_SPEC §2: a post without a translation switches to the other
// language's blog index).

type AlternateTargets = Partial<Record<Lang, string>>;
let alternates: { path: string; targets: AlternateTargets } | null = null;
const alternateListeners = new Set<() => void>();

/** Sets (or, with null, clears) the language switch targets for the page at `path`. */
export function setAlternateTargets(path: string, targets: AlternateTargets | null): void {
  if (targets === null && alternates?.path !== path) return;
  alternates = targets ? { path, targets } : null;
  alternateListeners.forEach((fn) => fn());
}

/** The same page in `target`: the registered translation for this path, else the route table's mapping. */
export function alternateFor(pathname: string, target: Lang): string {
  const own = alternates && alternates.path === pathname ? alternates.targets[target] : undefined;
  return own ?? alternatePath(pathname, target);
}

function subscribeAlternates(fn: () => void): () => void {
  alternateListeners.add(fn);
  return () => {
    alternateListeners.delete(fn);
  };
}

/** Re-renders when a page registers its language switch targets or the address changes. */
export function useAlternateVersion(): number {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return useSyncExternalStore(subscribeAlternates, () => alternatesVersion(), () => 0);
}

let version = 0;
subscribeAlternates(() => {
  version++;
});
function alternatesVersion(): number {
  return version;
}
