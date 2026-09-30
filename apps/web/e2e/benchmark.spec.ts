import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  benchmarkDatasetCounts,
  createMobileProfile,
  login,
  requestJson,
  resetBenchmark,
  setMobileNetworkOffline,
  syncChangeCount,
} from "./benchmark-fixtures";
import {
  assertTargetSyncWithinBudget,
  runSamples,
  writeResultArtifact,
  type Measurement,
} from "./benchmark-results";

const sampling = { warmups: 5, samples: 30 };
const command = "pnpm --filter @workspace/web run benchmark";
const environment = {
  nodeEnv: "benchmark",
  apiOrigin: "http://127.0.0.1:3001",
  webOrigin: "http://127.0.0.1:4174",
};
const collectedMeasurements: Measurement[] = [];
const profiles: Record<string, Record<string, string | number | boolean>> = {
  api: { name: "api" },
};
type ProjectionCounts = {
  customers: number;
  vehicles: number;
  rentals: number;
};
type SearchMarker = { generation: number };
type LocalSearchTiming = {
  generation: number;
  entity: "customers" | "vehicles";
  startMs: number;
  endMs: number;
  records: number;
};
const searchMarkerSelector = "[data-benchmark-search-completion]";
const fullPilotProjectionCounts: ProjectionCounts = {
  customers: 1_000,
  vehicles: 50,
  rentals: 500,
};
const targetProjectionCounts: ProjectionCounts = {
  customers: 700,
  vehicles: 50,
  rentals: 250,
};

async function loginMobilePage(
  page: Page,
  accessToken?: string,
): Promise<void> {
  if (accessToken) {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            accessToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        }),
      }),
    );
  }
  await page.goto("/login");
  await page.locator("#login-email").fill("benchmark-owner-1@markab.local");
  await page
    .locator("#login-password")
    .fill(process.env.BENCHMARK_PASSWORD ?? "");
  await page.getByRole("button", { name: "دخول" }).click();
  await page.waitForURL("/", { timeout: 30_000 });
}

async function syncAndWaitForFinalPull(
  page: Page,
  expectedCounts: ProjectionCounts,
  expectedSyncRequests?: { push: number; pull: number },
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await indexedDB.databases()).some(
          (database) => database.name === "markab-offline-v1",
        ),
      ),
    )
    .toBe(true);
  await page.locator('[data-offline-sync-ready="true"]').waitFor();
  const observed: string[] = [];
  const syncRequests = { push: 0, pull: 0 };
  const observe = (response: { url(): string; status(): number }) => {
    const path = new URL(response.url()).pathname;
    if (path === "/api/sync/pull") {
      observed.push(String(response.status()));
      if (response.status() >= 200 && response.status() < 300) {
        syncRequests.pull += 1;
      }
    }
    if (
      path === "/api/sync/push" &&
      response.status() >= 200 &&
      response.status() < 300
    ) {
      syncRequests.push += 1;
    }
  };
  page.on("response", observe);
  const finalPull = page.waitForResponse(
    async (response) => {
      if (
        new URL(response.url()).pathname !== "/api/sync/pull" ||
        !response.ok()
      ) {
        return false;
      }
      const body = (await response.json()) as {
        changes?: unknown[];
        next_cursor?: string | null;
      };
      return body.next_cursor === null;
    },
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  try {
    await finalPull;
  } catch {
    throw new Error(
      `Sync final pull not observed within 30 seconds; pull HTTP statuses: ${observed.join(", ") || "none"}.`,
    );
  } finally {
    page.off("response", observe);
  }
  if (expectedSyncRequests) {
    expect(syncRequests).toEqual(expectedSyncRequests);
  }
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("markab-offline-v1");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const transaction = database.transaction(
            ["customers", "vehicles", "rentals"],
            "readonly",
          );
          const count = (store: string) =>
            new Promise<number>((resolve, reject) => {
              const request = transaction.objectStore(store).count();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
          const [customers, vehicles, rentals] = await Promise.all([
            count("customers"),
            count("vehicles"),
            count("rentals"),
          ]);
          database.close();
          return { customers, vehicles, rentals };
        }),
      { timeout: 30_000 },
    )
    .toEqual(expectedCounts);
}

function recordMeasurements(
  measurements: Measurement[],
  profile: Record<string, string | number | boolean> = { name: "api" },
): void {
  profiles[String(profile.name)] = profile;
  collectedMeasurements.push(...measurements);
}

async function assertOfflineLocal(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const databases = await indexedDB.databases();
        return (
          !navigator.onLine &&
          databases.some((database) => database.name === "markab-offline-v1")
        );
      }),
    )
    .toBe(true);
}

