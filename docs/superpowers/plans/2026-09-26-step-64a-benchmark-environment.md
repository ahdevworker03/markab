# Step 64A Benchmark Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a safe local benchmark environment with deterministic pilot data and reproducible before-state measurements.

**Architecture:** Keep `lib/db/src/seed.ts` as the single seed entry point, adding a benchmark-only branch that validates both URLs before dynamically importing Prisma. Add deterministic data construction and a benchmark runner that launches the real API and built web application, emits JSON evidence, and leaves the authoritative baseline document for reviewed manual updates.

**Tech Stack:** Node.js, TypeScript, Prisma 7, PostgreSQL, Argon2, Express, Vite, Playwright 1.63, native `fetch`, native `performance.now()`.

**Spec:** `docs/superpowers/specs/2026-09-26-step-64a-benchmark-environment-design.md`

## Global Constraints

- Run benchmark seeding only when `NODE_ENV=benchmark`, `BENCHMARK_DATABASE_URL`, and `DATABASE_URL` normalize to the same approved local `markab_benchmark` database target.
- Preserve non-benchmark seed behavior and never initialize Prisma before the benchmark URL guard passes.
- Do not add indexes, caches, queues, workers, Redis, API endpoints, schema changes, or application performance fixes.
- Authenticate every benchmark request using `/api/auth/login`; never add an authentication bypass or commit benchmark credentials.
- Preserve rental lifecycle, tenant, money, payment, and vehicle-status invariants in direct Prisma data construction.
- Emit benchmark evidence under an ignored output directory; only a reviewed result may be summarized in `docs/operations/production-baseline.md`.
- Use five unrecorded warm-ups, 30 recorded samples, nearest-rank p50/p95 over successful samples, and failed/recorded error rate.
- The concurrent API profile is 10 authenticated users total. The mobile profile is Chromium, 393x852, DPR 2, 4x CPU, 1.6 Mbps down, 750 Kbps up, and 150 ms RTT.

---

### Task 1: Add a pre-Prisma benchmark target guard

**Files:**
- Create: `lib/db/src/benchmark-target.ts`
- Create: `lib/db/src/benchmark-target.test.ts`
- Modify: `lib/db/src/seed.ts:1-15`
- Modify: `lib/db/package.json:9-16`

**Interfaces:**
- Produces: `validateBenchmarkTarget(environment: NodeJS.ProcessEnv): { databaseUrl: string; password: string }`
- Consumes: `process.env` before `await import("./index")`

- [ ] **Step 1: Write the failing guard tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { validateBenchmarkTarget } from "./benchmark-target";

const target = "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public";

test("accepts matching local benchmark URLs in benchmark mode", () => {
  assert.equal(
    validateBenchmarkTarget({
      NODE_ENV: "benchmark",
      DATABASE_URL: target,
      BENCHMARK_DATABASE_URL: target,
      BENCHMARK_PASSWORD: "local-benchmark-password",
    }).databaseUrl,
    target,
  );
});

