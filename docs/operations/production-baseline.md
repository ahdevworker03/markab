# Production Baseline

## Purpose

This record is the approved Step 57 baseline for Milestone 6. It fixes the
production decisions later steps depend on without changing application,
schema, API, or deployment behavior.

The governing product scope remains `docs/product/02-business-requirements.md`;
the approved deployment topology remains
`docs/architecture/09-deployment.md`.

## Entry Gate

Milestone 5.8 is closed. Its completion checklist records Step 56 and final
human product QA as complete. Its remaining work is limited to the explicitly
planned Milestone 6 items below; it transfers no unresolved P0 or P1
tenant-frontend defect.

| Objective                                                    | Current state                             | Milestone 6 disposition                                                   |
| ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| Tenant business modules and lifecycle gate                   | Implemented                               | Regression protection in Steps 58 and 66                                  |
| Platform status action and audit                             | Implemented                               | Add discovery, frontend boundary, and bootstrap in Step 60                |
| Password-reset token lifecycle                               | Implemented; delivery is a test-only sink | Add Resend delivery in Step 59                                            |
| Private file metadata and local provider abstraction         | Implemented for development               | Add R2 provider and production hardening in Step 61                       |
| Offline operation                                            | Product requirement only                  | Define server protocol in Step 62 and client projection/outbox in Step 63 |
| Production configuration, image, compose, health, operations | Partial development foundation            | Complete in Steps 61 and 65                                               |
| Browser E2E                                                  | Plan only                                 | Add a narrow executable suite in Step 66                                  |
| Performance evidence                                         | Not yet captured                          | Baseline and resolve measured blockers in Steps 64 and 66                 |
| Deferred Version 3 work                                      | Not in scope                              | Do not implement in Milestone 6                                           |

## Approved Topology

The approved production topology is confirmed without adding services:

| Component           | Approved deployment                                                                     |
| ------------------- | --------------------------------------------------------------------------------------- |
| Frontend            | React, TypeScript, and Vite on Cloudflare Pages and CDN                                 |
| API                 | Node.js, Express, Prisma, and Docker on a Hetzner VPS in Nuremberg                      |
| Database            | PostgreSQL on the same VPS, private to the application environment                      |
| Runtime             | Docker Compose, including the API, PostgreSQL, and reverse proxy/runtime infrastructure |
| Object storage      | Private Cloudflare R2 through the existing storage-provider boundary                    |
| Edge                | Cloudflare DNS, proxy, TLS, DDoS protection, and edge rate limiting                     |
| Transactional email | Resend, using a verified sender identity and controlled frontend reset origin           |

The first pilot starts at approximately 4 vCPU, 8 GB RAM, and 80 GB storage.
PostgreSQL remains authoritative. The frontend remains independently deployable
and is not hosted from the VPS. No cache, queue, worker, broker, search engine,
or additional database is approved for this pilot.

Production PostgreSQL is co-located with the production API on the approved Hetzner VPS. Staging uses an isolated PostgreSQL database and configuration and must not share production data; its exact infrastructure placement may be selected during Step 65 as long as isolation is preserved.

## Platform Owner Model

### Decision

`PLATFORM_OWNER` users will belong to one dedicated internal platform
organization. The internal organization is not a client tenant and must never
be returned by tenant organization discovery or granted tenant-business access.

### Basis

The current Prisma model requires `User.organization_id`, the access-token
contract requires an `org` claim, and tenant middleware already explicitly
rejects `PLATFORM_OWNER`. Making the relation nullable would require a broader
authentication, token, relation, and tenant-context redesign without a current
benefit.

### Implementation Constraints

- Step 60 creates or resolves the internal organization only from the
  production-only bootstrap command.
- Tenant provisioning, tenant user creation, invitations, role mutation, and
  normal seed data cannot create or promote a `PLATFORM_OWNER`.
- The internal organization is excluded from platform client-organization
  list, search, detail, and lifecycle actions.
- The bootstrap command is idempotent, fails on conflicting email/role state,
  hashes its discarded initial secret, and triggers the approved password-reset
  delivery path instead of exposing a reusable password.

### Bootstrap Procedure

Run the command only in the production API environment, after migrations and
the production password-reset email configuration have been verified:

```sh
NODE_ENV=production pnpm --filter @workspace/api-server bootstrap:platform-owner -- --email <email>
```

The command refuses non-production execution, normalizes the supplied email,
and never prints a password or reset token. A successful first run creates the
dedicated `internal_key = "platform"` organization, records one
`PLATFORM_OWNER_BOOTSTRAPPED` audit event, and sends the normal reset
activation email. A repeat with the same email is safe and sends a replacement
activation email; a conflicting active platform owner or an email assigned to
another account fails without replacing that account.

## Offline Operation Matrix

The following matrix is the approved Version 2 offline scope. It supersedes
the broader illustrative examples in `docs/architecture/08-offline-first.md`
where they conflict.

| Operation                                                                   | Offline disposition | Conflict rule                                                                                                      |
| --------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Open after a prior successful online authentication                         | Supported           | Session and local-data validity remain server-controlled after reconnect                                           |
| View previously synchronized approved data                                  | Supported           | Pull reconciles authoritative updates and deletes                                                                  |
| Search customers                                                            | Supported           | Search the tenant-local projection only                                                                            |
| Search vehicles                                                             | Supported           | Search the tenant-local projection only                                                                            |
| Create customer                                                             | Supported           | Idempotent command; duplicate server outcome is returned safely                                                    |
| Create rental                                                               | Supported           | Server rechecks tenant ownership, role, lifecycle, customer/vehicle state, and availability; no client-side winner |
| Edit existing customer                                                      | Supported           | Server revision mismatch returns a conflict with authorized current data                                           |
| Edit existing vehicle                                                       | Online only         | Not in approved offline scope                                                                                      |
| Edit existing rental fields                                                 | Not approved        | Online only until a specific safe edit contract is approved                                                        |
| Queue approved local mutations                                              | Supported           | Persistent ordered outbox with stable mutation identity                                                            |
| Synchronize after reconnect                                                 | Supported           | Retry is idempotent; failed/conflicting items remain recoverable                                                   |
| Vehicle creation                                                            | Online only         | Not in approved offline scope                                                                                      |
| Payments, expenses, maintenance, tasks                                      | Online only         | Not in approved offline scope                                                                                      |
| Rental pickup, return, extension, cancellation, or other lifecycle commands | Online only         | High-conflict availability/financial behavior remains server-mediated                                              |
| Files, photos, PDF/contract generation, download                            | Online only         | External/private-object operations are excluded                                                                    |
| First login, logout recovery, password reset, invitations, Platform Admin   | Online only         | Authentication or external-service operations are excluded                                                         |

