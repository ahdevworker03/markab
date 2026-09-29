import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOfflineStore } from "./storage";

const tenantA = { organizationId: "organization-a", userId: "user-a" };
const tenantB = { organizationId: "organization-b", userId: "user-b" };

type Range = { value?: unknown; lower?: unknown; upper?: unknown };
type StoredRecord = Record<string, unknown>;

Object.defineProperty(globalThis, "IDBKeyRange", {
  configurable: true,
  value: {
    only(value: unknown): Range {
      return { value };
    },
    bound(lower: unknown, upper: unknown): Range {
      return { lower, upper };
    },
  },
});

function keyFor(record: StoredRecord): string {
  return [
    record.tenantKey,
    record.id ?? record.operation_id ?? record.key,
  ].join(":");
}

function request<T>(result: T): IDBRequest<T> {
  const value = {} as IDBRequest<T>;
  queueMicrotask(() => {
    Object.assign(value, { result });
    value.onsuccess?.(new Event("success"));
  });
  return value;
}

function createFakeIndexedDb(): IDBFactory {
  const stores = new Map<string, Map<string, StoredRecord>>();
  const storeNames = {
    contains(name: string) {
      return stores.has(name);
    },
  } as DOMStringList;

  const objectStore = (name: string) => {
    const records = stores.get(name)!;
    const valuesFor = (indexName: string, range?: Range) => {
      const keyForIndex = (record: StoredRecord) =>
        indexName === "byTenantCreatedAt"
          ? [record.tenantKey, record.createdAt, record.operation_id]
          : [record.tenantKey];
      const compare = (left: unknown[], right: unknown[]) =>
        left
          .map(String)
          .join("\u0000")
          .localeCompare(right.map(String).join("\u0000"));

      return [...records.values()]
        .filter((record) => {
          const key = keyForIndex(record);
          if (range?.value !== undefined) return key[0] === range.value;
          if (!Array.isArray(range?.lower) || !Array.isArray(range.upper))
            return true;
          return (
            compare(key, range.lower) >= 0 && compare(key, range.upper) <= 0
          );
        })
        .sort((left, right) => compare(keyForIndex(left), keyForIndex(right)));
    };
    return {
      put(record: StoredRecord) {
        records.set(keyFor(record), structuredClone(record));
      },
      delete(key: unknown[]) {
        records.delete(key.join(":"));
      },
      get(key: unknown[]) {
        return request(structuredClone(records.get(key.join(":"))));
      },
      index(indexName: string) {
        return {
          getAll(range?: Range, limit?: number) {
            return request(
              structuredClone(valuesFor(indexName, range).slice(0, limit)),
            );
          },
          getAllKeys(range?: Range) {
            return request(
              valuesFor(indexName, range).map((record) => {
                const id = record.id ?? record.operation_id ?? record.key;
                return [record.tenantKey, id];
              }),
            );
          },
        };
      },
    } as unknown as IDBObjectStore;
  };

  const database = {
    objectStoreNames: storeNames,
    createObjectStore(name: string) {
      stores.set(name, new Map());
      return { createIndex() {} } as IDBObjectStore;
    },
    transaction(_names: string | string[]) {
      const transaction = {
        objectStore(name: string) {
          return objectStore(name);
        },
      } as IDBTransaction;
      setTimeout(() => transaction.oncomplete?.(new Event("complete")), 0);
      return transaction;
    },
    close() {},
  } as unknown as IDBDatabase;

  return {
    open() {
      const openRequest = { result: database } as IDBOpenDBRequest;
      queueMicrotask(() => {
        openRequest.onupgradeneeded?.(new Event("upgradeneeded"));
        openRequest.onsuccess?.(new Event("success"));
      });
      return openRequest;
    },
  } as IDBFactory;
}

function customerChange(id: string) {
  return {
    resource_type: "CUSTOMER" as const,
    resource_id: id,
    updated_at: "2026-09-23T12:00:00.000Z",
    deleted: false,
    customer: {
      id,
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "10000000",
      address: "Beirut",
      nationalId: "national-id",
      licenseNumber: "license-number",
      licenseExpiryDate: "2030-01-01",
      createdAt: "2026-09-23T12:00:00.000Z",
      updatedAt: "2026-09-23T12:00:00.000Z",
    },
  };
}

