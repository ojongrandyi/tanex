// Smartsupp live chat. Loaded after the page has finished loading (and the browser is idle), so the
// widget never competes with the hero image or the app bundle (MOTION_3D_SPEC §2). Never loaded on
// the admin console. Same loader as Smartsupp's own snippet, minus the inline <script>.
import { SMARTSUPP_KEY, isAdminPathname } from '../config/brand';

type SmartsuppQueue = ((...args: unknown[]) => void) & { _: unknown[][] };

declare global {
  interface Window {
    _smartsupp?: { key?: string };
    smartsupp?: SmartsuppQueue;
  }
}

function inject(): void {
  if (window.smartsupp) return;
  window._smartsupp = window._smartsupp || {};
  window._smartsupp.key = SMARTSUPP_KEY;
  const queue = function (...args: unknown[]) { queue._.push(args); } as SmartsuppQueue;
  queue._ = [];
  window.smartsupp = queue;

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.charset = 'utf-8';
  script.async = true;
  script.src = 'https://www.smartsuppchat.com/loader.js?';
  document.head.appendChild(script);
}

export function loadLiveChat(): void {
  if (!SMARTSUPP_KEY || typeof window === 'undefined') return;
  if (isAdminPathname(window.location.pathname)) return;

  const schedule = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(inject, { timeout: 3000 });
    else setTimeout(inject, 1500);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}
