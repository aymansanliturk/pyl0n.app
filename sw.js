/* sw.js — PYL0N Suite Service Worker
   Strategy: Cache-First, falling back to Network.
   New network responses are cached at runtime so the app stays
   up-to-date while remaining fully usable offline.
*/

const CACHE_NAME = 'pyl0n-v1';

const PRECACHE_URLS = [
  /* ── Shell & dashboard ─────────────────────────────────────────── */
  './',
  './index.html',

  /* ── Tools ─────────────────────────────────────────────────────── */
  './timecast.html',
  './resourcecast.html',
  './orgcast.html',
  './rfqcast.html',
  './dorcast.html',
  './riskcast.html',
  './calccast.html',
  './lettercast.html',
  './cashflow.html',
  './w2w-report.html',
  './cvcast.html',

  /* ── Brand assets ───────────────────────────────────────────────── */
  './favicon.svg',
  './logo.svg',
  './build/icon.png',

  /* ── Vendor scripts ─────────────────────────────────────────────── */
  './vendor/pyl0n-native.js',
  './vendor/pyl0n-suite.js',
  './vendor/pyl0n-state.js',
  './vendor/pyl0n-validate.js',

  /* ── Local libraries ────────────────────────────────────────────── */
  './libs/fonts.css',
  './libs/chart.js',
  './libs/xlsx.full.min.js',
  './libs/html2pdf.bundle.min.js',
  './libs/html2canvas.min.js',
];

/* ── Install: pre-cache all known assets ────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each URL individually so an unavailable optional file
      // (e.g. fonts.css before libs are downloaded) does not abort the
      // whole install.
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn('PYL0N SW: could not pre-cache', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: delete stale caches from previous versions ───────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => {
              console.log('PYL0N SW: deleting old cache', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: serve from cache, fall back to network, cache new hits ──── */
self.addEventListener('fetch', event => {
  // Only handle GET requests; let POST/PUT pass through untouched.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache successful same-origin or CORS responses.
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'opaque'
        ) {
          return response;
        }

        // Clone before consuming — a Response body can only be read once.
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Network failed and nothing is cached.
        // For navigation requests return the offline shell so the user
        // still sees the dashboard rather than a browser error page.
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
