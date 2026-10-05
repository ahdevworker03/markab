import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Request,
} from "@playwright/test";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  BENCHMARK_LABEL_PREFIX,
  NET_WRAPPER,
  STAGING_API_ORIGIN,
  STAGING_WEB_ORIGIN,
  assertAllowedStagingUrl,
  assertBenchmarkCgroup,
  assertBenchmarkRole,
  isAllowedStagingOrigin,
  nearestRank,
  readStagingReconnectConfig,
} from "./staging-reconnect-guard";

const execFileAsync = promisify(execFile);
const config = readStagingReconnectConfig(process.env);
const runId = Date.now().toString(36);
const labelPattern = new RegExp(
  `^${BENCHMARK_LABEL_PREFIX}[a-z0-9]+-(w|r)\\d+$`,
);
const unrelatedUrl = "https://example.com/";
const gateMs = 10_000;
const artifactDirectory = resolve(
  import.meta.dirname,
  "../test-results/staging-reconnect",
);

type Probe = { ok: boolean; status?: number; error?: string };
type SyncEvent = {
  path: "/api/sync/push" | "/api/sync/pull";
  startedMs: number;
  endedMs: number;
  status: number | null;
  error: string | null;
  finalPull?: boolean;
};
type OfflineState = {
  outboxTotal: number;
  outboxPending: number;
  queuedOperationId: string | null;
  reconciliationRequired: boolean;
  provisionalPresent: boolean;
  authoritativeMatches: number;
};
type Cycle = {
  index: number;
  kind: "warmup" | "recorded";
  label: string;
  success: boolean;
  durationMs: number | null;
  error: string | null;
  timeline: Record<string, number | null>;
  probes: Record<string, Probe>;
  checks: Record<string, boolean>;
  evidence: Record<string, unknown>;
};

// Every block is mirrored by an unblock here, in globalTeardown, in the
// runner's shell trap, and by the wrapper's fail-safe timer.
let blocked = false;
process.once("exit", () => {
  if (blocked) unblockSync();
});

function unblockSync(): void {
  try {
    execFileSync("sudo", ["-n", NET_WRAPPER, "unblock"], {
      stdio: "ignore",
      timeout: 30_000,
    });
    blocked = false;
  } catch {
    console.error(`STAGING_RECONNECT_UNBLOCK_FAILED: run 'sudo ${NET_WRAPPER} unblock'.`);
  }
}

async function net(command: "block" | "unblock" | "status"): Promise<string> {
  const { stdout } = await execFileAsync("sudo", ["-n", NET_WRAPPER, command], {
    timeout: 30_000,
  });
  return stdout;
}

async function block(): Promise<void> {
  blocked = true;
  await net("block");
}

async function unblock(): Promise<void> {
  await net("unblock");
  blocked = false;
}

async function netState(): Promise<"blocked" | "unblocked"> {
  return (await net("status")).includes("state=blocked")
    ? "blocked"
    : "unblocked";
}

function firstLine(error: unknown): string {
  return String(error instanceof Error ? error.message : error).split("\n")[0]!;
}

