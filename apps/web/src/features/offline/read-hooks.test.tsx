import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CustomerResponse,
  SyncPullChange,
  VehicleResponse,
} from "@workspace/api-client-react";
import type { PropsWithChildren } from "react";
import type { OfflineStore, OfflineWorkspace } from "./types";

const offline = vi.hoisted(() => vi.fn());
const useListCustomers = vi.hoisted(() => vi.fn());
const useGetCustomer = vi.hoisted(() => vi.fn());
const useListVehicles = vi.hoisted(() => vi.fn());
const useGetVehicle = vi.hoisted(() => vi.fn());

vi.mock("./OfflineProvider", () => ({ useOffline: offline }));
vi.mock("@workspace/api-client-react", () => ({
  useListCustomers,
  useGetCustomer,
  useListVehicles,
  useGetVehicle,
  useCreateCustomer: vi.fn(),
  useDeleteCustomer: vi.fn(),
  useUpdateCustomer: vi.fn(),
  useCreateVehicle: vi.fn(),
  useDeleteVehicle: vi.fn(),
  useUpdateVehicle: vi.fn(),
  getGetCustomerQueryKey: vi.fn(),
  getListCustomersQueryKey: vi.fn(),
  getGetVehicleQueryKey: vi.fn(),
  getListVehiclesQueryKey: vi.fn(),
  useListCustomerDocuments: vi.fn(),
  useUploadCustomerDocument: vi.fn(),
  useUpdateCustomerDocument: vi.fn(),
  useDeleteCustomerDocument: vi.fn(),
  getListCustomerDocumentsQueryKey: vi.fn(),
  downloadCustomerDocument: vi.fn(),
  useListVehiclePhotos: vi.fn(),
  useUploadVehiclePhoto: vi.fn(),
  useDeleteVehiclePhoto: vi.fn(),
  getListVehiclePhotosQueryKey: vi.fn(),
  serveVehiclePhoto: vi.fn(),
  useListVehicleDocuments: vi.fn(),
  useUploadVehicleDocument: vi.fn(),
  useUpdateVehicleDocument: vi.fn(),
  useDeleteVehicleDocument: vi.fn(),
  getListVehicleDocumentsQueryKey: vi.fn(),
  downloadVehicleDocument: vi.fn(),
  useListRentals: vi.fn(),
  getListRentalsQueryKey: vi.fn(),
}));

import {
  useOfflineCustomerRecord,
  useOfflineCustomersList,
  useOfflineVehicleRecord,
  useOfflineVehiclesList,
} from "./read-hooks";
import { useCustomerRecord, useCustomersList } from "../customers/api-hooks";
import { useVehicleRecord, useVehiclesList } from "../vehicles/api-hooks";
import {
  useCustomerDocuments,
  useVehicleDocuments,
  useVehiclePhotos,
} from "../media/hooks";
import {
  useRentalsForCustomer,
  useRentalsForVehicle,
} from "../rentals/api-hooks";
import {
  useListCustomerDocuments,
  useListRentals,
  useListVehicleDocuments,
  useListVehiclePhotos,
} from "@workspace/api-client-react";

const workspaceA = { organizationId: "organization-a", userId: "user-a" };
const workspaceB = { organizationId: "organization-b", userId: "user-b" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}

function customer(id: string, firstName = "Ada"): CustomerResponse {
  return {
    id,
    firstName,
    lastName: "Lovelace",
    phone: `phone-${id}`,
    address: "Beirut",
    nationalId: `national-${id}`,
    licenseNumber: `license-${id}`,
    licenseExpiryDate: "2030-01-01",
    createdAt: `2026-09-${id === "new" ? "24" : "23"}T12:00:00.000Z`,
    updatedAt: "2026-09-23T12:00:00.000Z",
  };
}

function vehicle(id: string, make = "Toyota", year = 2024): VehicleResponse {
  return {
    id,
    make,
    model: "Corolla",
    plateNumber: `plate-${id}`,
    year,
    color: "White",
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    seats: 5,
    currentMileage: 100,
    status: "AVAILABLE",
    createdAt: `2026-09-${id === "new" ? "24" : "23"}T12:00:00.000Z`,
    updatedAt: "2026-09-23T12:00:00.000Z",
  };
}