Step 62 must choose a stable identity strategy that allows an offline-created customer to be referenced by dependent queued operations without temporary-ID ambiguity. The implementation may use client-generated UUIDs, server reconciliation identifiers, or another inspected minimal mechanism, but the client/server identity contract must be explicit and duplicate-safe.

## Password Reset And Object Storage

Step 59 uses Resend behind `deliverPasswordReset`. The API constructs the
one-time HTTPS reset URL from a validated deployment configuration; callers
cannot supply a redirect. The sender identity must be verified before staging
or production release. Request responses remain generic for known, unknown,
deactivated, and provider-failure cases. Provider failures are redacted and
observable without logging raw reset tokens.

Set `RESEND_API_KEY`, `RESEND_FROM`, `PASSWORD_RESET_FRONTEND_ORIGIN`, and
`PASSWORD_RESET_FRONTEND_PATH` in the staging and production secret stores.
Production startup rejects missing or invalid reset-email configuration; test
uses the in-memory delivery sink and sends no email. Verify the sender domain
in Resend before deployment. Rotate the API key in the secret store, restart
the API with the replacement key, and revoke the old key only after a
controlled staging reset succeeds. Investigate delivery failures through the
redacted `provider: "resend"` diagnostics and Resend delivery records; do not
add reset URLs, tokens, API keys, or recipient addresses to application logs.

Step 61 implements private Cloudflare R2 through the existing
`StorageProvider` abstraction. R2 stores production uploads and off-server
PostgreSQL backups. The application retains authenticated server-side
authorization and tenant checks before object retrieval; R2 objects are not
public.

Step 61 also requires production startup to reject local storage, placeholder
or incomplete database, JWT/refresh, CORS, Resend, and R2 configuration. Set
`STORAGE_PROVIDER=r2` and all four R2 values in the deployment secret store;
the existing R2 client uses Cloudflare's account endpoint and `auto` region,
so no separate R2 endpoint or region setting is configured. Development and
test continue to use local storage. API traffic trusts exactly one Caddy
reverse proxy in production. The API's process-local public and upload rate
limits supplement, rather than replace, Cloudflare edge limits; each API
instance has its own counters, so Cloudflare must coordinate the production
edge policy.

Upload metadata is persisted only after the object is stored. If metadata
creation fails, the API deletes that exact new object and logs any cleanup
failure while returning the original persistence error. Missing metadata-backed
objects return `FILE_NOT_FOUND`. Soft-deleted objects remain retained; operators
must investigate cleanup-failure logs and reconcile orphaned or missing objects
against database metadata before any permanent deletion process is run.

## Pilot Capacity And Performance Gates

All measurements use a warm staging environment with production-like API and
PostgreSQL configuration, the normal production build, no artificial
Redis/cache layer, and this representative dataset:

- Two tenant organizations.
- Fifty vehicles, 1,000 customers, and 500 rentals per organization.
- Up to ten concurrent users total.
- A representative mid-range mobile device and simulated 4G connection for
  frontend measurements.

| Area                                         | Gate                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Normal API read/list/detail                  | P95 at or below 500 ms                                                     |
| Customer and vehicle search API              | P95 at or below 500 ms                                                     |
| Normal create/update mutation                | P95 at or below 800 ms                                                     |
| Representative workload error rate           | Below 1%, excluding intentional validation and business-conflict responses |
| Initial usable application load              | At or below 3 seconds without depending on a cached application session    |
| Normal post-load navigation                  | Usable content at or below 1 second                                        |
| Initial sync of about 1,000 relevant records | At or below 30 seconds                                                     |
| Reconnect sync with a small normal queue     | At or below 10 seconds                                                     |
| Offline IndexedDB customer/vehicle search    | At or below 300 ms for the representative local dataset                    |

The UI must remain responsive, queued operations must not be lost, and the
representative workload must not sustain CPU or memory saturation, create
unbounded request fan-out, or cause query growth disproportionate to the
dataset. Step 64 records measurements and addresses only demonstrated
bottlenecks.

## Recovery And Release Ownership

| Area               | Approved decision                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup cadence     | Daily automated PostgreSQL backup to private Cloudflare R2                                                                                                              |
| Retention          | Retain 30 daily backups                                                                                                                                                 |
| RPO                | 24 hours                                                                                                                                                                |
| RTO                | 4 hours                                                                                                                                                                 |
| Restore evidence   | Restore a backup into an isolated staging database, run migration status, and perform authenticated smoke checks before production approval and periodically thereafter |
| Release authority  | Project owner/operator approves staging promotion and production go/no-go                                                                                               |
| Incident ownership | Project owner/operator owns initial incident coordination, customer communication, rollback/recovery decision, and post-incident record                                 |

Step 65 implements the backup, restore, deployment, and runbook procedures.
No production launch is approved until the first successful restore rehearsal,
provider/DNS/secret permission walkthrough, and production-like staging smoke
test are recorded.

## Threat Inventory

| Surface                                            | Primary exposure                                                                              | Required disposition                                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public auth, refresh, reset, and invitation routes | Credential stuffing, enumeration timing, reset-token disclosure, refresh replay               | Step 58 corrects identity/session consistency; Step 59 preserves generic delivery behavior; Step 61 adds scoped rate limits and validated configuration           |
| Tenant APIs                                        | Cross-tenant access, malformed identifiers, non-operational organizations, stale cached data  | Step 58 validates UUIDs, normalizes request failures, and clears/partitions tenant data; server authorization remains authoritative                               |
| Platform APIs and bootstrap                        | Unauthorized role creation, client-tenant disclosure, bootstrap secret exposure               | Step 60 uses the dedicated internal organization, platform-only endpoints, audited operational command, and reset activation                                      |
| Offline browser data and outbox                    | Shared-device disclosure, stale edits, replay, duplicate rental                               | Steps 62-63 define tenant-scoped projection, encrypted/appropriate browser-storage decision, stable mutation identities, revisions, conflicts, and reconciliation |
| Upload and download paths                          | MIME spoofing, resource exhaustion, object guessing, cross-tenant retrieval, orphaned objects | Step 61 validates signatures, bounds resources, implements private R2, and defines object reconciliation                                                          |
| Email links                                        | Host-header/redirect injection, unverified sender, raw token in logs                          | Step 59 builds links from controlled origin and redacts provider diagnostics                                                                                      |
| Secrets and deployment controls                    | Placeholder credentials, public database, over-privileged provider access, unpatched image    | Step 61 fails closed on production configuration; Step 65 applies least privilege, image/dependency/secret scanning, private database networking, and runbooks    |