async function nodeProbe(
  request: APIRequestContext,
  url: string,
): Promise<Probe> {
  try {
    const response = await request.get(url, {
      timeout: 10_000,
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    return { ok: true, status: response.status() };
  } catch (error) {
    return { ok: false, error: firstLine(error) };
  }
}

async function browserProbe(
  page: Page,
  url: string,
  mode: RequestMode = "cors",
): Promise<Probe> {
  return page.evaluate(
    async ({ url, mode }) => {
      try {
        const response = await fetch(url, { cache: "no-store", mode });
        return { ok: true, status: response.status };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    },
    { url, mode },
  );
}

async function apiLogin(request: APIRequestContext): Promise<string> {
  const response = await request.post(
    assertAllowedStagingUrl(`${STAGING_API_ORIGIN}/api/auth/login`).href,
    { data: { email: config.email, password: config.password } },
  );
  if (!response.ok()) {
    throw new Error(`Staging benchmark login failed with ${response.status()}.`);
  }
  const body = (await response.json()) as { data?: { accessToken?: string } };
  const token = body.data?.accessToken;
  if (!token) throw new Error("Staging benchmark login returned no token.");
  const me = await request.get(
    assertAllowedStagingUrl(`${STAGING_API_ORIGIN}/api/auth/me`).href,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!me.ok()) {
    throw new Error(`Staging benchmark role check failed with ${me.status()}.`);
  }
  assertBenchmarkRole(
    ((await me.json()) as { data?: { role?: unknown } }).data?.role,
  );
  return token;
}

async function findBenchmarkCustomers(
  request: APIRequestContext,
  token: string,
  search: string,
): Promise<Array<{ id: string; nationalId: string }>> {
  const url = assertAllowedStagingUrl(
    `${STAGING_API_ORIGIN}/api/customers?search=${encodeURIComponent(search)}`,
  );
  const response = await request.get(url.href, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    throw new Error(`Customer search failed with ${response.status()}.`);
  }
  const body = (await response.json()) as {
    data: Array<{ id: string; nationalId: string }>;
  };
  return body.data.filter(
    (customer) =>
      customer.nationalId.startsWith(search) &&
      labelPattern.test(customer.nationalId),
  );
}

async function deleteBenchmarkCustomers(
  request: APIRequestContext,
  search: string,
): Promise<Record<string, unknown>> {
  const token = await apiLogin(request);
  const found = await findBenchmarkCustomers(request, token, search);
  const failures: string[] = [];
  for (const customer of found) {
    const response = await request.delete(
      assertAllowedStagingUrl(
        `${STAGING_API_ORIGIN}/api/customers/${customer.id}`,
      ).href,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.status() !== 204) {
      failures.push(`${customer.nationalId}: ${response.status()}`);
    }
  }
  const remaining = await findBenchmarkCustomers(request, token, search);
  return {
    search,
    found: found.length,
    deleted: found.length - failures.length,
    failures,
    remaining: remaining.length,
  };
}

async function readOfflineState(
  page: Page,
  nationalId: string,
): Promise<OfflineState> {
  return page.evaluate(readOfflineStateInPage, nationalId);
}

// Runs in the browser. Reads the application's own IndexedDB projection.
function readOfflineStateInPage(nationalId: string): Promise<OfflineState> {
  return new Promise((resolvePromise, reject) => {
    const open = indexedDB.open("markab-offline-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction(
        ["outbox", "customers", "metadata"],
        "readonly",
      );
      const outbox = transaction.objectStore("outbox").getAll();
      const customers = transaction.objectStore("customers").getAll();
      const metadata = transaction.objectStore("metadata").getAll();
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        database.close();
        const operations = outbox.result as Array<{
          operation_id: string;
          state: string;
          type: string;
          customer_create?: { national_id?: string };
        }>;
        const records = customers.result as Array<{
          id: string;
          nationalId?: string;
          customer?: { national_id?: string };
        }>;
        const queued = operations.find(
          (operation) =>
            operation.type === "CUSTOMER_CREATE" &&
            operation.customer_create?.national_id === nationalId,
        );
        resolvePromise({
          outboxTotal: operations.length,
          outboxPending: operations.filter(
            (operation) => operation.state === "PENDING",
          ).length,
          queuedOperationId: queued?.operation_id ?? null,
          reconciliationRequired: (
            metadata.result as Array<{ key: string }>
          ).some((entry) => entry.key === "reconciliation_required"),
          provisionalPresent: records.some(
            (record) =>
              record.id.startsWith("local:") &&
              record.customer?.national_id === nationalId,
          ),
          authoritativeMatches: records.filter(
            (record) =>
              !record.id.startsWith("local:") &&
              record.nationalId === nationalId,
          ).length,
        });
      };
    };
  });
}

// Runs in the browser. Polls every 50 ms until the reconciled final state is
// present or the timeout elapses. It never dispatches events.
function waitForReconciledInPage({
  nationalId,
  timeoutMs,
}: {
  nationalId: string;
  timeoutMs: number;
}): Promise<{ reconciled: boolean; state: OfflineState | null; error?: string }> {
  const read = (): Promise<OfflineState> =>
    new Promise((resolvePromise, reject) => {
      const open = indexedDB.open("markab-offline-v1");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const transaction = database.transaction(
          ["outbox", "customers", "metadata"],
          "readonly",
        );
        const outbox = transaction.objectStore("outbox").count();
        const customers = transaction.objectStore("customers").getAll();
        const metadata = transaction.objectStore("metadata").getAll();
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          database.close();
          const records = customers.result as Array<{
            id: string;
            nationalId?: string;
            customer?: { national_id?: string };
          }>;
          resolvePromise({
            outboxTotal: outbox.result,
            outboxPending: outbox.result,
            queuedOperationId: null,
            reconciliationRequired: (
              metadata.result as Array<{ key: string }>
            ).some((entry) => entry.key === "reconciliation_required"),
            provisionalPresent: records.some(
              (record) =>
                record.id.startsWith("local:") &&
                record.customer?.national_id === nationalId,
            ),
            authoritativeMatches: records.filter(
              (record) =>
                !record.id.startsWith("local:") &&
                record.nationalId === nationalId,
            ).length,
          });
        };
      };
    });
  const deadline = performance.now() + timeoutMs;
  return new Promise((resolvePromise) => {
    let last: OfflineState | null = null;
    const tick = async () => {
      try {
        last = await read();
        if (
          last.outboxTotal === 0 &&
          !last.reconciliationRequired &&
          !last.provisionalPresent &&
          last.authoritativeMatches === 1
        ) {
          resolvePromise({ reconciled: true, state: last });
          return;
        }
      } catch (error) {
        resolvePromise({ reconciled: false, state: last, error: String(error) });
        return;
      }
      if (performance.now() >= deadline) {
        resolvePromise({ reconciled: false, state: last });
        return;
      }
      setTimeout(tick, 50);
    };
    void tick();
  });
}

