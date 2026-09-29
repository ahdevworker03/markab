import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  syncPull,
  type CustomerResponse,
  SyncOperationResult,
  SyncPullResponse,
  SyncPushResponse,
} from "@workspace/api-client-react";
import { createSyncCoordinator } from "./sync";
import type { OfflineStore, OfflineWorkspace, QueuedOperation } from "./types";

const workspace: OfflineWorkspace = {
  organizationId: "organization-a",
  userId: "user-a",
};

function operation(id: string): QueuedOperation {
  return {
    operation_id: id,
    type: "CUSTOMER_CREATE",
    customer_create: {
      first_name: "Ada",
      last_name: "Lovelace",
      phone: "10000000",
      address: "Beirut",
      national_id: `national-${id}`,
      license_number: `license-${id}`,
      license_expiry_date: "2030-01-01",
    },
    createdAt: `2026-09-23T12:00:${id.padStart(2, "0")}.000Z`,
    attempts: 0,
    state: "PENDING",
  };
}

function applied(id: string): SyncOperationResult {
  return {
    operation_id: id,
    type: "CUSTOMER_CREATE",
    status: "APPLIED",
    code: "SYNC_APPLIED",
    resource_type: "CUSTOMER",
    customer: customer(id),
  };
}

function customer(id: string): CustomerResponse {
  return {
    id: `customer-${id}`,
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "10000000",
    address: "Beirut",
    nationalId: `national-${id}`,
    licenseNumber: `license-${id}`,
    licenseExpiryDate: "2030-01-01",
    createdAt: "2026-09-23T12:00:00.000Z",
    updatedAt: "2026-09-23T12:00:00.000Z",
  };
}

function pullPage(
  changes: SyncPullResponse["changes"] = [],
  next_cursor: string | null = null,
  completion_cursor: string | null = "complete",
): SyncPullResponse {
  return { changes, next_cursor, completion_cursor };
}

function apiError(status: number, code?: string): ApiError {
  return new ApiError(
    new Response(null, { status }),
    code ? { error: { code } } : null,
    { method: "POST", url: "/sync/push" },
  );
}

function createStore(initial: QueuedOperation[] = []): OfflineStore {
  const outbox = new Map(initial.map((item) => [item.operation_id, item]));
  return {
    open: vi.fn(),
    close: vi.fn(),
    getCustomers: vi.fn(),
    getCustomer: vi.fn(),
    getVehicles: vi.fn(),
    getVehicle: vi.fn(),
    getRental: vi.fn(),
    getCompletionCursor: vi.fn().mockResolvedValue(undefined),
    applyPull: vi.fn(),
    enqueue: vi.fn(),
    listOutbox: vi.fn(async (_workspace, limit) =>
      [...outbox.values()].slice(0, limit),
    ),
    getOutboxItem: vi.fn(async (_workspace, operationId) =>
      outbox.get(operationId),
    ),
    updateOutbox: vi.fn(async (_workspace, item) => {
      outbox.set(item.operation_id, item);
    }),
    removeOutbox: vi.fn(async (_workspace, operationId) => {
      outbox.delete(operationId);
    }),
    replaceCustomerConflict: vi.fn(),
    discardCustomerConflict: vi.fn(),
    discardActionRequired: vi.fn(),
    reconcileCustomerCreate: vi.fn(),
    clearWorkspace: vi.fn(),
  };
}

