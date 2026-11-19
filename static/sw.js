const CACHE_NAME = "ccrc-pwa-v19";

const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/static/css/style.css?v=31",
  "/static/js/i18n.js?v=9",
  "/static/js/auth.js?v=1",
  "/static/js/app.js?v=35",
  "/static/js/voice_call.js?v=1",
  "/static/icons/icon.svg"
];

const NO_CACHE_PREFIXES = ["/api/", "/admin", "/rider", "/history", "/track"];

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

  // Only handle same-origin GET requests; skip API endpoints
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  const isSensitivePage = NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p));

  // Network-first for pages; never cache authenticated/sensitive pages
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200 && !isSensitivePage) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return (!isSensitivePage && cached) || caches.match("/offline");
          });
        })
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