The Step 58 and 61 items above are production blockers. Version 3 work,
including MFA, OAuth, billing, notifications, queues, Redis, and broad
platform tooling, is explicitly excluded.

## Exit Evidence

Step 57 is complete when the repository entry checks, empty-database migration
rehearsal, baseline bundle/request/timing capture, provider-permission
walkthrough, and required operator/product approvals are recorded. The current
repository does not yet have provider credentials, deployed staging resources,
or executable browser E2E infrastructure; those are later-step implementation
deliverables and not evidence that this decision record changes application
behavior.

### Recorded Entry Validation

Recorded on 2026-09-04 from the clean pre-Step-57 worktree:

| Check                                                     | Result                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                               | Passed: 239 API tests and 281 web tests                                                                         |
| `pnpm typecheck`                                          | Passed                                                                                                          |
| `pnpm lint`                                               | Passed                                                                                                          |
| `pnpm build`                                              | Passed; Vite emitted existing source-map resolution and over-500 kB chunk warnings                              |
| `prettier --check docs/operations/production-baseline.md` | Passed                                                                                                          |
| `git diff --check`                                        | Passed                                                                                                          |
| OpenAPI code generation                                   | Passed after deterministic Orval output normalization; two consecutive runs leave generated artifacts unchanged |

### Empty-Database Migration Rehearsal

Recorded on 2026-09-05 against local Docker PostgreSQL 16.14. The existing
local test topology (`postgresql://postgres@localhost:5432`) was used, but a
separate database named `vehicle_rental_step57_rehearsal` was created for this
rehearsal. The normal development, test, staging, and production databases
were not used.

| Evidence                     | Result                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty-state verification     | The new database had zero `public` tables and no `_prisma_migrations` table before deployment                                                                                                                       |
| Migration command            | `DATABASE_URL=<rehearsal URL> pnpm --filter @workspace/db exec prisma migrate deploy`                                                                                                                               |
| Committed migrations applied | 32, from `20260808171411_init` through `20260901161000_normalize_task_title_backfill`                                                                                                                               |
| Final migration status       | `prisma migrate status` reported `Database schema is up to date!`                                                                                                                                                   |
| Schema compatibility         | `prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma --exit-code` reported `No difference detected.`                                                                                      |
| Prisma schema validation     | Passed                                                                                                                                                                                                              |
| Task recurrence cutover      | The incompatible recurrence migration and its two Task-title follow-ups applied from zero; final `Task` columns include non-null `title` and `occurrence_number`, plus nullable recurrence interval/unit/end fields |
| API smoke test               | Not run: the existing API test suite hard-codes `vehicle_rental_test` and is not a safe mechanism for this temporary database                                                                                       |
| Cleanup                      | `DROP DATABASE vehicle_rental_step57_rehearsal` succeeded and a post-drop query confirmed the database no longer exists                                                                                             |

Prisma emitted only its routine notice that version 8.0.0-rc.13 is available;
no migration warning or repair was required.

### Staging Provisioning Assessment

Recorded on 2026-09-05 from this workspace. No staging resource was created,
changed, or claimed as verified. The available evidence is insufficient to
safely perform provider-side provisioning.

| Area                  | Verified result                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare access     | Neither `wrangler` nor `cloudflared` is installed, the repository has no Cloudflare Pages or Wrangler configuration, and no Cloudflare MCP resource is connected.                                                                                                                       |
| Hetzner access        | `hcloud` is not installed. SSH is available, but the only resolved host is `localhost`; no staging VPS host or SSH target is configured.                                                                                                                                                |
| Deployment automation | No `.github/workflows` deployment workflow, Cloudflare deployment configuration, reverse-proxy configuration, or deploy script exists in the repository.                                                                                                                                |
| API container         | `pnpm --filter @workspace/api-server run build` passed. Two non-interactive `docker build --no-cache --file apps/api/Dockerfile ... .` builds passed after the build context excluded host `node_modules`; the locked dependency installation remains `pnpm install --frozen-lockfile`. |
| API runtime           | A minimal container start exited with `ERR_MODULE_NOT_FOUND` for `argon2`; the final runner stage does not contain that externalized runtime dependency. This is separate from the resolved non-interactive builder failure and remains a Step 65 runtime-image limitation.             |
| Compose baseline      | `docker compose --file apps/api/docker-compose.yml config` passed, but the rendered configuration publishes PostgreSQL on host port `5432`, uses the development `postgres` password, and sets `NODE_ENV=development`. It is not acceptable staging configuration.                      |
| Application readiness | The repository exposes `GET /api/healthz`, which returns `{ "status": "ok" }`. It does not validate database, storage, or configuration readiness. The storage provider remains local filesystem only.                                                                                  |

The following operator-owned inputs are required before staging provisioning can
continue:

- Cloudflare account access for a dedicated Pages project, private R2 bucket,
  scoped R2 credentials, and staging DNS/TLS records.
- Hetzner project access for a dedicated Nuremberg staging VPS, its SSH target,
  and firewall/network configuration that leaves PostgreSQL private.
- Approved isolated staging hostnames, database name and credentials, R2 bucket
  name and credentials, frontend API origin, and non-production JWT/refresh
  secrets in a secure secret store.
- A reviewed staging Compose/runtime configuration that does not publish
  PostgreSQL, does not embed credentials, starts a reverse proxy with HTTPS,
  and includes all runtime dependencies required to start the API image.

These are blockers for provider walkthrough, HTTPS reachability, migration on
staging, secret loading, R2 reachability, database privacy, and authenticated
staging smoke evidence. They are documented here rather than bypassed with
development credentials or a public database.

### Pending External Evidence

- Capture staging API P50/P95, error rate, request count/payload, Core Web
  Vitals, native IndexedDB search, initial/reconnect synchronization, and
  database query-plan measurements against the representative pilot dataset.
- Walk through Cloudflare, Hetzner, R2, Resend, DNS, TLS, backup, restore, and
  secret-management permissions with the project owner/operator.
- Confirm the documented offline matrix with a representative pilot rental
  business user before implementing synchronization.

### Step 64 Local Measurement Baseline

Recorded on 2026-09-26 from this workspace. This was a measurement-only pass;
it made no application, schema, API, index, or infrastructure changes.

