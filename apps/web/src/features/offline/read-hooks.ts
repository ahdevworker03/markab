import { useEffect, useRef, useState } from "react";
import type {
  CustomerListResponse,
  CustomerResponse,
  CustomerResponseWrapper,
  VehicleListResponse,
  VehicleResponseWrapper,
} from "@workspace/api-client-react";
import { useOffline } from "./OfflineProvider";
import type { ProvisionalCustomer } from "./types";

type LocalQuery<T> = {
  data: T | undefined;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  refetch: () => Promise<{ data: T | undefined }>;
};

type LocalSearchTiming = {
  generation: number;
  entity: "customers" | "vehicles";
  startMs: number;
  endMs: number;
  records: number;
};

type LocalSearchProbe = {
  requestedGeneration: number;
  entries: LocalSearchTiming[];
};

function startLocalSearch(entity: LocalSearchTiming["entity"]) {
  if (import.meta.env.VITE_BENCHMARK !== "true") return;
  const probe = (
    globalThis as typeof globalThis & {
      __benchmarkLocalSearch?: LocalSearchProbe;
    }
  ).__benchmarkLocalSearch;
  if (!probe) return;
  return {
    probe,
    generation: probe.requestedGeneration,
    entity,
    startMs: performance.now(),
  };
}

function finishLocalSearch(
  start: ReturnType<typeof startLocalSearch>,
  records: number,
) {
  if (start)
    start.probe.entries.push({
      generation: start.generation,
      entity: start.entity,
      startMs: start.startMs,
      endMs: performance.now(),
      records,
    });
}

function normalized(value: string): string {
  return value.toLocaleLowerCase();
}

function byCreatedAt<T extends { createdAt: string }>(
  left: T,
  right: T,
): number {
  return right.createdAt.localeCompare(left.createdAt);
}

function isProvisionalCustomer(
  customer: CustomerResponse | ProvisionalCustomer,
): customer is ProvisionalCustomer {
  return "localId" in customer;
}

function toCustomerResponse(
  customer: CustomerResponse | ProvisionalCustomer,
): CustomerResponse {
  if (!isProvisionalCustomer(customer)) return customer;
  return {
    id: customer.localId,
    firstName: customer.customer.first_name,
    lastName: customer.customer.last_name,
    phone: customer.customer.phone,
    address: customer.customer.address,
    nationalId: customer.customer.national_id,
    licenseNumber: customer.customer.license_number,
    licenseExpiryDate: customer.customer.license_expiry_date,
    createdAt: customer.operationId,
    updatedAt: customer.operationId,
  };
}

