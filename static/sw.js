const CACHE_NAME = "ccrc-pwa-v1";

const PRECACHE_ASSETS = [
  "/",
  "/rider",
  "/offline",
  "/manifest.webmanifest",
  "/static/css/style.css?v=1",
  "/static/js/app.js?v=1",
  "/static/js/track.js?v=1",
  "/static/js/rider.js?v=1",
  "/static/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" })))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip caching for API endpoints and non-GET requests
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Network-first for pages, falling back to cache or offline.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return cached || caches.match("/offline");
          });
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
        }
        return networkResponse;
      });
    })
  );
});
