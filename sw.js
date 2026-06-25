const CACHE_NAME = 'nimbus-weather-cache-v44';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './canvas.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Let network requests for external APIs (like OpenWeatherMap and Firebase) go through
  if (e.request.url.includes('api.openweathermap.org') || e.request.url.includes('firebaseio.com')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
