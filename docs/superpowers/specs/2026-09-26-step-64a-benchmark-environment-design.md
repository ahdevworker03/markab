# Step 64A Benchmark Environment Design

## Goal

Provide a reproducible, isolated pilot-scale environment and measurement workflow that captures Markab's before-state performance without changing application behavior.

## Scope

The benchmark dataset contains two active tenant organizations. Each tenant has:

- 50 vehicles
- 1,000 customers
- 500 rentals

The dataset includes representative vehicle and rental statuses, due amounts, and recent records so list, search, dashboard, payment, and sync paths exercise realistic shapes. Tenant records remain strictly isolated.

The benchmark workload supports up to 10 concurrent users total and covers:

- Authenticated API reads and searches
- Authenticated API mutations
- Initial web load and navigation
- Initial and reconnect synchronization
- Native-browser IndexedDB Customer and Vehicle searches

## Architecture

`lib/db/src/seed.ts` remains the single seed entry point. Its existing development and test behavior remains available outside benchmark mode. Benchmark construction is an explicit branch selected only when `NODE_ENV=benchmark` and `BENCHMARK_DATABASE_URL` is set. The benchmark branch validates both target URLs before importing or initializing the shared Prisma client and requires normalized `DATABASE_URL` to equal normalized `BENCHMARK_DATABASE_URL`.

The seed creates real `User` records with Argon2 password hashes. Benchmark consumers use the existing `/api/auth/login` flow and normal bearer-token requests. No benchmark-only authentication endpoint, bypass, or embedded credential is introduced.

A dedicated benchmark command starts the existing API and the built web application with the benchmark configuration, executes deterministic representative requests, and emits a machine-readable result artifact. A developer reviews that artifact before recording concise approved results in `docs/operations/production-baseline.md`; the runner never modifies the authoritative baseline document.

## Interfaces

### Environment

- `BENCHMARK_DATABASE_URL` is required by benchmark seeding and measurement commands.
- `BENCHMARK_PASSWORD` is required by benchmark seeding and measurement commands and is never logged.
- `BENCHMARK_DATABASE_URL` must parse as a PostgreSQL URL whose hostname is exactly `localhost`, `127.0.0.1`, or `::1`.
- The URL database name must match `markab_benchmark` or `markab_benchmark_<suffix>` exactly; a substring match is insufficient.
- Benchmark commands require `NODE_ENV=benchmark` and reject every other value, including `production`.
- The guard runs before importing or using the shared Prisma module. It normalizes both URLs and requires the `DATABASE_URL` Prisma will use to equal the validated `BENCHMARK_DATABASE_URL` target.
- A non-local or staging target is out of scope until separately approved and its exact host allowlist is added deliberately.

### Seed

- The benchmark branch is idempotent: it removes only data from the dedicated benchmark database, then recreates the fixed two-tenant dataset. Non-benchmark seed behavior is unchanged.
- It prints non-secret tenant login email addresses and dataset counts; `BENCHMARK_PASSWORD` is required from the environment and never logged.
- The seeded owners are valid users of their own organizations and invalid for the other tenant's records.
- Direct Prisma construction preserves domain invariants: every relation belongs to its tenant; rental dates and state are valid; rentals for the same vehicle do not overlap; active/reserved rentals match the vehicle status; and money is written through Decimal-safe values.
- Payments use a deterministic mix of fully paid, partially paid, and unpaid rentals with valid payment dates and positive Decimal-safe amounts. Payment-summary/dashboard measurements therefore do not rely on an artificial all-unpaid dataset.

### Measurement

- API measurements authenticate normally and record latency, status/error counts, and request names.
- Mutating measurement groups reset the benchmark dataset before the group and after the group, so no mutation changes the input shape of a later group.
- Browser measurements use the built web app and real API, with a fresh browser storage context per run.
- IndexedDB measurements populate the native browser store from benchmark data, then time Customer and Vehicle search paths independently.
- API and browser timing use `performance.now()`. Each group performs five unrecorded warm-up iterations, then records 30 samples; p50 and p95 use the nearest-rank value over successful samples, and error rate is failed samples divided by all recorded samples.
- The concurrent API group uses 10 authenticated users total with a fixed mix of representative read/search and mutation requests. Per-request and aggregate results remain separate.
- The `mid-range-mobile-4g` browser profile uses Chromium at a 393x852 viewport, device scale factor 2, 4x CPU throttling, and simulated 4G at 1.6 Mbps download, 750 Kbps upload, and 150 ms round-trip latency. The result also records browser name/version, actual viewport, CPU/network throttling, and profile name.
- Results record the exact command, date, source revision, environment, dataset shape, concurrency, timing method, sample count, p50, p95, maximum, error rate, and the output-artifact path.

### Sync Scenarios

Step 63 synchronizes Customer, Vehicle, and Rental resources. A complete pilot tenant therefore has approximately 1,550 synchronized rows, not the approved approximately 1,000-record initial-sync target.

- The `target-1000` scenario uses a separate temporary seed shape of 700 customers, 50 vehicles, and 250 rentals for exactly 1,000 synchronized rows and compares its result directly with the <=30-second target. The full-pilot dataset is reseeded afterward.
- The `full-pilot` scenario synchronizes the actual full tenant volume and records its exact resource count as a larger representative/stress result; it is not reported as a direct pass/fail against the 1,000-record target.

## Acceptance Criteria

- A contributor can create or reset only the dedicated local benchmark database through a documented command.
- Safety guards reject unsafe database URLs before any destructive Prisma operation.
- The deterministic seed produces exactly 2 organizations, 100 vehicles, 2,000 customers, and 1,000 rentals with two real owner accounts.
- A benchmark run uses real login, API, web, sync, and IndexedDB code paths.
- The result artifact is preserved for review before `docs/operations/production-baseline.md` is updated.
- Mutation groups and sync scenarios begin from a known dataset shape.
- Measurements can be repeated on the same revision and environment and are recorded as before-state data against the pilot targets.
- Existing application behavior, API contracts, Prisma schema, and production data remain unchanged.

## Non-Goals

- No performance optimization, index, cache, queue, worker, Redis, aggregate endpoint, or production deployment.
- No production-data access or destructive command against a development or production database.
- No benchmark-only API endpoint or authentication bypass.
- No claim that local measurements represent production capacity.

## Risks And Constraints

- The current payment dashboard hook performs one rental-payment request per rental. At 500 rentals, that can add about 500 requests. This is a before-state measurement subject, not part of this implementation.
- The current Playwright setup serves a static web build and lacks a real API/bootstrap lifecycle. The benchmark runner must add only the lifecycle required for these measurements.
- Device and simulated-4G measurements depend on a locally available browser and cannot be claimed unless run successfully in that environment.
