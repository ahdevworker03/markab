import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertTargetSyncWithinBudget,
  buildResultArtifact,
  runSamples,
} from "./benchmark-results";

describe("runSamples", () => {
  afterEach(() => vi.restoreAllMocks());

  it("excludes warmups and uses nearest-rank percentiles over successful samples", async () => {
    const timestamps = Array.from({ length: 30 }, (_, index) => {
      const duration = index + 1;
      return [0, duration];
    }).flat();
    vi.spyOn(performance, "now").mockImplementation(
      () => timestamps.shift() ?? 0,
    );
    const samples: number[] = [];

    const result = await runSamples(
      "read",
      async (sample) => {
        samples.push(sample);
        if (sample === 3) throw new Error("expected failure");
      },
      { warmups: 5, samples: 30 },
    );

    expect(samples).toEqual([
      -5,
      -4,
      -3,
      -2,
      -1,
      ...Array.from({ length: 30 }, (_, index) => index + 1),
    ]);
    expect(result.sampleCount).toBe(30);
    expect(result.errorCount).toBe(1);
    expect(result.errorRate).toBeCloseTo(1 / 30);
    expect(result.p50Ms).toBe(16);
    expect(result.p95Ms).toBe(29);
    expect(result.maxMs).toBe(30);
  });

  it("preserves aggregate metadata and every measurement in an artifact", async () => {
    const measurement = await runSamples("read", async () => undefined, {
      warmups: 0,
      samples: 1,
    });

    expect(
      buildResultArtifact(
        {
          command: "pnpm --filter @workspace/web run benchmark",
          datasetCounts: { customers: 2_000 },
          environment: { nodeEnv: "benchmark" },
          profiles: { api: { name: "api" } },
          measurements: [measurement],
        },
        {
          artifactPath: "apps/web/test-results/benchmark/result.json",
          gitRevision: "abc123",
          recordedAt: "2026-09-26T00:00:00.000Z",
        },
      ),
    ).toMatchObject({
      artifactPath: "apps/web/test-results/benchmark/result.json",
      command: "pnpm --filter @workspace/web run benchmark",
      gitRevision: "abc123",
      recordedAt: "2026-09-26T00:00:00.000Z",
      timingMethod: "performance.now()",
      measurements: [
        expect.objectContaining({ name: "read", maxMs: expect.any(Number) }),
      ],
      profiles: { api: { name: "api" } },
    });
  });

  it("runs sample setup and teardown around each warmup and recorded measurement", async () => {
    const calls: string[] = [];

    await runSamples(
      "read",
      async (sample) => {
        calls.push(`action:${sample}`);
      },
      {
        warmups: 1,
        samples: 1,
        beforeSample: async (sample) => {
          calls.push(`setup:${sample}`);
        },
        afterSample: async (sample) => {
          calls.push(`teardown:${sample}`);
        },
      },
    );

    expect(calls).toEqual([
      "setup:-1",
      "action:-1",
      "teardown:-1",
      "setup:1",
      "action:1",
      "teardown:1",
    ]);
  });

  it("uses browser-local invocation durations instead of action wall time", async () => {
    const result = await runSamples("local-search", async () => undefined, {
      warmups: 1,
      samples: 2,
      durationMs: async (sample) => (sample === 1 ? 7 : 11),
    });

    expect(result).toMatchObject({
      warmupCount: 1,
      sampleCount: 2,
      p50Ms: 7,
      p95Ms: 11,
      maxMs: 11,
      errorCount: 0,
    });
  });

  it("rejects a target-1000 initial sync slower than 30 seconds", () => {
    expect(() =>
      assertTargetSyncWithinBudget({
        name: "target-1000-initial-sync",
        warmupCount: 5,
        sampleCount: 30,
        successCount: 30,
        errorCount: 0,
        errorRate: 0,
        p50Ms: 20_000,
        p95Ms: 31_000,
        maxMs: 31_000,
      }),
    ).toThrow(/30 seconds/);
  });

  it("accepts a target-1000 initial sync at the 30-second budget", () => {
    expect(() =>
      assertTargetSyncWithinBudget({
        name: "target-1000-initial-sync",
        warmupCount: 5,
        sampleCount: 30,
        successCount: 30,
        errorCount: 0,
        errorRate: 0,
        p50Ms: 20_000,
        p95Ms: 30_000,
        maxMs: 30_000,
      }),
    ).not.toThrow();
  });
});
