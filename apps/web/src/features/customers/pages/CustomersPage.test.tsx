import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerResponse } from "@workspace/api-client-react";
import CustomersPage from "./CustomersPage";

const { setLocation, setSearchParams, useCustomersList } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  setSearchParams: vi.fn(),
  useCustomersList: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/customers", setLocation],
  useSearchParams: () => [new URLSearchParams(), setSearchParams],
}));
vi.mock("@/features/customers/api-hooks", () => ({ useCustomersList }));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "OWNER" } }),
}));
vi.mock("@/features/offline/OfflineProvider", () => ({
  useOffline: () => ({ isOffline: false }),
}));

const customers = Array.from({ length: 51 }, (_, index) => ({
  id: `customer-${index + 1}`,
  firstName: `عميل ${String(index + 1).padStart(2, "0")}`,
  lastName: "اختبار",
  phone: `+961701${String(index + 1).padStart(4, "0")}`,
  address: "بيروت",
  nationalId: `NID-${index + 1}`,
  licenseNumber: `LIC-${index + 1}`,
  licenseExpiryDate: "2027-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
})) as CustomerResponse[];

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCustomersList.mockImplementation((params?: { search?: string }) => ({
      customers: params?.search
        ? customers.filter((customer) =>
            customer.firstName.includes(params.search!),
          )
        : customers,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
  });

  it("renders only one bounded page of customer records and exposes the next page", () => {
    render(<CustomersPage />);

    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      50,
    );
    expect(screen.getAllByText("عميل 01 اختبار").length).toBeGreaterThan(0);
    expect(screen.queryByText("عميل 51 اختبار")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      1,
    );
    expect(screen.getAllByText("عميل 51 اختبار").length).toBeGreaterThan(0);
  });

  it("resets to the first page when a search finds a customer outside the visible page", () => {
    vi.useFakeTimers();
    render(<CustomersPage />);
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    fireEvent.change(
      screen.getByPlaceholderText(
        "ابحث بالاسم أو الهوية أو رقم الرخصة أو الهاتف...",
      ),
      { target: { value: "51" } },
    );
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getAllByText("عميل 51 اختبار").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
