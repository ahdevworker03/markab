const CACHE_NAME = "markab-app-shell-v1";
const CACHE_PREFIX = "markab-app-shell-";
const APP_SHELL_URL = new URL("./", self.registration.scope).href;
const PRECACHE_URLS = __PRECACHE_MANIFEST__.map((asset) =>
  new URL(asset, self.registration.scope).href,
);
const STATIC_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll([APP_SHELL_URL, ...PRECACHE_URLS]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/auth" ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  if (!isNavigation && !STATIC_DESTINATIONS.has(request.destination)) return;

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(APP_SHELL_URL)) ?? Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