| Area                                | Evidence                                                                                                                                                       | Result                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved pilot profile              | Two organizations; each with 50 vehicles, 1,000 customers, and 500 rentals; up to 10 concurrent users; mid-range mobile device and simulated 4G                | Recovered from this record; required for target-bearing measurements                                                                                                                                                                                                                                                                                  |
| Web production build                | `pnpm --filter @workspace/web run build`                                                                                                                       | Passed in 4.95 s locally; emitted one 1,374.03 kB minified JavaScript chunk (370.52 kB gzip), 127.12 kB CSS (20.58 kB gzip), and Vite's over-500 kB chunk warning. Step 57 defines no bundle-size gate, so this requires investigation rather than a gate failure.                                                                                    |
| Offline unit coverage               | `pnpm --filter @workspace/web exec vitest run src/features/offline/storage.test.ts src/features/offline/sync.test.ts src/features/offline/read-hooks.test.tsx` | Passed: 35 tests in 1.95 s. These tests use a hand-written IndexedDB fake and are not a native-browser/device search benchmark.                                                                                                                                                                                                                       |
| Dashboard/analytics request fan-out | Static inspection of `apps/web/src/features/payments/hooks.ts`                                                                                                 | Failed the milestone requirement that pilot pages do not have unbounded request fan-out: `useOrgOutstandingBalances` creates one rental-payment request per rental. At the approved 500 rentals, dashboard and analytics each add 500 per-rental requests before accounting for their other data requests. Latency/payload impact remains unmeasured. |
| Local database suitability          | Read-only tenant record counts in `vehicle_rental`                                                                                                             | Not representative: no tenant approaches the approved 50 vehicles, 1,000 customers, and 500 rentals. It must not be used to classify API, sync, search, or query-plan performance.                                                                                                                                                                    |

At the time of this 2026-09-26 entry, the repository had Vite production
builds, Vitest, a narrow static-only Playwright service-worker configuration,
and a local PostgreSQL 16.14 container, but no representative-data seed or
authenticated benchmark environment. Step 64A added a local-only runner;
there is still no production-like staging environment.

At the time of that entry, the following target-bearing measurements were
unavailable rather than estimated: API read/search/mutation P95 and error rate; initial usable load and
post-load navigation on the approved mobile/4G profile; initial/reconnect sync;
native IndexedDB customer/vehicle search; high-value-page request counts and
payloads; database `EXPLAIN (ANALYZE, BUFFERS)` on representative paths; and
CPU/memory/connection saturation under ten concurrent users. Establish a
deterministic two-tenant seed and isolated authenticated API/browser environment
before collecting them. The partial local follow-up is recorded below.

### Step 64A — original guarded local before-state attempt (2026-09-28)

**Status: BLOCKED.** The dedicated local `markab_benchmark` database was explicitly approved for resets. No development, staging, production, or real customer database was used. The working tree was uncommitted; `git rev-parse HEAD` was `7c79dd3cbafb4662314debccbde42f04653b238a`, which alone does not identify the uncommitted benchmark implementation. This is local evidence, not production capacity proof.

The exact benchmark scripts were `pnpm --filter @workspace/db run db:seed:benchmark` followed by `pnpm --filter @workspace/web run benchmark`. After the first full attempt, focused reruns used `pnpm --filter @workspace/web run benchmark --grep 'benchmark API'`, `--grep 'measures real login, navigation'`, `--grep 'measures target-1000 initial sync'`, and `--grep 'measures full-pilot sync'`. Each run supplied `NODE_ENV=benchmark`, matching `DATABASE_URL` and `BENCHMARK_DATABASE_URL` pointing to local `markab_benchmark`, local-only benchmark owner password and JWT/refresh secrets, `STORAGE_PROVIDER=local`, and a locally installed Chromium executable. The runner built Vite with `VITE_API_URL=http://127.0.0.1:3001`, started the real Express API on port 3001, served the built web app on 4174, and used `/api/auth/login`. Secrets were generated for the local process and were not written to the artifacts.

Full-pilot seed: two active tenants, each 1,000 Customers, 50 Vehicles, 500 Rentals; 666 payments overall. The guarded target profile produced 700 Customers, 50 Vehicles, and 250 Rentals for the measured tenant. The authenticated sync-count checks accepted exactly **1,000** target resources and **1,550** full-pilot resources; the guarded database integration test also reseeded full-pilot after target and verified the approved full row totals.

Reviewed machine-readable evidence (ignored by Git):

- API, 2026-09-28T13:50:02Z: `apps/web/test-results/benchmark/2026-09-28T13-50-02.252Z.json`
- Browser partial, 2026-09-28T13:46:45Z: `apps/web/test-results/benchmark/2026-09-28T13-46-45.968Z.json`
- Original browser/sync failure snapshot: `apps/web/test-results/benchmark-benchmark-mobile-4fa98-ect-sync-and-local-searches/error-context.md`. The original JSON artifacts above and the blocker description below preserve the before-fix evidence; focused Playwright failure snapshots in the runner's output directory were replaced by later runs.

Each completed group used five unrecorded warm-ups and 30 recorded samples, `performance.now()`, nearest-rank P50/P95 of successful samples, maximum successful duration, and failed/30 error rate. API groups used real authenticated requests; mutation groups reset the dedicated data before and after. The browser profile was Chrome 153.0.8010.52, 393×852, DPR 2, 4× CPU, 1.6 Mbps down, 750 Kbps up, 150 ms latency, simulated cellular 4G. Browser initial-load samples used fresh storage contexts and waited for visible login content; post-load navigation clicked the real in-app links and waited for visible headings.

