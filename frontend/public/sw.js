/**
 * WebWaka Super Admin V2 — Service Worker (Workbox-style)
 *
 * Strategies:
 *   Static assets:  Cache-First  (install-time precache → stale-while-revalidate)
 *   API routes:     Network-First (fallback to Cache API; offline JSON 503)
 *   HTML:           Network-First (SPA shell always fresh, fallback to /index.html)
 *
 * Background sync:
 *   On sync event (tag: pending-mutations), notifies app to flush Dexie queue.
 *   SW notifies all open clients on activation.
 *
 * Version: 3.0.0 — Phase 3 (Workbox-style, background sync, Dexie integration)
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `webwaka-static-${CACHE_VERSION}`;
const API_CACHE = `webwaka-api-${CACHE_VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, API_CACHE];

// Assets to precache at install time
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API hostname/path patterns → Network-First strategy
const API_PATTERNS = [
  /workers\.dev/,
  /localhost:8787/,
  /\/api\//,
];

// ── Utilities ──────────────────────────────────────────────────────────────

function isApiRequest(url) {
  return API_PATTERNS.some((p) => p.test(url.href));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

// ── INSTALL — precache static assets ──────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache failed (non-fatal):', err.message);
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE — purge old caches + claim clients ────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => notifyClients({ type: 'SW_ACTIVATED', version: CACHE_VERSION }))
  );
});

// ── FETCH — routing ────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  if (isApiRequest(url)) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  event.respondWith(cacheFirstStatic(request));
});

// ── Strategies ─────────────────────────────────────────────────────────────

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, error: 'Offline — cached response unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'X-SW-Offline': '1' } }
    );
  }
}

async function networkFirstHtml(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request) || await caches.match('/index.html');
    if (cached) return cached;
    return new Response('<!doctype html><p>Offline — please reconnect</p>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Stale-while-revalidate: serve cached, update in background
    fetch(request).then(async (res) => {
      if (res.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, res.clone());
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── BACKGROUND SYNC ────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'pending-mutations') {
    // Tell app-side usePendingSync hook to flush Dexie queue
    event.waitUntil(notifyClients({ type: 'SYNC_PENDING_MUTATIONS' }));
  }
});

// ── MESSAGES ───────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      if (Array.isArray(payload && payload.urls)) {
        caches.open(STATIC_CACHE)
          .then((cache) => cache.addAll(payload.urls))
          .catch(() => {});
      }
      break;

    case 'CLEAR_API_CACHE':
      caches.delete(API_CACHE).then(() => {
        if (event.source) event.source.postMessage({ type: 'API_CACHE_CLEARED' });
      });
      break;

    case 'GET_VERSION':
      if (event.source) event.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
      break;

    default:
      break;
  }
});

// ── PUSH NOTIFICATIONS (optional) ─────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'WebWaka', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'WebWaka Super Admin', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'webwaka-notification',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) { existing.focus(); } else { self.clients.openWindow(url); }
    })
  );
});
