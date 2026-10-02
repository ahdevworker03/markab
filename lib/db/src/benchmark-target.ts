const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const databaseName = /^markab_benchmark(?:_[a-z0-9_]+)?$/;
export type BenchmarkSeedProfile = "full-pilot" | "target-1000";

const benchmarkSeedProfiles: readonly BenchmarkSeedProfile[] = [
  "full-pilot",
  "target-1000",
];

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];

  if (!value) {
    throw new Error(`Benchmark mode requires ${name}.`);
  }

  return value;
}

function normalize(url: URL): string {
  const normalized = new URL(url);

  normalized.hostname = normalized.hostname.toLowerCase();

  return normalized.toString();
}

function validateDatabaseUrl(url: URL, name: string): void {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (url.protocol !== "postgresql:" || !allowedHosts.has(hostname)) {
    throw new Error(`${name} must use an approved local PostgreSQL host.`);
  }

  if (!databaseName.test(url.pathname.slice(1))) {
    throw new Error(
      `${name} must name markab_benchmark or markab_benchmark_<suffix>.`,
    );
  }
}

function approvedStagingDatabaseUrl(
  environment: NodeJS.ProcessEnv,
): string | undefined {
  if (environment.ALLOW_STAGING_BENCHMARK_SEED !== "true") return undefined;

  const approved = new URL(
    required(environment, "APPROVED_STAGING_BENCHMARK_DATABASE_URL"),
  );

  if (approved.protocol !== "postgresql:") {
    throw new Error(
      "APPROVED_STAGING_BENCHMARK_DATABASE_URL must use PostgreSQL.",
    );
  }

  return normalize(approved);
}

function benchmarkProfile(
  environment: NodeJS.ProcessEnv,
): BenchmarkSeedProfile {
  const value = environment.BENCHMARK_PROFILE ?? "full-pilot";

  if (!benchmarkSeedProfiles.includes(value as BenchmarkSeedProfile)) {
    throw new Error("BENCHMARK_PROFILE must be full-pilot or target-1000.");
  }

  return value as BenchmarkSeedProfile;
}

export function validateBenchmarkTarget(environment: NodeJS.ProcessEnv): {
  databaseUrl: string;
  password: string;
  profile: BenchmarkSeedProfile;
} {
  if (environment.NODE_ENV !== "benchmark") {
    throw new Error("Benchmark mode requires NODE_ENV=benchmark.");
  }

  const benchmark = new URL(required(environment, "BENCHMARK_DATABASE_URL"));
  const database = new URL(required(environment, "DATABASE_URL"));

  const databaseUrl = normalize(database);
  const benchmarkUrl = normalize(benchmark);
  const approvedStagingUrl = approvedStagingDatabaseUrl(environment);

  if (
    approvedStagingUrl &&
    databaseUrl === approvedStagingUrl &&
    benchmarkUrl === approvedStagingUrl
  ) {
    return {
      databaseUrl: approvedStagingUrl,
      password: required(environment, "BENCHMARK_PASSWORD"),
      profile: benchmarkProfile(environment),
    };
  }

  validateDatabaseUrl(benchmark, "BENCHMARK_DATABASE_URL");
  validateDatabaseUrl(database, "DATABASE_URL");

  if (databaseUrl !== benchmarkUrl) {
    throw new Error(
      "DATABASE_URL must equal BENCHMARK_DATABASE_URL in benchmark mode.",
    );
  }

  return {
    databaseUrl: benchmarkUrl,
    password: required(environment, "BENCHMARK_PASSWORD"),
    profile: benchmarkProfile(environment),
  };
}
