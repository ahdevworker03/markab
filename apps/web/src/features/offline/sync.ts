import {
  ApiError,
  type SyncPushRequest,
  type SyncOperationResult,
  type SyncPullResponse,
  type SyncPushResponse,
} from "@workspace/api-client-react";
import type {
  OfflineStore,
  OfflineWorkspace,
  QueuedOperation,
  QueuedOperationResult,
} from "./types";

type SyncStatus =
  | "pending"
  | "synchronizing"
  | "upToDate"
  | "failed"
  | "conflict"
  | "authenticationRequired"
  | "organizationUnavailable";

export type SyncStatusUpdate = {
  status: SyncStatus;
  pendingCount: number;
  conflicts: QueuedOperation[];
  error?: unknown;
};

type SyncCoordinatorOptions = {
  workspace: OfflineWorkspace;
  store: OfflineStore;
  push: (request: SyncPushRequest) => Promise<SyncPushResponse>;
  pull: (params?: { cursor?: string }) => Promise<SyncPullResponse>;
  onStatus: (status: SyncStatusUpdate) => void;
};

function resultMetadata(result: SyncOperationResult): QueuedOperationResult {
  return {
    status: result.status,
    code: result.code,
    resource_type: result.resource_type,
    current_customer: result.current_customer,
  };
}

function requestStatus(error: unknown): SyncStatus {
  if (!(error instanceof ApiError)) return "failed";
  if (error.status === 401) return "authenticationRequired";
  if (error.data?.error.code === "ORGANIZATION_NOT_OPERATIONAL") {
    return "organizationUnavailable";
  }
  return "failed";
}

function hasPendingOperations(operations: readonly QueuedOperation[]): boolean {
  return operations.some((operation) => operation.state === "PENDING");
}

function isSyncPullResponse(value: unknown): value is SyncPullResponse {
  if (!value || typeof value !== "object") return false;
  const page = value as Record<string, unknown>;
  return (
    Array.isArray(page.changes) &&
    (page.next_cursor === null || typeof page.next_cursor === "string") &&
    (page.completion_cursor === null ||
      typeof page.completion_cursor === "string") &&
    (page.next_cursor !== null
      ? page.next_cursor.length > 0 && page.completion_cursor === null
      : page.changes.length === 0 ||
        (typeof page.completion_cursor === "string" &&
          page.completion_cursor.length > 0))
  );
}

function hasUnresolvedCustomerCreate(
  operation: QueuedOperation,
  outbox: readonly QueuedOperation[],
): boolean {
  const operationId =
    operation.rental_create?.customer_reference.customer_create_operation_id;
  return operationId
    ? outbox.some((candidate) => candidate.operation_id === operationId)
    : false;
}

