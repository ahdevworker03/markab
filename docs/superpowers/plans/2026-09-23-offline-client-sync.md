# Step 63 Offline Client Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a previously authenticated tenant user to reopen the web app offline, read/search synchronized customers and vehicles, queue the three approved mutations, and reconcile them safely after reconnect.

**Architecture:** Native IndexedDB is the durable tenant-local projection and outbox; React Query remains the online server-state cache. An authenticated tenant-only provider owns connectivity state, runs one FIFO sync cycle at a time through the existing generated `syncPush` and `syncPull` functions, and exposes truthful global synchronization state. The server API contract and generated packages remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, native IndexedDB, Vitest, Testing Library, existing generated API client and Zod types.

**Spec:** `docs/operations/production-baseline.md` (approved Step 57 offline matrix), `docs/development-milestones/6-production-readiness.md` (Step 63), and the user-approved Step 63 design in this session.

## Global Constraints

- PostgreSQL remains authoritative; IndexedDB is a tenant-local browser projection and durable queue, not a second authoritative domain system.
- Support only customer/vehicle offline reads and searches plus `CUSTOMER_CREATE`, `CUSTOMER_UPDATE`, and `RENTAL_CREATE` offline commands.
- Keep vehicle mutations, payments, expenses, maintenance, tasks, rental lifecycle operations, documents, media, contracts, platform administration, first login, password reset, and invitation flows online-only.
- Tenant scope is exactly `organizationId + userId`; never persist access or refresh tokens; `PLATFORM_OWNER` never initializes an offline database.
- The local projection change and its corresponding outbox write for each approved command occur in one IndexedDB transaction; a reload never observes only one side.
- Logout, account switching, confirmed revocation, and organization unavailability clear React Query/in-memory state and stop rendering/synchronization, but preserve the namespaced IndexedDB workspace and unsynchronized outbox until an explicit product decision permits destruction.
- Offline-created customers use a dedicated provisional `localId` derived from `operation_id`; that identifier is never sent as `customer_id`. Dependent rentals use `customer_create_operation_id`, and applying the authoritative customer replaces the provisional projection and references atomically.
- Do not edit `lib/api-spec`, `lib/api-client-react`, or `lib/api-zod`; use their existing generated standalone `syncPush` and `syncPull` functions.
- Push is FIFO, has at most 25 operations per request, and has no parallel dependent batches.
- Arabic UI text is RTL-first and conflict resolution remains explicit: discard or reapply with a fresh UUID and `current_customer.updatedAt`.
- Do not use `apps/web/src/data` or the React Query cache as persistent offline storage.

---

### Task 1: Tenant-Scoped IndexedDB Projection and Outbox

**Files:**
- Create: `apps/web/src/features/offline/storage.ts`
- Create: `apps/web/src/features/offline/storage.test.ts`
- Create: `apps/web/src/features/offline/types.ts`

**Interfaces:**
- Produces `OfflineWorkspace`, `{ organizationId: string; userId: string }`.
- Produces `OfflineStore` with `open(workspace)`, `getCustomers(workspace)`, `getCustomer(workspace, id)`, `getVehicles(workspace)`, `getVehicle(workspace, id)`, `applyPull(workspace, changes, completionCursor)`, `enqueue(workspace, operation)`, `listOutbox(workspace, limit)`, `getOutboxItem(workspace, operationId)`, `updateOutbox(workspace, operation)`, `removeOutbox(workspace, operationId)`, and `clearWorkspace(workspace)`.
- Produces `QueuedOperation`, which extends the generated `SyncOperation` payload with `createdAt`, `attempts`, `state`, and optional local projection metadata. It never contains tokens or file/blob data.
- Produces `ProvisionalCustomer`, `{ localId: `local:${operation_id}`; operationId: string; customer: CreateCustomerRequest }`; it is distinct from an authoritative server customer ID.

- [ ] **Step 1: Write failing storage tests**

```ts
it("does not return tenant A customers to tenant B", async () => {
  await store.applyPull(tenantA, [customerChange("customer-a")], "cursor-a");

  expect(await store.getCustomers(tenantB)).toEqual([]);
  expect(await store.getCustomers(tenantA)).toHaveLength(1);
});

it("persists FIFO outbox operations across a reopened database", async () => {
  await store.enqueue(tenantA, queuedCustomerCreate("first"));
  await store.enqueue(tenantA, queuedCustomerCreate("second"));
  await store.close();

  expect((await reopenedStore.listOutbox(tenantA, 25)).map((item) => item.operation_id))
    .toEqual(["first", "second"]);
});
```

