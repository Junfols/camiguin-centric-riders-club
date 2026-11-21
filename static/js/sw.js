const CACHE_NAME = "ccrc-pwa-v26";

const PRECACHE_ASSETS = [
  "/offline",
  "/manifest.webmanifest?v=3",
  "/static/icons/logo.png?v=3",
  "/static/icons/icon-192.png?v=3",
  "/static/icons/icon-maskable-192.png?v=3"
];

const NO_CACHE_PREFIXES = ["/api/", "/admin", "/rider", "/history", "/track", "/verify"];

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

  // Network-first for HTML page navigations; never cache authenticated/sensitive pages
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

  // Network-first for JS and CSS so PWA users always receive the latest code updates immediately
  const isCodeAsset = url.pathname.startsWith("/static/js/") || url.pathname.startsWith("/static/css/");
  if (isCodeAsset) {
    event.respondWith(
      fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Stale-while-revalidate for static images/icons
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


// Handle PWA Notification clicks (focus existing tab or open target URL)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if (targetUrl && targetUrl !== "/" && !client.url.endsWith(targetUrl)) {
            client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SHOW_NOTIFICATION" && self.registration && self.registration.showNotification) {
    event.waitUntil(
      self.registration.showNotification(msg.title || "Camiguin Centric Riders Club", {
        body: msg.body || "",
        icon: msg.icon || "/static/icons/icon-192.png",
        badge: "/static/icons/icon-192.png",
        tag: msg.tag || "ccrc-alert",
        renotify: true,
        vibrate: [250, 100, 250],
        data: { url: msg.url || "/" },
      })
    );
  }
});
