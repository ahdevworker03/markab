import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RentalResponse } from "@workspace/api-client-react";
import RentalsPage from "./RentalsPage";

const { setLocation, useListCustomers, useListRentals, useListVehicles } =
  vi.hoisted(() => ({
    setLocation: vi.fn(),
    useListCustomers: vi.fn(),
    useListRentals: vi.fn(),
    useListVehicles: vi.fn(),
  }));

vi.mock("wouter", () => ({ useLocation: () => ["/rentals", setLocation] }));
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useListCustomers,
  useListRentals,
  useListVehicles,
}));
vi.mock("@/features/payments/hooks", () => ({
  useOrgOutstandingBalances: () => ({
    balances: [],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "OWNER" } }),
}));

const rentals = Array.from({ length: 51 }, (_, index) => ({
  id: `rental-${index + 1}`,
  customerId: `customer-${index + 1}`,
  vehicleId: `vehicle-${index + 1}`,
  pickupDate: "2026-08-01T09:00:00.000Z",
  expectedReturnDate: "2026-08-05T09:00:00.000Z",
  actualPickupDate: null,
  actualReturnDate: null,
  dailyRate: 100,
  totalAmount: 400,
  depositAmount: 50,
  status: index === 50 ? "ACTIVE" : "RESERVED",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
})) as RentalResponse[];

describe("RentalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useListRentals.mockImplementation((params?: { search?: string }) => ({
      data: {
        data: params?.search
          ? rentals.filter((rental) => rental.id.includes(params.search!))
          : rentals,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    useListCustomers.mockReturnValue({
      data: {
        data: rentals.map((rental, index) => ({
          id: rental.customerId,
          firstName: `عميل ${String(index + 1).padStart(2, "0")}`,
          lastName: "اختبار",
          phone: `+961701${String(index + 1).padStart(4, "0")}`,
        })),
      },
    });
    useListVehicles.mockReturnValue({
      data: {
        data: rentals.map((rental, index) => ({
          id: rental.vehicleId,
          make: "Toyota",
          model: String(index + 1),
          plateNumber: `PLATE-${index + 1}`,
        })),
      },
    });
  });

  it("renders only one bounded page of rental records and exposes the next page", () => {
    render(<RentalsPage />);

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

  it("resets to the first page when search finds a rental outside the visible page", () => {
    vi.useFakeTimers();
    render(<RentalsPage />);
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    fireEvent.change(
      screen.getByPlaceholderText("ابحث بالعميل أو السيارة..."),
      {
        target: { value: "51" },
      },
    );
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getAllByText("عميل 51 اختبار").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("applies status filters before selecting the visible page", () => {
    render(<RentalsPage />);
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));

    fireEvent.click(screen.getByRole("button", { name: "نشط" }));

    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      1,
    );
    expect(screen.getAllByText("عميل 51 اختبار").length).toBeGreaterThan(0);
  });
});