for (const environment of [
  { NODE_ENV: "development", DATABASE_URL: target, BENCHMARK_DATABASE_URL: target },
  { NODE_ENV: "benchmark", DATABASE_URL: target, BENCHMARK_DATABASE_URL: "postgresql://postgres:postgres@db.example/markab_benchmark" },
  { NODE_ENV: "benchmark", DATABASE_URL: target, BENCHMARK_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/vehicle_rental" },
  { NODE_ENV: "benchmark", DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark_other", BENCHMARK_DATABASE_URL: target },
]) {
  test("rejects an unsafe benchmark target", () => {
    assert.throws(() => validateBenchmarkTarget({ ...environment, BENCHMARK_PASSWORD: "local-benchmark-password" }));
  });
}
```

- [ ] **Step 2: Run the guard tests to verify failure**

Run: `pnpm --filter @workspace/db exec tsx --test src/benchmark-target.test.ts`

Expected: FAIL because `./benchmark-target` does not exist.

- [ ] **Step 3: Implement the minimal guard and lazy Prisma import**

```ts
const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const databaseName = /^markab_benchmark(?:_[a-z0-9_]+)?$/;

export function validateBenchmarkTarget(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV !== "benchmark") throw new Error("Benchmark mode requires NODE_ENV=benchmark.");
  const benchmark = new URL(required(environment, "BENCHMARK_DATABASE_URL"));
  const database = new URL(required(environment, "DATABASE_URL"));
  if (benchmark.protocol !== "postgresql:" || !allowedHosts.has(benchmark.hostname)) throw new Error("BENCHMARK_DATABASE_URL must use an approved local PostgreSQL host.");
  if (!databaseName.test(benchmark.pathname.slice(1))) throw new Error("BENCHMARK_DATABASE_URL must name markab_benchmark or markab_benchmark_<suffix>.");
  if (normalize(database) !== normalize(benchmark)) throw new Error("DATABASE_URL must equal BENCHMARK_DATABASE_URL in benchmark mode.");
  return { databaseUrl: normalize(benchmark), password: required(environment, "BENCHMARK_PASSWORD") };
}
```

Replace the static `import prisma from "./index"` in `seed.ts` with a branch on `NODE_ENV`. Call `validateBenchmarkTarget(process.env)` and only then dynamically import the benchmark seeder, which dynamically imports `./index`. Keep the existing non-benchmark no-op behavior unchanged.

- [ ] **Step 4: Run the guard tests to verify success**

Run: `pnpm --filter @workspace/db exec tsx --test src/benchmark-target.test.ts`

Expected: PASS.

- [ ] **Step 5: Add an explicit benchmark seed script**

Add `db:seed:benchmark` using `NODE_ENV=benchmark` without setting either database URL or password. The caller must explicitly supply all three values; the command must not provide defaults.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/benchmark-target.ts lib/db/src/benchmark-target.test.ts lib/db/src/seed.ts lib/db/package.json
git commit -m "feat(db): guard benchmark seed target"
```

### Task 2: Construct deterministic invariant-safe pilot data

**Files:**
- Create: `lib/db/src/benchmark-seed.ts`
- Create: `lib/db/src/benchmark-seed.test.ts`
- Modify: `lib/db/src/seed.ts`

**Interfaces:**
- Consumes: `PrismaClient`, `password: string`, and the output of `validateBenchmarkTarget`.
- Produces: `seedBenchmark(prisma: PrismaClient, password: string): Promise<BenchmarkDatasetSummary>` with tenant IDs, owner emails, and record counts.

- [ ] **Step 1: Write the failing deterministic generator tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildBenchmarkTenant } from "./benchmark-seed";

test("builds a tenant with pilot counts and valid rental assignments", () => {
  const tenant = buildBenchmarkTenant(0, new Date("2026-09-01T00:00:00.000Z"));
  assert.equal(tenant.vehicles.length, 50);
  assert.equal(tenant.customers.length, 1_000);
  assert.equal(tenant.rentals.length, 500);
  assert.equal(tenant.payments.some((payment) => payment.amount > 0), true);
  assert.equal(hasOverlappingVehicleRentals(tenant.rentals), false);
  assert.equal(tenant.rentals.every((rental) => rental.expectedReturnDate > rental.pickupDate), true);
});
```

`hasOverlappingVehicleRentals` belongs in the test and groups rentals by vehicle before comparing sorted date intervals.

- [ ] **Step 2: Run the generator test to verify failure**

Run: `pnpm --filter @workspace/db exec tsx --test src/benchmark-seed.test.ts`

Expected: FAIL because `buildBenchmarkTenant` does not exist.

- [ ] **Step 3: Implement deterministic construction and database reset**

Use a fixed clock of `2026-09-01T00:00:00.000Z`, generated string identifiers, and Prisma `Decimal` values represented as two-decimal strings. Create two active organizations with a real Argon2 owner password hash, 50 unique vehicles, 1,000 unique customers, and 500 non-overlapping rentals each.

Assign closed historical rentals to `AVAILABLE` vehicles. Assign at most one current `RESERVED` or `ACTIVE` rental to the corresponding `RESERVED` or `RENTED` vehicle. Create payments only under the rental's organization, with a deterministic full/partial/unpaid distribution and positive values no greater than the rental total.

Delete benchmark records in foreign-key-safe dependency order inside the guarded database, then use `createMany` for independent rows and chunked `createMany` for rentals/payments. Never issue deletion before Task 1's guard succeeds.

- [ ] **Step 4: Add a guarded integration assertion for actual row counts**

Write a test that skips unless all benchmark environment variables are explicitly present. It calls the guarded seed against `markab_benchmark`, asserts exactly 2 organizations, 100 vehicles, 2,000 customers, 1,000 rentals, and a nonzero payment count, then reseeds and asserts the same counts.

- [ ] **Step 5: Run focused tests**

Run: `pnpm --filter @workspace/db exec tsx --test src/benchmark-seed.test.ts`

Expected: PASS. The integration assertion reports skipped without the explicitly supplied benchmark environment.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/benchmark-seed.ts lib/db/src/benchmark-seed.test.ts lib/db/src/seed.ts
git commit -m "feat(db): seed representative benchmark tenants"
```