| Area / local gate                                                         |        P50 / P95 / max (ms) | Errors | Classification                                                                          |
| ------------------------------------------------------------------------- | --------------------------: | -----: | --------------------------------------------------------------------------------------- |
| Customer list / <=500 ms P95                                              |          12.9 / 16.7 / 18.0 |   0/30 | PASS                                                                                    |
| Vehicle list / <=500 ms P95                                               |            5.5 / 7.8 / 11.5 |   0/30 | PASS                                                                                    |
| Customer detail / <=500 ms P95                                            |             4.0 / 7.6 / 9.1 |   0/30 | PASS                                                                                    |
| Vehicle detail / <=500 ms P95                                             |           4.6 / 10.6 / 15.1 |   0/30 | PASS                                                                                    |
| Customer API search / <=500 ms P95                                        |           8.7 / 13.6 / 14.8 |   0/30 | PASS                                                                                    |
| Vehicle API search / <=500 ms P95                                         |             5.1 / 7.5 / 8.7 |   0/30 | PASS                                                                                    |
| Customer create / <=800 ms P95                                            |             4.2 / 5.5 / 6.0 |   0/30 | PASS                                                                                    |
| Ten authenticated users, mixed reads/search/create / <1% error rate       |          46.9 / 61.2 / 62.7 |   0/30 | PASS                                                                                    |
| Rental-payment fan-out group / no standalone latency gate                 | 1,942.5 / 2,162.9 / 2,237.5 |   0/30 | INVESTIGATE                                                                             |
| Fresh browser login route usable / <=3,000 ms initial load                | 3,253.6 / 3,275.3 / 3,287.1 |   0/30 | FAIL for the measured login route; authenticated dashboard load not separately measured |
| In-app Customer/Vehicle heading visibility / <=1,000 ms usable navigation |       123.2 / 148.8 / 154.1 |   0/30 | INVESTIGATE: heading visible; list content readiness not measured                       |
| Initial sync, target-1000 / <=30,000 ms                                   |        No completed samples |      — | FAIL: terminal pull never observed; 1,000 rows verified, latency gate not measurable    |
| Initial sync, full-pilot (1,550; no 1,000-row gate)                       |        No completed samples |      — | INVESTIGATE: representative/stress run blocked; no target comparison                    |
| Reconnect sync with small normal queue / <=10,000 ms                      |                  No samples |      — | INVESTIGATE: initial sync blocker prevents queue/reconnect coverage                     |
| Native IndexedDB Customer/Vehicle search / <=300 ms                       |                  No samples |      — | INVESTIGATE: initial sync blocker prevents a populated local projection                 |

The authenticated payment fan-out group completed **501 HTTP requests per sample**: one rental-list request and 500 successful per-rental payment requests. This is observed from the real API group, not a measured dashboard-render request trace. The dashboard hook is statically known to make the same per-rental calls; its actual UI request count and payload bytes remain blocked by browser/sync coverage. The navigation result measures visible headings, not usable list content. The reconnect harness does not yet create a small queued offline mutation, and a future successful sync run must also prove client application to IndexedDB after the final HTTP response before the sync gate can be classified. No bundle-size pass/fail gate was invented.

**Blocker:** the real `/api/sync/pull` responded 200 with 100 changes and a further cursor, but no next pull followed; both target-1000 and full-pilot isolated runs failed waiting for the final pull. Code-path inspection shows the API wraps the response in `{ data: ... }` (`apps/api/src/shared/response.ts`), while the generated `syncPull` returns that body and `apps/web/src/features/offline/sync.ts` reads `page.changes` and `page.next_cursor` directly. This is a candidate product contract mismatch, not a benchmark latency result. Application sync behavior was not changed in this measurement task. The first full attempt also lacked the Playwright-required Chromium revision; the follow-up used local Chrome, whose version is recorded above. Resolve the sync contract and rerun the complete browser/offline suite before closing Step 64A or selecting a Step 64 optimization slice.

### Step 64A — corrected synchronization rerun (2026-09-29)

**Final status: COMPLETE for the requested before-state measurements; the failing performance gates remain open.** The OpenAPI contract defines bare `SyncPullResponse` and `SyncPushResponse` bodies. The backend sync controller had applied the generic `{ data: ... }` success envelope even though the generated client performs no unwrapping. The controller now emits the documented bare bodies, and the client coordinator rejects malformed pull pages before applying changes or reporting success. The original failed artifacts above remain the historical before-fix evidence.

The focused corrected commands were `pnpm --filter @workspace/web run benchmark --grep 'target-1000 initial sync'`, `--grep 'full-pilot sync'`, `--grep 'native IndexedDB searches'`, and `--grep 'one queued customer per sample'`, with the same guarded local environment and browser profile. The runner obtained bounded real access tokens outside measured samples to avoid measuring the 30-request login limiter repeatedly; it fulfilled each fresh browser context's login response with that token, after which the app authenticated `/me` and used the generated sync client against the real API. These reruns do not measure real login latency. Sync completion required the expected Customer, Vehicle, and Rental counts to be present in IndexedDB after the final pull response.

Reviewed corrected evidence (ignored by Git):

- Target-1000 initial sync: `apps/web/test-results/benchmark/2026-09-29T04-59-16.078Z.json`
- Full-pilot initial sync and earlier empty-outbox reconnect: `apps/web/test-results/benchmark/2026-09-29T05-28-20.131Z.json`
- Native IndexedDB searches: `apps/web/test-results/benchmark/2026-09-29T05-31-28.306Z.json`
- Reconnect with one queued customer per sample: `apps/web/test-results/benchmark/2026-09-29T06-19-56.276Z.json`

The full-pilot artifact contains complete 30/30 initial-sync and reconnect groups. Its enclosing Playwright test later failed during the first Customer-search warm-up because a strict text selector matched three responsive DOM representations; the completed groups remain valid. The selector was narrowed, and only the search slice was rerun into the separate search artifact. No application performance optimization was made.

| Corrected area / local gate                         |           P50 / P95 / max (ms) | Errors | Classification                                                                                           |
| --------------------------------------------------- | -----------------------------: | -----: | -------------------------------------------------------------------------------------------------------- |
| Initial sync, target-1000 / <=30,000 ms             | 20,275.1 / 20,314.9 / 20,335.5 |   0/30 | PASS; exactly 700 Customers, 50 Vehicles, and 250 Rentals applied to IndexedDB                           |
| Initial sync, full-pilot (1,550; no 1,000-row gate) | 31,917.3 / 32,019.5 / 32,023.2 |   0/30 | RECORDED separately; exactly 1,000 Customers, 50 Vehicles, and 500 Rentals applied; no target comparison |
| Reconnect, one queued Customer create / <=10,000 ms | 15,846.5 / 16,114.2 / 16,129.1 |   0/30 | FAIL; outbox drained and local Customer count advanced after each reconnect                              |
| Original Customer search (invalidated boundary)     |             30.5 / 36.0 / 37.4 |   0/30 | INVALIDATED; visible row could predate the query                                                         |
| Original Vehicle search (invalidated boundary)      |          215.6 / 417.1 / 430.5 |   0/30 | INVALIDATED; visible row could predate the query                                                         |

The earlier no-pending-mutation reconnect measured P50/P95/max **15,676.7 / 15,836.2 / 15,972.2 ms**, but it does not satisfy the approved queued-mutation scenario. The corrected reconnect fixture staged one normal `CUSTOMER_CREATE` record and optimistic Customer projection in the native IndexedDB outbox before each timed reconnect, matching the approved offline queue shape; it verified the outbox was drained and the expected Customer count was applied after the final pull. This tests sync replay, not the UI form used to create an offline customer. A timed-out fixture attempt produced an empty artifact (`2026-09-29T06-07-24.996Z.json`) and is not a measurement.