- [ ] **Step 2: Run the storage tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- storage.test.ts`

Expected: FAIL because the offline storage module does not exist.

- [ ] **Step 3: Implement the minimal IndexedDB schema**

```ts
const databaseName = "markab-offline-v1";

type TenantRecord<T> = T & { tenantKey: string };

function tenantKey({ organizationId, userId }: OfflineWorkspace) {
  return `${organizationId}:${userId}`;
}
```

Create `customers`, `vehicles`, `rentals`, `outbox`, and `metadata` stores. Every record uses a compound key beginning with `tenantKey`; add only the indexes required for tenant-list lookup and FIFO outbox ordering. Apply pull changes transactionally, deleting tombstoned projections and storing `completion_cursor` only after the final page. Provide one transaction helper used by local-first commands to write the optimistic projection and queued operation together. When a customer create is applied, atomically replace its provisional `localId` record with the authoritative customer and rewrite dependent local rental references.

- [ ] **Step 4: Run storage tests to verify they pass**

Run: `pnpm --filter @workspace/web test -- storage.test.ts`

Expected: PASS, including tenant isolation, pull delete handling, cursor persistence, and FIFO reload persistence.

- [ ] **Step 5: Commit when requested**

```bash
git add apps/web/src/features/offline/storage.ts apps/web/src/features/offline/storage.test.ts apps/web/src/features/offline/types.ts
```

### Task 2: Offline Session Identity and Connectivity State

**Files:**
- Create: `apps/web/src/features/offline/session.ts`
- Create: `apps/web/src/features/offline/session.test.ts`
- Create: `apps/web/src/features/offline/OfflineProvider.tsx`
- Create: `apps/web/src/features/offline/OfflineProvider.test.tsx`
- Modify: `apps/web/src/providers/AuthProvider.tsx`
- Modify: `apps/web/src/providers/AuthProvider.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces `OfflineSessionIdentity`, `{ id; organizationId; role; organizationStatus }`, stored only after a successful authoritative current-user response.
- Produces `useOffline()` with `{ status, isOnline, pendingCount, syncNow, conflicts }`.
- `status` is one of `offline`, `pending`, `synchronizing`, `upToDate`, `failed`, `conflict`, `authenticationRequired`, or `organizationUnavailable`.
- `AuthProvider` must distinguish an unreachable server from a confirmed `401`/authoritative invalid session.

- [ ] **Step 1: Write failing identity and provider tests**

```tsx
it("keeps a validated tenant workspace available after an unreachable refresh", async () => {
  saveOfflineIdentity(tenantA);
  api.refreshToken.mockRejectedValue(new TypeError("Failed to fetch"));

  renderApp();

  expect(await screen.findByText("offline-workspace")).toBeInTheDocument();
});

it("does not initialize IndexedDB for a platform owner", async () => {
  renderOfflineProvider(platformOwner);

  expect(openWorkspace).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run identity/provider tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- session.test.ts OfflineProvider.test.tsx AuthProvider.test.tsx`

Expected: FAIL because no offline session identity or provider exists.

- [ ] **Step 3: Implement minimal identity and provider behavior**

```ts
window.addEventListener("online", syncNow);
window.addEventListener("offline", updateConnectivity);
```

Persist the identity only after a successful `getCurrentUser()` response. On a network failure, expose the saved tenant workspace without presenting it as a newly authenticated online session. On confirmed authentication failure, logout, or an account/tenant transition, clear React Query and in-memory workspace state, stop synchronization, and prevent rendering that workspace while preserving its namespaced IndexedDB data. Mount `OfflineProvider` only inside authenticated tenant routes, after `AuthProvider`; do not mount it on public or platform routes.

- [ ] **Step 4: Run identity/provider tests to verify they pass**

Run: `pnpm --filter @workspace/web test -- session.test.ts OfflineProvider.test.tsx AuthProvider.test.tsx`

Expected: PASS, including tenant switch, logout cleanup, reachable invalid session cleanup, unreachable-session preservation, and platform exclusion.

- [ ] **Step 5: Commit when requested**