### Task 3: Enable the real API and web applications in benchmark mode

**Files:**
- Modify: `apps/api/src/config/env.ts:1-45,215-315`
- Create: `apps/api/src/config/env.test.ts`
- Create: `apps/web/playwright.benchmark.config.ts`
- Modify: `apps/web/package.json:6-15`
- Modify: `.gitignore`

**Interfaces:**
- Produces: API configuration accepting `NODE_ENV=benchmark` with explicit local benchmark variables.
- Produces: a Playwright project that starts `@workspace/api-server` on `3001` and Vite preview on `4174`, each using the validated benchmark target.

- [ ] **Step 1: Write a failing API environment test**

```ts
it("accepts benchmark environment configuration", () => {
  expect(loadEnv({
    NODE_ENV: "benchmark",
    PORT: "3001",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark",
    JWT_SECRET: "benchmark-jwt-secret-at-least-32-characters",
    REFRESH_TOKEN_SECRET: "benchmark-refresh-secret-at-least-32-chars",
    CORS_ORIGINS: "http://127.0.0.1:4174",
    STORAGE_PROVIDER: "local",
  })).toMatchObject({ NODE_ENV: "benchmark", PORT: 3001 });
});
```

- [ ] **Step 2: Run the environment test to verify failure**

Run: `pnpm --filter @workspace/api-server exec vitest run src/config/env.test.ts`

Expected: FAIL because `benchmark` is not a valid `NODE_ENV`.

- [ ] **Step 3: Permit benchmark mode without weakening production requirements**

Extend the `NodeEnv` union with `benchmark`. Keep all production-only secret/storage validation exactly as-is. Use explicit benchmark process variables in the runner: `PORT=3001`, `CORS_ORIGINS=http://127.0.0.1:4174`, `STORAGE_PROVIDER=local`, and a dedicated temporary local `STORAGE_DIR` ignored by Git.

Add a separate Playwright config rather than changing the existing service-worker config. Its `webServer` array starts the built API with `NODE_ENV=benchmark` and Vite preview with `VITE_API_URL=http://127.0.0.1:3001`; it must pass through `DATABASE_URL`, `BENCHMARK_DATABASE_URL`, `BENCHMARK_PASSWORD`, and the locally supplied JWT secrets without logging them.

- [ ] **Step 4: Run focused configuration checks**

Run: `pnpm --filter @workspace/api-server exec vitest run src/config/env.test.ts && pnpm --filter @workspace/web exec playwright test --config playwright.benchmark.config.ts --list`

Expected: configuration test PASS and benchmark project lists tests without starting a measurement.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/config/env.test.ts apps/web/playwright.benchmark.config.ts apps/web/package.json .gitignore
git commit -m "feat(benchmark): run local application stack"
```

### Task 4: Add repeatable API, browser, IndexedDB, and sync measurements

**Files:**
- Create: `apps/web/e2e/benchmark.spec.ts`
- Create: `apps/web/e2e/benchmark-results.ts`
- Create: `apps/web/e2e/benchmark-fixtures.ts`
- Create: `apps/web/e2e/benchmark.spec.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `runSamples(name, action, options): Measurement` with `{ warmups: 5, samples: 30 }`.
- Produces: `writeResultArtifact(result: BenchmarkResult): Promise<string>` under `apps/web/test-results/benchmark/`.
- Consumes: the real `/api/auth/login`, `/api/sync/pull`, list/search, payment-summary, and mutation routes.

- [ ] **Step 1: Write failing pure measurement tests**

```ts
it("calculates nearest-rank p50, p95, and error rate after warmups", async () => {
  const result = await runSamples("read", async (sample) => {
    if (sample === 3) throw new Error("expected failure");
    return sample;
  }, { warmups: 5, samples: 30 });

  expect(result.sampleCount).toBe(30);
  expect(result.errorCount).toBe(1);
  expect(result.errorRate).toBeCloseTo(1 / 30);
  expect(result.p50Ms).toBeGreaterThanOrEqual(0);
  expect(result.p95Ms).toBeGreaterThanOrEqual(result.p50Ms);
});
```

- [ ] **Step 2: Run the measurement test to verify failure**

Run: `pnpm --filter @workspace/web exec vitest run e2e/benchmark.spec.test.ts`

Expected: FAIL because `runSamples` does not exist.

- [ ] **Step 3: Implement measurement primitives and JSON evidence output**