async function readSearchMarker(page: Page): Promise<SearchMarker> {
  return page.evaluate((selector) => {
    const marker = document.querySelector<HTMLElement>(selector);
    if (!marker)
      throw new Error("Benchmark search completion marker is missing");
    return {
      generation: Number(marker.dataset.searchGeneration),
    };
  }, searchMarkerSelector);
}

async function waitForSearchMarker(
  page: Page,
  generation: number,
): Promise<void> {
  await page.waitForFunction(
    ({ selector, generation }) => {
      const marker = document.querySelector<HTMLElement>(selector);
      return Number(marker?.dataset.searchGeneration) > generation;
    },
    { selector: searchMarkerSelector, generation },
  );
}

async function resetSearchReadCount(
  page: Page,
  entity: LocalSearchTiming["entity"],
  generation: number,
): Promise<void> {
  await page.evaluate(
    ({ entity, generation }) => {
      const target = window as Window & {
        __benchmarkSearchGetAll?: number;
        __benchmarkSearchOriginalGetAll?: IDBIndex["getAll"];
        __benchmarkSearchTransactions?: number;
        __benchmarkSearchOriginalTransaction?: IDBDatabase["transaction"];
        __benchmarkSearchStore?: string;
        __benchmarkLocalSearch?: {
          requestedGeneration: number;
          entries: LocalSearchTiming[];
        };
      };
      if (!target.__benchmarkSearchOriginalTransaction) {
        target.__benchmarkSearchOriginalTransaction =
          IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
          if (
            args[0] === target.__benchmarkSearchStore &&
            args[1] === "readonly"
          ) {
            target.__benchmarkSearchTransactions =
              (target.__benchmarkSearchTransactions ?? 0) + 1;
          }
          return target.__benchmarkSearchOriginalTransaction!.apply(this, args);
        };
      }
      if (!target.__benchmarkSearchOriginalGetAll) {
        target.__benchmarkSearchOriginalGetAll = IDBIndex.prototype.getAll;
        IDBIndex.prototype.getAll = function (...args) {
          target.__benchmarkSearchGetAll =
            (target.__benchmarkSearchGetAll ?? 0) + 1;
          return target.__benchmarkSearchOriginalGetAll!.apply(this, args);
        };
      }
      target.__benchmarkSearchStore = entity;
      target.__benchmarkSearchGetAll = 0;
      target.__benchmarkSearchTransactions = 0;
      target.__benchmarkLocalSearch = {
        requestedGeneration: generation,
        entries: [],
      };
    },
    { entity, generation },
  );
}

async function searchReadEvidence(page: Page) {
  return page.evaluate(() => {
    const target = window as Window & {
      __benchmarkSearchGetAll?: number;
      __benchmarkSearchTransactions?: number;
      __benchmarkLocalSearch?: { entries: LocalSearchTiming[] };
    };
    return {
      requests: target.__benchmarkSearchGetAll ?? 0,
      transactions: target.__benchmarkSearchTransactions ?? 0,
      entries: target.__benchmarkLocalSearch?.entries ?? [],
    };
  });
}

function alternatingSearchTerm(
  sample: number,
  first: string,
  second: string,
): string {
  const sequence =
    sample < 0 ? sample + sampling.warmups : sample + sampling.warmups + 1;
  return sequence % 2 ? second : first;
}

async function runOfflineSearchSamples(
  name: string,
  page: Page,
  entity: LocalSearchTiming["entity"],
  expectedRecords: number,
  term: (sample: number) => string,
  action: (sample: number) => Promise<void>,
): Promise<Measurement> {
  let apiRequests: string[] = [];
  let marker: SearchMarker;
  let localDurationMs = 0;
  const observeRequest = (request: { method(): string; url(): string }) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      apiRequests.push(`${request.method()} ${url.pathname}`);
    }
  };
  const measurement = await runSamples(
    name,
    async (sample) => {
      await action(sample);
      await waitForSearchMarker(page, marker.generation);
      expect(
        await page.evaluate(() => document.querySelectorAll("tbody tr").length),
      ).toBe(
        term(sample) === (entity === "customers" ? "Customer1" : "Pilot")
          ? expectedRecords
          : 1,
      );
      const evidence = await searchReadEvidence(page);
      expect(evidence.entries).toHaveLength(1);
      const entry = evidence.entries[0]!;
      expect(entry).toMatchObject({
        entity,
        generation: marker.generation + 1,
        records: expectedRecords,
      });
      expect(entry.endMs).toBeGreaterThanOrEqual(entry.startMs);
      expect(evidence.transactions).toBe(1);
      expect(evidence.requests).toBe(1);
      expect(apiRequests).toEqual([]);
      localDurationMs = entry.endMs - entry.startMs;
    },
    {
      ...sampling,
      durationMs: async () => localDurationMs,
      beforeSample: async () => {
        await assertOfflineLocal(page);
        marker = await readSearchMarker(page);
        await resetSearchReadCount(page, entity, marker.generation + 1);
        apiRequests = [];
        page.on("request", observeRequest);
      },
      afterSample: async () => {
        page.off("request", observeRequest);
      },
    },
  );
  expect(measurement.errorCount).toBe(0);
  return measurement;
}

