/* sw.js — PYL0N Suite Service Worker
   Strategy:
   - HTML navigations → fetch by URL string (cors mode, not navigate mode).
     Safari WebKit refuses SW responses to navigate-mode fetches that involve
     any redirect. Fetching the same URL as a plain cors GET sidesteps the
     restriction entirely while still returning correct HTML to the browser.
   - Static assets → Cache-first (vendor scripts, libs, fonts, icons).
   - Offline fallback → cached HTML served when network is unavailable.
*/

const CACHE_NAME = 'pyl0n-v4';

const HTML_PAGES = [
  './index.html',
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
];

const STATIC_ASSETS = [
  './favicon.svg',
  './logo.svg',
  './vendor/pyl0n-native.js',
  './vendor/pyl0n-suite.js',
  './vendor/pyl0n-state.js',
  './vendor/pyl0n-validate.js',
  './libs/chart.js',
  './libs/xlsx.full.min.js',
  './libs/html2pdf.bundle.min.js',
  './libs/html2canvas.min.js',
];

/* ── Install ─────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        [...HTML_PAGES, ...STATIC_ASSETS].map(url =>
          // Fetch as a plain string (cors mode) — never stores a redirect response.
          fetch(url, { redirect: 'follow' })
            .then(res => { if (res.ok) return cache.put(url, res); })
            .catch(err => console.warn('PYL0N SW: could not precache', url, err.message))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate ────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation) {
    // ── HTML: network-first, fetched by URL string (cors mode) ──────────
    // Using event.request.url (string) instead of event.request (object)
    // avoids the Safari WebKit "response has redirections" error that occurs
    // when a navigate-mode fetch encounters any redirect in the chain.
    event.respondWith(
      fetch(event.request.url, { redirect: 'follow' })
        .then(response => {
          if (response.ok) {
            // Cache fresh copy for offline use, keyed to the full URL.
            caches.open(CACHE_NAME).then(c => c.put(event.request.url, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: exact URL → .html variant → dashboard
          const url = new URL(event.request.url);

          const exact = await caches.match(event.request.url);
          if (exact) return exact;

          // Cloudflare / Azure may serve /timecast without extension —
          // try the .html variant we precached.
          if (!url.pathname.includes('.')) {
            const withHtml = await caches.match(url.origin + url.pathname + '.html');
            if (withHtml) return withHtml;
          }

          return caches.match('./index.html');
        })
    );
    return;
  }

  // ── Static assets: cache-first ────────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request, { redirect: 'follow' }).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        return response;
      });
    })
  );
});