async function waitForSettledOnline(page: Page): Promise<void> {
  await page.locator('[data-offline-sync-ready="true"]').waitFor({
    state: "attached",
    timeout: 60_000,
  });
  await expect
    .poll(
      async () => {
        const state = await readOfflineState(page, "");
        return state.outboxTotal === 0 && !state.reconciliationRequired;
      },
      { timeout: 60_000, intervals: [100] },
    )
    .toBe(true);
}

async function fillCustomerForm(
  page: Page,
  label: string,
  index: number,
): Promise<void> {
  const phoneSuffix = String((Date.now() % 900_000) + index).padStart(6, "0");
  await page.locator("#customer-first-name").fill("Benchmark");
  await page.locator("#customer-last-name").fill(`Reconnect ${label}`);
  await page.locator("#customer-phone").fill(`70${phoneSuffix}`);
  await page.locator("#customer-address").fill("Staging reconnect benchmark");
  await page.locator("#customer-national-id").fill(label);
  await page.locator("#customer-license-number").fill(`${label}-L`);
  await page.locator("#customer-license-expiry").click();
  const popover = page.locator("#customer-license-expiry-popover");
  await popover.locator(".rdp-button_next").click();
  await popover
    .locator("button.rdp-day_button", { hasText: /^15$/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "حفظ العميل" })).toBeEnabled();
}

