# Step 64 API/DB/Resource Evidence Design

## Goal

Collect representative, local-only API, query-plan, and resource evidence before any backend or database optimization.

## Scope

- Extend `apps/web/e2e/benchmark.spec.ts` using the existing guarded seed, authentication, warmup/sample, and artifact flow.
- Measure tenant-scoped list/detail/search/mutation operations and the existing ten-user workload.
- Run read-only PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against `markab_benchmark` for the slowest measured query shapes.
- Record process and connection observations without changing API behavior, contracts, schema, indexes, or deployment.

## Safety

The benchmark may reset only the approved local `markab_benchmark` database. Query-plan commands are read-only. No production behavior or database design changes are in scope.
