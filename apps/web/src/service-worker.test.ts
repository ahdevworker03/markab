import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serviceWorkerPath = resolve(import.meta.dirname, "../public/sw.js");

describe("application shell service worker", () => {
  it("uses a build-time manifest for hashed application assets", () => {
    const source = readFileSync(serviceWorkerPath, "utf8");

    expect(source).toContain('const CACHE_NAME = "markab-app-shell-v1"');
    expect(source).toContain("const PRECACHE_URLS = __PRECACHE_MANIFEST__.map");
    expect(source).toContain("cache.addAll([APP_SHELL_URL, ...PRECACHE_URLS])");
    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain('url.origin !== self.location.origin');
    expect(source).toContain('url.pathname === "/api"');
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname.startsWith("/auth/")');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("request.destination");
    expect(source).toContain("cache.put(request, response.clone())");
  });

  it("starts base-path-aware registration only in production", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "main.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import { registerApplicationShell } from "@/features/offline/service-worker"',
    );
    expect(source).toContain("if (import.meta.env.PROD)");
    expect(source).toContain('`${import.meta.env.BASE_URL}sw.js`');
    expect(source).toContain("registerApplicationShell(");
  });
});
