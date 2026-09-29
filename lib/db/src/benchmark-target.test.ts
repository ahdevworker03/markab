import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateBenchmarkTarget } from "./benchmark-target";

const target =
  "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public";

test("accepts matching local benchmark URLs in benchmark mode", () => {
  const result = validateBenchmarkTarget({
    NODE_ENV: "benchmark",
    DATABASE_URL: target,
    BENCHMARK_DATABASE_URL: target,
    BENCHMARK_PASSWORD: "local-benchmark-password",
  });

  assert.equal(result.databaseUrl, target);
  assert.equal(result.password, "local-benchmark-password");
  assert.equal(result.profile, "full-pilot");
});

test("accepts the target-1000 benchmark profile", () => {
  assert.equal(
    validateBenchmarkTarget({
      NODE_ENV: "benchmark",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL: target,
      BENCHMARK_PASSWORD: "local-benchmark-password",
      BENCHMARK_PROFILE: "target-1000",
    }).profile,
    "target-1000",
  );
});

test("rejects an unknown benchmark profile", () => {
  assert.throws(() =>
    validateBenchmarkTarget({
      NODE_ENV: "benchmark",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL: target,
      BENCHMARK_PASSWORD: "local-benchmark-password",
      BENCHMARK_PROFILE: "custom-counts",
    }),
  );
});

test("accepts matching URLs after normalization", () => {
  const normalizedTarget =
    "postgresql://postgres:postgres@localhost:5432/markab_benchmark?schema=public";

  assert.equal(
    validateBenchmarkTarget({
      NODE_ENV: "benchmark",
      DATABASE_URL:
        "postgresql://postgres:postgres@LOCALHOST:5432/markab_benchmark?schema=public",
      BENCHMARK_DATABASE_URL: normalizedTarget,
      BENCHMARK_PASSWORD: "local-benchmark-password",
    }).databaseUrl,
    normalizedTarget,
  );
});

test("seed rejects a missing benchmark target before Prisma loads", () => {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "benchmark",
    BENCHMARK_PASSWORD: "local-benchmark-password",
  };

  delete environment.DATABASE_URL;
  delete environment.BENCHMARK_DATABASE_URL;

  const result = spawnSync("pnpm", ["exec", "tsx", "src/seed.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: environment,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  assert.notEqual(result.status, 0);
  assert.match(output, /Benchmark mode requires BENCHMARK_DATABASE_URL\./);
  assert.doesNotMatch(output, /DATABASE_URL must be set/);
});

for (const [name, environment] of [
  [
    "when NODE_ENV is not benchmark",
    {
      NODE_ENV: "development",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL: target,
      BENCHMARK_PASSWORD: "local-benchmark-password",
    },
  ],
  [
    "when the benchmark URL is remote",
    {
      NODE_ENV: "benchmark",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL:
        "postgresql://postgres:postgres@db.example/markab_benchmark",
      BENCHMARK_PASSWORD: "local-benchmark-password",
    },
  ],
  [
    "when the database URL is remote",
    {
      NODE_ENV: "benchmark",
      DATABASE_URL:
        "postgresql://postgres:postgres@db.example/markab_benchmark",
      BENCHMARK_DATABASE_URL:
        "postgresql://postgres:postgres@db.example/markab_benchmark",
      BENCHMARK_PASSWORD: "local-benchmark-password",
    },
  ],
  [
    "when the benchmark database name is unsafe",
    {
      NODE_ENV: "benchmark",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/vehicle_rental",
      BENCHMARK_PASSWORD: "local-benchmark-password",
    },
  ],
  [
    "when the database URL database name is unsafe",
    {
      NODE_ENV: "benchmark",
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/vehicle_rental",
      BENCHMARK_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/vehicle_rental",
      BENCHMARK_PASSWORD: "local-benchmark-password",
    },
  ],
  [
    "when both URLs differ",
    {
      NODE_ENV: "benchmark",
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark_other",
      BENCHMARK_DATABASE_URL: target,
      BENCHMARK_PASSWORD: "local-benchmark-password",
    },
  ],
  [
    "when the benchmark password is missing",
    {
      NODE_ENV: "benchmark",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL: target,
    },
  ],
] as const) {
  test(`rejects an unsafe benchmark target ${name}`, () => {
    assert.throws(() => validateBenchmarkTarget(environment));
  });
}