test.afterAll(async () => {
  await writeResultArtifact({
    command,
    datasetCounts: benchmarkDatasetCounts,
    environment,
    profiles,
    measurements: collectedMeasurements,
  });
});

test.describe("benchmark API", () => {
  test("measures bounded outstanding summary", async ({ request }) => {
    await resetBenchmark();
    try {
      const token = await login(request);
      const measurement = await runSamples(
        "outstanding-balances-summary",
        async () => {
          const response = (await requestJson(
            request,
            token,
            "/payments/outstanding-balances",
          )) as { data: { balances: unknown[] } };
          expect(response.data.balances).toHaveLength(500);
        },
        sampling,
      );
      expect(measurement.errorCount).toBe(0);
      recordMeasurements([measurement], {
        name: "api-outstanding-summary",
        summaryRequestsPerSample: 1,
      });
      console.log("SLICE3_API_SUMMARY", JSON.stringify(measurement));
    } finally {
      await resetBenchmark();
    }
  });

  test("measures authenticated list, search, and payment-summary reads", async ({
    request,
  }) => {
    const token = await login(request);
    let paymentSummaryRequestCount = 0;
    const customers = (await requestJson(request, token, "/customers")) as {
      data: Array<{ id: string }>;
    };
    const vehicles = (await requestJson(request, token, "/vehicles")) as {
      data: Array<{ id: string }>;
    };
    expect(customers.data.length).toBe(1_000);
    expect(vehicles.data.length).toBe(50);
    const reads = [];
    for (const [name, path] of [
      ["customers-list", "/customers"],
      ["vehicles-list", "/vehicles"],
      ["customer-detail", `/customers/${customers.data[0]!.id}`],
      ["vehicle-detail", `/vehicles/${vehicles.data[0]!.id}`],
    ] as const) {
      reads.push(
        await runSamples(
          name,
          async () => {
            await requestJson(request, token, path);
          },
          sampling,
        ),
      );
    }
    reads.push(
      await runSamples(
        "customers-search",
        async (sample) => {
          await requestJson(
            request,
            token,
            `/customers?search=Customer1${sample % 2 ? "" : "0"}`,
          );
        },
        sampling,
      ),
      await runSamples(
        "vehicles-search",
        async (sample) => {
          await requestJson(
            request,
            token,
            `/vehicles?search=Pilot%20${Math.abs(sample % 10) + 1}`,
          );
        },
        sampling,
      ),
      await runSamples(
        "payment-summary-fanout",
        async () => {
          const rentals = (await requestJson(request, token, "/rentals")) as {
            data: Array<{ id: string }>;
          };
          paymentSummaryRequestCount = rentals.data.length + 1;
          await Promise.all(
            rentals.data.map((rental) =>
              requestJson(request, token, `/rentals/${rental.id}/payments`),
            ),
          );
        },
        sampling,
      ),
    );
    recordMeasurements(reads, { name: "api", paymentSummaryRequestCount });
  });

  test("measures one reset-protected customer mutation", async ({
    request,
  }) => {
    await resetBenchmark();
    try {
      const token = await login(request);
      const measurement = await runSamples(
        "customer-create",
        async (sample) => {
          await requestJson(request, token, "/customers", "POST", {
            first_name: "Benchmark",
            last_name: `Mutation${sample}`,
            phone: `+961711${String(sample + 10).padStart(5, "0")}`,
            address: "Benchmark Street",
            national_id: `MUT-${sample}`,
            license_number: `MUT-${sample}`,
            license_expiry_date: "2030-01-01",
          });
        },
        sampling,
      );
      recordMeasurements([measurement]);
    } finally {
      await resetBenchmark();
    }
  });

  test("measures a fixed ten-user authenticated mixed request group", async ({
    playwright,
  }) => {
    await resetBenchmark();
    const users = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const request = await playwright.request.newContext();
        return { request, token: await login(request) };
      }),
    );
    try {
      const measurement = await runSamples(
        "concurrent-ten-user-mixed-request-group",
        async (sample) => {
          await Promise.all(
            users.map(({ request, token }, index) =>
              index === 0
                ? requestJson(request, token, "/customers", "POST", {
                    first_name: "Benchmark",
                    last_name: `Concurrent${sample}`,
                    phone: `+961712${String(sample + 10).padStart(5, "0")}`,
                    address: "Benchmark Street",
                    national_id: `CON-${sample}-${index}`,
                    license_number: `CON-${sample}-${index}`,
                    license_expiry_date: "2030-01-01",
                  })
                : requestJson(
                    request,
                    token,
                    index % 2
                      ? "/customers?search=Customer1"
                      : "/vehicles?search=Pilot",
                  ),
            ),
          );
        },
        sampling,
      );
      recordMeasurements([measurement], {
        name: "api-concurrent",
        virtualUsers: 10,
      });
    } finally {
      await Promise.all(users.map(({ request }) => request.dispose()));
      await resetBenchmark();
    }
  });
});

