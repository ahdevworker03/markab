import type {
  CreateCustomerRequest,
  CustomerResponse,
  RentalResponse,
  SyncOperationResult,
  SyncOperation,
  SyncPullChange,
  SyncRentalCreatePayload,
  VehicleResponse,
} from "@workspace/api-client-react";

export type OfflineWorkspace = {
  organizationId: string;
  userId: string;
};

export type ProvisionalCustomer = {
  localId: `local:${string}`;
  operationId: string;
  customer: CreateCustomerRequest;
};

export type LocalProjection = {
  customer?: CustomerResponse | ProvisionalCustomer;
  rental?: RentalResponse;
};

export type QueuedOperationState =
  "PENDING" | "SYNCING" | "CONFLICT" | "REJECTED" | "EXPIRED";

export type QueuedOperationResult = Pick<
  SyncOperationResult,
  "status" | "code" | "resource_type" | "current_customer"
>;

export type QueuedRentalCreate = Omit<
  SyncRentalCreatePayload,
  "customer_id"
> & {
  customer_id?: string;
};

export type QueuedOperation = Omit<SyncOperation, "rental_create"> & {
  rental_create?: QueuedRentalCreate | null;
  createdAt: string;
  attempts: number;
  state: QueuedOperationState;
  result?: QueuedOperationResult;
  localProjection?: LocalProjection;
};

export interface OfflineStore {
  open(workspace: OfflineWorkspace): Promise<void>;
  close(): Promise<void>;
  getCustomers(
    workspace: OfflineWorkspace,
  ): Promise<(CustomerResponse | ProvisionalCustomer)[]>;
  getCustomer(
    workspace: OfflineWorkspace,
    id: string,
  ): Promise<CustomerResponse | ProvisionalCustomer | undefined>;
  getVehicles(workspace: OfflineWorkspace): Promise<VehicleResponse[]>;
  getVehicle(
    workspace: OfflineWorkspace,
    id: string,
  ): Promise<VehicleResponse | undefined>;
  getRental(
    workspace: OfflineWorkspace,
    id: string,
  ): Promise<RentalResponse | undefined>;
  getCompletionCursor(workspace: OfflineWorkspace): Promise<string | undefined>;
  requireReconciliation(workspace: OfflineWorkspace): Promise<void>;
  isReconciliationRequired(workspace: OfflineWorkspace): Promise<boolean>;
  subscribeOutbox(
    workspace: OfflineWorkspace,
    listener: () => void,
  ): () => void;
  applyPull(
    workspace: OfflineWorkspace,
    changes: readonly SyncPullChange[],
    completionCursor: string | null,
    reconciliationComplete?: boolean,
  ): Promise<void>;
  enqueue(
    workspace: OfflineWorkspace,
    operation: QueuedOperation,
  ): Promise<void>;
  listOutbox(
    workspace: OfflineWorkspace,
    limit: number,
  ): Promise<QueuedOperation[]>;
  getOutboxItem(
    workspace: OfflineWorkspace,
    operationId: string,
  ): Promise<QueuedOperation | undefined>;
  updateOutbox(
    workspace: OfflineWorkspace,
    operation: QueuedOperation,
  ): Promise<void>;
  removeOutbox(workspace: OfflineWorkspace, operationId: string): Promise<void>;
  replaceCustomerConflict(
    workspace: OfflineWorkspace,
    operationId: string,
    replacement: QueuedOperation,
  ): Promise<void>;
  discardCustomerConflict(
    workspace: OfflineWorkspace,
    operationId: string,
  ): Promise<void>;
  discardActionRequired(
    workspace: OfflineWorkspace,
    operationId: string,
  ): Promise<void>;
  reconcileCustomerCreate(
    workspace: OfflineWorkspace,
    operationId: string,
    customer: CustomerResponse,
  ): Promise<void>;
  clearWorkspace(workspace: OfflineWorkspace): Promise<void>;
}
