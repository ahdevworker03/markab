const CACHE_NAME = "markab-shell-v1";
const SHELL_URL = new URL("./", self.registration.scope).pathname;
const CACHEABLE_DESTINATIONS = new Set([
  "script",
  "style",
  "font",
  "image",
  "manifest",
  "worker",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith("markab-shell-") && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    request.headers.has("authorization") ||
    url.origin !== self.location.origin ||
    /(?:^|\/)(?:api|auth|private)(?:\/|$)/.test(url.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(SHELL_URL)));
    return;
  }

  if (!CACHEABLE_DESTINATIONS.has(request.destination)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, response.clone()));
          }
          return response;
        }),
    ),
  );
});
