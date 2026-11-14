// Installable courier app (DISPATCH_SPEC §6): the courier web-app manifest and a small service
// worker scoped to the console path. Only courier accounts register them; the worker caches the
// app shell (the console page and the hashed build files) and never API answers (Public/courier-sw.js).
import { ADMIN_PATH } from '../config/brand';

const MANIFEST = '/courier.webmanifest';
const WORKER = '/courier-sw.js';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installEvent: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

export function setupCourierPwa(): void {
  // Point the page's manifest at the courier one (the public site keeps /site.webmanifest).
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ?? Object.assign(document.createElement('link'), { rel: 'manifest' });
  if (link.getAttribute('href') !== MANIFEST) link.setAttribute('href', MANIFEST);
  if (!link.isConnected) document.head.appendChild(link);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as BeforeInstallPromptEvent;
    installListeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installListeners.forEach((fn) => fn());
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(WORKER, { scope: ADMIN_PATH }).catch((err) => {
      console.warn('[courier] service worker not registered:', err);
    });
  }
}

export function canInstall(): boolean {
  return installEvent !== null;
}

export function onInstallChange(fn: () => void): () => void {
  installListeners.add(fn);
  return () => { installListeners.delete(fn); };
}

export async function promptInstall(): Promise<void> {
  const e = installEvent;
  if (!e) return;
  await e.prompt();
  await e.userChoice.catch(() => null);
  installEvent = null;
  installListeners.forEach((fn) => fn());
}