The correctness blocker is closed and all requested blocked slices now have evidence. The reconnect and Vehicle-search target failures, the prior login-route load failure, and the 501-request payment fan-out are candidate Step 64 performance work; they were not optimized here.

### Step 64 Slice 1 — CDP reconnect fixture correction (2026-09-29)

The original reconnect result of P50/P95/max **15,846.5 / 16,114.2 /
16,129.1 ms** remains preserved above as invalidated measurement evidence. Its
fixture used `context.setOffline(true/false)`, which confounded the reconnect
timing with Chromium's offline-emulation transition: a focused profile showed
the queued push held for **14,592.20 ms** before network transmission, while
server-side push processing was **12.46 ms** and pull processing was **6.41
ms**. It was therefore not valid evidence for a production sync optimization.

The reconnect fixture now holds the existing Chromium CDP session and uses
`Network.emulateNetworkConditions` for both offline and restored states,
reapplying the same 4G latency and throughput profile. It retains the explicit
browser `online` event because CDP restoration alone does not emit it. The
focused browser check proves that CDP offline blocks a real browser request and
that restoration permits it. Each reconnect sample verifies exactly one
successful `/api/sync/push`, exactly one successful final `/api/sync/pull`,
outbox drain, removal of the provisional local Customer, and the authoritative
Customer count in IndexedDB.

Reviewed corrected evidence (ignored by Git):

- One-sample CDP profile:
  `apps/web/test-results/benchmark/2026-09-29T08-57-20.584Z.json`
- Five-warmup, 30-sample CDP reconnect run:
  `apps/web/test-results/benchmark/2026-09-29T09-08-43.465Z.json`

The one-sample CDP profile still reported **14,565.61 ms** before the push
began transmission. The corrected fixture therefore removes the
`context.setOffline()` dependency but demonstrates that the local
Chromium-emulation transition itself retains the artificial pre-request delay.
No production `OfflineProvider`, sync coordinator, API, retry, idempotency, or
conflict behavior was changed.

| Corrected area / local gate                         |           P50 / P95 / max (ms) | Errors |                    Request count | Classification                                                   |
| --------------------------------------------------- | -----------------------------: | -----: | -------------------------------: | ---------------------------------------------------------------- |
| Reconnect, one queued Customer create / <=10,000 ms | 15,889.6 / 16,563.1 / 16,942.7 |   0/30 | 1 push + 1 final pull per sample | FAIL under Chromium emulation; not attributed to production sync |

The corrected P95 remains over 10 seconds, and the required profile confirms
the same browser-emulation delay. Stop before proposing application
optimization; Vehicle search, payment fan-out, and initial-load work remain
out of this slice.

### Step 64 Slice 1 — online application-sync control (2026-09-29)

This control measures application synchronization latency only, not a real
offline-to-online reconnect. It starts from an authenticated online session,
stages the same normal `CUSTOMER_CREATE` outbox record and optimistic Customer
projection in IndexedDB, and starts timing immediately before the explicit
browser `online` event. No Playwright or CDP network state is changed.

The control preserves the normal coordinator path and verifies exactly one
successful push, one final pull, outbox drain, provisional Customer removal,
the authoritative Customer count in IndexedDB, and synchronized completion.
It must not be used as a reconnect gate result.

Reviewed control evidence (ignored by Git):

- One-sample phase profile:
  `apps/web/test-results/benchmark/2026-09-29T09-31-26.822Z.json`
- Five-warmup, 30-sample control:
  `apps/web/test-results/benchmark/2026-09-29T09-34-40.356Z.json`

| Application-sync control   |  P50 / P95 / max (ms) | Errors | Classification                          |
| -------------------------- | --------------------: | -----: | --------------------------------------- |
| One queued Customer create | 531.4 / 563.5 / 597.9 |   0/30 | PASS for local application-sync latency |

The one-sample control measured **545.59 ms** total coordinator-to-completion:
the coordinator took 87.85 ms before push dispatch; push request/response was
177.06 ms with 9.70 ms server processing; push reconciliation before pull was
14.96 ms; pull request/response was 157.43 ms with 4.40 ms server processing;
and final IndexedDB application, cursor/status completion was 108.17 ms.

The application-sync path is locally below the ten-second target. The real
browser connectivity-restoration gate is **UNRESOLVED / LOCAL-BENCHMARK-
BLOCKED**: both `context.setOffline()` and CDP offline restoration retain the
same artificial roughly 14.5-second Chromium pre-transmission stall. A genuine
offline-to-online measurement remains required against production-like staging
in Step 65 or 66 before the reconnect gate can be marked PASS. No production
sync optimization is justified by these local measurements.

### Step 64 reconnect validation disposition (2026-10-01)

**Status: DEFERRED PENDING STAGING.** The local Chromium/CDP reconnect result
was P50/P95/max **15,889.6 / 16,563.1 / 16,942.7 ms**, failing the <=10-second
gate. This is invalid evidence for a product optimization: approximately 14.5
seconds occurs before push transmission during connectivity restoration. The
online application-sync control passed at **531.4 / 563.5 / 597.9 ms**. No
reconnect product optimization is justified. The final gate requires the
existing queued-Customer-create scenario against production-like staging with a
real network interruption and restoration; staging is currently unavailable.

### Step 64 Slice 2 — local-search gate and interaction evidence (2026-09-29)

**A. Authoritative IndexedDB/local-search gate (<=300 ms).** The browser uses
the built web app, full-pilot tenant projection (1,000 Customers and 50
Vehicles), native IndexedDB, and the mid-range mobile/4G/4x CPU profile. Each
sample starts immediately before the real offline hook calls its store method
and ends after the same hook maps, filters, and sorts its result, before React
state is updated. The benchmark-only probe associates that interval with the
next rendered search generation. Each sample verifies one readonly transaction,
one tenant-index `getAll`, the expected row count, and zero API requests. Five
warmups precede 30 recorded samples per entity. This excludes input, debounce,
React rendering, and Playwright observation.

Reviewed gate artifact (ignored by Git):
`apps/web/test-results/benchmark/2026-09-29T14-49-38.282Z.json`.

