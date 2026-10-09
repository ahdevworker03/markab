const CACHE_NAME = "markab-app-shell-__BUILD_ID__";
const CACHE_PREFIX = "markab-app-shell-";
const APP_SHELL_URL = new URL("./", self.registration.scope).href;
const PRECACHE_URLS = __PRECACHE_MANIFEST__.map(
  (asset) => new URL(asset, self.registration.scope).href,
);
const STATIC_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

function hasExpectedStaticContentType(destination, contentType) {
  if (destination === "script" || destination === "worker") {
    return [
      "application/javascript",
      "application/ecmascript",
      "text/javascript",
      "text/ecmascript",
    ].includes(contentType);
  }

  if (destination === "style") return contentType === "text/css";
  if (destination === "image") return contentType.startsWith("image/");
  if (destination === "font") {
    return (
      contentType.startsWith("font/") ||
      ["application/font-woff", "application/vnd.ms-fontobject"].includes(
        contentType,
      )
    );
  }
  if (destination === "manifest") {
    return ["application/json", "application/manifest+json"].includes(
      contentType,
    );
  }

  return false;
}

function getContentType(response) {
  return (
    response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() ?? ""
  );
}

function isCacheableAssetResponse(destination, response) {
  return (
    response.ok &&
    response.type === "basic" &&
    hasExpectedStaticContentType(destination, getContentType(response))
  );
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellResponse = await fetch(APP_SHELL_URL);
  if (!shellResponse.ok || shellResponse.type !== "basic") {
    throw new Error("The application shell could not be cached.");
  }
  await cache.put(APP_SHELL_URL, shellResponse);

  await Promise.all(
    PRECACHE_URLS.map(async (assetUrl) => {
      const destination = assetUrl.endsWith(".css") ? "style" : "script";
      const response = await fetch(new URL(assetUrl, self.registration.scope));
      if (!isCacheableAssetResponse(destination, response)) {
        throw new Error(`Invalid response while precaching ${assetUrl}.`);
      }
      await cache.put(
        new URL(assetUrl, self.registration.scope).href,
        response,
      );
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
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
      )
      .then(() => self.clients.claim()),
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
      if (isCacheableAssetResponse(request.destination, response)) {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
