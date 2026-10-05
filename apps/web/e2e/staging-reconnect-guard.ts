export const STAGING_WEB_ORIGIN = "https://staging.markab-lb.com";
export const STAGING_API_ORIGIN = "https://staging-api.markab-lb.com";
export const BENCHMARK_CGROUP =
  "/user.slice/user-1000.slice/user@1000.service/app.slice/markab-reconnect-bench.scope";
export const NET_WRAPPER = "/usr/local/sbin/markab-bench-net";
export const BENCHMARK_LABEL_PREFIX = "SRB-";

const allowedOrigins = new Set([STAGING_WEB_ORIGIN, STAGING_API_ORIGIN]);

export type StagingReconnectMode = "validation" | "full";

export type StagingReconnectConfig = {
  mode: StagingReconnectMode;
  email: string;
  password: string;
  releaseId: string;
  warmups: number;
  samples: number;
  outageHoldMs: number;
  recoveryTimeoutMs: number;
};

export function assertAllowedStagingUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowedOrigins.has(url.origin)
  ) {
    throw new Error(`Refusing non-staging URL origin: ${url.origin}`);
  }
  return url;
}

export function isAllowedStagingOrigin(value: string): boolean {
  try {
    assertAllowedStagingUrl(value);
    return true;
  } catch {
    return false;
  }
}

export function assertBenchmarkRole(role: unknown): void {
  if (role !== "OWNER") {
    throw new Error(
      "Staging benchmark account must have role OWNER; PLATFORM_OWNER, EMPLOYEE, MANAGER, and unknown roles are rejected.",
    );
  }
}

export function assertBenchmarkCgroup(procSelfCgroup: string): void {
  const line = procSelfCgroup
    .split("\n")
    .find((entry) => entry.startsWith("0::"));
  if (line?.slice(3).trim() !== BENCHMARK_CGROUP) {
    throw new Error(
      "Staging reconnect benchmark must run inside the markab-reconnect-bench systemd scope (use scripts/run-staging-reconnect.sh).",
    );
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for the staging reconnect benchmark.`);
  }
  return value;
}

export function readStagingReconnectConfig(
  env: NodeJS.ProcessEnv,
): StagingReconnectConfig {
  if (env.STAGING_RECONNECT_BENCHMARK !== "1") {
    throw new Error(
      "STAGING_RECONNECT_BENCHMARK=1 is required to run the staging reconnect benchmark.",
    );
  }
  const mode = env.STAGING_RECONNECT_MODE ?? "validation";
  if (mode !== "validation" && mode !== "full") {
    throw new Error("STAGING_RECONNECT_MODE must be 'validation' or 'full'.");
  }
  const releaseId = required(env, "STAGING_RELEASE_ID");
  if (releaseId.length > 256 || /[\u0000-\u001f\u007f]/.test(releaseId)) {
    throw new Error("STAGING_RELEASE_ID must be printable and at most 256 characters.");
  }
  return {
    mode,
    email: required(env, "STAGING_BENCH_EMAIL"),
    password: required(env, "STAGING_BENCH_PASSWORD"),
    releaseId,
    warmups: mode === "full" ? 5 : 0,
    samples: mode === "full" ? 30 : 1,
    outageHoldMs: 10_000,
    recoveryTimeoutMs: 120_000,
  };
}

export function nearestRank(values: number[], fraction: number): number | null {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}