| Local search / <=300 ms P95 | P50 / P95 / max (ms) | Errors | Rows per read | Transactions / `getAll` per sample | Classification |
| --------------------------- | -------------------: | -----: | ------------: | ---------------------------------: | -------------- |
| Customer                    | 36.2 / 329.8 / 350.4 |   0/30 |         1,000 |                              1 / 1 | FAIL           |
| Vehicle                     |   14.8 / 35.1 / 37.8 |   0/30 |            50 |                              1 / 1 | PASS           |

At this before-state, Customer failed the local-search gate; Vehicle passed.

**B. End-to-end search interaction / UX observations (no 300 ms gate).** A
separate corrected input-to-render benchmark waits for the exact normalized
debounced term at a higher completion-marker generation, after the new result
renders. These measurements include the intentional 300 ms debounce, list
rendering, and browser observation. Reviewed artifact (ignored by Git):
`apps/web/test-results/benchmark/2026-09-29T12-04-56.557Z.json`.

| Interaction observation |        P50 / P95 / max (ms) | Errors |
| ----------------------- | --------------------------: | -----: |
| Customer                | 3,336.1 / 3,990.5 / 4,191.5 |   0/30 |
| Vehicle                 |       791.0 / 975.6 / 976.1 |   0/30 |

These UX observations may motivate separate responsive-render investigation;
they are not evidence that the IndexedDB gate failed. No separate approved
input-to-render target is defined here.
The retained benchmark marker exposes only a generation number; each current
sample also verifies its expected fixture result count and corresponding hook
invocation. The earlier artifact used the normalized term in the benchmark-only
marker; its measurements remain historical observations.

**C. Invalidated historical search measurements.** The original Customer
**30.5 / 36.0 / 37.4 ms** and Vehicle **215.6 / 417.1 / 430.5 ms**
(P50/P95/max) remain in the earlier table. Their generic visible-row selector
could succeed before a new search finished, so neither classifies the local
gate. No production search, storage, schema, API, or backend behavior changed
during the boundary-correction pass.

**D. Customer local-search loading-state correction.** Two additional guarded
five-warmup/30-sample Customer runs reproduced the before-state P95 failure:
**35.2 / 390.5 / 396.8 ms** and **31.6 / 359.7 / 385.3 ms** (P50/P95/max;
0/30 errors in each). Their narrow-result reads repeatedly waited about
300–380 ms for the same 1,000-row IndexedDB `getAll` that completed in about
15–29 ms following a small result. A Chromium trace showed that the hook's
`isLoading(true)` transition replaced the previous 1,000-result Customer list
(2,000 card articles plus table rows) with its skeleton while `getAll` was
pending. Main-thread JavaScript occupied most of the slow callback window;
waiting for browser idle before the next search did not prevent the transition.
GC, layout, and paint were not the dominant cost.

The offline Customer and Vehicle list hooks now retain already-loaded results
for an in-place search within the same workspace instead of entering the
blocking loading state. Initial reads and workspace changes still show loading,
and workspace-key gating prevents the prior tenant's data from being exposed.
The latest active read still replaces the old result; errors continue to be
reported. No schema, index, sync, API, debounce, or search predicate changed.

Reviewed after-state artifacts (ignored by Git): the first post-change run
`apps/web/test-results/benchmark/2026-09-29T15-47-15.508Z.json` and the final
checkpoint run with a generation-only benchmark marker
`apps/web/test-results/benchmark/2026-09-29T15-59-22.585Z.json`. The first
post-change run measured Customer **21.4 / 93.2 / 98.4 ms** and Vehicle
**4.3 / 9.7 / 10.1 ms** (P50/P95/max), with 0/30 errors each. The final
checkpoint results are:

| Local search / <=300 ms P95 | Before P50 / P95 / max (ms) | After P50 / P95 / max (ms) | After errors | After rows / transactions / `getAll` | Final classification |
| --------------------------- | --------------------------: | -------------------------: | -----------: | -----------------------------------: | -------------------- |
| Customer                    |        36.2 / 329.8 / 350.4 |         29.2 / 86.2 / 91.7 |         0/30 |                        1,000 / 1 / 1 | PASS                 |
| Vehicle                     |          14.8 / 35.1 / 37.8 |          4.3 / 13.1 / 14.6 |         0/30 |                           50 / 1 / 1 | PASS                 |

Exact unrounded final artifact values (P50/P95/max, ms): Customer
`29.19999998807907 / 86.19999998807907 / 91.70000000298023`; Vehicle
`4.299999997019768 / 13.099999994039536 / 14.599999994039536`.

No final-run Customer sample reached 100 ms; the alternating slow-result
pattern was not observed in the 30 recorded samples. The interaction/UX figures
in section B remain before-state observations, not a new <=300 ms UX gate.

### Step 64 Slice 3 — payment fan-out before-state diagnostic (2026-09-30)

The guarded local `markab_benchmark` target was validated before reset; both
database URLs pointed to that local database. Node 22.16.0 and pnpm 11.15.0
(the CI pnpm version) ran the benchmark with a built web app, real API and
hooks, two seeded tenants (each 1,000 customers, 50 vehicles, 500 rentals;
666 payments overall), the mobile/4G/4× CPU profile, and a fully synchronized
1,550-record projection. Login, initial sync and their API traffic were
excluded from the navigation window. All credentials were ephemeral process
values. The earlier Rentals-only diagnostic was run unchanged apart from an
assertion that all 500 payment requests returned HTTP 200; its result was
503 requests, 500 successful payment requests, 35,483 ms to cleared payment
placeholders, 975,405 response bytes (392,131 payment bytes), 501 peak
initiated/pending requests, and payment-response P50/P95 10,209/21,352 ms.

The same single-run diagnostic then exercised Rentals, Dashboard and Analytics
through real navigation. Each page initiated 500 rental-payment requests,
waited for its actual payment placeholders or outstanding-balance value,
verified all 500 completed with HTTP 200, and reported:

| Page      | API requests | Payment completed / successful / failed | Financial content usable (ms) | Approx. total / payment response bytes | Peak initiated/pending | Payment response P50 / P95 (ms) | Browser request-start delay P95 (ms) |
| --------- | -----------: | --------------------------------------: | ----------------------------: | -------------------------------------: | ---------------------: | ------------------------------: | -----------------------------------: |
| Rentals   |          503 |                           500 / 500 / 0 |                        30,540 |                      975,405 / 392,131 |                    501 |                 13,936 / 15,271 |                               11,818 |
| Dashboard |          507 |                           500 / 500 / 0 |                        17,183 |                    1,059,181 / 392,131 |                    500 |                  6,622 / 12,513 |                               11,872 |
| Analytics |          506 |                           500 / 500 / 0 |                        18,111 |                    1,058,599 / 392,131 |                    500 |                  6,534 / 12,512 |                               11,865 |