describe("createSyncCoordinator", () => {
  it("sends pending operations in FIFO batches of at most 25", async () => {
    const operations = Array.from({ length: 26 }, (_, index) =>
      operation(String(index + 1)),
    );
    const store = createStore(operations);
    const push = vi
      .fn()
      .mockResolvedValueOnce({
        results: operations
          .slice(0, 25)
          .map(({ operation_id }) => applied(operation_id)),
      })
      .mockResolvedValueOnce({ results: [applied("26")] });
    const pull = vi.fn().mockResolvedValue(pullPage());
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push,
      pull,
      onStatus: vi.fn(),
    });

    await coordinator.syncNow();

    expect(push).toHaveBeenNthCalledWith(1, {
      operations: operations.slice(0, 25),
    });
    expect(push).toHaveBeenNthCalledWith(2, {
      operations: operations.slice(25),
    });
  });

  it("waits for a customer create to complete before sending a dependent rental", async () => {
    const customerCreate = operation("customer-create");
    const rentalCreate: QueuedOperation = {
      operation_id: "rental-create",
      type: "RENTAL_CREATE",
      rental_create: {
        vehicle_id: "vehicle-a",
        pickup_date: "2026-09-24T12:00:00.000Z",
        expected_return_date: "2026-09-25T12:00:00.000Z",
        daily_rate: 100,
        total_amount: 100,
        deposit_amount: 50,
        customer_reference: {
          customer_create_operation_id: customerCreate.operation_id,
        },
      },
      createdAt: "2026-09-23T12:01:00.000Z",
      attempts: 0,
      state: "PENDING",
    };
    const store = createStore([customerCreate, rentalCreate]);
    const push = vi
      .fn()
      .mockResolvedValueOnce({
        results: [applied(customerCreate.operation_id)],
      })
      .mockResolvedValueOnce({
        results: [
          {
            operation_id: rentalCreate.operation_id,
            type: "RENTAL_CREATE",
            status: "REJECTED",
            code: "VEHICLE_UNAVAILABLE",
            resource_type: "RENTAL",
          },
        ],
      });
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push,
      pull: vi.fn().mockResolvedValue(pullPage()),
      onStatus: vi.fn(),
    });

    await coordinator.syncNow();

    expect(push).toHaveBeenNthCalledWith(1, { operations: [customerCreate] });
    expect(push).toHaveBeenNthCalledWith(2, { operations: [rentalCreate] });
  });

  it("reconciles applied and duplicate authoritative results before removing them", async () => {
    const first = operation("1");
    const second = operation("2");
    const store = createStore([first, second]);
    const push = vi.fn().mockResolvedValue({
      results: [
        applied("1"),
        { ...applied("2"), status: "DUPLICATE", code: "SYNC_DUPLICATE" },
      ],
    } satisfies SyncPushResponse);
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push,
      pull: vi.fn().mockResolvedValue(pullPage()),
      onStatus: vi.fn(),
    });

    await coordinator.syncNow();

    expect(store.reconcileCustomerCreate).toHaveBeenNthCalledWith(
      1,
      workspace,
      "1",
      customer("1"),
    );
    expect(store.removeOutbox).toHaveBeenNthCalledWith(1, workspace, "1");
    expect(store.reconcileCustomerCreate).toHaveBeenNthCalledWith(
      2,
      workspace,
      "2",
      customer("2"),
    );
    expect(store.removeOutbox).toHaveBeenNthCalledWith(2, workspace, "2");
    expect(
      store.reconcileCustomerCreate.mock.invocationCallOrder[0],
    ).toBeLessThan(store.removeOutbox.mock.invocationCallOrder[0]);
  });

  it("retains an applied operation when authoritative reconciliation fails", async () => {
    const queued = operation("1");
    const store = createStore([queued]);
    const reconciliationError = new Error("IndexedDB unavailable");
    store.reconcileCustomerCreate = vi
      .fn()
      .mockRejectedValue(reconciliationError);
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn().mockResolvedValue({ results: [applied("1")] }),
      pull: vi.fn(),
      onStatus: vi.fn(),
    });

    await expect(coordinator.syncNow()).rejects.toBe(reconciliationError);

    expect(store.removeOutbox).not.toHaveBeenCalled();
  });

  it("retains a stale customer conflict with the server version and does not pull past it", async () => {
    const queued = operation("1");
    const store = createStore([queued]);
    const onStatus = vi.fn();
    const pull = vi.fn().mockResolvedValue(pullPage());
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn().mockResolvedValue({
        results: [
          {
            ...applied("1"),
            status: "CONFLICT",
            code: "SYNC_CUSTOMER_STALE",
            current_customer: customer("current"),
          },
        ],
      }),
      pull,
      onStatus,
    });

    await coordinator.syncNow();

    expect(store.updateOutbox).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        operation_id: "1",
        state: "CONFLICT",
        result: expect.objectContaining({
          code: "SYNC_CUSTOMER_STALE",
          current_customer: customer("current"),
        }),
      }),
    );
    expect(store.removeOutbox).not.toHaveBeenCalled();
    expect(pull).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "conflict" }),
    );
  });

  it("retains rejected and expired operations outside automatic retries", async () => {
    const rejected = operation("1");
    const expired = operation("2");
    const store = createStore([rejected, expired]);
    const push = vi.fn().mockResolvedValue({
      results: [
        { ...applied("1"), status: "REJECTED", code: "VEHICLE_UNAVAILABLE" },
        { ...applied("2"), status: "EXPIRED", code: "SYNC_OPERATION_EXPIRED" },
      ],
    });
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push,
      pull: vi.fn().mockResolvedValue(pullPage()),
      onStatus: vi.fn(),
    });

    await coordinator.syncNow();
    await coordinator.syncNow();

    expect(store.updateOutbox).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({ operation_id: "1", state: "REJECTED" }),
    );
    expect(store.updateOutbox).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({ operation_id: "2", state: "EXPIRED" }),
    );
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("preserves pending operations when a push request fails", async () => {
    const queued = operation("1");
    const store = createStore([queued]);
    const error = new TypeError("Failed to fetch");
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn().mockRejectedValue(error),
      pull: vi.fn(),
      onStatus: vi.fn(),
    });

    await expect(coordinator.syncNow()).rejects.toBe(error);

    expect(store.updateOutbox).not.toHaveBeenCalled();
    expect(store.removeOutbox).not.toHaveBeenCalled();
  });

  it.each([
    [apiError(401), "authenticationRequired"],
    [apiError(403, "ORGANIZATION_NOT_OPERATIONAL"), "organizationUnavailable"],
    [apiError(500), "failed"],
  ] as const)(
    "preserves the outbox for request failures and reports %s",
    async (error, status) => {
      const queued = operation("1");
      const store = createStore([queued]);
      const onStatus = vi.fn();
      const coordinator = createSyncCoordinator({
        workspace,
        store,
        push: vi.fn().mockRejectedValue(error),
        pull: vi.fn(),
        onStatus,
      });

      await expect(coordinator.syncNow()).rejects.toBe(error);

      expect(store.updateOutbox).not.toHaveBeenCalled();
      expect(store.removeOutbox).not.toHaveBeenCalled();
      expect(onStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ status }),
      );
    },
  );

  it("releases the single-flight lock after a failed sync", async () => {
    const queued = operation("1");
    const store = createStore([queued]);
    const error = new TypeError("Failed to fetch");
    const push = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ results: [applied("1")] });
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push,
      pull: vi.fn().mockResolvedValue(pullPage()),
      onStatus: vi.fn(),
    });

    await expect(coordinator.syncNow()).rejects.toBe(error);
    await coordinator.syncNow();

    expect(push).toHaveBeenCalledTimes(2);
  });

  it("shares concurrent sync calls and pulls every page before advancing the cursor", async () => {
    const store = createStore();
    store.getCompletionCursor = vi.fn().mockResolvedValue("saved");
    let resolvePull!: (page: SyncPullResponse) => void;
    const firstPage = new Promise<SyncPullResponse>((resolve) => {
      resolvePull = resolve;
    });
    const pull = vi
      .fn()
      .mockReturnValueOnce(firstPage)
      .mockResolvedValueOnce(pullPage([], null, "completed"));
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn(),
      pull,
      onStatus: vi.fn(),
    });

    const first = coordinator.syncNow();
    const second = coordinator.syncNow();
    expect(second).toBe(first);
    resolvePull(pullPage([], "next", null));
    await first;

    expect(pull).toHaveBeenNthCalledWith(1, { cursor: "saved" });
    expect(pull).toHaveBeenNthCalledWith(2, { cursor: "next" });
    expect(store.applyPull).toHaveBeenNthCalledWith(1, workspace, [], null);
    expect(store.applyPull).toHaveBeenNthCalledWith(
      2,
      workspace,
      [],
      "completed",
    );
  });

  it("passes generated-client pages to the coordinator until the completion checkpoint", async () => {
    const firstChange: SyncPullResponse["changes"][number] = {
      resource_type: "CUSTOMER",
      resource_id: "customer-1",
      updated_at: "2026-09-23T12:00:00.000Z",
      deleted: false,
      customer: customer("1"),
    };
    const secondChange: SyncPullResponse["changes"][number] = {
      resource_type: "CUSTOMER",
      resource_id: "customer-2",
      updated_at: "2026-09-23T12:01:00.000Z",
      deleted: false,
      customer: customer("2"),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pullPage([firstChange], "next", null)), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(pullPage([secondChange], null, "completed")),
          { headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = createStore();
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn(),
      pull: syncPull,
      onStatus: vi.fn(),
    });

    try {
      await coordinator.syncNow();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/sync/pull",
      "/api/sync/pull?cursor=next",
    ]);
    expect(store.applyPull).toHaveBeenNthCalledWith(
      1,
      workspace,
      [firstChange],
      null,
    );
    expect(store.applyPull).toHaveBeenNthCalledWith(
      2,
      workspace,
      [secondChange],
      "completed",
    );
  });

  it("keeps the saved completion cursor when a later pull page fails", async () => {
    const store = createStore();
    store.getCompletionCursor = vi.fn().mockResolvedValue("saved");
    const error = new TypeError("Failed to fetch");
    const pull = vi
      .fn()
      .mockResolvedValueOnce(pullPage([], "next", null))
      .mockRejectedValueOnce(error);
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn(),
      pull,
      onStatus: vi.fn(),
    });

    await expect(coordinator.syncNow()).rejects.toBe(error);

    expect(store.applyPull).toHaveBeenCalledTimes(1);
    expect(store.applyPull).toHaveBeenCalledWith(workspace, [], null);
  });

  it("does not mark sync successful for an unexpected pull response", async () => {
    const store = createStore();
    const onStatus = vi.fn();
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn(),
      pull: vi.fn().mockResolvedValue({ data: pullPage() }),
      onStatus,
    });

    await expect(coordinator.syncNow()).rejects.toThrow(
      "Invalid sync pull response",
    );

    expect(store.applyPull).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "upToDate" }),
    );
  });

  it("rejects a non-empty final page without a completion checkpoint", async () => {
    const store = createStore();
    const onStatus = vi.fn();
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn(),
      pull: vi.fn().mockResolvedValue(
        pullPage(
          [
            {
              resource_type: "CUSTOMER",
              resource_id: "customer-1",
              updated_at: "2026-09-23T12:00:00.000Z",
              deleted: false,
              customer: customer("1"),
            },
          ],
          null,
          null,
        ),
      ),
      onStatus,
    });

    await expect(coordinator.syncNow()).rejects.toThrow(
      "Invalid sync pull response",
    );
    expect(store.applyPull).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "upToDate" }),
    );
  });

  it("applies customer tombstones from pull pages", async () => {
    const store = createStore();
    const tombstone: SyncPullResponse["changes"][number] = {
      resource_type: "CUSTOMER",
      resource_id: "customer-1",
      updated_at: "2026-09-23T12:00:00.000Z",
      deleted: true,
      customer: null,
    };
    const coordinator = createSyncCoordinator({
      workspace,
      store,
      push: vi.fn(),
      pull: vi.fn().mockResolvedValue(pullPage([tombstone])),
      onStatus: vi.fn(),
    });

    await coordinator.syncNow();

    expect(store.applyPull).toHaveBeenCalledWith(
      workspace,
      [tombstone],
      "complete",
    );
  });
});
