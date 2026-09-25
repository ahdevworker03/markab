import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useCreateCustomer,
  useDeleteCustomer,
  useGetCustomer,
  useListCustomers,
  useUpdateCustomer,
} from "@workspace/api-client-react";
import { useOffline } from "@/features/offline/OfflineProvider";
import {
  useOfflineCustomerRecord,
  useOfflineCustomersList,
} from "@/features/offline/read-hooks";
import { GetCustomerResponse, ListCustomersResponse } from "@workspace/api-zod";

export function useCustomersList(params?: { search?: string }) {
  const { isOffline, refreshProjections, store, workspace } = useOffline();
  const query = useListCustomers(params, {
    query: { enabled: !isOffline, queryKey: getListCustomersQueryKey(params) },
  });
  const localQuery = useOfflineCustomersList(params);
  useEffect(() => {
    if (
      isOffline ||
      !workspace ||
      !query.data?.data ||
      !ListCustomersResponse.safeParse(query.data).success
    ) return;
    let active = true;
    void store.applyPull(workspace, query.data.data.map((customer) => ({
      resource_type: "CUSTOMER" as const,
      resource_id: customer.id,
      updated_at: customer.updatedAt,
      deleted: false,
      customer,
    })), null).then(() => {
      if (active) refreshProjections();
    });
    return () => { active = false; };
  }, [isOffline, query.data, refreshProjections, store, workspace?.organizationId, workspace?.userId]);
  const activeQuery = isOffline ? localQuery : query;
  const customers = useMemo(() => activeQuery.data?.data ?? [], [activeQuery.data]);

  return { ...activeQuery, customers };
}

export function useCustomerRecord(id: string) {
  const { isOffline, refreshProjections, store, workspace } = useOffline();
  const query = useGetCustomer(id, {
    query: { enabled: !isOffline, queryKey: getGetCustomerQueryKey(id) },
  });
  const localQuery = useOfflineCustomerRecord(id);
  useEffect(() => {
    const customer = query.data?.data;
    if (
      isOffline ||
      !workspace ||
      !customer ||
      !GetCustomerResponse.safeParse(query.data).success
    ) return;
    let active = true;
    void store.applyPull(workspace, [{
      resource_type: "CUSTOMER",
      resource_id: customer.id,
      updated_at: customer.updatedAt,
      deleted: false,
      customer,
    }], null).then(() => {
      if (active) refreshProjections();
    });
    return () => { active = false; };
  }, [isOffline, query.data, refreshProjections, store, workspace?.organizationId, workspace?.userId]);
  return isOffline ? localQuery : query;
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();
  const invalidateList = () => void queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  const invalidateRecord = (id: string) => void queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });

  const create = useCreateCustomer({ mutation: { onSuccess: invalidateList } });
  const update = useUpdateCustomer({ mutation: { onSuccess: (_data, variables) => { invalidateList(); invalidateRecord(variables.id); } } });
  const remove = useDeleteCustomer({ mutation: { onSuccess: (_data, variables) => { invalidateList(); invalidateRecord(variables.id); } } });

  return { create, update, remove };
}