The response-byte values are Playwright's response body plus headers, not
wire-level transfer accounting. The request-start delay comes from browser
timing, **not** measured server queue time. Payment P50/P95 describe the 500
requests within each single page visit, **not** repeated page-load samples or
a page P95. This is diagnostic evidence of unbounded request fan-out and slow
financial readiness at the pilot volume, not a performance-gate classification
or production-like staging measurement. The existing
`useOrgOutstandingBalances` starts one authoritative rental-payment request
per rental on all three pages; no application optimization was made in this
slice. A tenant-scoped bounded Payment-domain summary remains a design
candidate, subject to contract and financial-parity tests.

### Step 64 Slice 3 — bounded payment summary implementation (2026-09-30)

**Status: COMPLETE for the measured payment fan-out optimization. Step 64 as a
whole remains open.** The additive authenticated
`GET /api/payments/outstanding-balances` contract returns per-rental IDs,
customer IDs, total/paid/outstanding amounts, the signed organization total,
and positive per-customer outstanding totals. It does not return payment
history or accept a tenant identifier. Existing payment-read authorization
and operational-organization checks apply, including denial of platform owners.

The Payment repository performs two bulk data reads in a repeatable-read
transaction: non-deleted tenant rentals and tenant payments grouped by rental,
excluding deleted payments and deleted/foreign rentals. The Payment service
calculates all balances and totals with Decimal arithmetic. Zero-payment,
RETURNED and CANCELLED rentals remain included; legacy overpayments remain
negative. Organization totals include those signed balances, while customer
totals sum only positive per-rental balances, matching the prior selectors.
There is no query per rental, schema change, index, cache, or new infrastructure.

Dashboard, Analytics and Rentals use one generated summary query. Analytics
retains the existing rental-list read for revenue-by-vehicle joins but no longer
calculates outstanding totals in frontend JavaScript. Rental Detail retains
its single-rental payment-history query. Payment creation and rental creation/
lifecycle success invalidate the summary alongside existing invalidations.
No payment update/delete frontend mutation paths currently exist.

The after-state command was
`pnpm --filter @workspace/web run benchmark --grep 'diagnoses real finance page request fan-out|measures bounded outstanding summary'`.
It used the same guarded local database, full-pilot dataset, Node 22.16.0,
pnpm 11.15.0, Chrome 153.0.8010.52 and mobile/4G/4× CPU profile as the
before-state diagnostic. Login and initial synchronization stayed outside
the navigation window. A setup request finishing after observation started
exposed a diagnostic counter defect in the first after-state attempt; only
tracked requests now decrement the counter. The corrected complete run passed.

| Page      | Before → after API requests | After summary HTTP 200 / failures | Before → after financial readiness (ms) | After summary response (ms) | Before → after approx. total response bytes |
| --------- | --------------------------: | --------------------------------: | --------------------------------------: | --------------------------: | ------------------------------------------: |
| Rentals   |                     503 → 4 |                             1 / 0 |                         30,540 → 10,843 |                       1,876 |                           975,405 → 692,136 |
| Dashboard |                     507 → 8 |                             1 / 0 |                          17,183 → 2,519 |                       2,172 |                         1,059,181 → 775,912 |
| Analytics |                     506 → 7 |                             1 / 0 |                          18,111 → 3,703 |                       2,241 |                         1,058,599 → 775,330 |

All 4/8/7 observed API requests respectively returned HTTP 200, and all had
response-size measurements. Each page made zero per-rental payment requests
and exactly one completed summary request. Summary response size was
108,862 bytes, replacing 392,131 bytes of rental-payment responses per page.
Peak initiated/pending requests were 4/8/7 respectively. Summary browser
request-start delays were 0.410/4.630/2.238 ms respectively; these are three
individual observations, not P95 values or measured server queue times.

The separate unthrottled authenticated API summary benchmark used five warmups
and 30 recorded successful samples: P50/P95/max **15.9 / 20.6 / 21.2 ms**,
zero errors, one summary request per sample. The historical raw API fan-out
group used 501 requests per sample and measured **1,942.5 / 2,162.9 / 2,237.5
ms**. These API-only groups are distinct from navigation-to-financial-readiness
and must not be compared directly to page timings. Page results remain
single-visit diagnostics rather than page P95 or navigation-gate proof.

Reviewed after-state artifacts (ignored by Git) under
`apps/web/test-results/benchmark/`:

- API samples: `2026-09-30T10-24-35.204Z.json`.
- Rentals: `slice3-rentals-2026-09-30T10-24-19.034Z.json`.
- Dashboard: `slice3-dashboard-2026-09-30T10-24-25.453Z.json`.
- Analytics: `slice3-analytics-2026-09-30T10-24-33.004Z.json`.

Verification: focused payment API and frontend consumer tests, full API suite
(351 tests), full web suite (446 tests), workspace typecheck, targeted ESLint,
normal OpenAPI code generation and deterministic generated-output checks,
API/web production builds, changed-file formatting and `git diff --check`.
The web build retains its existing sourcemap and large-chunk warnings. React
Doctor reported 87/100 with existing Analytics/large-page warnings; no unrelated
UI refactor was included.

Remaining Step 64 candidates are initial usable load/route-bundle work, long-list
rendering and payload cost (notably remaining Rentals readiness), broader
report/analytics fetches, media behavior, representative query-plan and resource
measurements, and real connectivity-restoration validation blocked by local
Chromium emulation. No additional slice was implemented. The one-second
navigation gate and production-like staging release evidence remain open.

### Step 64 API/DB/resource evidence (2026-10-01)

**Status: COMPLETE.** Guarded local measurements used the approved two-tenant
`markab_benchmark` dataset and five warmups plus 30 recorded samples. Customer,
vehicle, rental, maintenance, expense, task, outstanding-summary, and detail
reads, both search paths, and Customer creation all passed their applicable API
P95 gates. The ten-user mixed workload passed with a 0% error rate.

The ten-user resource sample recorded API CPU at **19.2%**, API RSS at
**264,048 KB**, and **11** active/peak database connections. PostgreSQL CPU/RSS
were unavailable because the local host did not expose matching database backend
OS processes to `ps`; this is an observability limitation, not saturation
evidence. Read-only `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence is stored
in `apps/web/test-results/benchmark/query-plans.json`; the Customer search used
`Customer_organization_id_idx`, and no plan justified an index or query change.
No backend or database optimization is justified by this evidence.