function queuedCustomerCreate(operationId: string) {
  return {
    operation_id: operationId,
    type: "CUSTOMER_CREATE" as const,
    customer_create: {
      first_name: "Ada",
      last_name: "Lovelace",
      phone: "10000000",
      address: "Beirut",
      national_id: `national-${operationId}`,
      license_number: `license-${operationId}`,
      license_expiry_date: "2030-01-01",
    },
    createdAt: "2026-09-23T12:00:00.000Z",
    attempts: 0,
    state: "PENDING" as const,
  };
}

describe("OfflineStore", () => {
  let store: ReturnType<typeof createOfflineStore>;
  const indexedDb = createFakeIndexedDb();

  beforeEach(async () => {
    store = createOfflineStore(indexedDb);
    await store.clearWorkspace(tenantA);
    await store.clearWorkspace(tenantB);
  });

  afterEach(() => store.close());

  it("does not return tenant A customers to tenant B", async () => {
    await store.applyPull(tenantA, [customerChange("customer-a")], "cursor-a");

    expect(await store.getCustomers(tenantB)).toEqual([]);
    expect(await store.getCustomers(tenantA)).toHaveLength(1);
  });

  it("removes tombstoned projections and stores a completed pull cursor", async () => {
    await store.applyPull(tenantA, [customerChange("customer-a")], null);
    await store.applyPull(
      tenantA,
      [{ ...customerChange("customer-a"), deleted: true, customer: null }],
      "cursor-a",
    );

    expect(await store.getCustomers(tenantA)).toEqual([]);
    await expect(store.getCompletionCursor(tenantA)).resolves.toBe("cursor-a");
  });

  it("applies page changes before storing the completion cursor on the final page", async () => {
    await store.applyPull(tenantA, [customerChange("customer-a")], null);

    await expect(store.getCustomers(tenantA)).resolves.toHaveLength(1);
    await expect(store.getCompletionCursor(tenantA)).resolves.toBeUndefined();

    await store.applyPull(tenantA, [], "cursor-a");

    await expect(store.getCompletionCursor(tenantA)).resolves.toBe("cursor-a");
  });

  it("persists FIFO outbox operations across a reopened database", async () => {
    await store.enqueue(tenantA, queuedCustomerCreate("first"));
    await store.enqueue(tenantA, queuedCustomerCreate("second"));
    await store.close();

    const reopenedStore = createOfflineStore(indexedDb);
    expect(
      (await reopenedStore.listOutbox(tenantA, 25)).map(
        (item) => item.operation_id,
      ),
    ).toEqual(["first", "second"]);
    await reopenedStore.close();
  });

  it("uses the tenant-scoped FIFO index when limiting outbox results", async () => {
    await store.enqueue(tenantA, {
      ...queuedCustomerCreate("third"),
      createdAt: "2026-09-23T12:00:03.000Z",
    });
    await store.enqueue(tenantA, {
      ...queuedCustomerCreate("first"),
      createdAt: "2026-09-23T12:00:01.000Z",
    });
    await store.enqueue(tenantA, {
      ...queuedCustomerCreate("second"),
      createdAt: "2026-09-23T12:00:02.000Z",
    });
    await store.enqueue(tenantB, {
      ...queuedCustomerCreate("tenant-b"),
      createdAt: "2026-09-23T12:00:00.000Z",
    });

    expect(
      (await store.listOutbox(tenantA, 2)).map((item) => item.operation_id),
    ).toEqual(["first", "second"]);
  });

  it("rejects a rental with a provisional customer ID despite a create dependency", async () => {
    await expect(
      store.enqueue(tenantA, {
        operation_id: "invalid-rental-create",
        type: "RENTAL_CREATE",
        rental_create: {
          customer_id: "local:customer-create",
          vehicle_id: "vehicle-a",
          pickup_date: "2026-09-24T12:00:00.000Z",
          expected_return_date: "2026-09-25T12:00:00.000Z",
          daily_rate: 100,
          total_amount: 100,
          deposit_amount: 50,
          customer_reference: {
            customer_create_operation_id: "customer-create",
          },
        },
        createdAt: "2026-09-23T12:00:01.000Z",
        attempts: 0,
        state: "PENDING",
      }),
    ).rejects.toThrow("Provisional rental customer IDs are not allowed");
  });

  it("replaces a provisional customer and rewrites dependent local rentals", async () => {
    const operation = queuedCustomerCreate("customer-create");
    await store.enqueue(tenantA, {
      ...operation,
      localProjection: {
        customer: {
          localId: "local:customer-create",
          operationId: "customer-create",
          customer: operation.customer_create,
        },
      },
    });
    await expect(
      store.getCustomer(tenantA, "local:customer-create"),
    ).resolves.toEqual({
      localId: "local:customer-create",
      operationId: "customer-create",
      customer: operation.customer_create,
    });
    await store.enqueue(tenantA, {
      operation_id: "rental-create",
      type: "RENTAL_CREATE",
      rental_create: {
        vehicle_id: "vehicle-a",
        pickup_date: "2026-09-24T12:00:00.000Z",
        expected_return_date: "2026-09-25T12:00:00.000Z",
        daily_rate: 100,
        total_amount: 100,
        deposit_amount: 50,
        customer_reference: { customer_create_operation_id: "customer-create" },
      },
      createdAt: "2026-09-23T12:00:01.000Z",
      attempts: 0,
      state: "PENDING",
      localProjection: {
        rental: {
          id: "local:rental-create",
          customerId: "local:customer-create",
          vehicleId: "vehicle-a",
          pickupDate: "2026-09-24T12:00:00.000Z",
          expectedReturnDate: "2026-09-25T12:00:00.000Z",
          status: "RESERVED",
          dailyRate: 100,
          totalAmount: 100,
          depositAmount: 50,
          createdAt: "2026-09-23T12:00:01.000Z",
          updatedAt: "2026-09-23T12:00:01.000Z",
        },
      },
    });
    await expect(
      store.getOutboxItem(tenantA, "rental-create"),
    ).resolves.not.toHaveProperty("rental_create.customer_id");
    const queuedRental = await store.getOutboxItem(tenantA, "rental-create");
    await expect(
      store.updateOutbox(tenantA, {
        ...queuedRental!,
        rental_create: {
          ...queuedRental!.rental_create!,
          customer_id: "local:customer-create",
        },
      }),
    ).rejects.toThrow("Provisional rental customer IDs are not allowed");

    await store.reconcileCustomerCreate(tenantA, "customer-create", {
      ...customerChange("customer-a").customer!,
      id: "customer-a",
    });

    await expect(
      store.getCustomer(tenantA, "local:customer-create"),
    ).resolves.toBeUndefined();
    await expect(
      store.getCustomer(tenantA, "customer-a"),
    ).resolves.toMatchObject({
      id: "customer-a",
    });
    await expect(
      store.getRental(tenantA, "local:rental-create"),
    ).resolves.toMatchObject({
      customerId: "customer-a",
    });
    await expect(
      store.getOutboxItem(tenantA, "rental-create"),
    ).resolves.toMatchObject({
      localProjection: { rental: { customerId: "customer-a" } },
    });
  });

  it("atomically replaces a stale customer conflict with a reapply operation", async () => {
    const stale = {
      ...queuedCustomerCreate("stale-update"),
      type: "CUSTOMER_UPDATE" as const,
      customer_create: null,
      customer_update: {
        customer_id: "customer-a",
        expected_updated_at: "2026-09-23T12:00:00.000Z",
        first_name: "Ada",
        last_name: "Byron",
        phone: "10000000",
        address: "Beirut",
        national_id: "national-a",
        license_number: "license-a",
        license_expiry_date: "2030-01-01",
      },
      state: "CONFLICT" as const,
    };
    await store.enqueue(tenantA, stale);
    const replacement = {
      ...stale,
      operation_id: "reapplied-update",
      createdAt: "2026-09-24T12:00:00.000Z",
      attempts: 0,
      state: "PENDING" as const,
      customer_update: {
        ...stale.customer_update,
        expected_updated_at: "2026-09-24T08:00:00.000Z",
      },
      localProjection: {
        customer: {
          ...customerChange("customer-a").customer!,
          lastName: "Byron",
          updatedAt: "2026-09-24T08:00:00.000Z",
        },
      },
    };

    await store.replaceCustomerConflict(tenantA, "stale-update", replacement);

    await expect(
      store.getOutboxItem(tenantA, "stale-update"),
    ).resolves.toBeUndefined();
    await expect(
      store.getOutboxItem(tenantA, "reapplied-update"),
    ).resolves.toEqual(replacement);
    await expect(
      store.getCustomer(tenantA, "customer-a"),
    ).resolves.toMatchObject({
      lastName: "Byron",
      updatedAt: "2026-09-24T08:00:00.000Z",
    });
  });

  it("restores the retained authoritative customer when discarding a conflict", async () => {
    const currentCustomer = customerChange("customer-a").customer!;
    await store.enqueue(tenantA, {
      ...queuedCustomerCreate("stale-update"),
      type: "CUSTOMER_UPDATE",
      customer_create: null,
      customer_update: {
        customer_id: "customer-a",
        expected_updated_at: "2026-09-23T12:00:00.000Z",
        first_name: "Ada",
        last_name: "Byron",
        phone: "10000000",
        address: "Beirut",
        national_id: "national-a",
        license_number: "license-a",
        license_expiry_date: "2030-01-01",
      },
      state: "CONFLICT",
      result: {
        status: "CONFLICT",
        code: "SYNC_CUSTOMER_STALE",
        resource_type: "CUSTOMER",
        current_customer: currentCustomer,
      },
      localProjection: { customer: { ...currentCustomer, lastName: "Byron" } },
    });

    await store.discardCustomerConflict(tenantA, "stale-update");

    await expect(store.getCustomer(tenantA, "customer-a")).resolves.toEqual(
      currentCustomer,
    );
    await expect(
      store.getOutboxItem(tenantA, "stale-update"),
    ).resolves.toBeUndefined();
  });

  it("discards only rejected or expired action-required operations", async () => {
    await store.enqueue(tenantA, {
      ...queuedCustomerCreate("rejected"),
      state: "REJECTED",
    });
    await store.enqueue(tenantA, {
      ...queuedCustomerCreate("pending"),
      state: "PENDING",
    });

    await store.discardActionRequired(tenantA, "rejected");

    await expect(
      store.getOutboxItem(tenantA, "rejected"),
    ).resolves.toBeUndefined();
    await expect(
      store.getOutboxItem(tenantA, "pending"),
    ).resolves.toBeDefined();
    await expect(
      store.discardActionRequired(tenantA, "pending"),
    ).rejects.toThrow("not action-required");
  });

  it("atomically discards a rejected rental and its matching provisional projection", async () => {
    await store.enqueue(tenantA, {
      operation_id: "rejected-rental",
      type: "RENTAL_CREATE",
      rental_create: {
        customer_id: "customer-a",
        vehicle_id: "vehicle-a",
        pickup_date: "2026-09-24T12:00:00.000Z",
        expected_return_date: "2026-09-25T12:00:00.000Z",
        daily_rate: 100,
        total_amount: 100,
        deposit_amount: 50,
        customer_reference: { customer_id: "customer-a" },
      },
      createdAt: "2026-09-23T12:00:00.000Z",
      attempts: 1,
      state: "REJECTED",
      localProjection: {
        rental: {
          id: "local:rejected-rental",
          customerId: "customer-a",
          vehicleId: "vehicle-a",
          pickupDate: "2026-09-24T12:00:00.000Z",
          expectedReturnDate: "2026-09-25T12:00:00.000Z",
          status: "RESERVED",
          dailyRate: 100,
          totalAmount: 100,
          depositAmount: 50,
          createdAt: "2026-09-23T12:00:00.000Z",
          updatedAt: "2026-09-23T12:00:00.000Z",
        },
      },
    });

    await store.discardActionRequired(tenantA, "rejected-rental");

    await expect(
      store.getOutboxItem(tenantA, "rejected-rental"),
    ).resolves.toBeUndefined();
    await expect(
      store.getRental(tenantA, "local:rejected-rental"),
    ).resolves.toBeUndefined();
  });
});
