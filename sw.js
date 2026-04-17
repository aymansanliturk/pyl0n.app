/* sw.js — PYL0N Suite Service Worker v5 (Safari-optimised)
   Key fix: when a navigation response is redirected, reconstruct a clean
   Response from the body so Safari does not reject it with
   "response has redirections" (WebKitInternal:0).
*/

const CACHE_NAME = 'pyl0n-v5';

const PRECACHE_ASSETS = [
  './index.html',
  './favicon.svg',
  './logo.svg',
  './vendor/pyl0n-native.js',
  './vendor/pyl0n-suite.js',
  './vendor/pyl0n-state.js',
  './vendor/pyl0n-validate.js',
  './libs/fonts.css',
];

// Tool page stems — used for extensionless offline URL matching
const PAGES = [
  'timecast', 'resourcecast', 'orgcast', 'rfqcast',
  'dorcast', 'riskcast', 'calccast', 'lettercast',
  'cashflow', 'w2w-report', 'cvcast',
];

/* ── Install ─────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
});

/* ── Activate ────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  // ── HTML navigations ─────────────────────────────────────────────────
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Safari fix: if the response was redirected, reconstruct a clean
          // Response object from the body. This strips the internal redirect
          // chain that WebKit refuses to serve from a service worker.
          if (response.redirected) {
            return new Response(response.body, {
              status:     response.status,
              statusText: response.statusText,
              headers:    response.headers,
            });
          }
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          return response;
        })
        .catch(async () => {
          // Offline fallback: exact match → .html variant → dashboard
          const cached = await caches.match(event.request);
          if (cached) return cached;

          const stem = url.pathname.split('/').pop();
          if (PAGES.includes(stem)) {
            const htmlCached = await caches.match(`./${stem}.html`);
            if (htmlCached) return htmlCached;
          }

          return caches.match('./index.html');
        })
    );
    return;
  }

  // ── Static assets: network-first, cache as fallback ──────────────────
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