```bash
git add apps/web/src/features/offline/session.ts apps/web/src/features/offline/session.test.ts apps/web/src/features/offline/OfflineProvider.tsx apps/web/src/features/offline/OfflineProvider.test.tsx apps/web/src/providers/AuthProvider.tsx apps/web/src/providers/AuthProvider.test.tsx apps/web/src/App.tsx
```

### Task 3: Single-Flight Push/Pull Coordinator

**Files:**
- Create: `apps/web/src/features/offline/sync.ts`
- Create: `apps/web/src/features/offline/sync.test.ts`
- Modify: `apps/web/src/features/offline/OfflineProvider.tsx`

**Interfaces:**
- Produces `createSyncCoordinator({ workspace, store, push: syncPush, pull: syncPull, onStatus })`.
- `syncNow(): Promise<void>` is single-flight and first flushes queued operations in FIFO batches of at most 25, then pulls every page until `next_cursor` is null.
- Produces conflict records only from `CONFLICT` + `SYNC_CUSTOMER_STALE`; other rejected/expired operations remain recoverable failed outbox records with their server result code.

- [ ] **Step 1: Write failing coordinator tests**

```ts
it("sends queued operations in one ordered batch of at most 25", async () => {
  await enqueueMany(26);
  await coordinator.syncNow();

  expect(push).toHaveBeenNthCalledWith(1, { operations: operations.slice(0, 25) });
  expect(push).toHaveBeenNthCalledWith(2, { operations: operations.slice(25) });
});

it("keeps a stale customer draft and records its authoritative server version", async () => {
  push.mockResolvedValue(staleCustomerResponse(operationId, serverCustomer));

  await coordinator.syncNow();

  expect(await store.getOutboxItem(workspace, operationId)).toMatchObject({ state: "conflict" });
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ status: "conflict" }));
});
```

