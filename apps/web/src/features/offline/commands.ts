import type {
  CreateCustomerRequest,
  CreateRentalRequest,
  CustomerResponse,
  SyncCustomerReference,
  UpdateCustomerRequest,
} from "@workspace/api-client-react";
import type { OfflineStore, OfflineWorkspace, QueuedOperation } from "./types";

type OfflineCommandsOptions = {
  workspace: OfflineWorkspace;
  store: OfflineStore;
  createOperationId?: () => string;
  now?: () => string;
};

type RentalDraft = Omit<CreateRentalRequest, "customer_id">;

function customerUpdatePayload(draft: UpdateCustomerRequest) {
  return {
    first_name: draft.first_name,
    last_name: draft.last_name,
    phone: draft.phone,
    address: draft.address,
    national_id: draft.national_id,
    license_number: draft.license_number,
    license_expiry_date: draft.license_expiry_date,
  };
}

function customerProjection(
  customer: CustomerResponse,
  draft: UpdateCustomerRequest,
): CustomerResponse {
  const update = customerUpdatePayload(draft);
  return {
    ...customer,
    firstName: update.first_name,
    lastName: update.last_name,
    phone: update.phone,
    address: update.address,
    nationalId: update.national_id,
    licenseNumber: update.license_number,
    licenseExpiryDate: update.license_expiry_date,
  };
}

export function createOfflineCommands({
  workspace,
  store,
  createOperationId = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
}: OfflineCommandsOptions) {
  const operation = (
    type: QueuedOperation["type"],
    operationId = createOperationId(),
  ) => ({
    operation_id: operationId,
    type,
    createdAt: now(),
    attempts: 0,
    state: "PENDING" as const,
  });

  return {
    async queueCustomerCreate(draft: CreateCustomerRequest): Promise<string> {
      const queued = operation("CUSTOMER_CREATE");
      await store.enqueue(workspace, {
        ...queued,
        customer_create: draft,
        localProjection: {
          customer: {
            localId: `local:${queued.operation_id}`,
            operationId: queued.operation_id,
            customer: draft,
          },
        },
      });
      return queued.operation_id;
    },

    async queueCustomerUpdate(
      customer: CustomerResponse,
      draft: UpdateCustomerRequest,
    ): Promise<string> {
      if (customer.id.startsWith("local:")) {
        throw new Error("Provisional customers cannot be updated");
      }
      const queued = operation("CUSTOMER_UPDATE");
      await store.enqueue(workspace, {
        ...queued,
        customer_update: {
          customer_id: customer.id,
          expected_updated_at: customer.updatedAt,
          ...customerUpdatePayload(draft),
        },
        localProjection: { customer: customerProjection(customer, draft) },
      });
      return queued.operation_id;
    },

    async queueRentalCreate(
      draft: RentalDraft,
      customerReference: SyncCustomerReference,
    ): Promise<string> {
      if (customerReference.customer_id?.startsWith("local:")) {
        throw new Error("Provisional rental customer IDs are not allowed");
      }
      const vehicle = await store.getVehicle(workspace, draft.vehicle_id);
      if (
        draft.vehicle_id.startsWith("local:") ||
        vehicle?.id !== draft.vehicle_id ||
        vehicle.status !== "AVAILABLE"
      ) {
        throw new Error("Vehicle is not available for an offline rental");
      }
      const queued = operation("RENTAL_CREATE");
      const customerId = customerReference.customer_id ?? undefined;
      await store.enqueue(workspace, {
        ...queued,
        rental_create: {
          ...draft,
          ...(customerId ? { customer_id: customerId } : {}),
          customer_reference: customerReference,
        },
        localProjection: {
          rental: {
            id: `local:${queued.operation_id}`,
            customerId:
              customerId ??
              `local:${customerReference.customer_create_operation_id}`,
            vehicleId: draft.vehicle_id,
            pickupDate: draft.pickup_date,
            expectedReturnDate: draft.expected_return_date,
            status: "RESERVED",
            dailyRate: draft.daily_rate,
            totalAmount: draft.total_amount,
            depositAmount: draft.deposit_amount,
            createdAt: queued.createdAt,
            updatedAt: queued.createdAt,
          },
        },
      });
      return queued.operation_id;
    },

    async reapplyCustomerConflict(
      operationId: string,
      currentCustomer: CustomerResponse,
    ): Promise<string> {
      const conflict = await store.getOutboxItem(workspace, operationId);
      if (
        conflict?.state !== "CONFLICT" ||
        conflict.type !== "CUSTOMER_UPDATE" ||
        !conflict.customer_update ||
        conflict.customer_update.customer_id !== currentCustomer.id
      ) {
        throw new Error("Outbox item is not a reapplicable customer conflict");
      }

      const queued = operation("CUSTOMER_UPDATE");
      const draft = conflict.customer_update;
      await store.replaceCustomerConflict(workspace, operationId, {
        ...queued,
        customer_update: {
          ...draft,
          expected_updated_at: currentCustomer.updatedAt,
        },
        localProjection: {
          customer: customerProjection(currentCustomer, draft),
        },
      });
      return queued.operation_id;
    },

    discardCustomerConflict(operationId: string): Promise<void> {
      return store.discardCustomerConflict(workspace, operationId);
    },

    discardFailedOperation(operationId: string): Promise<void> {
      return store.discardActionRequired(workspace, operationId);
    },
  };
}
