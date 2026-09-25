import type {
  CustomerResponse,
  RentalResponse,
  SyncPullChange,
  VehicleResponse,
} from "@workspace/api-client-react";
import type {
  OfflineStore,
  OfflineWorkspace,
  ProvisionalCustomer,
  QueuedOperation,
} from "./types";

const databaseName = "markab-offline-v1";
const databaseVersion = 1;
const projectionStores = ["customers", "vehicles", "rentals"] as const;
const allStores = [...projectionStores, "outbox", "metadata"] as const;

type ProjectionStore = (typeof projectionStores)[number];
type StoreName = (typeof allStores)[number];
type TenantRecord<T> = T & { tenantKey: string };
type MetadataRecord = { tenantKey: string; key: string; value: string };
type CustomerProjection = CustomerResponse | ProvisionalCustomer;

function tenantKey({ organizationId, userId }: OfflineWorkspace): string {
  return `${organizationId}:${userId}`;
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () =>
      reject(value.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function createStore(database: IDBDatabase, name: StoreName): void {
  const store = database.createObjectStore(name, {
    keyPath:
      name === "metadata"
        ? ["tenantKey", "key"]
        : name === "outbox"
          ? ["tenantKey", "operation_id"]
          : ["tenantKey", "id"],
  });
  store.createIndex("byTenant", "tenantKey");
  if (name === "outbox") {
    store.createIndex("byTenantCreatedAt", [
      "tenantKey",
      "createdAt",
      "operation_id",
    ]);
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openRequest = factory.open(databaseName, databaseVersion);
    openRequest.onupgradeneeded = () => {
      const database = openRequest.result;
      for (const store of allStores) {
        if (!database.objectStoreNames.contains(store))
          createStore(database, store);
      }
    };
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () =>
      reject(openRequest.error ?? new Error("Unable to open IndexedDB"));
  });
}

function withoutTenantKey<T extends { tenantKey: string }>(
  record: T,
): Omit<T, "tenantKey"> {
  const { tenantKey: _tenantKey, ...value } = record;
  return value;
}

function customerProjection(
  record: TenantRecord<CustomerProjection>,
): CustomerProjection {
  const value = withoutTenantKey(record);
  if ("localId" in value) {
    const { id: _id, ...customer } = value as ProvisionalCustomer & {
      id: string;
    };
    return customer;
  }
  return value as CustomerResponse;
}

function projectionStore(change: SyncPullChange): ProjectionStore {
  switch (change.resource_type) {
    case "CUSTOMER":
      return "customers";
    case "VEHICLE":
      return "vehicles";
    case "RENTAL":
      return "rentals";
  }
}

function projection(
  change: SyncPullChange,
): CustomerResponse | VehicleResponse | RentalResponse {
  switch (change.resource_type) {
    case "CUSTOMER":
      if (change.customer) return change.customer;
      break;
    case "VEHICLE":
      if (change.vehicle) return change.vehicle;
      break;
    case "RENTAL":
      if (change.rental) return change.rental;
      break;
  }
  throw new Error(
    `Pull change ${change.resource_id} is missing its projection`,
  );
}

function serializedOperation(operation: QueuedOperation): QueuedOperation {
  const rental = operation.rental_create;
  if (!rental) return operation;

  const { customer_reference: customerReference } = rental;
  if (
    rental.customer_id?.startsWith("local:") ||
    customerReference.customer_id?.startsWith("local:")
  ) {
    throw new Error("Provisional rental customer IDs are not allowed");
  }
  return operation;
}

export function createOfflineStore(
  factory = globalThis.indexedDB,
): OfflineStore {
  let database: Promise<IDBDatabase> | undefined;

  const getDatabase = () => {
    if (!factory) throw new Error("IndexedDB is unavailable");
    database ??= openDatabase(factory);
    return database;
  };

  const getProjection = async <T>(
    workspace: OfflineWorkspace,
    storeName: ProjectionStore,
    id: string,
  ): Promise<T | undefined> => {
    const db = await getDatabase();
    const transaction = db.transaction(storeName, "readonly");
    const record = await request(
      transaction.objectStore(storeName).get([tenantKey(workspace), id]),
    );
    await transactionDone(transaction);
    return record
      ? (withoutTenantKey(record as TenantRecord<T>) as T)
      : undefined;
  };

  const listProjection = async <T>(
    workspace: OfflineWorkspace,
    storeName: ProjectionStore,
  ): Promise<T[]> => {
    const db = await getDatabase();
    const transaction = db.transaction(storeName, "readonly");
    const records = await request(
      transaction
        .objectStore(storeName)
        .index("byTenant")
        .getAll(IDBKeyRange.only(tenantKey(workspace))),
    );
    await transactionDone(transaction);
    return (records as TenantRecord<T>[]).map(
      (record) => withoutTenantKey(record) as T,
    );
  };

  return {
    async open(_workspace) {
      await getDatabase();
    },

    async close() {
      if (!database) return;
      (await database).close();
      database = undefined;
    },

    getCustomers(workspace) {
      return listProjection<CustomerProjection>(workspace, "customers").then(
        (records) =>
          records.map((record) => {
            if ("localId" in record) {
              const { id: _id, ...customer } = record as ProvisionalCustomer & {
                id: string;
              };
              return customer;
            }
            return record;
          }),
      );
    },

    async getCustomer(workspace, id) {
      const db = await getDatabase();
      const transaction = db.transaction("customers", "readonly");
      const record = await request(
        transaction.objectStore("customers").get([tenantKey(workspace), id]),
      );
      await transactionDone(transaction);
      return record
        ? customerProjection(record as TenantRecord<CustomerProjection>)
        : undefined;
    },

    getVehicles(workspace) {
      return listProjection<VehicleResponse>(workspace, "vehicles");
    },

    getVehicle(workspace, id) {
      return getProjection<VehicleResponse>(workspace, "vehicles", id);
    },

    getRental(workspace, id) {
      return getProjection<RentalResponse>(workspace, "rentals", id);
    },

    async getCompletionCursor(workspace) {
      const db = await getDatabase();
      const transaction = db.transaction("metadata", "readonly");
      const record = await request(
        transaction
          .objectStore("metadata")
          .get([tenantKey(workspace), "completion_cursor"]),
      );
      await transactionDone(transaction);
      return (record as MetadataRecord | undefined)?.value;
    },

    async applyPull(workspace, changes, completionCursor) {
      const db = await getDatabase();
      const transaction = db.transaction(
        [...projectionStores, "metadata"],
        "readwrite",
      );
      const key = tenantKey(workspace);

      for (const change of changes) {
        const store = transaction.objectStore(projectionStore(change));
        if (change.deleted) store.delete([key, change.resource_id]);
        else store.put({ ...projection(change), tenantKey: key });
      }
      if (completionCursor) {
        transaction.objectStore("metadata").put({
          tenantKey: key,
          key: "completion_cursor",
          value: completionCursor,
        } satisfies MetadataRecord);
      }
      await transactionDone(transaction);
    },

    async enqueue(workspace, operation) {
      const db = await getDatabase();
      const transaction = db.transaction(
        ["customers", "rentals", "outbox"],
        "readwrite",
      );
      const key = tenantKey(workspace);
      const { localProjection } = operation;

      if (localProjection?.customer) {
        const customer = localProjection.customer;
        const id = "localId" in customer ? customer.localId : customer.id;
        transaction
          .objectStore("customers")
          .put({ ...customer, id, tenantKey: key });
      }
      if (localProjection?.rental) {
        transaction
          .objectStore("rentals")
          .put({ ...localProjection.rental, tenantKey: key });
      }
      transaction
        .objectStore("outbox")
        .put({ ...serializedOperation(operation), tenantKey: key });
      await transactionDone(transaction);
    },

    async listOutbox(workspace, limit) {
      const db = await getDatabase();
      const transaction = db.transaction("outbox", "readonly");
      const range = IDBKeyRange.bound(
        [tenantKey(workspace), "", ""],
        [tenantKey(workspace), "\uffff", "\uffff"],
      );
      const records = await request(
        transaction
          .objectStore("outbox")
          .index("byTenantCreatedAt")
          .getAll(range, limit),
      );
      await transactionDone(transaction);
      return (records as TenantRecord<QueuedOperation>[]).map(withoutTenantKey);
    },

    async getOutboxItem(workspace, operationId) {
      const db = await getDatabase();
      const transaction = db.transaction("outbox", "readonly");
      const record = await request(
        transaction
          .objectStore("outbox")
          .get([tenantKey(workspace), operationId]),
      );
      await transactionDone(transaction);
      return record
        ? (withoutTenantKey(
            record as TenantRecord<QueuedOperation>,
          ) as QueuedOperation)
        : undefined;
    },

    async updateOutbox(workspace, operation) {
      const db = await getDatabase();
      const transaction = db.transaction("outbox", "readwrite");
      transaction.objectStore("outbox").put({
        ...serializedOperation(operation),
        tenantKey: tenantKey(workspace),
      });
      await transactionDone(transaction);
    },

    async removeOutbox(workspace, operationId) {
      const db = await getDatabase();
      const transaction = db.transaction("outbox", "readwrite");
      transaction
        .objectStore("outbox")
        .delete([tenantKey(workspace), operationId]);
      await transactionDone(transaction);
    },

    async replaceCustomerConflict(workspace, operationId, replacement) {
      const db = await getDatabase();
      const transaction = db.transaction(["customers", "outbox"], "readwrite");
      const key = tenantKey(workspace);
      const outbox = transaction.objectStore("outbox");
      const existing = (await request(outbox.get([key, operationId]))) as
        TenantRecord<QueuedOperation> | undefined;
      if (
        existing?.state !== "CONFLICT" ||
        existing.type !== "CUSTOMER_UPDATE" ||
        replacement.type !== "CUSTOMER_UPDATE" ||
        replacement.state !== "PENDING"
      ) {
        throw new Error("Outbox item is not a reapplicable customer conflict");
      }

      const customer = replacement.localProjection?.customer;
      if (customer && "localId" in customer) {
        throw new Error(
          "Customer conflict replacement requires an authoritative customer",
        );
      }
      if (customer) {
        transaction
          .objectStore("customers")
          .put({ ...customer, tenantKey: key });
      }
      outbox.delete([key, operationId]);
      outbox.put({ ...serializedOperation(replacement), tenantKey: key });
      await transactionDone(transaction);
    },

    async discardCustomerConflict(workspace, operationId) {
      const db = await getDatabase();
      const transaction = db.transaction(["customers", "outbox"], "readwrite");
      const key = tenantKey(workspace);
      const outbox = transaction.objectStore("outbox");
      const existing = (await request(outbox.get([key, operationId]))) as
        TenantRecord<QueuedOperation> | undefined;
      const currentCustomer = existing?.result?.current_customer;
      if (
        existing?.state !== "CONFLICT" ||
        existing.type !== "CUSTOMER_UPDATE" ||
        !currentCustomer
      ) {
        throw new Error("Outbox item is not a customer conflict");
      }
      transaction.objectStore("customers").put({
        ...currentCustomer,
        tenantKey: key,
      });
      outbox.delete([key, operationId]);
      await transactionDone(transaction);
    },

    async discardActionRequired(workspace, operationId) {
      const db = await getDatabase();
      const transaction = db.transaction(
        ["customers", "rentals", "outbox"],
        "readwrite",
      );
      const key = tenantKey(workspace);
      const outbox = transaction.objectStore("outbox");
      const existing = (await request(outbox.get([key, operationId]))) as
        TenantRecord<QueuedOperation> | undefined;
      if (existing?.state !== "REJECTED" && existing?.state !== "EXPIRED") {
        throw new Error("Outbox item is not action-required");
      }
      const customer = existing.localProjection?.customer;
      if (
        customer &&
        "localId" in customer &&
        customer.localId === `local:${operationId}`
      ) {
        transaction.objectStore("customers").delete([key, customer.localId]);
      }
      const rental = existing.localProjection?.rental;
      if (rental?.id === `local:${operationId}`) {
        transaction.objectStore("rentals").delete([key, rental.id]);
      }
      outbox.delete([key, operationId]);
      await transactionDone(transaction);
    },

    async reconcileCustomerCreate(workspace, operationId, customer) {
      const db = await getDatabase();
      const transaction = db.transaction(
        ["customers", "rentals", "outbox"],
        "readwrite",
      );
      const key = tenantKey(workspace);
      const localId = `local:${operationId}`;
      const customers = transaction.objectStore("customers");
      const rentals = transaction.objectStore("rentals");
      const outbox = transaction.objectStore("outbox");

      customers.delete([key, localId]);
      customers.put({ ...customer, tenantKey: key });
      const rentalRecords = await request(
        rentals.index("byTenant").getAll(IDBKeyRange.only(key)),
      );
      for (const rental of rentalRecords as TenantRecord<RentalResponse>[]) {
        if (rental.customerId === localId) {
          rentals.put({ ...rental, customerId: customer.id });
        }
      }
      const outboxRecords = await request(
        outbox.index("byTenant").getAll(IDBKeyRange.only(key)),
      );
      for (const operation of outboxRecords as TenantRecord<QueuedOperation>[]) {
        const rental = operation.localProjection?.rental;
        if (rental?.customerId === localId) {
          outbox.put(
            serializedOperation({
              ...operation,
              localProjection: {
                ...operation.localProjection,
                rental: { ...rental, customerId: customer.id },
              },
            }),
          );
        }
      }
      await transactionDone(transaction);
    },

    async clearWorkspace(workspace) {
      const db = await getDatabase();
      const transaction = db.transaction(allStores, "readwrite");
      const key = tenantKey(workspace);
      for (const storeName of allStores) {
        const store = transaction.objectStore(storeName);
        const keys = await request(
          store.index("byTenant").getAllKeys(IDBKeyRange.only(key)),
        );
        for (const recordKey of keys) store.delete(recordKey);
      }
      await transactionDone(transaction);
    },
  };
}
