import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDirectory = resolve(import.meta.dirname, "../../..");
const artifactDirectory = resolve(
  import.meta.dirname,
  "../test-results/benchmark",
);

export type Measurement = {
  name: string;
  warmupCount: number;
  sampleCount: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};

export function assertTargetSyncWithinBudget(measurement: Measurement): void {
  if (measurement.errorCount > 0 || measurement.maxMs === null) {
    throw new Error("target-1000 initial sync must complete without errors.");
  }

  if (measurement.maxMs > 30_000) {
    throw new Error(
      "target-1000 initial sync must complete within 30 seconds.",
    );
  }
}

export type BenchmarkResult = {
  command: string;
  datasetCounts: Record<string, number>;
  environment: Record<string, string | number | boolean>;
  profiles: Record<string, Record<string, string | number | boolean>>;
  measurements: Measurement[];
};

export type BenchmarkArtifact = BenchmarkResult & {
  artifactPath: string;
  gitRevision: string;
  recordedAt: string;
  timingMethod: "performance.now()";
};

type SampleOptions = {
  warmups: number;
  samples: number;
  beforeSample?: (sample: number) => Promise<void>;
  afterSample?: (sample: number) => Promise<void>;
  durationMs?: (sample: number) => Promise<number>;
};

export async function runSamples(
  name: string,
  action: (sample: number) => Promise<void>,
  options: SampleOptions,
): Promise<Measurement> {
  for (let sample = -options.warmups; sample < 0; sample += 1) {
    await options.beforeSample?.(sample);
    try {
      await action(sample);
    } finally {
      await options.afterSample?.(sample);
    }
  }

  const durations: number[] = [];
  let errorCount = 0;
  for (let sample = 1; sample <= options.samples; sample += 1) {
    await options.beforeSample?.(sample);
    const startedAt = performance.now();
    let localDuration: number | undefined;
    let succeeded = false;
    try {
      await action(sample);
      localDuration = await options.durationMs?.(sample);
      if (
        localDuration !== undefined &&
        (!Number.isFinite(localDuration) || localDuration < 0)
      )
        throw new Error("Invalid benchmark duration");
      succeeded = true;
    } catch {
      errorCount += 1;
    } finally {
      const wallDuration = performance.now() - startedAt;
      if (succeeded) durations.push(localDuration ?? wallDuration);
      await options.afterSample?.(sample);
    }
  }

  durations.sort((left, right) => left - right);
  const percentile = (value: number) =>
    durations.length
      ? durations[Math.ceil(value * durations.length) - 1]!
      : null;

  return {
    name,
    warmupCount: options.warmups,
    sampleCount: options.samples,
    successCount: durations.length,
    errorCount,
    errorRate: errorCount / options.samples,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: durations.at(-1) ?? null,
  };
}

export function buildResultArtifact(
  result: BenchmarkResult,
  metadata: Pick<
    BenchmarkArtifact,
    "artifactPath" | "gitRevision" | "recordedAt"
  >,
): BenchmarkArtifact {
  return { ...result, ...metadata, timingMethod: "performance.now()" };
}

export async function writeResultArtifact(
  result: BenchmarkResult,
): Promise<string> {
  const [{ stdout: revision }, now] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: rootDirectory }),
    Promise.resolve(new Date()),
  ]);
  await mkdir(artifactDirectory, { recursive: true });
  const artifactPath = resolve(
    artifactDirectory,
    `${now.toISOString().replaceAll(":", "-")}.json`,
  );
  const repositoryPath = relative(rootDirectory, artifactPath);
  await writeFile(
    artifactPath,
    `${JSON.stringify(
      buildResultArtifact(result, {
        artifactPath: repositoryPath,
        gitRevision: revision.trim(),
        recordedAt: now.toISOString(),
      }),
      null,
      2,
    )}\n`,
  );
  return repositoryPath;
}
