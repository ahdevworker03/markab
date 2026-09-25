import { describe, expect, it, vi } from "vitest";
import { createOfflineCommands } from "./commands";
import type { OfflineStore, OfflineWorkspace, QueuedOperation } from "./types";

const workspace: OfflineWorkspace = {
  organizationId: "organization-a",
  userId: "user-a",
};

const customer = {
  id: "customer-a",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "10000000",
  address: "Beirut",
  nationalId: "national-a",
  licenseNumber: "license-a",
  licenseExpiryDate: "2030-01-01",
  createdAt: "2026-09-23T12:00:00.000Z",
  updatedAt: "2026-09-23T12:00:00.000Z",
};

const vehicle = {
  id: "vehicle-a",
  make: "Toyota",
  model: "Corolla",
  plateNumber: "A-123",
  year: 2024,
  color: "White",
  transmission: "AUTOMATIC" as const,
  fuelType: "PETROL" as const,
  seats: 5,
  currentMileage: 1000,
  status: "AVAILABLE" as const,
  createdAt: "2026-09-23T12:00:00.000Z",
  updatedAt: "2026-09-23T12:00:00.000Z",
};

function createStore(): OfflineStore {
  return {
    open: vi.fn(),
    close: vi.fn(),
    getCustomers: vi.fn(),
    getCustomer: vi.fn(),
    getVehicles: vi.fn(),
    getVehicle: vi.fn().mockResolvedValue(vehicle),
    getRental: vi.fn(),
    getCompletionCursor: vi.fn(),
    applyPull: vi.fn(),
    enqueue: vi.fn(),
    listOutbox: vi.fn(),
    getOutboxItem: vi.fn(),
    updateOutbox: vi.fn(),
    removeOutbox: vi.fn(),
    replaceCustomerConflict: vi.fn(),
    discardCustomerConflict: vi.fn(),
    discardActionRequired: vi.fn(),
    reconcileCustomerCreate: vi.fn(),
    clearWorkspace: vi.fn(),
  };
}