test.describe("benchmark mobile IndexedDB and sync", () => {
  test("uses CDP network emulation to block and restore browser requests", async ({
    browser,
  }) => {
    const profileContext = await createMobileProfile(browser);
    try {
      await profileContext.page.goto("/login");
      await setMobileNetworkOffline(profileContext.session, true);
      await expect(
        profileContext.page.evaluate(() =>
          fetch("http://127.0.0.1:3001/api/healthz").then(
            () => false,
            () => true,
          ),
        ),
      ).resolves.toBe(true);

      await setMobileNetworkOffline(profileContext.session, false);
      await expect(
        profileContext.page.evaluate(() =>
          fetch("http://127.0.0.1:3001/api/healthz").then(
            (response) => response.ok,
          ),
        ),
      ).resolves.toBe(true);
    } finally {
      await profileContext.context.close();
    }
  });

  test("measures real login and navigation", async ({ browser }) => {
    const { context, page, profile } = await createMobileProfile(browser);
    try {
      let loadContext:
        Awaited<ReturnType<typeof createMobileProfile>> | undefined;
      const initialLoad = await runSamples(
        "mobile-initial-page-load",
        async () => {
          await loadContext!.page.goto("/login");
          await expect(
            loadContext!.page.getByRole("heading", { name: "تسجيل الدخول" }),
          ).toBeVisible();
        },
        {
          ...sampling,
          beforeSample: async () => {
            loadContext = await createMobileProfile(browser);
          },
          afterSample: async () => {
            await loadContext?.context.close();
            loadContext = undefined;
          },
        },
      );
      recordMeasurements([initialLoad], profile);
      await loginMobilePage(page);

      const navigation = await runSamples(
        "mobile-route-navigation",
        async (sample) => {
          await page
            .locator(
              `nav.fixed[aria-label="التنقل الرئيسي"] a[href="${sample % 2 ? "/customers" : "/vehicles"}"]`,
            )
            .click();
          await expect(
            page.getByRole("heading", {
              name: sample % 2 ? "العملاء" : "السيارات",
              exact: true,
            }),
          ).toBeVisible();
        },
        sampling,
      );
      recordMeasurements([navigation], profile);
    } finally {
      await context.close();
    }
  });

  test("measures target-1000 initial sync within 30 seconds and restores full-pilot", async ({
    browser,
    request,
  }) => {
    await resetBenchmark("target-1000");
    try {
      expect(await syncChangeCount(request, await login(request))).toBe(1_000);
      let accessToken = "";
      const measurement = await runSamples(
        "target-1000-initial-sync",
        async () => {
          const sample = await createMobileProfile(browser);
          try {
            await loginMobilePage(sample.page, accessToken);
            await syncAndWaitForFinalPull(sample.page, targetProjectionCounts);
          } finally {
            await sample.context.close();
          }
        },
        {
          ...sampling,
          beforeSample: async (sample) => {
            if (!accessToken || sample % 10 === 0) {
              accessToken = await login(request);
            }
          },
        },
      );
      recordMeasurements([measurement], {
        name: "mid-range-mobile-4g-target-1000",
        scenario: "target-1000",
        changeCount: 1_000,
      });
      assertTargetSyncWithinBudget(measurement);
    } finally {
      await resetBenchmark();
    }

    expect(await syncChangeCount(request, await login(request))).toBe(1_550);
  });

  test("measures full-pilot sync and records its representative 1,550-change count", async ({
    browser,
    request,
  }) => {
    await resetBenchmark();
    const profileContext = await createMobileProfile(browser);
    try {
      const changeCount = await syncChangeCount(request, await login(request));
      expect(changeCount).toBe(1_550);
      let accessToken = "";
      const measurement = await runSamples(
        "full-pilot-sync-1550-changes",
        async () => {
          const sample = await createMobileProfile(browser);
          try {
            await loginMobilePage(sample.page, accessToken);
            await syncAndWaitForFinalPull(
              sample.page,
              fullPilotProjectionCounts,
            );
          } finally {
            await sample.context.close();
          }
        },
        {
          ...sampling,
          beforeSample: async (sample) => {
            if (!accessToken || sample % 10 === 0) {
              accessToken = await login(request);
            }
          },
        },
      );
      recordMeasurements([measurement], {
        ...profileContext.profile,
        scenario: "full-pilot-representative-stress",
        changeCount,
      });
    } finally {
      await profileContext.context.close();
      await resetBenchmark();
    }
  });

  test("measures full-pilot reconnect with one queued customer per sample", async ({
    browser,
    request,
  }) => {
    await resetBenchmark();
    const profileContext = await createMobileProfile(browser);
    const { context, page, profile, session } = profileContext;
    try {
      await loginMobilePage(page, await login(request));
      await syncAndWaitForFinalPull(page, fullPilotProjectionCounts);
      let queuedCount = 0;
      const localCustomerIds: string[] = [];
      const outboxCount = () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("markab-offline-v1");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const transaction = db.transaction("outbox", "readonly");
          const count = await new Promise<number>((resolve, reject) => {
            const request = transaction.objectStore("outbox").count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          db.close();
          return count;
        });
      const reconnectSync = await runSamples(
        "mobile-reconnect-sync-queued-customer",
        async () => {
          await setMobileNetworkOffline(session, false);
          await syncAndWaitForFinalPull(
            page,
            {
              ...fullPilotProjectionCounts,
              customers: fullPilotProjectionCounts.customers + queuedCount,
            },
            { push: 1, pull: 1 },
          );
          await expect.poll(outboxCount).toBe(0);
          const localCustomerId = localCustomerIds.at(-1);
          if (!localCustomerId) {
            throw new Error(
              "Queued benchmark customer is missing its local ID",
            );
          }
          await expect
            .poll(() =>
              page.evaluate((localCustomerId) => {
                return new Promise<boolean>((resolve, reject) => {
                  const open = indexedDB.open("markab-offline-v1");
                  open.onerror = () => reject(open.error);
                  open.onsuccess = () => {
                    const db = open.result;
                    const transaction = db.transaction("customers", "readonly");
                    const customer = transaction
                      .objectStore("customers")
                      .getAll();
                    customer.onerror = () => reject(customer.error);
                    customer.onsuccess = () => {
                      db.close();
                      resolve(
                        !(customer.result as Array<{ id: string }>).some(
                          (record) => record.id === localCustomerId,
                        ),
                      );
                    };
                  };
                });
              }, localCustomerId),
            )
            .toBe(true);
        },
        {
          ...sampling,
          beforeSample: async (sample) => {
            await setMobileNetworkOffline(session, true);
            const localCustomerId = await page.evaluate((number) => {
              return new Promise<string>((resolve, reject) => {
                const open = indexedDB.open("markab-offline-v1");
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                  const db = open.result;
                  const keys = db
                    .transaction("customers", "readonly")
                    .objectStore("customers")
                    .getAllKeys();
                  keys.onerror = () => reject(keys.error);
                  keys.onsuccess = () => {
                    const tenantKey = (
                      keys.result[0] as string[] | undefined
                    )?.[0];
                    if (!tenantKey) {
                      reject(new Error("Benchmark tenant projection is empty"));
                      db.close();
                      return;
                    }
                    const operationId = crypto.randomUUID();
                    const draft = {
                      first_name: "Reconnect",
                      last_name: `Pilot${number}`,
                      phone: `7012${String(number + 10).padStart(4, "0")}`,
                      address: "Beirut",
                      national_id: `RECONNECT-NID-${number}`,
                      license_number: `RECONNECT-LIC-${number}`,
                      license_expiry_date: "2030-01-01T00:00:00.000Z",
                    };
                    const localId = `local:${operationId}`;
                    const localProjection = {
                      customer: { localId, operationId, customer: draft },
                    };
                    const transaction = db.transaction(
                      ["customers", "outbox"],
                      "readwrite",
                    );
                    transaction.objectStore("customers").put({
                      ...localProjection.customer,
                      id: localId,
                      tenantKey,
                    });
                    transaction.objectStore("outbox").put({
                      operation_id: operationId,
                      type: "CUSTOMER_CREATE",
                      customer_create: draft,
                      localProjection,
                      createdAt: new Date().toISOString(),
                      attempts: 0,
                      state: "PENDING",
                      tenantKey,
                    });
                    transaction.oncomplete = () => {
                      db.close();
                      resolve(localId);
                    };
                    transaction.onerror = () => reject(transaction.error);
                    transaction.onabort = () => reject(transaction.error);
                  };
                };
              });
            }, sample);
            localCustomerIds.push(localCustomerId);
            await expect.poll(outboxCount).toBe(1);
            queuedCount += 1;
          },
        },
      );
      recordMeasurements([reconnectSync], {
        ...profile,
        scenario: "full-pilot-one-queued-customer-per-reconnect",
      });
    } finally {
      await context.close();
      await resetBenchmark();
    }
  });

  test("measures online application sync with one queued customer per sample", async ({
    browser,
    request,
  }) => {
    await resetBenchmark();
    const profileContext = await createMobileProfile(browser);
    const { context, page, profile } = profileContext;
    try {
      await loginMobilePage(page, await login(request));
      await syncAndWaitForFinalPull(page, fullPilotProjectionCounts);
      let queuedCount = 0;
      const localCustomerIds: string[] = [];
      const outboxCount = () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("markab-offline-v1");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const transaction = db.transaction("outbox", "readonly");
          const count = await new Promise<number>((resolve, reject) => {
            const request = transaction.objectStore("outbox").count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          db.close();
          return count;
        });
      const applicationSync = await runSamples(
        "mobile-online-application-sync-queued-customer",
        async () => {
          await syncAndWaitForFinalPull(
            page,
            {
              ...fullPilotProjectionCounts,
              customers: fullPilotProjectionCounts.customers + queuedCount,
            },
            { push: 1, pull: 1 },
          );
          await expect.poll(outboxCount).toBe(0);
          const localCustomerId = localCustomerIds.at(-1);
          if (!localCustomerId) {
            throw new Error(
              "Queued benchmark customer is missing its local ID",
            );
          }
          await expect
            .poll(() =>
              page.evaluate((localCustomerId) => {
                return new Promise<boolean>((resolve, reject) => {
                  const open = indexedDB.open("markab-offline-v1");
                  open.onerror = () => reject(open.error);
                  open.onsuccess = () => {
                    const db = open.result;
                    const transaction = db.transaction("customers", "readonly");
                    const customer = transaction
                      .objectStore("customers")
                      .getAll();
                    customer.onerror = () => reject(customer.error);
                    customer.onsuccess = () => {
                      db.close();
                      resolve(
                        !(customer.result as Array<{ id: string }>).some(
                          (record) => record.id === localCustomerId,
                        ),
                      );
                    };
                  };
                });
              }, localCustomerId),
            )
            .toBe(true);
        },
        {
          ...sampling,
          beforeSample: async (sample) => {
            const localCustomerId = await page.evaluate((number) => {
              return new Promise<string>((resolve, reject) => {
                const open = indexedDB.open("markab-offline-v1");
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                  const db = open.result;
                  const keys = db
                    .transaction("customers", "readonly")
                    .objectStore("customers")
                    .getAllKeys();
                  keys.onerror = () => reject(keys.error);
                  keys.onsuccess = () => {
                    const tenantKey = (
                      keys.result[0] as string[] | undefined
                    )?.[0];
                    if (!tenantKey) {
                      reject(new Error("Benchmark tenant projection is empty"));
                      db.close();
                      return;
                    }
                    const operationId = crypto.randomUUID();
                    const draft = {
                      first_name: "Reconnect",
                      last_name: `Pilot${number}`,
                      phone: `7012${String(number + 10).padStart(4, "0")}`,
                      address: "Beirut",
                      national_id: `RECONNECT-NID-${number}`,
                      license_number: `RECONNECT-LIC-${number}`,
                      license_expiry_date: "2030-01-01T00:00:00.000Z",
                    };
                    const localId = `local:${operationId}`;
                    const localProjection = {
                      customer: { localId, operationId, customer: draft },
                    };
                    const transaction = db.transaction(
                      ["customers", "outbox"],
                      "readwrite",
                    );
                    transaction.objectStore("customers").put({
                      ...localProjection.customer,
                      id: localId,
                      tenantKey,
                    });
                    transaction.objectStore("outbox").put({
                      operation_id: operationId,
                      type: "CUSTOMER_CREATE",
                      customer_create: draft,
                      localProjection,
                      createdAt: new Date().toISOString(),
                      attempts: 0,
                      state: "PENDING",
                      tenantKey,
                    });
                    transaction.oncomplete = () => {
                      db.close();
                      resolve(localId);
                    };
                    transaction.onerror = () => reject(transaction.error);
                    transaction.onabort = () => reject(transaction.error);
                  };
                };
              });
            }, sample);
            localCustomerIds.push(localCustomerId);
            await expect.poll(outboxCount).toBe(1);
            queuedCount += 1;
          },
        },
      );
      recordMeasurements([applicationSync], {
        ...profile,
        scenario: "full-pilot-online-application-sync-control",
      });
    } finally {
      await context.close();
      await resetBenchmark();
    }
  });

  test("measures full-pilot native IndexedDB searches", async ({
    browser,
    request,
  }) => {
    await resetBenchmark();
    const profileContext = await createMobileProfile(browser);
    try {
      const accessToken = await login(request);
      await loginMobilePage(profileContext.page, accessToken);
      await syncAndWaitForFinalPull(
        profileContext.page,
        fullPilotProjectionCounts,
      );
      await profileContext.context.setOffline(true);
      await profileContext.page
        .locator('nav.fixed[aria-label="التنقل الرئيسي"] a[href="/customers"]')
        .click();
      await waitForSearchMarker(profileContext.page, 0);
      const customerSearch = await runOfflineSearchSamples(
        "indexeddb-customer-search",
        profileContext.page,
        "customers",
        fullPilotProjectionCounts.customers,
        (sample) => alternatingSearchTerm(sample, "Customer1", "BENCH-1-0001"),
        async (sample) => {
          await profileContext.page
            .getByPlaceholder(
              "ابحث بالاسم أو الهوية أو رقم الرخصة أو الهاتف...",
            )
            .fill(alternatingSearchTerm(sample, "Customer1", "BENCH-1-0001"));
        },
      );
      recordMeasurements([customerSearch], profileContext.profile);
      await profileContext.page
        .locator('nav.fixed[aria-label="التنقل الرئيسي"] a[href="/vehicles"]')
        .click();
      await waitForSearchMarker(profileContext.page, 0);
      const vehicleSearch = await runOfflineSearchSamples(
        "indexeddb-vehicle-search",
        profileContext.page,
        "vehicles",
        fullPilotProjectionCounts.vehicles,
        (sample) => alternatingSearchTerm(sample, "Pilot", "BM-1-001"),
        async (sample) => {
          await profileContext.page
            .getByPlaceholder("ابحث بالاسم أو رقم اللوحة أو سنة الصنع...")
            .fill(alternatingSearchTerm(sample, "Pilot", "BM-1-001"));
        },
      );
      recordMeasurements([vehicleSearch], profileContext.profile);
    } finally {
      await profileContext.context.close();
      await resetBenchmark();
    }
  });

  test("diagnoses real finance page request fan-out", async ({ browser }) => {
    await resetBenchmark();
    const {
      context,
      page: loginPage,
      profile,
    } = await createMobileProfile(browser);
    try {
      await loginMobilePage(loginPage);
      await loginPage.close();
      for (const destination of new Set<"dashboard" | "analytics" | "rentals">([
        "rentals",
        "dashboard",
        "analytics",
      ])) {
        const page = await context.newPage();
        const session = await context.newCDPSession(page);
        await session.send("Network.enable");
        await setMobileNetworkOffline(session, false);
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto("/customers");
        await page
          .getByRole("heading", { name: "العملاء", exact: true })
          .waitFor();
        await syncAndWaitForFinalPull(page, fullPilotProjectionCounts);
        const requests: Array<{
          path: string;
          method: string;
          started: number;
          ended?: number;
          status?: number;
          bytes?: number;
          queueMs?: number;
        }> = [];
        const byRequest = new Map<
          import("@playwright/test").Request,
          (typeof requests)[number]
        >();
        const sizes: Promise<void>[] = [];
        let active = 0;
        let maxActive = 0;
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (!path.startsWith("/api/")) return;
          active += 1;
          maxActive = Math.max(active, maxActive);
          const entry: (typeof requests)[number] = {
            path: path.replace(
              /\/rentals\/[^/]+\/payments$/,
              "/rentals/:id/payments",
            ),
            method: request.method(),
            started: performance.now(),
          };
          requests.push(entry);
          byRequest.set(request, entry);
        });
        page.on("requestfinished", (request) => {
          const path = new URL(request.url()).pathname;
          if (!path.startsWith("/api/")) return;
          const entry = byRequest.get(request);
          if (!entry) return;
          active -= 1;
          entry.ended = performance.now();
          const timing = request.timing();
          entry.queueMs =
            timing.requestStart >= 0 ? timing.requestStart : undefined;
          sizes.push(
            (async () => {
              entry.status = (await request.response())?.status();
              const size = await request.sizes();
              entry.bytes = size.responseBodySize + size.responseHeadersSize;
            })().catch(() => undefined),
          );
        });
        page.on("requestfailed", (request) => {
          const path = new URL(request.url()).pathname;
          if (!path.startsWith("/api/")) return;
          const entry = byRequest.get(request);
          if (!entry) return;
          active -= 1;
          entry.ended = performance.now();
        });
        const started = performance.now();
        if (destination === "dashboard") {
          await page
            .locator('nav.fixed[aria-label="التنقل الرئيسي"] a[href="/"]')
            .click();
        } else if (destination === "rentals") {
          await page
            .locator(
              'nav.fixed[aria-label="التنقل الرئيسي"] a[href="/rentals"]',
            )
            .click();
        } else {
          await page
            .getByRole("button", { name: "المزيد من وحدات النظام" })
            .click();
          await page
            .locator('nav[aria-label="كل وحدات النظام"] a[href="/analytics"]')
            .click();
        }
        await page.waitForURL(
          destination === "dashboard" ? "/" : `/${destination}`,
        );
        const ready =
          destination === "analytics"
            ? page
                .locator('section[aria-label="ملخص الأداء المالي"]')
                .getByText("الأرصدة المستحقة", { exact: true })
                .locator("..")
                .locator("..")
                .locator("..")
                .locator("span.text-2xl")
            : destination === "dashboard"
              ? page
                  .getByText("الأرصدة المستحقة", { exact: true })
                  .first()
                  .locator("..")
                  .locator("..")
                  .locator("p.number-ltr")
              : page.getByRole("heading", { name: "الإيجارات", exact: true });
        try {
          await ready.waitFor({ state: "visible", timeout: 120_000 });
        } catch (error) {
          console.log(
            "SLICE3_PAGE_BLOCKER",
            JSON.stringify({
              destination,
              totalRequests: requests.length,
              paymentRequests: requests.filter(
                (item) => item.path === "/api/rentals/:id/payments",
              ).length,
              statuses: Object.entries(
                Object.groupBy(
                  requests.filter((item) => item.status !== undefined),
                  (item) => String(item.status),
                ),
              ).map(([status, items]) => [status, items?.length]),
              financialLoading: await page
                .getByLabel("جارٍ تحميل الأرصدة المستحقة")
                .count(),
              financialError: await page.getByText("تعذر تحميل القيمة").count(),
              targetCount: await ready.count(),
            }),
          );
          throw error;
        }
        if (destination === "rentals") {
          await page
            .getByTestId("payment-status-slot")
            .first()
            .waitFor({ state: "attached", timeout: 120_000 });
          await expect
            .poll(() => page.getByLabel("جارٍ تحميل حالة الدفع").count(), {
              timeout: 120_000,
            })
            .toBe(0);
        }
        const usableMs = performance.now() - started;
        await expect
          .poll(
            () =>
              requests.filter(
                (item) =>
                  item.path === "/api/payments/outstanding-balances" &&
                  item.ended !== undefined,
              ).length,
            { timeout: 120_000 },
          )
          .toBe(1);
        await expect.poll(() => active).toBe(0);
        await Promise.all(sizes);
        const summaries = requests.filter(
          (item) => item.path === "/api/payments/outstanding-balances",
        );
        const payments = requests.filter(
          (item) => item.path === "/api/rentals/:id/payments",
        );
        const counts = Object.entries(
          Object.groupBy(requests, (item) => item.path),
        ).map(([path, values]) => [path, values?.length]);
        const percent = (values: number[], p: number) =>
          values.sort((a, b) => a - b)[Math.ceil(p * values.length) - 1] ??
          null;
        const result = {
          diagnosticOnly: true,
          boundary: "navigation-to-financial-readiness",
          profile,
          destination,
          usableMs,
          totalRequests: requests.length,
          paymentRequests: payments.length,
          summaryRequests: summaries.length,
          summaryCompleted: summaries.filter((item) => item.ended !== undefined)
            .length,
          summarySuccesses: summaries.filter((item) => item.status === 200)
            .length,
          failures: requests.filter((item) => item.status !== 200).length,
          statuses: Object.entries(
            Object.groupBy(requests, (item) => String(item.status ?? "failed")),
          ).map(([status, items]) => [status, items?.length]),
          byteMeasurements: requests.filter((item) => item.bytes !== undefined)
            .length,
          maxInflight: maxActive,
          totalResponseBytes: requests.reduce(
            (sum, item) => sum + (item.bytes ?? 0),
            0,
          ),
          summaryResponseBytes: summaries.reduce(
            (sum, item) => sum + (item.bytes ?? 0),
            0,
          ),
          summaryResponseMs: summaries.map(
            (item) => (item.ended ?? item.started) - item.started,
          ),
          summaryRequestStartDelayMs: summaries.map(
            (item) => item.queueMs ?? null,
          ),
          responseP50Ms: percent(
            requests.map((item) => (item.ended ?? item.started) - item.started),
            0.5,
          ),
          responseP95Ms: percent(
            requests.map((item) => (item.ended ?? item.started) - item.started),
            0.95,
          ),
          paths: counts,
        };
        console.log("SLICE3_PAGE_PROFILE", JSON.stringify(result));
        const artifactDirectory = resolve(
          import.meta.dirname,
          "../test-results/benchmark",
        );
        await mkdir(artifactDirectory, { recursive: true });
        await writeFile(
          resolve(
            artifactDirectory,
            `slice3-${destination}-${new Date().toISOString().replaceAll(":", "-")}.json`,
          ),
          JSON.stringify(result, null, 2),
        );
        expect(payments).toHaveLength(0);
        expect(summaries).toHaveLength(1);
        expect(summaries[0]?.status).toBe(200);
        expect(result.failures).toBe(0);
        await page.close();
      }
    } finally {
      await context.close();
      await resetBenchmark();
    }
  });
});