async function runCycle(
  page: Page,
  request: APIRequestContext,
  syncEvents: SyncEvent[],
  index: number,
  kind: Cycle["kind"],
  validation: boolean,
): Promise<Cycle> {
  const label = `${BENCHMARK_LABEL_PREFIX}${runId}-${kind === "warmup" ? "w" : "r"}${index}`;
  const cycle: Cycle = {
    index,
    kind,
    label,
    success: false,
    durationMs: null,
    error: null,
    timeline: {},
    probes: {},
    checks: {},
    evidence: {},
  };
  const now = () => performance.now();
  try {
    cycle.checks.unblockedBeforeCycle = (await netState()) === "unblocked";
    await page.goto(`${STAGING_WEB_ORIGIN}/customers/add`);
    await page.locator("#customer-first-name").waitFor({ timeout: 60_000 });
    await waitForSettledOnline(page);

    cycle.probes.browserApiBeforeBlock = await browserProbe(
      page,
      `${STAGING_API_ORIGIN}/api/healthz`,
    );
    cycle.probes.nodeApiBeforeBlock = await nodeProbe(
      request,
      `${STAGING_API_ORIGIN}/api/healthz`,
    );
    cycle.probes.nodeWebBeforeBlock = await nodeProbe(
      request,
      `${STAGING_WEB_ORIGIN}/?srb-probe=${Date.now()}`,
    );
    cycle.checks.stagingReachableBeforeBlock =
      cycle.probes.browserApiBeforeBlock.ok &&
      cycle.probes.browserApiBeforeBlock.status === 200 &&
      cycle.probes.nodeApiBeforeBlock.status === 200 &&
      cycle.probes.nodeWebBeforeBlock.ok &&
      (cycle.probes.nodeWebBeforeBlock.status ?? 600) < 400;

    await fillCustomerForm(page, label, index);

    // Outage window.
    cycle.timeline.blockStart = now();
    await block();
    cycle.timeline.blockApplied = now();
    cycle.checks.blockActive = (await netState()) === "blocked";

    cycle.probes.browserApiDuringBlock = await browserProbe(
      page,
      `${STAGING_API_ORIGIN}/api/healthz`,
    );
    cycle.probes.browserWebDuringBlock = await browserProbe(
      page,
      `${STAGING_WEB_ORIGIN}/?srb-probe=${Date.now()}`,
    );
    cycle.probes.nodeApiDuringBlock = await nodeProbe(
      request,
      `${STAGING_API_ORIGIN}/api/healthz`,
    );
    cycle.probes.nodeWebDuringBlock = await nodeProbe(
      request,
      `${STAGING_WEB_ORIGIN}/?srb-probe=${Date.now()}`,
    );
    cycle.checks.stagingTrafficFailsDuringBlock =
      !cycle.probes.browserApiDuringBlock.ok &&
      !cycle.probes.browserWebDuringBlock.ok &&
      !cycle.probes.nodeApiDuringBlock.ok &&
      !cycle.probes.nodeWebDuringBlock.ok;
    if (validation) {
      cycle.probes.browserUnrelatedDuringBlock = await browserProbe(
        page,
        unrelatedUrl,
        "no-cors",
      );
      cycle.probes.nodeUnrelatedDuringBlock = await nodeProbe(
        request,
        unrelatedUrl,
      );
      cycle.checks.unrelatedConnectivityDuringBlock =
        cycle.probes.browserUnrelatedDuringBlock.ok &&
        cycle.probes.nodeUnrelatedDuringBlock.ok;
    }

    await page.getByRole("button", { name: "حفظ العميل" }).click();
    await page.waitForURL(`${STAGING_WEB_ORIGIN}/customers`, {
      timeout: 30_000,
    });
    cycle.timeline.queued = now();
    const queuedState = await readOfflineState(page, label);
    cycle.evidence.queuedState = queuedState;
    cycle.checks.operationQueuedOffline =
      queuedState.queuedOperationId !== null &&
      queuedState.outboxPending === 1 &&
      queuedState.provisionalPresent &&
      queuedState.authoritativeMatches === 0;

    const remainingHold =
      cycle.timeline.blockStart + config.outageHoldMs - now();
    if (remainingHold > 0) await page.waitForTimeout(remainingHold);

    cycle.evidence.syncFailuresDuringOutage = syncEvents.filter(
      (event) =>
        event.startedMs >= cycle.timeline.blockApplied! &&
        event.error !== null,
    ).length;
    cycle.checks.stillBlockedBeforeRestore = (await netState()) === "blocked";
    cycle.evidence.navigatorOnLineBeforeRestore = await page.evaluate(
      () => navigator.onLine,
    );

    // Restoration. The poller starts first so no observation latency is added.
    const reconciled = page.evaluate(waitForReconciledInPage, {
      nationalId: label,
      timeoutMs: config.recoveryTimeoutMs,
    });
    cycle.timeline.unblockStart = now();
    await unblock();
    const restoredAt = now();
    cycle.timeline.restored = restoredAt;
    const outcome = await reconciled;
    const verifiedAt = now();
    cycle.timeline.verified = verifiedAt;
    cycle.evidence.finalState = outcome.state;
    if (outcome.error) cycle.evidence.pollError = outcome.error;
    cycle.checks.unblockSucceeded = (await netState()) === "unblocked";
    cycle.probes.nodeApiAfterRestore = await nodeProbe(
      request,
      `${STAGING_API_ORIGIN}/api/healthz`,
    );
    cycle.probes.browserApiAfterRestore = await browserProbe(
      page,
      `${STAGING_API_ORIGIN}/api/healthz`,
    );
    cycle.checks.stagingReachableAfterRestore =
      cycle.probes.nodeApiAfterRestore.status === 200 &&
      cycle.probes.browserApiAfterRestore.status === 200;

    const afterRestore = syncEvents.filter(
      (event) => event.startedMs >= restoredAt && event.startedMs <= verifiedAt,
    );
    const pushes = afterRestore.filter(
      (event) => event.path === "/api/sync/push",
    );
    const firstPushOk = pushes.find(
      (event) => event.status !== null && event.status < 300,
    );
    const finalPull = afterRestore.find(
      (event) =>
        event.path === "/api/sync/pull" &&
        event.finalPull === true &&
        firstPushOk !== undefined &&
        event.startedMs >= firstPushOk.endedMs,
    );
    cycle.evidence.syncEventsAfterRestore = afterRestore.map((event) => ({
      ...event,
      startedMs: event.startedMs - restoredAt,
      endedMs: event.endedMs - restoredAt,
    }));
    cycle.timeline.firstSyncRequestAfterRestore =
      afterRestore[0]?.startedMs ?? null;
    cycle.timeline.finalPullCompleted = finalPull?.endedMs ?? null;

    const token = await apiLogin(request);
    const serverMatches = await findBenchmarkCustomers(request, token, label);
    const events = await page.evaluate(() => {
      const target = window as Window & {
        __srbEvents?: Record<string, number>;
      };
      return {
        online: target.__srbEvents?.online ?? 0,
        offline: target.__srbEvents?.offline ?? 0,
        focus: target.__srbEvents?.focus ?? 0,
        onLine: navigator.onLine,
      };
    });
    cycle.evidence.pageEvents = events;
    cycle.evidence.serverMatches = serverMatches.length;

    cycle.checks.automaticReconciliationWithoutOnlineEvent =
      outcome.reconciled && events.online === 0;
    cycle.checks.pushSucceeded = firstPushOk !== undefined;
    cycle.checks.authoritativePullCompleted = finalPull !== undefined;
    cycle.checks.outboxDrained = outcome.state?.outboxTotal === 0;
    cycle.checks.reconciliationRequiredCleared =
      outcome.state?.reconciliationRequired === false;
    cycle.checks.provisionalRecordRemoved =
      outcome.state?.provisionalPresent === false;
    cycle.checks.exactlyOneAuthoritativeCustomerLocal =
      outcome.state?.authoritativeMatches === 1;
    cycle.checks.exactlyOneAuthoritativeCustomerServer =
      serverMatches.length === 1;
    cycle.checks.duplicateCountZero =
      serverMatches.length <= 1 && (outcome.state?.authoritativeMatches ?? 0) <= 1;
    cycle.checks.syncErrorsZero = afterRestore.every(
      (event) => event.error === null && event.status !== null && event.status < 300,
    );

    cycle.durationMs = verifiedAt - restoredAt;
    cycle.success = Object.values(cycle.checks).every(Boolean);
  } catch (error) {
    cycle.error = firstLine(error);
  } finally {
    if (blocked) {
      try {
        await unblock();
      } catch (error) {
        cycle.error ??= `unblock failed: ${firstLine(error)}`;
      }
    }
    // Normalize timeline to the block start for readability.
    const origin = cycle.timeline.blockStart;
    if (origin !== undefined && origin !== null) {
      for (const key of Object.keys(cycle.timeline)) {
        const value = cycle.timeline[key];
        if (typeof value === "number") cycle.timeline[key] = value - origin;
      }
    }
  }
  return cycle;
}

