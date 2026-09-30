import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRentalPayments,
  useListPayments,
  useGetOutstandingBalances,
  useCreatePayment,
  getListRentalPaymentsQueryKey,
  getGetOutstandingBalancesQueryKey,
  getListPaymentsQueryKey,
} from "@workspace/api-client-react";

export function useRentalPayments(rentalId: string) {
  const query = useListRentalPayments(rentalId);

  const data = useMemo(
    () => ({
      payments: query.data?.data.payments ?? [],
      outstandingBalance: query.data?.data.outstandingBalance ?? 0,
    }),
    [query.data],
  );

  return { ...query, data };
}

export function usePaymentMutations(rentalId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getListRentalPaymentsQueryKey(rentalId),
    });
    void queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: getGetOutstandingBalancesQueryKey(),
    });
  };

  const create = useCreatePayment({
    mutation: {
      onSuccess: () => invalidate(),
    },
  });

  return { create };
}

/** All recorded payments in the current organization (API-backed). */
export function usePayments() {
  const query = useListPayments();
  const payments = useMemo(() => query.data?.data ?? [], [query.data]);
  return { ...query, payments };
}

export function useOrgOutstandingBalances() {
  const query = useGetOutstandingBalances();
  return {
    ...query,
    balances: query.data?.data.balances ?? [],
    customerOutstanding: query.data?.data.customerOutstanding ?? [],
    totalOutstanding: query.data?.data.totalOutstanding ?? null,
  };
}
