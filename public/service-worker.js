const CACHE_VERSION = 'rms-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const NAVIGATION_CACHE = `${CACHE_VERSION}-navigation`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

/* ------------------------------------------------------------------ */
/*  PRECACHE LIST  — main assets & pages                               */
/* ------------------------------------------------------------------ */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/images/Logo.jpg',
  '/robots.txt',
  '/sitemap.xml',
  '/login',
];

/* ------------------------------------------------------------------ */
/*  NAVIGATION / PAGE SHELL ROUTES  — SPA routes that should work      */
/*  offline once visited (cache-first), falling back to index.html     */
/* ------------------------------------------------------------------ */
const PAGE_SHELL_ROUTES = [
  '/login',
  '/register',
  '/qr-display',
  '/admin',
  '/admin/dashboard',
  '/admin/orders',
  '/admin/payments',
  '/admin/reports',
  '/admin/inventory',
  '/admin/payroll',
  '/admin/attendance',
  '/admin/reservations',
  '/admin/tables',
  '/admin/customers',
  '/admin/users',
  '/admin/menu',
  '/admin/categories',
  '/waiter',
  '/waiter/dashboard',
  '/cashier',
  '/cashier/dashboard',
  '/stripe/success',
  '/stripe/cancel',
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isAssetRequest(url) {
  const ext = url.pathname.split('.').pop().toLowerCase();
  return ['js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext);
}

function isPageShellRoute(url) {
  return PAGE_SHELL_ROUTES.some(route => url.pathname === route || url.pathname.startsWith(`${route}/`));
}

async function cacheFirst(cacheName, request, fetchOptions) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request, fetchOptions);
    if (response && response.status === 200 && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cache.match(request);
  }
}

async function staleWhileRevalidate(cacheName, request, fetchOptions) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request, fetchOptions)
    .then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

/* ================================================================== */
/*  INSTALL  — pre-cache core assets once service worker activates     */
/* ================================================================== */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ================================================================== */
/*  ACTIVATE  — clean up old caches                                    */
/* ================================================================== */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => !key.startsWith(CACHE_VERSION))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ================================================================== */
/*  FETCH  — offline-first caching strategy                            */
/* ================================================================== */
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ---- Never cache API calls — they need auth & live data ----------
  if (isApiRequest(url) || url.origin !== self.location.origin) {
    return;
  }

  /* ---------- Navigation requests (page loads) ---------- */
  if (isNavigationRequest(request)) {
    // Page shell routes: cache-first, fallback to network then index.html offline
    if (isPageShellRoute(url)) {
      event.respondWith(
        cacheFirst(NAVIGATION_CACHE, request)
          .then(response => response || fetch(request))
          .catch(() => caches.match('/index.html'))
      );
      return;
    }

    // Any other navigation: network-first with cache fallback to index.html
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(NAVIGATION_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/index.html');
        })
    );
    return;
  }

  /* ---------- Static assets (hashed by Vite) ---------- */
  if (isAssetRequest(url)) {
    // Images get cache-first since they rarely change
    const isImage = /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(url.pathname);
    if (isImage) {
      event.respondWith(cacheFirst(DYNAMIC_CACHE, request));
      return;
    }
    // JS/CSS/fonts get stale-while-revalidate for fast updates
    event.respondWith(staleWhileRevalidate(STATIC_CACHE, request));
    return;
  }

  /* ---------- Everything else: network-first with cache fallback ---------- */
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match('/index.html');
      })
  );
});