export function useOfflineCustomersList(params?: {
  search?: string;
}): LocalQuery<CustomerListResponse> {
  const { isOffline, projectionVersion, store, workspace } = useOffline();
  const [data, setData] = useState<CustomerListResponse>();
  const [error, setError] = useState<unknown>();
  const [loadedWorkspace, setLoadedWorkspace] = useState<string>();
  const loadedResultWorkspace = useRef<string>(undefined);
  const [isLoading, setIsLoading] = useState(isOffline && workspace !== null);
  const search = params?.search ? normalized(params.search) : "";
  const workspaceKey = workspace
    ? `${workspace.organizationId}:${workspace.userId}`
    : "";

  useEffect(() => {
    let active = true;
    if (!isOffline) return;
    if (!workspace) {
      setData({ data: [] });
      setError(undefined);
      setLoadedWorkspace(workspaceKey);
      loadedResultWorkspace.current = workspaceKey;
      setIsLoading(false);
      return;
    }

    if (loadedResultWorkspace.current !== workspaceKey) setIsLoading(true);
    setError(undefined);
    const searchTiming = startLocalSearch("customers");
    void store
      .getCustomers(workspace)
      .then((customers) => {
        if (!active) return;
        const data = customers
          .map(toCustomerResponse)
          .filter(
            (customer) =>
              !search ||
              [
                customer.firstName,
                customer.lastName,
                customer.nationalId,
                customer.licenseNumber,
                customer.phone,
              ].some((value) => normalized(value).includes(search)),
          )
          .sort(byCreatedAt);
        finishLocalSearch(searchTiming, customers.length);
        setData({ data });
        setLoadedWorkspace(workspaceKey);
        loadedResultWorkspace.current = workspaceKey;
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setError(error);
        setLoadedWorkspace(workspaceKey);
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    isOffline,
    projectionVersion,
    search,
    store,
    workspace?.organizationId,
    workspace?.userId,
    workspaceKey,
  ]);

  return {
    data: isOffline && loadedWorkspace === workspaceKey ? data : undefined,
    error,
    isError: error !== undefined,
    isLoading: isOffline
      ? isLoading || loadedWorkspace !== workspaceKey
      : false,
    refetch: async () => ({ data }),
  };
}

export function useOfflineCustomerRecord(
  id: string,
): LocalQuery<CustomerResponseWrapper> {
  const { isOffline, projectionVersion, store, workspace } = useOffline();
  const [data, setData] = useState<CustomerResponseWrapper>();
  const [error, setError] = useState<unknown>();
  const [loadedWorkspace, setLoadedWorkspace] = useState<string>();
  const [isLoading, setIsLoading] = useState(isOffline && workspace !== null);
  const workspaceKey = workspace
    ? `${workspace.organizationId}:${workspace.userId}`
    : "";

  useEffect(() => {
    let active = true;
    if (!isOffline) return;
    if (!workspace) {
      setData(undefined);
      setError(undefined);
      setLoadedWorkspace(workspaceKey);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);
    void store
      .getCustomer(workspace, id)
      .then((customer) => {
        if (!active) return;
        setData(customer ? { data: toCustomerResponse(customer) } : undefined);
        setLoadedWorkspace(workspaceKey);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setError(error);
        setLoadedWorkspace(workspaceKey);
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    id,
    isOffline,
    projectionVersion,
    store,
    workspace?.organizationId,
    workspace?.userId,
    workspaceKey,
  ]);

  return {
    data: isOffline && loadedWorkspace === workspaceKey ? data : undefined,
    error,
    isError: error !== undefined,
    isLoading: isOffline
      ? isLoading || loadedWorkspace !== workspaceKey
      : false,
    refetch: async () => ({ data }),
  };
}

export function useOfflineVehiclesList(params?: {
  search?: string;
}): LocalQuery<VehicleListResponse> {
  const { isOffline, projectionVersion, store, workspace } = useOffline();
  const [data, setData] = useState<VehicleListResponse>();
  const [error, setError] = useState<unknown>();
  const [loadedWorkspace, setLoadedWorkspace] = useState<string>();
  const loadedResultWorkspace = useRef<string>(undefined);
  const [isLoading, setIsLoading] = useState(isOffline && workspace !== null);
  const search = params?.search ? normalized(params.search) : "";
  const workspaceKey = workspace
    ? `${workspace.organizationId}:${workspace.userId}`
    : "";

  useEffect(() => {
    let active = true;
    if (!isOffline) return;
    if (!workspace) {
      setData({ data: [] });
      setError(undefined);
      setLoadedWorkspace(workspaceKey);
      loadedResultWorkspace.current = workspaceKey;
      setIsLoading(false);
      return;
    }

    if (loadedResultWorkspace.current !== workspaceKey) setIsLoading(true);
    setError(undefined);
    const searchTiming = startLocalSearch("vehicles");
    void store
      .getVehicles(workspace)
      .then((vehicles) => {
        if (!active) return;
        const year = /^\d+$/.test(search) ? Number(search) : undefined;
        const data = vehicles
          .filter(
            (vehicle) =>
              !search ||
              vehicle.year === year ||
              [vehicle.make, vehicle.model, vehicle.plateNumber].some((value) =>
                normalized(value).includes(search),
              ),
          )
          .sort(byCreatedAt);
        finishLocalSearch(searchTiming, vehicles.length);
        setData({ data });
        setLoadedWorkspace(workspaceKey);
        loadedResultWorkspace.current = workspaceKey;
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setError(error);
        setLoadedWorkspace(workspaceKey);
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    isOffline,
    projectionVersion,
    search,
    store,
    workspace?.organizationId,
    workspace?.userId,
    workspaceKey,
  ]);

  return {
    data: isOffline && loadedWorkspace === workspaceKey ? data : undefined,
    error,
    isError: error !== undefined,
    isLoading: isOffline
      ? isLoading || loadedWorkspace !== workspaceKey
      : false,
    refetch: async () => ({ data }),
  };
}

export function useOfflineVehicleRecord(
  id: string,
): LocalQuery<VehicleResponseWrapper> {
  const { isOffline, projectionVersion, store, workspace } = useOffline();
  const [data, setData] = useState<VehicleResponseWrapper>();
  const [error, setError] = useState<unknown>();
  const [loadedWorkspace, setLoadedWorkspace] = useState<string>();
  const [isLoading, setIsLoading] = useState(isOffline && workspace !== null);
  const workspaceKey = workspace
    ? `${workspace.organizationId}:${workspace.userId}`
    : "";

  useEffect(() => {
    let active = true;
    if (!isOffline) return;
    if (!workspace) {
      setData(undefined);
      setError(undefined);
      setLoadedWorkspace(workspaceKey);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);
    void store
      .getVehicle(workspace, id)
      .then((vehicle) => {
        if (!active) return;
        setData(vehicle ? { data: vehicle } : undefined);
        setLoadedWorkspace(workspaceKey);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setError(error);
        setLoadedWorkspace(workspaceKey);
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    id,
    isOffline,
    projectionVersion,
    store,
    workspace?.organizationId,
    workspace?.userId,
    workspaceKey,
  ]);

  return {
    data: isOffline && loadedWorkspace === workspaceKey ? data : undefined,
    error,
    isError: error !== undefined,
    isLoading: isOffline
      ? isLoading || loadedWorkspace !== workspaceKey
      : false,
    refetch: async () => ({ data }),
  };
}
