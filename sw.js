const CACHE = 'ultra-log-v1';

// Files to cache on install so the app shell loads offline
const PRECACHE = [
  '/',
  '/mwrazej_training_log.html',
  '/manifest.json',
  '/icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Delete any old caches from previous versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Let Netlify function calls and Strava/Firebase API calls go straight to network
  if (
    url.pathname.startsWith('/.netlify/functions/') ||
    url.hostname.includes('strava.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis')
  ) {
    return;
  }

  // For everything else: serve from cache, fall back to network, then cache the response
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
