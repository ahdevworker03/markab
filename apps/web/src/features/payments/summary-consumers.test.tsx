import {
  render,
  renderHook,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import AnalyticsPage from "@/features/analytics/pages/AnalyticsPage";
import RentalsPage from "@/features/rentals/pages/RentalsPage";
import RentalDetailPage from "@/features/rentals/pages/RentalDetailPage";
import { useOrgOutstandingBalances, usePaymentMutations } from "./hooks";
import { formatCurrency } from "@/lib/format";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "OWNER" } }),
}));
vi.mock("@/features/contracts", () => ({ ContractSection: () => null }));
vi.mock("@/features/vehicles/hooks", () => ({ useVehicles: () => [] }));
vi.mock("@/features/rentals/hooks", () => ({ useRentals: () => [] }));
vi.mock("@/features/customers/hooks", () => ({
  useCustomers: () => [],
  useCustomerById: () => () => undefined,
}));

const rental = {
  id: "r1",
  customerId: "c1",
  vehicleId: "v1",
  totalAmount: 100,
  dailyRate: 25,
  depositAmount: 0,
  status: "ACTIVE",
  pickupDate: "2026-08-01T09:00:00Z",
  expectedReturnDate: "2026-08-05T09:00:00Z",
  actualPickupDate: null,
  actualReturnDate: null,
  createdAt: "2026-08-01T09:00:00Z",
  updatedAt: "2026-08-01T09:00:00Z",
};
const summary = {
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
};
let paths: string[];
let summaryReads: number;
let clients: QueryClient[];

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  paths = [];
  summaryReads = 0;
  clients = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      paths.push(path);
      let data: unknown = [];
      if (path === "/api/payments/outstanding-balances") {
        summaryReads += 1;
        data = summary;
      } else if (path === "/api/rentals") data = [rental];
      else if (path === "/api/rentals/r1") data = rental;
      else if (path === "/api/rentals/r1/return")
        data = { ...rental, status: "RETURNED" };
      else if (path === "/api/customers" || path === "/api/customers/c1") {
        const customer = {
          id: "c1",
          firstName: "ليلى",
          lastName: "خليل",
          address: "بيروت",
          phone: "123",
          nationalId: "n1",
          licenseNumber: "l1",
          licenseExpiryDate: "2030-01-01T00:00:00Z",
        };
        data = path === "/api/customers" ? [customer] : customer;
      } else if (path === "/api/vehicles/v1")
        data = {
          id: "v1",
          make: "Toyota",
          model: "Yaris",
          plateNumber: "B-1",
          status: "RENTED",
        };
      else if (path === "/api/rentals/r1/payments")
        data =
          init?.method === "POST"
            ? { id: "p1", rentalId: "r1", amount: 20 }
            : { payments: [], outstandingBalance: 80 };
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  clients.forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

describe("outstanding-summary HTTP consumers", () => {
  it.each([DashboardPage, AnalyticsPage, RentalsPage])(
    "%s renders authoritative balances using one summary and no per-rental payments",
    async (Page) => {
      const { wrapper } = setup();
      render(<Page />, { wrapper });
      await waitFor(() =>
        expect(screen.getAllByText(formatCurrency(80)).length).toBeGreaterThan(
          0,
        ),
      );
      expect(
        paths.filter((path) => path === "/api/payments/outstanding-balances"),
      ).toHaveLength(1);
      expect(
        paths.filter((path) => /^\/api\/rentals\/[^/]+\/payments$/.test(path)),
      ).toEqual([]);
    },
  );

  it("rental detail retains its one-rental payment history without a summary request", async () => {
    const { wrapper } = setup();
    render(<RentalDetailPage params={{ id: "r1" }} />, { wrapper });
    await waitFor(() =>
      expect(screen.getAllByText(formatCurrency(80)).length).toBeGreaterThan(0),
    );
    expect(
      paths.filter((path) => path === "/api/rentals/r1/payments"),
    ).toHaveLength(1);
    expect(summaryReads).toBe(0);
  });

  it("payment creation refetches an active summary", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({
        summary: useOrgOutstandingBalances(),
        mutations: usePaymentMutations("r1"),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.summary.totalOutstanding).toBe(80),
    );
    await act(async () => {
      await result.current.mutations.create.mutateAsync({
        rentalId: "r1",
        data: {
          amount: 20,
          payment_date: "2026-08-02T09:00:00Z",
          method: "CASH",
        },
      });
    });
    await waitFor(() => expect(summaryReads).toBe(2));
  });

  it("a rental lifecycle mutation invalidates an active outstanding summary", async () => {
    const { wrapper } = setup();
    renderHook(() => useOrgOutstandingBalances(), { wrapper });
    render(<RentalDetailPage params={{ id: "r1" }} />, { wrapper });
    await waitFor(() => expect(summaryReads).toBe(1));
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "إرجاع السيارة" }))[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));
    await waitFor(() => expect(summaryReads).toBe(2));
  });
});
