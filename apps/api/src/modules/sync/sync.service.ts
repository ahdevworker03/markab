import { createHash } from "node:crypto";
import { z } from "zod";
import {
  retrySerializable,
  transaction,
  type TxClient,
} from "../../database";
import { AppError } from "../../shared";
import {
  createCustomerWithinTx,
  toCustomerResponse,
  updateCustomerWithinTx,
} from "../customers/customer.service";
import { createRentalWithinTx } from "../rentals/rental.service";
import { toRentalResponse } from "../rentals/rental.mapper";
import type { CustomerResponse } from "../customers/customer.types";
import * as repo from "./sync.repository";
import type { SyncOperationInput, SyncPushInput } from "./sync.validation";

type SyncResult = {
  operation_id: string;
  type: SyncOperationInput["type"];
  status: "APPLIED" | "DUPLICATE" | "CONFLICT" | "REJECTED" | "EXPIRED";
  code:
    | "SYNC_APPLIED"
    | "SYNC_DUPLICATE"
    | "SYNC_CUSTOMER_STALE"
    | "SYNC_OPERATION_PAYLOAD_MISMATCH"
    | "SYNC_OPERATION_EXPIRED"
    | "SYNC_DEPENDENCY_NOT_APPLIED"
    | "SYNC_OPERATION_INVALID"
    | "CUSTOMER_NOT_FOUND"
    | "VEHICLE_NOT_FOUND"
    | "VEHICLE_UNAVAILABLE"
    | "DUPLICATE_CUSTOMER"
    | "INVALID_RENTAL_PERIOD"
    | "INVALID_RENTAL_AMOUNT";
  resource_type: "CUSTOMER" | "RENTAL" | null;
  customer?: ReturnType<typeof toCustomerResponse>;
  rental?: ReturnType<typeof toRentalResponse>;
  current_customer?: ReturnType<typeof toCustomerResponse>;
};

const receiptLifetimeMs = 30 * 24 * 60 * 60 * 1000;

const staleCustomerSnapshotSchema: z.ZodType<CustomerResponse> = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    address: z.string(),
    nationalId: z.string(),
    licenseNumber: z.string(),
    licenseExpiryDate: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

function staleCustomerSnapshot(customer: CustomerResponse): CustomerResponse {
  return staleCustomerSnapshotSchema.parse({
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    address: customer.address,
    nationalId: customer.nationalId,
    licenseNumber: customer.licenseNumber,
    licenseExpiryDate: customer.licenseExpiryDate,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  });
}

function readStaleCustomerSnapshot(snapshot: unknown): CustomerResponse {
  const parsed = staleCustomerSnapshotSchema.safeParse(snapshot);
  if (parsed.success) return parsed.data;
  throw new AppError(
    500,
    "SYNC_CONFLICT_SNAPSHOT_INVALID",
    "Sync conflict snapshot is unavailable.",
  );
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function fingerprint(operation: SyncOperationInput): string {
  const { operation_id: _operationId, ...request } = operation;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(request)))
    .digest("hex");
}

function result(
  operation: SyncOperationInput,
  status: SyncResult["status"],
  code: SyncResult["code"],
  resourceType: SyncResult["resource_type"] = null,
): SyncResult {
  return {
    operation_id: operation.operation_id,
    type: operation.type,
    status,
    code,
    resource_type: resourceType,
  };
}

function recordedResult(
  operation: SyncOperationInput,
  receipt: {
    outcome: "APPLIED" | "CONFLICT" | "REJECTED";
    result_code: string;
    resource_type: "CUSTOMER" | "RENTAL" | null;
    resource_id: string | null;
  },
): SyncResult {
  const status =
    receipt.outcome === "APPLIED"
      ? "DUPLICATE"
      : receipt.outcome === "CONFLICT"
        ? "CONFLICT"
        : "REJECTED";
  const code =
    receipt.outcome === "APPLIED"
      ? "SYNC_DUPLICATE"
      : (receipt.result_code as SyncResult["code"]);

  return result(operation, status, code, receipt.resource_type);
}

