import { expect, test, type Page } from "@playwright/test";
import {
  benchmarkDatasetCounts,
  createMobileProfile,
  login,
  requestJson,
  resetBenchmark,
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
  const observe = (response: { url(): string; status(): number }) => {
    if (new URL(response.url()).pathname === "/api/sync/pull") {
      observed.push(String(response.status()));
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

async function runOfflineSearchSamples(
  name: string,
  page: Page,
  action: (sample: number) => Promise<void>,
): Promise<Measurement> {
  let apiRequests: string[] = [];
  const observeRequest = (request: { method(): string; url(): string }) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      apiRequests.push(`${request.method()} ${url.pathname}`);
    }
  };
  const measurement = await runSamples(name, action, {
    ...sampling,
    beforeSample: async () => {
      await assertOfflineLocal(page);
      apiRequests = [];
      page.on("request", observeRequest);
    },
    afterSample: async () => {
      page.off("request", observeRequest);
      expect(apiRequests).toEqual([]);
    },
  });
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
    const { context, page, profile } = profileContext;
    try {
      await loginMobilePage(page, await login(request));
      await syncAndWaitForFinalPull(page, fullPilotProjectionCounts);
      let queuedCount = 0;
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
          await context.setOffline(false);
          await syncAndWaitForFinalPull(page, {
            ...fullPilotProjectionCounts,
            customers: fullPilotProjectionCounts.customers + queuedCount,
          });
          await expect.poll(outboxCount).toBe(0);
        },
        {
          ...sampling,
          beforeSample: async (sample) => {
            await context.setOffline(true);
            await page.evaluate((number) => {
              return new Promise<void>((resolve, reject) => {
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
                      resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                    transaction.onabort = () => reject(transaction.error);
                  };
                };
              });
            }, sample);
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
      const customerSearch = await runOfflineSearchSamples(
        "indexeddb-customer-search",
        profileContext.page,
        async (sample) => {
          await profileContext.page
            .getByPlaceholder(
              "ابحث بالاسم أو الهوية أو رقم الرخصة أو الهاتف...",
            )
            .fill(sample % 2 ? "Customer1" : "BENCH-1-0001");
          await expect(
            profileContext.page
              .locator("span:visible", { hasText: /^Customer1 0001$/ })
              .first(),
          ).toBeVisible();
        },
      );
      recordMeasurements([customerSearch], profileContext.profile);
      await profileContext.page
        .locator('nav.fixed[aria-label="التنقل الرئيسي"] a[href="/vehicles"]')
        .click();
      const vehicleSearch = await runOfflineSearchSamples(
        "indexeddb-vehicle-search",
        profileContext.page,
        async (sample) => {
          await profileContext.page
            .getByPlaceholder("ابحث بالاسم أو رقم اللوحة أو سنة الصنع...")
            .fill(sample % 2 ? "Pilot" : "BM-1-001");
          await expect(
            profileContext.page
              .locator("span:visible", { hasText: /^Toyota Pilot 1$/ })
              .first(),
          ).toBeVisible();
        },
      );
      recordMeasurements([vehicleSearch], profileContext.profile);
    } finally {
      await profileContext.context.close();
      await resetBenchmark();
    }
  });
});
