// ============================================================
// OKEKARAOKE — Progressive Web App Service Worker (Offline Support)
// Full offline support for 1-Device Solo Karaoke & Remote Rooms
// ============================================================

const CACHE_NAME = 'okekaraoke-pwa-v3';

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/okekaraokelogo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/remote/OFFLINE',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url, { cache: 'no-cache' })
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              })
              .catch(() => {})
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Skip API routes, extensions, and range requests (video streams)
  if (
    url.pathname.startsWith('/api/') ||
    request.headers.get('range') ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  // 1. Next.js RSC requests (_rsc query param or RSC: 1 header)
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Return an empty RSC response when offline to prevent router crash
          return new Response('', {
            headers: { 'Content-Type': 'text/x-component' },
          });
        })
    );
    return;
  }

  // 2. Navigation requests (HTML pages): Network-first with deep Offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy).catch(() => {});
            });
          }
          return response;
        })
        .catch(async () => {
          // A. Exact match in cache
          const cached = await caches.match(request);
          if (cached) return cached;

          // B. Navigating to any /remote/[roomCode] while offline:
          if (url.pathname.startsWith('/remote/')) {
            // Check for precached /remote/OFFLINE shell
            const offlineShell = await caches.match('/remote/OFFLINE');
            if (offlineShell) return offlineShell;

            // Or find any cached /remote/ page
            const cache = await caches.open(CACHE_NAME);
            const keys = await cache.keys();
            const anyRemoteKey = keys.find((k) => new URL(k.url).pathname.startsWith('/remote/'));
            if (anyRemoteKey) {
              const match = await cache.match(anyRemoteKey);
              if (match) return match;
            }
          }

          // C. Fallback to cached home page
          const fallback = await caches.match('/');
          if (fallback) return fallback;

          // D. Fallback HTML page
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OKEKARAOKE Offline</title></head><body style="background:#09090b;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;"><h1 style="color:#2dd4bf">OKEKARAOKE Offline</h1><p>Open your downloaded songs to sing without internet.</p><a href="/" style="color:#38bdf8">Reload</a></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 3. Static assets (_next/static, css, js, icons): Stale-While-Revalidate / Cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, copy).catch(() => {});
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Default: Network with Cache fallback
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
