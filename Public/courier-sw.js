// TanEx courier app service worker (DISPATCH_SPEC §6). Registered only by courier accounts, with
// scope /private-user/. It keeps the app shell so the app opens on a weak connection:
//   - the console page: network first, the saved copy when there is no answer;
//   - hashed build files (/assets/…): saved on first use, then served from the cache;
//   - logos and icons (/brand/…): served from the cache and refreshed in the background.
// API answers (/api/…) are never cached: they always go to the network. Courier steps made offline
// are kept by the app itself (IndexedDB), not here.
const VERSION = 'tx-courier-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = '/private-user/';
const MAX_ASSETS = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload', credentials: 'same-origin' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tx-courier-') && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

async function shell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('text/html')) cache.put(SHELL_URL, res.clone());
    return res;
  } catch (err) {
    const saved = await cache.match(SHELL_URL);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    await cache.put(request, res.clone());
    trim(cache);
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const saved = await cache.match(request);
  const fresh = fetch(request).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  }).catch(() => saved);
  return saved || fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // never cached
  if (request.mode === 'navigate') {
    if (url.pathname === SHELL_URL) event.respondWith(shell(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/brand/') || url.pathname === '/courier.webmanifest') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