- [ ] **Step 2: Run coordinator tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- sync.test.ts`

Expected: FAIL because no coordinator exists.

- [ ] **Step 3: Implement the narrow synchronization loop**

```ts
while (true) {
  const page = await pull(cursor ? { cursor } : undefined);
  await store.applyPull(workspace, page.changes, page.completion_cursor);
  if (!page.next_cursor) break;
  cursor = page.next_cursor;
}
```

Use generated standalone client functions rather than generated React hooks. Never run batches in parallel. Remove applied or duplicate outbox records only after their authoritative response is stored locally; retain failed/conflicted records. Prevent a second `syncNow()` from entering while the first is running. Do not retry authoritative authentication or organization-lifecycle failures as ordinary network failures.

- [ ] **Step 4: Run coordinator tests to verify they pass**

Run: `pnpm --filter @workspace/web test -- sync.test.ts`

Expected: PASS, including single-flight behavior, 25-item boundary, FIFO order, duplicate removal, paginated pull, tombstones, conflict retention, and retryable network failure retention.

- [ ] **Step 5: Commit when requested**

```bash
git add apps/web/src/features/offline/sync.ts apps/web/src/features/offline/sync.test.ts apps/web/src/features/offline/OfflineProvider.tsx
```

### Task 4: Local-First Customer and Vehicle Reads

**Files:**
- Modify: `apps/web/src/features/customers/api-hooks.ts`
- Modify: `apps/web/src/features/vehicles/api-hooks.ts`
- Create: `apps/web/src/features/offline/read-hooks.ts`
- Create: `apps/web/src/features/offline/read-hooks.test.tsx`
- Modify: `apps/web/src/features/customers/pages/CustomersPage.tsx`
- Modify: `apps/web/src/features/vehicles/pages/VehiclesPage.tsx`

**Interfaces:**
- Produces `useOfflineCustomersList(search?)`, `useOfflineCustomerRecord(id)`, `useOfflineVehiclesList(search?)`, and `useOfflineVehicleRecord(id)`.
- Online success writes validated response projections into IndexedDB; offline mode reads/searches only the matching tenant projection.

- [ ] **Step 1: Write failing read-hook tests**

```tsx
it("filters tenant-local customers while offline without calling the API", async () => {
  await store.applyPull(workspace, [customerChange("أحمد")], "cursor");
  renderHook(() => useOfflineCustomersList({ search: "أحمد" }), { wrapper: offlineWrapper() });

  expect(await screen.findByText("أحمد")).toBeInTheDocument();
  expect(listCustomers).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run read-hook tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- read-hooks.test.tsx`

Expected: FAIL because the local read hooks do not exist.

- [ ] **Step 3: Implement local projection reads without changing online behavior**

Use existing generated list/get hooks while online and mirror successful payloads to IndexedDB. When offline, return the same view-model shape required by current pages, with local `isLoading`/`isError` states and local in-memory refresh after a projection write. Search with the existing normalized page input against the entire local tenant projection; do not call the API or use mock data.

- [ ] **Step 4: Run read-hook tests to verify they pass**

Run: `pnpm --filter @workspace/web test -- read-hooks.test.tsx`

Expected: PASS, including offline search, online projection updates, tenant isolation, and unchanged online error/loading rendering.

- [ ] **Step 5: Commit when requested**

```bash
git add apps/web/src/features/customers/api-hooks.ts apps/web/src/features/vehicles/api-hooks.ts apps/web/src/features/offline/read-hooks.ts apps/web/src/features/offline/read-hooks.test.tsx apps/web/src/features/customers/pages/CustomersPage.tsx apps/web/src/features/vehicles/pages/VehiclesPage.tsx
```

### Task 5: Approved Local-First Commands and Conflict Recovery

**Files:**
- Create: `apps/web/src/features/offline/commands.ts`
- Create: `apps/web/src/features/offline/commands.test.ts`
- Create: `apps/web/src/features/offline/components/SyncStatus.tsx`
- Create: `apps/web/src/features/offline/components/CustomerConflictDialog.tsx`
- Create: `apps/web/src/features/offline/components/CustomerConflictDialog.test.tsx`
- Modify: `apps/web/src/features/customers/api-hooks.ts`
- Modify: `apps/web/src/features/customers/pages/AddCustomerPage.tsx`
- Modify: `apps/web/src/features/customers/pages/EditCustomerPage.tsx`
- Modify: `apps/web/src/features/rentals/pages/NewRentalPage.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`

**Interfaces:**
- Produces `queueCustomerCreate(data)`, `queueCustomerUpdate(customer, data)`, and `queueRentalCreate(data, customerReference)` from `useOfflineCommands()`.
- `queueCustomerUpdate` captures `expected_updated_at` from the current local customer projection.
- `reapplyCustomerConflict(operationId, currentCustomer)` creates a new UUID operation using the retained local draft and `currentCustomer.updatedAt`.

- [ ] **Step 1: Write failing command and conflict tests**

```ts
it("queues an offline customer update with the current revision", async () => {
  await commands.queueCustomerUpdate(customer, draft);

  expect(await store.listOutbox(workspace, 25)).toContainEqual(
    expect.objectContaining({
      type: "CUSTOMER_UPDATE",
      customer_update: expect.objectContaining({ expected_updated_at: customer.updatedAt }),
    }),
  );
});

it("reapplies a stale draft with a new operation id and server revision", async () => {
  await reapplyCustomerConflict(operationId, serverCustomer);

  expect(await store.getOutboxItem(workspace, operationId)).toBeUndefined();
  expect(await store.listOutbox(workspace, 25)).toContainEqual(
    expect.objectContaining({
      operation_id: expect.not.stringMatching(operationId),
      customer_update: expect.objectContaining({ expected_updated_at: serverCustomer.updatedAt }),
    }),
  );
});
```

- [ ] **Step 2: Run command and conflict tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- commands.test.ts CustomerConflictDialog.test.tsx`

Expected: FAIL because no local-first command layer or conflict dialog exists.

- [ ] **Step 3: Implement only the approved paths**

Customer create and update write a local optimistic projection plus exactly one durable operation in the same IndexedDB transaction before reporting success. Offline customer create uses `local:${operation_id}` only as a local projection identity; rental create queues the generated `rental_create.customer_reference`: use `customer_id` only for a synchronized server customer and `customer_create_operation_id` for a queued customer create. Never serialize the provisional identity as `customer_id`. Keep offline-created customer UI in the pending list rather than assuming a server record ID before reconciliation. Do not queue documents or perform document upload while offline; report that action as requiring connection.

Render `SyncStatus` in `AppShell` and use the existing Radix alert-dialog primitives for `CustomerConflictDialog`. Arabic copy must communicate the unsynced state, avoid pretending server save succeeded, and provide only “discard local changes” and “reapply my changes” actions.

- [ ] **Step 4: Run command and conflict tests to verify they pass**

Run: `pnpm --filter @workspace/web test -- commands.test.ts CustomerConflictDialog.test.tsx AddCustomerPage.test.tsx EditCustomerPage.test.tsx NewRentalPage.test.tsx`

Expected: PASS, including one queued operation per action, reload-safe pending state, customer-create/rental dependency serialization, no offline document upload, and conflict reapply behavior.

- [ ] **Step 5: Commit when requested**

```bash
git add apps/web/src/features/offline/commands.ts apps/web/src/features/offline/commands.test.ts apps/web/src/features/offline/components/SyncStatus.tsx apps/web/src/features/offline/components/CustomerConflictDialog.tsx apps/web/src/features/offline/components/CustomerConflictDialog.test.tsx apps/web/src/features/customers/api-hooks.ts apps/web/src/features/customers/pages/AddCustomerPage.tsx apps/web/src/features/customers/pages/EditCustomerPage.tsx apps/web/src/features/rentals/pages/NewRentalPage.tsx apps/web/src/components/layout/AppShell.tsx
```

### Task 6: Application Shell Cache and End-to-End Verification

**Files:**
- Create: `apps/web/public/service-worker.js`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/features/offline/service-worker.test.ts`
- Modify: `docs/testing/e2e-test-plan.md`
- Modify: `docs/testing/manual-test-plan.md`

**Interfaces:**
- The browser registers a versioned application-shell service worker after the first successful online load.
- The worker uses cache-first only for same-origin built application assets and navigation fallback; authenticated API responses are never cached by the worker.

- [ ] **Step 1: Write failing service-worker registration tests**

```ts
it("registers the application shell worker without caching API responses", async () => {
  renderMain();

  expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/service-worker.js");
  expect(workerSource).not.toContain("/api/");
});
```

- [ ] **Step 2: Run service-worker tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- service-worker.test.ts`

Expected: FAIL because the application does not register a worker.

- [ ] **Step 3: Implement the minimum application-shell cache**

Cache only the built shell, CSS, JavaScript, fonts, and same-origin static assets required to reopen the app after one successful online load. Version the cache with the build asset manifest or application build revision and delete older shell caches during activation. Never cache `/api/`, authorization headers, generated documents, uploads, or user-specific HTML responses. Ensure a schema-version mismatch enters a safe reinitialization path rather than silently combining incompatible local records.

- [ ] **Step 4: Add executable/manual verification coverage**

Document and implement focused browser scenarios for: online seed then offline reopen; customer and vehicle local search; one offline customer create/edit and rental create; reload with queued work; reconnect and duplicate-safe reconciliation; stale customer conflict discard/reapply; tenant logout/switch isolation; and suspended/deleted account reconnect handling.

- [ ] **Step 5: Run the relevant verification**

Run: `pnpm --filter @workspace/web test -- service-worker.test.ts`

Run: `pnpm --filter @workspace/web typecheck`

Run: `pnpm --filter @workspace/web build`

Expected: PASS. Execute the documented browser offline matrix before declaring Step 63 complete.

- [ ] **Step 6: Commit when requested**

```bash
git add apps/web/public/service-worker.js apps/web/src/main.tsx apps/web/vite.config.ts apps/web/src/features/offline/service-worker.test.ts docs/testing/e2e-test-plan.md docs/testing/manual-test-plan.md
```

## Verification Checklist

- [ ] Run `pnpm --filter @workspace/web test`.
- [ ] Run `pnpm --filter @workspace/web typecheck`.
- [ ] Run `pnpm --filter @workspace/web build`.
- [ ] Run `git diff --check` and inspect the final diff, preserving unrelated task-page and screenshot work.
- [ ] Verify the app shell reopens offline after a previous online load without a service-worker API cache.
- [ ] Verify two tenant workspaces cannot read each other’s IndexedDB data, including after logout and account switch, while each prior workspace's durable outbox remains preserved and inaccessible to the other account.
- [ ] Verify only the three approved offline commands queue and reconcile; every other mutation remains explicitly online-only.
- [ ] Verify a stale customer conflict never silently overwrites the server and reapply uses a fresh operation UUID plus `current_customer.updatedAt`.