describe("createOfflineCommands", () => {
  it("queues a customer create with a provisional customer projection", async () => {
    const store = createStore();
    const commands = createOfflineCommands({
      workspace,
      store,
      createOperationId: () => "customer-create",
      now: () => "2026-09-24T12:00:00.000Z",
    });
    const draft = {
      first_name: "Grace",
      last_name: "Hopper",
      phone: "20000000",
      address: "Beirut",
      national_id: "national-grace",
      license_number: "license-grace",
      license_expiry_date: "2030-01-01",
    };

    await commands.queueCustomerCreate(draft);

    expect(store.enqueue).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        operation_id: "customer-create",
        type: "CUSTOMER_CREATE",
        customer_create: draft,
        state: "PENDING",
        localProjection: {
          customer: {
            localId: "local:customer-create",
            operationId: "customer-create",
            customer: draft,
          },
        },
      }),
    );
  });

  it("queues a customer update with the local projection revision", async () => {
    const store = createStore();
    const commands = createOfflineCommands({
      workspace,
      store,
      createOperationId: () => "customer-update",
      now: () => "2026-09-24T12:00:00.000Z",
    });
    const draft = {
      first_name: "Ada",
      last_name: "Byron",
      phone: "10000000",
      address: "Beirut",
      national_id: "national-a",
      license_number: "license-a",
      license_expiry_date: "2030-01-01",
    };

    await commands.queueCustomerUpdate(customer, draft);

    expect(store.enqueue).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        operation_id: "customer-update",
        type: "CUSTOMER_UPDATE",
        customer_update: {
          customer_id: "customer-a",
          expected_updated_at: customer.updatedAt,
          ...draft,
        },
        localProjection: {
          customer: expect.objectContaining({
            id: "customer-a",
            lastName: "Byron",
          }),
        },
      }),
    );
  });

  it("rejects updates to provisional customers", async () => {
    const store = createStore();
    const commands = createOfflineCommands({ workspace, store });

    await expect(
      commands.queueCustomerUpdate(
        { ...customer, id: "local:customer-create" },
        {
          first_name: "Ada",
          last_name: "Byron",
          phone: "10000000",
          address: "Beirut",
          national_id: "national-a",
          license_number: "license-a",
          license_expiry_date: "2030-01-01",
        },
      ),
    ).rejects.toThrow("Provisional customers cannot be updated");

    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it("serializes only the seven allowed customer update fields", async () => {
    const store = createStore();
    const commands = createOfflineCommands({
      workspace,
      store,
      createOperationId: () => "customer-update",
    });
    const draft = {
      first_name: "Ada",
      last_name: "Byron",
      phone: "10000000",
      address: "Beirut",
      national_id: "national-a",
      license_number: "license-a",
      license_expiry_date: "2030-01-01",
      ignored: "must-not-queue",
    } as never;

    await commands.queueCustomerUpdate(customer, draft);

    expect(store.enqueue).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        customer_update: {
          customer_id: customer.id,
          expected_updated_at: customer.updatedAt,
          first_name: "Ada",
          last_name: "Byron",
          phone: "10000000",
          address: "Beirut",
          national_id: "national-a",
          license_number: "license-a",
          license_expiry_date: "2030-01-01",
        },
      }),
    );
  });

  it("queues a rental dependency without serializing a provisional customer ID", async () => {
    const store = createStore();
    const commands = createOfflineCommands({
      workspace,
      store,
      createOperationId: () => "rental-create",
      now: () => "2026-09-24T12:00:00.000Z",
    });

    await commands.queueRentalCreate(
      {
        vehicle_id: "vehicle-a",
        pickup_date: "2026-09-25T12:00:00.000Z",
        expected_return_date: "2026-09-26T12:00:00.000Z",
        daily_rate: 100,
        total_amount: 100,
        deposit_amount: 50,
      },
      { customer_create_operation_id: "customer-create" },
    );

    expect(store.enqueue).toHaveBeenCalledWith(
      workspace,
      expect.objectContaining({
        operation_id: "rental-create",
        rental_create: expect.objectContaining({
          customer_reference: {
            customer_create_operation_id: "customer-create",
          },
        }),
      }),
    );
    expect(store.enqueue).toHaveBeenCalledWith(
      workspace,
      expect.not.objectContaining({
        rental_create: expect.objectContaining({
          customer_id: expect.any(String),
        }),
      }),
    );
  });

  it("requires an authoritative available cached vehicle before queuing a rental", async () => {
    const store = createStore();
    store.getVehicle = vi.fn().mockResolvedValue({
      ...vehicle,
      status: "MAINTENANCE",
    });
    const commands = createOfflineCommands({ workspace, store });
    const draft = {
      vehicle_id: vehicle.id,
      pickup_date: "2026-09-25T12:00:00.000Z",
      expected_return_date: "2026-09-26T12:00:00.000Z",
      daily_rate: 100,
      total_amount: 100,
      deposit_amount: 50,
    };

    await expect(
      commands.queueRentalCreate(draft, { customer_id: customer.id }),
    ).rejects.toThrow("Vehicle is not available for an offline rental");

    expect(store.getVehicle).toHaveBeenCalledWith(workspace, vehicle.id);
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it("rejects a provisional customer ID in a rental reference", async () => {
    const store = createStore();
    const commands = createOfflineCommands({ workspace, store });

    await expect(
      commands.queueRentalCreate(
        {
          vehicle_id: vehicle.id,
          pickup_date: "2026-09-25T12:00:00.000Z",
          expected_return_date: "2026-09-26T12:00:00.000Z",
          daily_rate: 100,
          total_amount: 100,
          deposit_amount: 50,
        },
        { customer_id: "local:customer-create" },
      ),
    ).rejects.toThrow("Provisional rental customer IDs are not allowed");

    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it("reapplies a stale customer draft with a new operation ID and server revision", async () => {
    const store = createStore();
    const retained: QueuedOperation = {
      operation_id: "stale-update",
      type: "CUSTOMER_UPDATE",
      customer_update: {
        customer_id: customer.id,
        expected_updated_at: customer.updatedAt,
        first_name: customer.firstName,
        last_name: "Byron",
        phone: customer.phone,
        address: customer.address,
        national_id: customer.nationalId,
        license_number: customer.licenseNumber,
        license_expiry_date: customer.licenseExpiryDate,
      },
      createdAt: "2026-09-23T12:00:00.000Z",
      attempts: 1,
      state: "CONFLICT",
      localProjection: { customer: { ...customer, lastName: "Byron" } },
    };
    store.getOutboxItem = vi.fn().mockResolvedValue(retained);
    const commands = createOfflineCommands({
      workspace,
      store,
      createOperationId: () => "reapplied-update",
      now: () => "2026-09-24T12:00:00.000Z",
    });
    const current = { ...customer, updatedAt: "2026-09-24T08:00:00.000Z" };

    await commands.reapplyCustomerConflict("stale-update", current);

    expect(store.replaceCustomerConflict).toHaveBeenCalledWith(
      workspace,
      "stale-update",
      expect.objectContaining({
        operation_id: "reapplied-update",
        state: "PENDING",
        attempts: 0,
        customer_update: expect.objectContaining({
          customer_id: customer.id,
          expected_updated_at: current.updatedAt,
          last_name: "Byron",
        }),
      }),
    );
  });

  it("only discards conflicts and action-required operations through their explicit commands", async () => {
    const store = createStore();
    const commands = createOfflineCommands({ workspace, store });

    await commands.discardCustomerConflict("stale-update");
    await commands.discardFailedOperation("rejected-rental");

    expect(store.discardCustomerConflict).toHaveBeenCalledWith(
      workspace,
      "stale-update",
    );
    expect(store.discardActionRequired).toHaveBeenCalledWith(
      workspace,
      "rejected-rental",
    );
  });
});
