import { useMemo } from "react";
import {
  useListRentals,
  useListAvailableVehicles,
  getListRentalsQueryKey,
  getListAvailableVehiclesQueryKey,
} from "@workspace/api-client-react";
import type { ListAvailableVehiclesParams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useRentalsForCustomer(customerId: string, enabled = true) {
  const { data, isLoading, isError, error } = useListRentals(undefined, {
    query: { enabled, queryKey: getListRentalsQueryKey() },
  });

  const rentals = useMemo(
    () => (data?.data ?? []).filter((r) => r.customerId === customerId),
    [data, customerId],
  );

  return { rentals, isLoading, isError, error };
}

export function useRentalsForVehicle(vehicleId: string, enabled = true) {
  const { data, isLoading, isError, error } = useListRentals(undefined, {
    query: { enabled, queryKey: getListRentalsQueryKey() },
  });

  const rentals = useMemo(
    () => (data?.data ?? []).filter((r) => r.vehicleId === vehicleId),
    [data, vehicleId],
  );

  return { rentals, isLoading, isError, error };
}

export function useAvailableVehicles(params: ListAvailableVehiclesParams | null) {
  const queryClient = useQueryClient();
  const queryKey = params ? getListAvailableVehiclesQueryKey(params) : [];

  const query = useListAvailableVehicles(
    params ?? { pickupDate: "", expectedReturnDate: "" },
    {
      query: {
        enabled: Boolean(params),
        queryKey,
      },
    },
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListAvailableVehiclesQueryKey() });
  };

  return { query, invalidate };
}