function createStore(): OfflineStore {
  const customers = new Map<string, CustomerResponse[]>();
  const vehicles = new Map<string, VehicleResponse[]>();
  const key = (workspace: OfflineWorkspace) =>
    `${workspace.organizationId}:${workspace.userId}`;
  const replace = <T extends { id: string }>(records: T[], value: T) => [
    ...records.filter((record) => record.id !== value.id),
    value,
  ];

  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getCustomers: vi.fn(
      async (workspace) => customers.get(key(workspace)) ?? [],
    ),
    getCustomer: vi.fn(async (workspace, id) =>
      (customers.get(key(workspace)) ?? []).find((record) => record.id === id),
    ),
    getVehicles: vi.fn(async (workspace) => vehicles.get(key(workspace)) ?? []),
    getVehicle: vi.fn(async (workspace, id) =>
      (vehicles.get(key(workspace)) ?? []).find((record) => record.id === id),
    ),
    getRental: vi.fn(),
    getCompletionCursor: vi.fn(),
    applyPull: vi.fn(async (workspace, changes: readonly SyncPullChange[]) => {
      for (const change of changes) {
        if (change.resource_type === "CUSTOMER" && change.customer) {
          customers.set(
            key(workspace),
            replace(customers.get(key(workspace)) ?? [], change.customer),
          );
        }
        if (change.resource_type === "VEHICLE" && change.vehicle) {
          vehicles.set(
            key(workspace),
            replace(vehicles.get(key(workspace)) ?? [], change.vehicle),
          );
        }
      }
    }),
    enqueue: vi.fn(),
    listOutbox: vi.fn().mockResolvedValue([]),
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

let store: OfflineStore;
let currentWorkspace: OfflineWorkspace | null;
let projectionVersion: number;
let refreshProjections: () => void;

function offlineWrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

function pullCustomer(record: CustomerResponse): SyncPullChange {
  return {
    resource_type: "CUSTOMER",
    resource_id: record.id,
    updated_at: record.updatedAt,
    deleted: false,
    customer: record,
  };
}

function pullVehicle(record: VehicleResponse): SyncPullChange {
  return {
    resource_type: "VEHICLE",
    resource_id: record.id,
    updated_at: record.updatedAt,
    deleted: false,
    vehicle: record,
  };
}

describe("offline read hooks", () => {
  beforeEach(() => {
    store = createStore();
    currentWorkspace = workspaceA;
    projectionVersion = 0;
    refreshProjections = () => {
      projectionVersion += 1;
    };
    offline.mockImplementation(() => ({
      status: "offline",
      isOffline: true,
      workspace: currentWorkspace,
      store,
      projectionVersion,
      refreshProjections,
    }));
    useListCustomers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    useGetCustomer.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    useListVehicles.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    useGetVehicle.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("filters tenant-local customers while offline without calling the API", async () => {
    await store.applyPull(
      workspaceA,
      [
        pullCustomer(customer("old", "Ada")),
        pullCustomer(customer("new", "أحمد")),
      ],
      "cursor",
    );

    const view = renderHook(() => useOfflineCustomersList({ search: "أحمد" }), {
      wrapper: offlineWrapper,
    });

    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([customer("new", "أحمد")]),
    );
    expect(useListCustomers).not.toHaveBeenCalled();
  });

  it("includes a provisional customer in offline reads for dependent rentals", async () => {
    store.getCustomers = vi.fn().mockResolvedValue([
      {
        localId: "local:customer-create",
        operationId: "customer-create",
        customer: {
          first_name: "ليلى",
          last_name: "سالم",
          phone: "03000000",
          address: "بيروت",
          national_id: "national-local",
          license_number: "license-local",
          license_expiry_date: "2030-01-01",
        },
      },
    ]);

    const view = renderHook(() => useOfflineCustomersList(), {
      wrapper: offlineWrapper,
    });

    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([
        expect.objectContaining({
          id: "local:customer-create",
          firstName: "ليلى",
        }),
      ]),
    );
  });

  it("searches and orders local vehicles while offline without calling the API", async () => {
    await store.applyPull(
      workspaceA,
      [
        pullVehicle(vehicle("old", "Toyota", 2023)),
        pullVehicle(vehicle("new", "Honda", 2024)),
      ],
      "cursor",
    );

    const view = renderHook(() => useOfflineVehiclesList({ search: "2024" }), {
      wrapper: offlineWrapper,
    });

    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([
        vehicle("new", "Honda", 2024),
      ]),
    );
    expect(useListVehicles).not.toHaveBeenCalled();
  });

  it("keeps an initial Customer list in loading state until the first read finishes", async () => {
    const pending = deferred<CustomerResponse[]>();
    store.getCustomers = vi.fn().mockReturnValue(pending.promise);
    const view = renderHook(() => useOfflineCustomersList(), {
      wrapper: offlineWrapper,
    });

    expect(view.result.current.isLoading).toBe(true);
    expect(view.result.current.data).toBeUndefined();
    await act(async () => pending.resolve([customer("old")]));
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.data?.data).toEqual([customer("old")]);
  });

  it("keeps current-workspace Customers visible until the latest search result arrives", async () => {
    const first = deferred<CustomerResponse[]>();
    const latest = deferred<CustomerResponse[]>();
    store.getCustomers = vi
      .fn()
      .mockResolvedValueOnce([customer("old", "Ada")])
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(latest.promise);
    let search = "";
    const view = renderHook(() => useOfflineCustomersList({ search }), {
      wrapper: offlineWrapper,
    });
    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([customer("old", "Ada")]),
    );

    search = "Ada";
    view.rerender();
    await waitFor(() => expect(store.getCustomers).toHaveBeenCalledTimes(2));
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.data?.data).toEqual([customer("old", "Ada")]);

    search = "Bob";
    view.rerender();
    await waitFor(() => expect(store.getCustomers).toHaveBeenCalledTimes(3));
    await act(async () => latest.resolve([customer("new", "Bob")]));
    expect(view.result.current.data?.data).toEqual([customer("new", "Bob")]);
    await act(async () => first.resolve([customer("old", "Ada")]));
    expect(view.result.current.data?.data).toEqual([customer("new", "Bob")]);
    expect(view.result.current.isLoading).toBe(false);
  });

  it("keeps current-workspace Vehicles visible during an in-place search and shows an empty result", async () => {
    const pending = deferred<VehicleResponse[]>();
    store.getVehicles = vi
      .fn()
      .mockResolvedValueOnce([vehicle("old", "Toyota")])
      .mockReturnValueOnce(pending.promise);
    let search = "";
    const view = renderHook(() => useOfflineVehiclesList({ search }), {
      wrapper: offlineWrapper,
    });
    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([
        vehicle("old", "Toyota"),
      ]),
    );
    search = "Honda";
    view.rerender();
    await waitFor(() => expect(store.getVehicles).toHaveBeenCalledTimes(2));
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.data?.data).toEqual([vehicle("old", "Toyota")]);
    await act(async () => pending.resolve([vehicle("old", "Toyota")]));
    expect(view.result.current.data?.data).toEqual([]);
  });

  it("returns local details and missing records without API calls", async () => {
    await store.applyPull(
      workspaceA,
      [pullCustomer(customer("customer-1")), pullVehicle(vehicle("vehicle-1"))],
      "cursor",
    );
    const customerView = renderHook(
      () => useOfflineCustomerRecord("customer-1"),
      { wrapper: offlineWrapper },
    );
    const vehicleView = renderHook(() => useOfflineVehicleRecord("vehicle-1"), {
      wrapper: offlineWrapper,
    });

    await waitFor(() =>
      expect(customerView.result.current.data).toEqual({
        data: customer("customer-1"),
      }),
    );
    await waitFor(() =>
      expect(vehicleView.result.current.data).toEqual({
        data: vehicle("vehicle-1"),
      }),
    );
    expect(useGetCustomer).not.toHaveBeenCalled();
    expect(useGetVehicle).not.toHaveBeenCalled();
  });

  it("disables generated customer and vehicle queries while offline", () => {
    renderHook(
      () => {
        useCustomersList({ search: "Ada" });
        useCustomerRecord("customer-1");
        useVehiclesList({ search: "Toyota" });
        useVehicleRecord("vehicle-1");
      },
      { wrapper: offlineWrapper },
    );

    expect(useListCustomers).toHaveBeenCalledWith(
      { search: "Ada" },
      { query: expect.objectContaining({ enabled: false }) },
    );
    expect(useGetCustomer).toHaveBeenCalledWith("customer-1", {
      query: expect.objectContaining({ enabled: false }),
    });
    expect(useListVehicles).toHaveBeenCalledWith(
      { search: "Toyota" },
      { query: expect.objectContaining({ enabled: false }) },
    );
    expect(useGetVehicle).toHaveBeenCalledWith("vehicle-1", {
      query: expect.objectContaining({ enabled: false }),
    });
  });

  it("keeps local reads tenant-scoped and clears superseded workspace results", async () => {
    await store.applyPull(
      workspaceA,
      [pullCustomer(customer("a", "Tenant A"))],
      "cursor-a",
    );
    await store.applyPull(
      workspaceB,
      [pullCustomer(customer("b", "Tenant B"))],
      "cursor-b",
    );
    const view = renderHook(() => useOfflineCustomersList(), {
      wrapper: offlineWrapper,
    });

    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([
        customer("a", "Tenant A"),
      ]),
    );
    currentWorkspace = workspaceB;
    projectionVersion += 1;
    view.rerender();

    expect(view.result.current.data).toBeUndefined();
    expect(view.result.current.isLoading).toBe(true);
    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([
        customer("b", "Tenant B"),
      ]),
    );
  });

  it("refreshes local reads after a projection write", async () => {
    const view = renderHook(() => useOfflineCustomersList(), {
      wrapper: offlineWrapper,
    });
    await waitFor(() => expect(view.result.current.data?.data).toEqual([]));

    await act(async () => {
      await store.applyPull(workspaceA, [pullCustomer(customer("new"))], null);
      refreshProjections();
      view.rerender();
    });

    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([customer("new")]),
    );
  });

  it("reports local projection read failures", async () => {
    const error = new Error("IndexedDB unavailable");
    store.getCustomers = vi.fn().mockRejectedValue(error);

    const view = renderHook(() => useOfflineCustomersList(), {
      wrapper: offlineWrapper,
    });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toBe(error);
  });

  it("reports an in-place search read failure without replacing current-workspace results", async () => {
    const pending = deferred<CustomerResponse[]>();
    store.getCustomers = vi
      .fn()
      .mockResolvedValueOnce([customer("old")])
      .mockReturnValueOnce(pending.promise);
    let search = "";
    const view = renderHook(() => useOfflineCustomersList({ search }), {
      wrapper: offlineWrapper,
    });
    await waitFor(() =>
      expect(view.result.current.data?.data).toEqual([customer("old")]),
    );
    search = "Ada";
    view.rerender();
    await waitFor(() => expect(store.getCustomers).toHaveBeenCalledTimes(2));
    expect(view.result.current.isLoading).toBe(false);
    const error = new Error("IndexedDB unavailable");
    await act(async () => pending.reject(error));
    expect(view.result.current.isError).toBe(true);
    expect(view.result.current.error).toBe(error);
    expect(view.result.current.data?.data).toEqual([customer("old")]);
  });

  it("mirrors online customer and vehicle list and detail responses without deleting existing projections", async () => {
    await store.applyPull(
      workspaceA,
      [pullCustomer(customer("existing")), pullVehicle(vehicle("existing"))],
      "cursor",
    );
    offline.mockImplementation(() => ({
      status: "upToDate",
      isOffline: false,
      workspace: workspaceA,
      store,
      projectionVersion,
      refreshProjections,
    }));
    useListCustomers.mockReturnValue({
      data: { data: [customer("listed")] },
      isLoading: false,
      isError: false,
    });
    useGetCustomer.mockReturnValue({
      data: { data: customer("customer-detail") },
      isLoading: false,
      isError: false,
    });
    useListVehicles.mockReturnValue({
      data: { data: [vehicle("vehicle-list")] },
      isLoading: false,
      isError: false,
    });
    useGetVehicle.mockReturnValue({
      data: { data: vehicle("detail") },
      isLoading: false,
      isError: false,
    });

    renderHook(() => useCustomersList(), { wrapper: offlineWrapper });
    renderHook(() => useCustomerRecord("customer-detail"), {
      wrapper: offlineWrapper,
    });
    renderHook(() => useVehiclesList(), { wrapper: offlineWrapper });
    renderHook(() => useVehicleRecord("detail"), { wrapper: offlineWrapper });

    await waitFor(() =>
      expect(store.applyPull).toHaveBeenCalledWith(
        workspaceA,
        expect.arrayContaining([pullCustomer(customer("listed"))]),
        null,
      ),
    );
    await waitFor(() =>
      expect(store.applyPull).toHaveBeenCalledWith(
        workspaceA,
        [pullCustomer(customer("customer-detail"))],
        null,
      ),
    );
    await waitFor(() =>
      expect(store.applyPull).toHaveBeenCalledWith(
        workspaceA,
        expect.arrayContaining([pullVehicle(vehicle("vehicle-list"))]),
        null,
      ),
    );
    await waitFor(() =>
      expect(store.applyPull).toHaveBeenCalledWith(
        workspaceA,
        [pullVehicle(vehicle("detail"))],
        null,
      ),
    );
    expect(await store.getCustomers(workspaceA)).toEqual(
      expect.arrayContaining([
        customer("existing"),
        customer("listed"),
        customer("customer-detail"),
      ]),
    );
    expect(await store.getVehicles(workspaceA)).toEqual(
      expect.arrayContaining([
        vehicle("existing"),
        vehicle("vehicle-list"),
        vehicle("detail"),
      ]),
    );
  });

  it("does not persist malformed online projections", async () => {
    offline.mockImplementation(() => ({
      status: "upToDate",
      isOffline: false,
      workspace: workspaceA,
      store,
      projectionVersion,
      refreshProjections,
    }));
    useListCustomers.mockReturnValue({
      data: { data: [{ id: "invalid" }] },
      isLoading: false,
      isError: false,
    });

    renderHook(() => useCustomersList(), { wrapper: offlineWrapper });

    await Promise.resolve();
    expect(store.applyPull).not.toHaveBeenCalled();
  });

  it("disables document, media, and rental history queries in explicit offline mode", () => {
    const query = { data: undefined, isLoading: false, isError: false };
    vi.mocked(useListCustomerDocuments).mockReturnValue(
      query as ReturnType<typeof useListCustomerDocuments>,
    );
    vi.mocked(useListVehiclePhotos).mockReturnValue(
      query as ReturnType<typeof useListVehiclePhotos>,
    );
    vi.mocked(useListVehicleDocuments).mockReturnValue(
      query as ReturnType<typeof useListVehicleDocuments>,
    );
    vi.mocked(useListRentals).mockReturnValue(
      query as ReturnType<typeof useListRentals>,
    );

    renderHook(
      () => {
        useCustomerDocuments("customer-1", false);
        useVehiclePhotos("vehicle-1", false);
        useVehicleDocuments("vehicle-1", false);
        useRentalsForCustomer("customer-1", false);
        useRentalsForVehicle("vehicle-1", false);
      },
      { wrapper: offlineWrapper },
    );

    expect(useListCustomerDocuments).toHaveBeenCalledWith("customer-1", {
      query: expect.objectContaining({ enabled: false }),
    });
    expect(useListVehiclePhotos).toHaveBeenCalledWith("vehicle-1", {
      query: expect.objectContaining({ enabled: false }),
    });
    expect(useListVehicleDocuments).toHaveBeenCalledWith("vehicle-1", {
      query: expect.objectContaining({ enabled: false }),
    });
    expect(useListRentals).toHaveBeenCalledWith(undefined, {
      query: expect.objectContaining({ enabled: false }),
    });
  });
});
