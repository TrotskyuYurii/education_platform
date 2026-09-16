// Крок 14: minimal service worker whose only job is the offline fallback page.
// Deliberately NOT caching app content/API responses — the app has no offline
// data-sync story yet, and caching stale HTML/JS/API bundles would risk serving
// outdated screens or stale auth state. Caching read articles is a follow-up.
const CACHE_NAME = 'viatec-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, '/icon.svg']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept top-level page navigations; let every other request
  // (API calls, JS/CSS bundles, images) go straight to the network as usual.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