function hasMatchingPayload(operation: SyncOperationInput): boolean {
  const payloads = [
    operation.customer_create,
    operation.customer_update,
    operation.rental_create,
  ];

  if (payloads.filter(Boolean).length !== 1) return false;

  switch (operation.type) {
    case "CUSTOMER_CREATE":
      return Boolean(operation.customer_create);
    case "CUSTOMER_UPDATE":
      return Boolean(operation.customer_update);
    case "RENTAL_CREATE":
      return Boolean(operation.rental_create);
    default:
      return false;
  }
}

async function reconciliationResult(
  organizationId: string,
  operation: SyncOperationInput,
  requestFingerprint: string,
): Promise<SyncResult | null> {
  const receipt = await repo.findReceipt(
    organizationId,
    operation.operation_id,
  );
  if (!receipt) return null;

  if (receipt.expires_at <= new Date()) {
    return result(operation, "EXPIRED", "SYNC_OPERATION_EXPIRED");
  }

  if (receipt.request_fingerprint !== requestFingerprint) {
    return result(operation, "REJECTED", "SYNC_OPERATION_PAYLOAD_MISMATCH");
  }

  if (
    receipt.outcome === "CONFLICT" &&
    receipt.operation_type === "CUSTOMER_UPDATE" &&
    receipt.resource_type === "CUSTOMER"
  ) {
    return {
      ...result(operation, "CONFLICT", "SYNC_CUSTOMER_STALE", "CUSTOMER"),
      current_customer: readStaleCustomerSnapshot(
        receipt.stale_customer_snapshot,
      ),
    };
  }

  if (receipt.resource_type === "CUSTOMER" && receipt.resource_id) {
    const customer = await repo.findCustomer(
      organizationId,
      receipt.resource_id,
      undefined,
      true,
    );
    return {
      ...recordedResult(operation, receipt),
      ...(customer ? { customer: toCustomerResponse(customer) } : {}),
    };
  }

  if (receipt.resource_type === "RENTAL" && receipt.resource_id) {
    const rental = await repo.findRental(
      organizationId,
      receipt.resource_id,
      undefined,
      true,
    );
    return {
      ...recordedResult(operation, receipt),
      ...(rental ? { rental: toRentalResponse(rental) } : {}),
    };
  }

  return recordedResult(operation, receipt);
}

async function resolveRentalCustomerId(
  organizationId: string,
  operation: SyncOperationInput,
  tx: TxClient,
): Promise<string | null> {
  const payload = operation.rental_create!;
  const reference = payload.customer_reference;
  const hasCustomerId = Boolean(reference.customer_id);
  const hasOperationId = Boolean(reference.customer_create_operation_id);

  if (hasCustomerId === hasOperationId) return null;

  if (reference.customer_id) {
    return reference.customer_id === payload.customer_id
      ? reference.customer_id
      : null;
  }

  const dependency = await repo.findReceipt(
    organizationId,
    reference.customer_create_operation_id!,
    tx,
  );
  if (
    !dependency ||
    dependency.expires_at <= new Date() ||
    dependency.outcome !== "APPLIED" ||
    dependency.resource_type !== "CUSTOMER" ||
    !dependency.resource_id
  ) {
    return null;
  }

  return dependency.resource_id;
}

async function applyOperation(
  organizationId: string,
  operation: SyncOperationInput,
  tx: TxClient,
): Promise<SyncResult> {
  if (!hasMatchingPayload(operation)) {
    return result(operation, "REJECTED", "SYNC_OPERATION_INVALID");
  }

  if (operation.type === "CUSTOMER_CREATE") {
    const customer = await createCustomerWithinTx(
      organizationId,
      operation.customer_create!,
      tx,
    );
    return {
      ...result(operation, "APPLIED", "SYNC_APPLIED", "CUSTOMER"),
      customer,
    };
  }

  if (operation.type === "CUSTOMER_UPDATE") {
    const payload = operation.customer_update!;
    const customer = await repo.findCustomer(
      organizationId,
      payload.customer_id,
      tx,
    );
    if (!customer) return result(operation, "REJECTED", "CUSTOMER_NOT_FOUND");
    if (
      customer.updated_at.getTime() !== payload.expected_updated_at.getTime()
    ) {
      return {
        ...result(operation, "CONFLICT", "SYNC_CUSTOMER_STALE", "CUSTOMER"),
        current_customer: toCustomerResponse(customer),
      };
    }

    const updated = await updateCustomerWithinTx(
      payload.customer_id,
      organizationId,
      payload,
      tx,
    );
    return {
      ...result(operation, "APPLIED", "SYNC_APPLIED", "CUSTOMER"),
      customer: updated,
    };
  }

  const payload = operation.rental_create!;
  const customerId = await resolveRentalCustomerId(
    organizationId,
    operation,
    tx,
  );
  if (!customerId) {
    return result(operation, "REJECTED", "SYNC_DEPENDENCY_NOT_APPLIED");
  }

  const rental = await createRentalWithinTx(
    organizationId,
    { ...payload, customer_id: customerId, status: "RESERVED" },
    tx,
  );
  return {
    ...result(operation, "APPLIED", "SYNC_APPLIED", "RENTAL"),
    rental,
  };
}

