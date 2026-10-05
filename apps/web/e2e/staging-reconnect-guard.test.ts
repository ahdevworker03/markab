import { describe, expect, it } from "vitest";
import {
  BENCHMARK_CGROUP,
  assertAllowedStagingUrl,
  assertBenchmarkCgroup,
  assertBenchmarkRole,
  isAllowedStagingReconnectRequestOrigin,
  isAllowedStagingOrigin,
  nearestRank,
  readStagingReconnectConfig,
} from "./staging-reconnect-guard";

const validEnv = {
  STAGING_RECONNECT_BENCHMARK: "1",
  STAGING_BENCH_EMAIL: "bench@example.test",
  STAGING_BENCH_PASSWORD: "not-a-real-password",
  STAGING_RELEASE_ID: "sha256:abc revision=123",
};

describe("staging reconnect guard", () => {
  it("allows only the two staging origins", () => {
    expect(
      assertAllowedStagingUrl("https://staging.markab-lb.com/customers").origin,
    ).toBe("https://staging.markab-lb.com");
    expect(
      assertAllowedStagingUrl("https://staging-api.markab-lb.com/api/healthz")
        .origin,
    ).toBe("https://staging-api.markab-lb.com");
    for (const url of [
      "https://markab-lb.com",
      "https://api.markab-lb.com",
      "https://app.markab-lb.com",
      "http://staging.markab-lb.com",
      "https://staging.markab-lb.com:8443",
      "https://user:pass@staging.markab-lb.com",
      "http://127.0.0.1:4174",
      "http://localhost:3001",
      "https://example.com",
    ]) {
      expect(() => assertAllowedStagingUrl(url)).toThrow();
    }
  });

  it("accepts no runtime origin other than the two staging origins", () => {
    expect(isAllowedStagingOrigin("https://staging.markab-lb.com/x")).toBe(true);
    expect(isAllowedStagingOrigin("https://staging-api.markab-lb.com/api")).toBe(
      true,
    );
    for (const url of [
      "https://markab-lb.com",
      "https://api.markab-lb.com",
      "http://localhost:4174",
      "http://127.0.0.1:3001",
      "http://[::1]:3001",
      "https://fonts.googleapis.com/css",
      "not a url",
    ]) {
      expect(isAllowedStagingOrigin(url)).toBe(false);
    }
  });

  it("allows only approved static origins in the browser request audit", () => {
    for (const url of [
      "https://staging.markab-lb.com/customers",
      "https://staging-api.markab-lb.com/api/healthz",
      "https://fonts.googleapis.com/css2?family=Cairo",
      "https://fonts.gstatic.com/s/cairo.woff2",
      "https://static.cloudflareinsights.com/beacon.min.js",
    ]) {
      expect(isAllowedStagingReconnectRequestOrigin(url)).toBe(true);
    }
    for (const url of [
      "http://fonts.googleapis.com/css2?family=Cairo",
      "https://api.markab-lb.com/api/healthz",
      "https://example.com/data",
      "https://analytics.example.com/collect",
    ]) {
      expect(isAllowedStagingReconnectRequestOrigin(url)).toBe(false);
    }
  });

  it("requires role OWNER", () => {
    expect(() => assertBenchmarkRole("OWNER")).not.toThrow();
    for (const role of [
      "PLATFORM_OWNER",
      "EMPLOYEE",
      "MANAGER",
      "owner",
      "",
      undefined,
      null,
    ]) {
      expect(() => assertBenchmarkRole(role)).toThrow(/role OWNER/);
    }
  });

  it("fails closed without opt-in, credentials, or release identifier", () => {
    expect(() => readStagingReconnectConfig({})).toThrow(
      /STAGING_RECONNECT_BENCHMARK=1/,
    );
    for (const name of [
      "STAGING_BENCH_EMAIL",
      "STAGING_BENCH_PASSWORD",
      "STAGING_RELEASE_ID",
    ]) {
      expect(() =>
        readStagingReconnectConfig({ ...validEnv, [name]: "" }),
      ).toThrow(name);
    }
    expect(() =>
      readStagingReconnectConfig({ ...validEnv, STAGING_RECONNECT_MODE: "x" }),
    ).toThrow();
  });

  it("defaults to one validation cycle and records the release id verbatim", () => {
    const config = readStagingReconnectConfig(validEnv);
    expect(config).toMatchObject({
      mode: "validation",
      warmups: 0,
      samples: 1,
      releaseId: "sha256:abc revision=123",
    });
    expect(
      readStagingReconnectConfig({ ...validEnv, STAGING_RECONNECT_MODE: "full" }),
    ).toMatchObject({ warmups: 5, samples: 30 });
  });

  it("requires the dedicated benchmark scope", () => {
    expect(() => assertBenchmarkCgroup(`0::${BENCHMARK_CGROUP}\n`)).not.toThrow();
    expect(() =>
      assertBenchmarkCgroup("0::/user.slice/user-1000.slice/session-2.scope\n"),
    ).toThrow();
  });

  it("uses nearest-rank percentiles", () => {
    const values = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(nearestRank(values, 0.5)).toBe(15);
    expect(nearestRank(values, 0.95)).toBe(29);
    expect(nearestRank([], 0.5)).toBeNull();
  });
});
