const CACHE_NAME = "vyb-shell-v3";
const STATIC_PATHS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.png",
  "/icons/maskable-icon.png",
  "/icons/apple-touch-icon.png"
];

function isCacheableAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    STATIC_PATHS.includes(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PATHS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => networkResponse)
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return cache.match("/") || Response.error();
        })
    );
    return;
  }

  if (!isCacheableAsset(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