function appErrorResult(
  operation: SyncOperationInput,
  error: AppError,
): SyncResult {
  const code = error.code as SyncResult["code"];
  const supportedCodes: SyncResult["code"][] = [
    "CUSTOMER_NOT_FOUND",
    "VEHICLE_NOT_FOUND",
    "VEHICLE_UNAVAILABLE",
    "DUPLICATE_CUSTOMER",
    "INVALID_RENTAL_PERIOD",
    "INVALID_RENTAL_AMOUNT",
  ];

  return result(
    operation,
    error.statusCode === 409 ? "CONFLICT" : "REJECTED",
    supportedCodes.includes(code) ? code : "SYNC_OPERATION_INVALID",
  );
}

async function createReceiptForResult(
  organizationId: string,
  operation: SyncOperationInput,
  requestFingerprint: string,
  operationResult: SyncResult,
  tx: TxClient,
): Promise<void> {
  await repo.createReceipt(
    {
      organization_id: organizationId,
      operation_id: operation.operation_id,
      request_fingerprint: requestFingerprint,
      operation_type: operation.type,
      result_code: operationResult.code,
      outcome:
        operationResult.status === "APPLIED"
          ? "APPLIED"
          : operationResult.status === "CONFLICT"
            ? "CONFLICT"
            : "REJECTED",
      resource_type: operationResult.resource_type,
      resource_id:
        operationResult.customer?.id ??
        operationResult.rental?.id ??
        operationResult.current_customer?.id ??
        null,
      stale_customer_snapshot:
        operation.type === "CUSTOMER_UPDATE" &&
        operationResult.status === "CONFLICT" &&
        operationResult.current_customer
          ? staleCustomerSnapshot(operationResult.current_customer)
          : null,
      expires_at: new Date(Date.now() + receiptLifetimeMs),
    },
    tx,
  );
}

async function executeOperation(
  organizationId: string,
  operation: SyncOperationInput,
): Promise<SyncResult> {
  const requestFingerprint = fingerprint(operation);
  const existing = await reconciliationResult(
    organizationId,
    operation,
    requestFingerprint,
  );
  if (existing) return existing;

  const run = () =>
    transaction(
      async (tx) => {
        const receipt = await repo.findReceipt(
          organizationId,
          operation.operation_id,
          tx,
        );
        if (receipt) return null;

        let operationResult: SyncResult;
        try {
          operationResult = await applyOperation(organizationId, operation, tx);
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          operationResult = appErrorResult(operation, error);
        }

        await createReceiptForResult(
          organizationId,
          operation,
          requestFingerprint,
          operationResult,
          tx,
        );
        return operationResult;
      },
      operation.type === "RENTAL_CREATE"
        ? { isolationLevel: "Serializable" }
        : undefined,
    );

  let transactionError: unknown;
  try {
    const operationResult =
      operation.type === "RENTAL_CREATE"
        ? await retrySerializable(run)
        : await run();
    if (operationResult) return operationResult;
  } catch (error) {
    transactionError = error;
  }

  const winner = await reconciliationResult(
    organizationId,
    operation,
    requestFingerprint,
  );
  if (winner) return winner;
  if (transactionError) throw transactionError;
  throw new AppError(
    500,
    "SYNC_RECEIPT_RACE_FAILED",
    "Sync receipt reconciliation failed.",
  );
}

async function pushOperations(
  organizationId: string,
  input: SyncPushInput,
): Promise<{ results: SyncResult[] }> {
  const results: SyncResult[] = [];
  for (const operation of input.operations) {
    results.push(await executeOperation(organizationId, operation));
  }
  return { results };
}

export { pushOperations };