Use `performance.now()` around each action. Execute five warm-ups without recording them, then 30 recorded samples. Sort successful durations ascending; use `sorted[Math.ceil(percentile * sorted.length) - 1]` for p50/p95. Divide failures by all 30 recorded samples. Write one timestamped JSON file containing revision from `git rev-parse HEAD`, command, dataset counts, test profile, environment fields excluding secrets, all measurements, and artifact path. Do not modify `docs/operations/production-baseline.md`.

- [ ] **Step 4: Implement authenticated benchmark groups**

Use `/api/auth/login` to obtain a token for every virtual user. Measure list/search reads, one representative mutation route, dashboard/payment summary request count and latency, and a fixed 10-user concurrent mix. Reseed before and after every mutation group through the guarded seed command; fail the group if reset fails.

Use the mobile profile specified in the global constraints through a Chromium CDP session. Record `browser.version()`, viewport, CPU rate, download/upload throughput, RTT, and profile name. Measure initial page load, route navigation, and the real initial/reconnect sync coordinator. Populate native IndexedDB through real sync, then measure the existing Customer and Vehicle local search paths independently.

Implement both sync scenarios:

- `target-1000`: reset to a temporary scenario with exactly 700 Customers, 50 Vehicles, and 250 Rentals; compare the resulting 1,000 changes to the <=30s target, then reseed the full pilot shape.
- `full-pilot`: exactly 1,550 changes for a tenant; label it representative/stress and record its actual count without asserting the 1,000-record target.

- [ ] **Step 5: Run unit tests and the benchmark test list**

Run: `pnpm --filter @workspace/web exec vitest run e2e/benchmark.spec.test.ts && pnpm --filter @workspace/web exec playwright test --config playwright.benchmark.config.ts --list`

Expected: PASS and the benchmark file is discoverable.

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e/benchmark.spec.ts apps/web/e2e/benchmark-results.ts apps/web/e2e/benchmark-fixtures.ts apps/web/e2e/benchmark.spec.test.ts apps/web/package.json
git commit -m "feat(benchmark): collect repeatable pilot measurements"
```

### Task 5: Document safe execution and record reviewed before-state evidence

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `docs/operations/production-baseline.md`
- Modify: `docs/testing/automated-test-plan.md`

**Interfaces:**
- Documents: required local-only benchmark environment and commands.
- Consumes: reviewed JSON artifacts from Task 4.

- [ ] **Step 1: Add safe benchmark configuration examples**

Document only variable names and redacted example values:

```bash
export NODE_ENV=benchmark
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public'
export BENCHMARK_DATABASE_URL="$DATABASE_URL"
export BENCHMARK_PASSWORD='<local-only-password>'
export JWT_SECRET='<local-only-at-least-32-characters>'
export REFRESH_TOKEN_SECRET='<local-only-at-least-32-characters>'
pnpm --filter @workspace/db run db:seed:benchmark
pnpm --filter @workspace/web run benchmark
```

State that the database must be created separately, must have an approved local `markab_benchmark` name, and that no production, staging, or development URL is permitted.

- [ ] **Step 2: Run one guarded seed and benchmark execution**

Run the commands from Step 1 only after the user has confirmed the local `markab_benchmark` database may be reset. Preserve the generated JSON artifact path and review that it contains all required metadata and no secret values.

- [ ] **Step 3: Record reviewed measurements manually**

Update `docs/operations/production-baseline.md` with the reviewed artifact path, command, revision, target comparison, actual sync count, methodology, result table, and known 500-request payment fan-out. Do not report the 1,550-row full-pilot run as a direct result against the 1,000-row target.

- [ ] **Step 4: Run final focused verification**

Run: `pnpm --filter @workspace/db exec tsx --test src/benchmark-target.test.ts src/benchmark-seed.test.ts && pnpm --filter @workspace/api-server exec vitest run src/config/env.test.ts && pnpm --filter @workspace/web exec vitest run e2e/benchmark.spec.test.ts && pnpm --filter @workspace/web run build`

Expected: all tests and the web production build PASS.

- [ ] **Step 5: Review final diff**

Run: `git diff --check && git status --short && git diff -- docs/operations/production-baseline.md`

Expected: no whitespace errors; documentation names the exact reviewed artifacts and keeps production/staging claims absent.

- [ ] **Step 6: Commit**

```bash
git add apps/api/.env.example docs/operations/production-baseline.md docs/testing/automated-test-plan.md
git commit -m "docs: record benchmark workflow and baseline"
```