test("staging reconnect benchmark", async ({ browser, playwright }) => {
  assertBenchmarkCgroup(await readFile("/proc/self/cgroup", "utf8"));
  expect(await netState()).toBe("unblocked");

  const request = await playwright.request.newContext();
  const startedAt = new Date().toISOString();
  const preRunCleanup = await deleteBenchmarkCustomers(
    request,
    BENCHMARK_LABEL_PREFIX,
  );

  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    serviceWorkers: "allow",
  });
  await context.addInitScript(() => {
    const target = window as Window & {
      __srbEvents?: Record<string, number>;
    };
    target.__srbEvents = { online: 0, offline: 0, focus: 0 };
    for (const name of ["online", "offline", "focus"]) {
      window.addEventListener(name, () => {
        target.__srbEvents![name] = (target.__srbEvents![name] ?? 0) + 1;
      });
    }
  });
  // Any browser request outside the two staging origins is a violation, except
  // the explicit unrelated-connectivity probe issued in validation mode.
  const nonStagingRequests: string[] = [];
  const unrelatedOrigin = new URL(unrelatedUrl).origin;
  const syncEvents: SyncEvent[] = [];
  const started = new Map<Request, number>();
  const syncPath = (request: Request) => {
    const path = new URL(request.url()).pathname;
    return path === "/api/sync/push" || path === "/api/sync/pull"
      ? path
      : null;
  };
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !isAllowedStagingOrigin(url.href) &&
      !(config.mode === "validation" && url.origin === unrelatedOrigin)
    ) {
      nonStagingRequests.push(url.origin);
    }
    if (syncPath(request)) started.set(request, performance.now());
  });
  context.on("requestfailed", (request) => {
    const path = syncPath(request);
    if (!path) return;
    syncEvents.push({
      path,
      startedMs: started.get(request) ?? performance.now(),
      endedMs: performance.now(),
      status: null,
      error: request.failure()?.errorText ?? "failed",
    });
  });
  context.on("requestfinished", async (request) => {
    const path = syncPath(request);
    if (!path) return;
    const endedMs = performance.now();
    const response = await request.response();
    let finalPull: boolean | undefined;
    if (path === "/api/sync/pull" && response?.ok()) {
      try {
        const body = (await response.json()) as { next_cursor?: unknown };
        finalPull = body.next_cursor === null;
      } catch {
        finalPull = false;
      }
    }
    syncEvents.push({
      path,
      startedMs: started.get(request) ?? endedMs,
      endedMs,
      status: response?.status() ?? null,
      error: null,
      finalPull,
    });
  });

  const page = await context.newPage();
  const cycles: Cycle[] = [];
  let postRunCleanup: Record<string, unknown> | null = null;
  try {
    await page.goto(`${STAGING_WEB_ORIGIN}/login`);
    await page.locator("#login-email").fill(config.email);
    await page.locator("#login-password").fill(config.password);
    await page.getByRole("button", { name: "دخول" }).click();
    await page.waitForURL(`${STAGING_WEB_ORIGIN}/`, { timeout: 60_000 });
    await waitForSettledOnline(page);

    const validation = config.mode === "validation";
    for (let index = 1; index <= config.warmups; index += 1) {
      cycles.push(
        await runCycle(page, request, syncEvents, index, "warmup", false),
      );
    }
    for (let index = 1; index <= config.samples; index += 1) {
      cycles.push(
        await runCycle(page, request, syncEvents, index, "recorded", validation),
      );
    }
  } finally {
    if (blocked) unblockSync();
    await context.close();
    try {
      postRunCleanup = await deleteBenchmarkCustomers(
        request,
        `${BENCHMARK_LABEL_PREFIX}${runId}-`,
      );
    } catch (error) {
      postRunCleanup = { error: firstLine(error) };
    }
    const finalNetState = await netState().catch(() => "unknown");
    const recorded = cycles.filter((cycle) => cycle.kind === "recorded");
    const successful = recorded.filter((cycle) => cycle.success);
    const durations = successful.map((cycle) => cycle.durationMs!);
    const p95 = nearestRank(durations, 0.95);
    const complete =
      recorded.length === config.samples &&
      successful.length === config.samples;
    let gitRevision = "unknown";
    let gitDirty: boolean | null = null;
    try {
      gitRevision = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
      gitDirty =
        execFileSync("git", ["status", "--porcelain"]).toString().trim() !== "";
    } catch {
      // Recorded as unknown.
    }
    let wrapperSha256 = "unknown";
    try {
      wrapperSha256 = createHash("sha256")
        .update(await readFile(NET_WRAPPER))
        .digest("hex");
    } catch {
      // Recorded as unknown.
    }
    const artifact = {
      benchmark: "step-64-staging-reconnect",
      mode: config.mode,
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      command:
        "apps/web/scripts/run-staging-reconnect.sh (systemd scope markab-reconnect-bench)",
      environment: {
        webOrigin: STAGING_WEB_ORIGIN,
        apiOrigin: STAGING_API_ORIGIN,
        stagingReleaseId: config.releaseId,
        harnessGitRevision: gitRevision,
        harnessWorkingTreeDirty: gitDirty,
        browser: `chromium ${browser.version()}`,
        viewport: "393x852 @2x",
        emulation: "none (no CDP network/CPU emulation, no navigator.onLine changes)",
        interruption:
          "host nftables table inet markab_bench, cgroup-scoped TCP reset / UDP icmpx admin-prohibited to resolved staging web+API addresses",
        netWrapperSha256: wrapperSha256,
      },
      protocol: {
        warmups: config.warmups,
        samples: config.samples,
        outageHoldMs: config.outageHoldMs,
        recoveryTimeoutMs: config.recoveryTimeoutMs,
        queuedOperation: "one CUSTOMER_CREATE via the Add Customer form during the outage",
        timingBoundary:
          "from markab-bench-net unblock returning to the in-page IndexedDB poll (50 ms) observing outbox 0, reconciliation_required cleared, provisional removed, exactly one authoritative Customer",
        percentileMethod: "nearest-rank over successful recorded samples",
      },
      preRunCleanup,
      postRunCleanup,
      nonStagingRequests,
      finalNetState,
      cycles,
      summary: {
        recorded: recorded.length,
        successCount: successful.length,
        failureCount: recorded.length - successful.length,
        p50Ms: nearestRank(durations, 0.5),
        p95Ms: p95,
        maxMs: durations.length ? Math.max(...durations) : null,
        gateMs,
        gate:
          config.mode !== "full"
            ? "NOT_EVALUATED (validation mode)"
            : complete && p95 !== null && p95 <= gateMs
              ? "PASS"
              : "FAIL",
      },
    };
    await mkdir(artifactDirectory, { recursive: true });
    const artifactPath = resolve(
      artifactDirectory,
      `${config.mode}-${startedAt.replaceAll(":", "-")}.json`,
    );
    await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
    console.log("STAGING_RECONNECT_ARTIFACT", artifactPath);
    console.log("STAGING_RECONNECT_SUMMARY", JSON.stringify(artifact.summary));
    await request.dispose();
  }

  expect(nonStagingRequests).toEqual([]);
  for (const cycle of cycles) {
    expect.soft(cycle.error, `${cycle.label} error`).toBeNull();
    expect.soft(
      Object.values(cycle.checks).every(Boolean),
      `${cycle.label} all checks`,
    ).toBe(true);
  }
});