export function createSyncCoordinator({
  workspace,
  store,
  push,
  pull,
  onStatus,
}: SyncCoordinatorOptions): { syncNow(): Promise<void>; retryNow(): Promise<void> } {
  let inFlight: Promise<void> | undefined;
  let syncRequested = false;

  const updateStatus = async (status: SyncStatus, error?: unknown) => {
    const outbox = await store.listOutbox(workspace, 2 ** 32 - 1);
    onStatus({
      status,
      pendingCount: outbox.filter((operation) => operation.state === "PENDING")
        .length,
      conflicts: outbox.filter((operation) => operation.state === "CONFLICT"),
      error,
    });
  };

  const reconcile = async (
    operation: QueuedOperation,
    result: SyncOperationResult,
  ) => {
    if (result.customer) {
      if (operation.type === "CUSTOMER_CREATE") {
        await store.reconcileCustomerCreate(
          workspace,
          operation.operation_id,
          result.customer,
        );
      } else {
        await store.applyPull(
          workspace,
          [
            {
              resource_type: "CUSTOMER",
              resource_id: result.customer.id,
              updated_at: result.customer.updatedAt,
              deleted: false,
              customer: result.customer,
            },
          ],
          null,
        );
      }
      return;
    }
    if (result.rental) {
      await store.applyPull(
        workspace,
        [
          {
            resource_type: "RENTAL",
            resource_id: result.rental.id,
            updated_at: result.rental.updatedAt,
            deleted: false,
            rental: result.rental,
          },
        ],
        null,
      );
      return;
    }
    throw new Error(
      `Missing authoritative resource for ${operation.operation_id}`,
    );
  };

  const processResult = async (
    operation: QueuedOperation,
    result: SyncOperationResult,
  ) => {
    if (result.status === "APPLIED" || result.status === "DUPLICATE") {
      await reconcile(operation, result);
      await store.removeOutbox(workspace, operation.operation_id);
      return;
    }

    if (
      result.status === "CONFLICT" &&
      result.code === "SYNC_CUSTOMER_STALE" &&
      result.current_customer
    ) {
      await store.applyPull(
        workspace,
        [
          {
            resource_type: "CUSTOMER",
            resource_id: result.current_customer.id,
            updated_at: result.current_customer.updatedAt,
            deleted: false,
            customer: result.current_customer,
          },
        ],
        null,
      );
      await store.updateOutbox(workspace, {
        ...operation,
        attempts: operation.attempts + 1,
        state: "CONFLICT",
        result: resultMetadata(result),
      });
      return;
    }

    await store.updateOutbox(workspace, {
      ...operation,
      attempts: operation.attempts + 1,
      state: result.status === "EXPIRED" ? "EXPIRED" : "REJECTED",
      result: resultMetadata(result),
    });
  };

  const pushQueuedOperations = async (): Promise<void> => {
    while (true) {
      const outbox = await store.listOutbox(workspace, 2 ** 32 - 1);
      const batch: QueuedOperation[] = [];
      for (const operation of outbox) {
        if (operation.state !== "PENDING") continue;
        if (hasUnresolvedCustomerCreate(operation, outbox)) break;
        batch.push(operation);
        if (batch.length === 25) break;
      }
      if (!batch.length) return;

      const response = await push({
        operations: batch as SyncPushRequest["operations"],
      });
      const results = new Map(
        response.results.map((result) => [result.operation_id, result]),
      );
      for (const operation of batch) {
        const result = results.get(operation.operation_id);
        if (!result) {
          throw new Error(`Missing sync result for ${operation.operation_id}`);
        }
        await processResult(operation, result);
      }

      if (response.results.some((result) => result.status === "CONFLICT"))
        return;
    }
  };

  const pullChanges = async (): Promise<void> => {
    let cursor = await store.getCompletionCursor(workspace);
    while (true) {
      const page = await pull(cursor ? { cursor } : undefined);
      if (!isSyncPullResponse(page)) {
        throw new Error("Invalid sync pull response");
      }
      await store.applyPull(
        workspace,
        page.changes,
        page.next_cursor ? null : page.completion_cursor,
      );
      if (!page.next_cursor) return;
      cursor = page.next_cursor;
    }
  };

  const syncNow = (): Promise<void> => {
    if (inFlight) return inFlight;
      inFlight = (async () => {
        let error: unknown;
        do {
          syncRequested = false;
          error = undefined;
          try {
            await updateStatus("synchronizing");
            await pushQueuedOperations();
            const remaining = await store.listOutbox(workspace, 2 ** 32 - 1);
            if (hasPendingOperations(remaining)) break;
            if (remaining.some((operation) => operation.state === "CONFLICT")) {
              await updateStatus("conflict");
              break;
            }
            await pullChanges();
            await updateStatus("upToDate");
          } catch (caught) {
            error = caught;
            await updateStatus(requestStatus(caught), caught);
          }
        } while (syncRequested);
        if (error) throw error;
      })().finally(() => {
        inFlight = undefined;
      });
      return inFlight;
  };

  return {
    syncNow,
    retryNow() {
      if (inFlight) syncRequested = true;
      return syncNow();
    },
  };
}
