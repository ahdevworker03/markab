import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerApplicationShell } from "./service-worker";

const workerSource = readFileSync(
  path.resolve(process.cwd(), "public/service-worker.js"),
  "utf8",
);

describe("registerApplicationShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the application shell after the page load", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    const addEventListener = vi.spyOn(window, "addEventListener");

    registerApplicationShell();

    expect(addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      { once: true },
    );

    const handler = addEventListener.mock.calls[0]?.[1] as EventListener;
    handler(new Event("load"));
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith("/service-worker.js");
  });

  it("does nothing when service workers are unavailable", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
    const addEventListener = vi.spyOn(window, "addEventListener");

    registerApplicationShell();

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("caches only public application shell requests", () => {
    expect(workerSource).toContain('request.method !== "GET"');
    expect(workerSource).toContain('request.headers.has("authorization")');
    expect(workerSource).toContain("url.origin !== self.location.origin");
    expect(workerSource).toContain("(?:api|auth|private)");
    expect(workerSource).toContain('request.mode === "navigate"');
  });
});
