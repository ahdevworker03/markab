import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  getGetOutstandingBalancesQueryKey,
  useCreatePayment,
  useGetOutstandingBalances,
  useListRentals,
} from "@workspace/api-client-react";
import { useOrgOutstandingBalances, usePaymentMutations } from "./hooks";

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useListRentals: vi.fn(),
  useGetOutstandingBalances: vi.fn(),
  useCreatePayment: vi.fn(),
}));

const summary = {
  data: {
    balances: [
      {
        rentalId: "r1",
        customerId: "c1",
        totalAmount: 100,
        paidAmount: 20,
        outstandingBalance: 80,
      },
    ],
    totalOutstanding: 80,
    customerOutstanding: [{ customerId: "c1", outstandingBalance: 80 }],
  },
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useListRentals).mockReturnValue({
    data: { data: [] },
    isLoading: false,
  } as ReturnType<typeof useListRentals>);
  vi.mocked(useGetOutstandingBalances).mockReturnValue({
    data: summary,
    isLoading: false,
    isFetching: false,
    error: null,
  } as ReturnType<typeof useGetOutstandingBalances>);
});

describe("organization payment balances", () => {
  it("reads one generated tenant summary and exposes its authoritative totals", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrgOutstandingBalances(), {
      wrapper,
    });
    expect(useGetOutstandingBalances).toHaveBeenCalledTimes(1);
    expect(result.current.totalOutstanding).toBe(80);
    expect(result.current.balances).toEqual(summary.data.balances);
    expect(result.current.customerOutstanding).toEqual(
      summary.data.customerOutstanding,
    );
  });

  it("invalidates the tenant summary after a successful payment without losing rental-detail invalidation", async () => {
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let onSuccess: (() => void) | undefined;
    vi.mocked(useCreatePayment).mockImplementation((options) => {
      onSuccess = options?.mutation?.onSuccess as () => void;
      return {} as ReturnType<typeof useCreatePayment>;
    });
    renderHook(() => usePaymentMutations("r1"), { wrapper });
    onSuccess?.();
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: getGetOutstandingBalancesQueryKey(),
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/rentals/r1/payments"],
    });
  });
});
