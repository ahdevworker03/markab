# Step 64 API/DB/Resource Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce guarded local evidence for pilot API latency, PostgreSQL plans, and bounded workload resources.

**Architecture:** Reuse the existing Playwright benchmark for HTTP measurements and artifact output. Add only benchmark-side operation coverage and collect database plans through read-only SQL against the approved local database.

**Tech Stack:** Playwright, TypeScript, PostgreSQL, Prisma, Node.js.

**Spec:** `docs/superpowers/specs/2026-10-01-step-64-api-db-resource-evidence-design.md`

## Global Constraints

- Use only local `markab_benchmark` through the existing guard.
- Do not change production behavior, API contracts, schema, migrations, indexes, or deployment.
- Use five warmups and 30 recorded samples.

### Task 1: Extend benchmark evidence

**Files:**
- Modify: `apps/web/e2e/benchmark.spec.ts`
- Test: `apps/web/e2e/benchmark.spec.test.ts`

- [ ] Add tenant-scoped reads for rentals, maintenance, expenses, and tasks using the existing `runSamples` helper.
- [ ] Record HTTP status and response payload metrics in the existing JSON artifact shape.
- [ ] Run focused benchmark-helper tests and type/lint/format checks.

### Task 2: Capture database and resource evidence

**Files:**
- Create: `apps/web/e2e/benchmark-db-evidence.ts`
- Modify: `apps/web/e2e/benchmark.spec.ts`

- [ ] Add read-only query-plan capture for measured slow query shapes.
- [ ] Capture bounded API/PostgreSQL process and connection observations around the existing ten-user group.
- [ ] Run the guarded benchmark, inspect plans, and classify gates without optimization.
