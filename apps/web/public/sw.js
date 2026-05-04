const CACHE_NAME = "vyb-shell-v5";
const STATIC_PATHS = [
  "/manifest.webmanifest",
  "/icons/icon.png",
  "/icons/maskable-icon.png",
  "/icons/apple-touch-icon.png"
];

const OFFLINE_NAVIGATION_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vyb is offline</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #080b14; color: #eef2ff; }
      main { width: min(420px, calc(100vw - 48px)); }
      h1 { margin: 0 0 10px; font-size: 1.35rem; line-height: 1.2; }
      p { margin: 0; color: #a5b4fc; line-height: 1.55; }
    </style>
  </head>
  <body>
    <main>
      <h1>You are offline</h1>
      <p>Your current Vyb session is still safe. Reconnect and refresh this page to continue.</p>
    </main>
  </body>
</html>`;

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

function isCacheableNavigation(request, response) {
  if (!response || !response.ok || response.redirected || response.type !== "basic") {
    return false;
  }

  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function buildOfflineNavigationResponse() {
  return new Response(OFFLINE_NAVIGATION_HTML, {
    status: 503,
    statusText: "Offline",
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
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
        .then((networkResponse) => {
          if (isCacheableNavigation(event.request, networkResponse)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return cache.match(event.request) || buildOfflineNavigationResponse();
        })
    );
    return;
  }

  if (!isCacheableAsset(event.request)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }

        return networkResponse;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(event.request) || Response.error();
      })
  );
});
