import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetVehicleQueryKey,
  getListVehiclesQueryKey,
  useCreateVehicle,
  useDeleteVehicle,
  useGetVehicle,
  useListVehicles,
  useUpdateVehicle,
} from "@workspace/api-client-react";
import { useOffline } from "@/features/offline/OfflineProvider";
import {
  useOfflineVehicleRecord,
  useOfflineVehiclesList,
} from "@/features/offline/read-hooks";
import { GetVehicleResponse, ListVehiclesResponse } from "@workspace/api-zod";

export function useVehiclesList(params?: { search?: string }) {
  const { isOffline, refreshProjections, store, workspace } = useOffline();
  const query = useListVehicles(params, {
    query: { enabled: !isOffline, queryKey: getListVehiclesQueryKey(params) },
  });
  const localQuery = useOfflineVehiclesList(params);
  useEffect(() => {
    if (
      isOffline ||
      !workspace ||
      !query.data?.data ||
      !ListVehiclesResponse.safeParse(query.data).success
    ) return;
    let active = true;
    void store.applyPull(workspace, query.data.data.map((vehicle) => ({
      resource_type: "VEHICLE" as const,
      resource_id: vehicle.id,
      updated_at: vehicle.updatedAt,
      deleted: false,
      vehicle,
    })), null).then(() => {
      if (active) refreshProjections();
    });
    return () => { active = false; };
  }, [isOffline, query.data, refreshProjections, store, workspace?.organizationId, workspace?.userId]);
  const activeQuery = isOffline ? localQuery : query;
  const vehicles = useMemo(() => activeQuery.data?.data ?? [], [activeQuery.data]);

  return { ...activeQuery, vehicles };
}

export function useVehicleRecord(id: string) {
  const { isOffline, refreshProjections, store, workspace } = useOffline();
  const query = useGetVehicle(id, {
    query: { enabled: !isOffline, queryKey: getGetVehicleQueryKey(id) },
  });
  const localQuery = useOfflineVehicleRecord(id);
  useEffect(() => {
    const vehicle = query.data?.data;
    if (
      isOffline ||
      !workspace ||
      !vehicle ||
      !GetVehicleResponse.safeParse(query.data).success
    ) return;
    let active = true;
    void store.applyPull(workspace, [{
      resource_type: "VEHICLE",
      resource_id: vehicle.id,
      updated_at: vehicle.updatedAt,
      deleted: false,
      vehicle,
    }], null).then(() => {
      if (active) refreshProjections();
    });
    return () => { active = false; };
  }, [isOffline, query.data, refreshProjections, store, workspace?.organizationId, workspace?.userId]);
  return isOffline ? localQuery : query;
}

export function useVehicleMutations() {
  const queryClient = useQueryClient();
  const invalidateList = () => void queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
  const invalidateRecord = (id: string) => void queryClient.invalidateQueries({ queryKey: getGetVehicleQueryKey(id) });

  const create = useCreateVehicle({ mutation: { onSuccess: invalidateList } });
  const update = useUpdateVehicle({ mutation: { onSuccess: (_data, variables) => { invalidateList(); invalidateRecord(variables.id); } } });
  const remove = useDeleteVehicle({ mutation: { onSuccess: (_data, variables) => { invalidateList(); invalidateRecord(variables.id); } } });

  return { create, update, remove };
}
