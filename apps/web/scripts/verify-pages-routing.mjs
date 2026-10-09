import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(scriptDir, "../dist/public");
const indexHtml = await readFile(path.join(outputDir, "index.html"), "utf8");
const notFoundHtml = await readFile(path.join(outputDir, "404.html"), "utf8");
const builtWorker = await readFile(path.join(outputDir, "sw.js"), "utf8");
const appRouter = await readFile(
  path.resolve(scriptDir, "../src/App.tsx"),
  "utf8",
);
const sourceHeaders = await readFile(
  path.resolve(scriptDir, "../public/_headers"),
  "utf8",
);
const emittedHeaders = await readFile(path.join(outputDir, "_headers"), "utf8");
const redirects = (await readFile(path.join(outputDir, "_redirects"), "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/));

assert.equal(
  emittedHeaders,
  sourceHeaders,
  "Cloudflare headers must be emitted unchanged",
);

const headerRules = new Map();
let currentHeaderPath;
for (const line of emittedHeaders.split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith("#")) continue;
  if (/^\s/.test(line)) {
    assert.ok(
      currentHeaderPath,
      "header directives must follow a path pattern",
    );
    const separator = line.indexOf(":");
    assert.ok(separator > 0, `invalid Cloudflare header directive: ${line}`);
    const headersForPath = headerRules.get(currentHeaderPath) ?? {};
    headersForPath[line.slice(0, separator).trim().toLowerCase()] = line
      .slice(separator + 1)
      .trim();
    headerRules.set(currentHeaderPath, headersForPath);
    continue;
  }
  assert.ok(line.startsWith("/"), `invalid Cloudflare header path: ${line}`);
  currentHeaderPath = line.trim();
  if (!headerRules.has(currentHeaderPath))
    headerRules.set(currentHeaderPath, {});
}

assert.deepEqual([...headerRules.keys()], ["/index.html", "/sw.js"]);
assert.equal(
  headerRules.get("/index.html")?.["cache-control"],
  "no-cache, max-age=0, must-revalidate",
);
assert.equal(
  headerRules.get("/sw.js")?.["cache-control"],
  "no-cache, max-age=0, must-revalidate",
);
assert.equal(
  [...headerRules.keys()].some(
    (pattern) => pattern === "/assets/*" || pattern === "/*",
  ),
  false,
  "hashed assets must not inherit the HTML shell no-cache rule",
);
console.log(
  "PASS Cloudflare _headers syntax and emitted HTML/worker revalidation rules",
);

const declaredRoutes = [...appRouter.matchAll(/<Route\s+path="([^"]+)"/g)].map(
  ([, route]) => route,
);
assert.ok(declaredRoutes.length > 0, "App.tsx must contain routable paths");
assert.equal(
  redirects.some(([, destination]) => destination === "/index.html"),
  false,
  "SPA proxy rules must target /, not /index.html",
);

const matchesRule = (pathname, pattern) => {
  if (pattern.endsWith("/*")) {
    return pathname.startsWith(pattern.slice(0, -1));
  }
  return pathname === pattern;
};

const jsAssetPath = indexHtml.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(jsAssetPath, "built index.html must reference a JavaScript chunk");
assert.match(jsAssetPath, /^\/assets\/.+\.js$/);
assert.ok(
  (await stat(path.join(outputDir, jsAssetPath.replace(/^\//, "")))).isFile(),
  "the current JavaScript chunk must exist in the Pages output",
);
console.log(
  `PASS valid asset artifact: ${jsAssetPath} (.js / application/javascript)`,
);

const missingAssetPath = "/assets/this-file-definitely-does-not-exist-123.js";
const missingAssetExists = await stat(
  path.join(outputDir, missingAssetPath.replace(/^\//, "")),
).then(
  () => true,
  (error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  },
);
assert.equal(missingAssetExists, false);
assert.equal(
  redirects.some(([pattern]) => matchesRule(missingAssetPath, pattern)),
  false,
  "a missing asset must not match a Pages rewrite",
);
assert.notEqual(notFoundHtml, indexHtml, "404.html must not be the SPA shell");
assert.match(notFoundHtml, /404 الصفحة غير موجودة/);
assert.match(notFoundHtml, /لم يتم العثور على الصفحة المطلوبة/);
console.log(
  "PASS missing asset routing: no rewrite; Pages returns the app-localized 404 with status 404",
);

for (const route of declaredRoutes) {
  if (route === "/") {
    assert.ok((await stat(path.join(outputDir, "index.html"))).isFile());
    continue;
  }

  const concreteRoute = route.replace(/:\w+/g, "sample-route-param");
  assert.ok(
    redirects.some(
      ([pattern, target, status]) =>
        matchesRule(concreteRoute, pattern) &&
        target === "/" &&
        status === "200",
    ),
    `React route ${route} must rewrite to / with status 200`,
  );
}
console.log(
  `PASS direct navigation/refresh rewrites to / for ${declaredRoutes.length} declared React paths: ${declaredRoutes.join(", ")}`,
);

const unknownRoute = "/this-application-route-definitely-does-not-exist-123";
assert.equal(
  redirects.some(([pattern]) => matchesRule(unknownRoute, pattern)),
  false,
  "unknown app paths must not be rewritten as valid application routes",
);
console.log(
  "PASS unknown application route: Pages 404 response uses the app-localized 404 copy",
);

const cacheMatch = builtWorker.match(
  /const CACHE_NAME = "markab-app-shell-([a-f0-9]{12})";/,
);
const manifestMatch = builtWorker.match(
  /const PRECACHE_URLS = (\[[^\n]*\])\.map/,
);
assert.ok(
  cacheMatch,
  "built service worker must contain a build-specific cache id",
);
assert.ok(
  manifestMatch,
  "built service worker must contain its asset manifest",
);
const builtManifest = JSON.parse(manifestMatch[1]);
const expectedCacheId = createHash("sha256")
  .update(builtManifest.join("\n"))
  .digest("hex")
  .slice(0, 12);
assert.equal(cacheMatch[1], expectedCacheId);
const changedManifestId = createHash("sha256")
  .update([...builtManifest, "assets/verification-change.js"].join("\n"))
  .digest("hex")
  .slice(0, 12);
assert.notEqual(cacheMatch[1], changedManifestId);
assert.match(
  builtWorker,
  /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/,
  "old-cache cleanup must be scoped to this app's cache prefix",
);
assert.equal(
  [...builtWorker.matchAll(/caches\.delete\(/g)].length,
  1,
  "the worker must only delete caches from its own prefix filter",
);
console.log(
  "PASS service worker cache id follows the build manifest; cleanup is app-prefix scoped",
);
