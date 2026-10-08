import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Router, useLocation } from "wouter";
import AnalyticsPage from "./AnalyticsPage";
import { useOrgOutstandingBalances } from "@/features/payments/hooks";
import { useVehicles } from "@/features/vehicles/hooks";
import type { Vehicle } from "@/data/types";
import {
  useListCustomers,
  useListVehicles,
  type ExpenseResponse,
  type MaintenanceResponse,
  type VehicleResponse,
  type VehicleResponseStatus,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";

vi.mock("@/features/vehicles/hooks", () => ({
  useVehicles: vi.fn(() => []),
}));

vi.mock("@/features/rentals/hooks", () => ({
  useRentals: vi.fn(() => []),
}));

vi.mock("@/features/customers/hooks", () => ({
  useCustomers: vi.fn(() => []),
  useCustomerById: vi.fn(() => () => undefined),
}));

vi.mock("@/features/maintenance/hooks", () => ({
  useMaintenance: vi.fn(() => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/features/expenses/hooks", () => ({
  useExpenses: vi.fn(() => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/features/payments/hooks", () => ({
  usePayments: vi.fn(() => ({
    data: { data: [] },
    payments: [],
    isLoading: false,
    isError: false,
    error: null,
  })),
  useOrgOutstandingBalances: vi.fn(() => ({
    balances: [],
    rentals: [],
    totalOutstanding: 0,
    customerOutstanding: [],
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/api-client-react")>();
  return {
    ...actual,
    useListRentals: vi.fn(() => ({
      data: { data: [] },
      isLoading: false,
      error: null,
    })),
    useListVehicles: vi.fn(() => ({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
    })),
    useListCustomers: vi.fn(() => ({
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
    })),
  };
});

function openSelect(label: string) {
  const trigger = screen.getByRole("combobox", { name: label });
  Object.assign(trigger, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    isPrimary: true,
    pointerType: "mouse",
  });
  return trigger;
}

const vehicleId = "00000000-0000-4000-8000-000000000001";

function makeVehicle(
  status: VehicleResponseStatus,
  overrides: Partial<VehicleResponse> = {},
): VehicleResponse {
  return {
    id: vehicleId,
    make: "Kia",
    model: "Picanto",
    plateNumber: "KIA-1",
    year: 2024,
    color: "White",
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    seats: 5,
    currentMileage: 1_000,
    status,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockApiVehicles(vehicles: VehicleResponse[]) {
  vi.mocked(useListVehicles).mockReturnValue({
    data: { data: vehicles },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useListVehicles>);
}

function makeMaintenance(vehicleId: string): MaintenanceResponse {
  return {
    id: "maintenance-1",
    vehicleId,
    type: "REPAIR",
    status: "COMPLETED",
    maintenanceDate: "2025-01-10T00:00:00Z",
    completedAt: "2025-01-10T00:00:00Z",
    cost: 150,
    vendor: null,
    notes: null,
    replacedParts: null,
    createdAt: "2025-01-10T00:00:00Z",
    updatedAt: "2025-01-10T00:00:00Z",
  };
}

function makeExpense(vehicleId: string): ExpenseResponse {
  return {
    id: "expense-1",
    vehicleId,
    expenseDate: "2026-01-10T00:00:00Z",
    amount: 75,
    category: "FUEL",
    description: null,
    createdAt: "2025-01-10T00:00:00Z",
    updatedAt: "2025-01-10T00:00:00Z",
  };
}

function makeLegacyVehicle(): Vehicle {
  return {
    id: "v2",
    make: "Kia",
    model: "Picanto",
    year: 2021,
    plate: "LEGACY-2",
    status: "rented",
    dailyPrice: 30,
    mileage: 45_000,
    photos: [],
  };
}

function LocationProbe({ onLocation }: { onLocation: (location: string) => void }) {
  const [location] = useLocation();
  onLocation(location);
  return null;
}

describe("AnalyticsPage insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the financial overview, trend, and vehicle insight sections", () => {
    render(<AnalyticsPage />);

    expect(screen.getByText("إجمالي الإيرادات")).toBeInTheDocument();
    expect(screen.getByText("اتجاه أداء الأعمال 2025")).toBeInTheDocument();
    expect(screen.getByText("رؤى السيارات")).toBeInTheDocument();
    expect(
      screen.getByText("لا توجد بيانات أداء لهذه السنة"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("لا توجد بيانات كافية لرؤى السيارات"),
    ).toBeInTheDocument();
  });

  it("renders the backend summary total and customer outstanding rather than summing rental balances", () => {
    vi.mocked(useOrgOutstandingBalances).mockReturnValue({
      balances: [],
      rentals: [],
      totalOutstanding: 80,
      customerOutstanding: [{ customerId: "c1", outstandingBalance: 80 }],
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOrgOutstandingBalances>);
    vi.mocked(useListCustomers).mockReturnValue({
      data: {
        data: [
          { id: "c1", firstName: "ليلى", lastName: "خليل", address: "بيروت" },
        ],
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useListCustomers>);

    render(<AnalyticsPage />);
    expect(screen.getByText("ليلى خليل")).toBeInTheDocument();
    expect(screen.getAllByText(formatCurrency(80)).length).toBeGreaterThan(0);
  });

  it("updates the trend period when the selected year changes", () => {
    render(<AnalyticsPage />);

    openSelect("سنة التحليل");
    fireEvent.click(screen.getByRole("option", { name: "2024" }));

    expect(screen.getByText("اتجاه أداء الأعمال 2024")).toBeInTheDocument();
  });

  it("keeps each period label, value, and chevron in one compact control", () => {
    render(<AnalyticsPage />);

    ["سنة التحليل", "شهر الملخص"].forEach((label) => {
      const trigger = screen.getByRole("combobox", { name: label });

      expect(trigger).toHaveClass("h-11", "w-auto", "justify-start", "gap-2");
      expect(trigger).toHaveClass("[&>svg]:shrink-0", "[&>svg]:opacity-100");
    });
  });

  it("opens the month selector from its trigger and chevron", () => {
    render(<AnalyticsPage />);

    const monthTrigger = openSelect("شهر الملخص");
    expect(
      screen.getByRole("option", { name: "تشرين الثاني" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(monthTrigger, { key: "Escape" });
    const chevron = monthTrigger.lastElementChild!;
    Object.assign(chevron, {
      hasPointerCapture: () => false,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
    });
    fireEvent.pointerDown(chevron, {
      button: 0,
      ctrlKey: false,
      isPrimary: true,
      pointerType: "mouse",
    });

    expect(
      screen.getByRole("option", { name: "تشرين الأول" }),
    ).toBeInTheDocument();
  });

  it("makes the financial summary month explicit and lets it change", () => {
    render(<AnalyticsPage />);

    expect(screen.getAllByText("كانون الثاني 2025").length).toBeGreaterThan(0);
    openSelect("شهر الملخص");
    fireEvent.click(screen.getByRole("option", { name: "آذار" }));

    expect(screen.getAllByText("آذار 2025").length).toBeGreaterThan(0);
  });

  it("uses error feedback when financial data fails", async () => {
    const { useExpenses } = await import("@/features/expenses/hooks");
    vi.mocked(useExpenses).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("تعذر تحميل المصروفات"),
    } as ReturnType<typeof useExpenses>);

    render(<AnalyticsPage />);

    expect(
      screen
        .getByText(/تعذر تحديث بعض البيانات المالية/)
        .closest('[role="alert"]'),
    ).toHaveClass("bg-status-danger-bg");
  });

  it("shows loading state instead of empty insight values", async () => {
    const { useMaintenance } = await import("@/features/maintenance/hooks");
    vi.mocked(useMaintenance).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useMaintenance>);

    render(<AnalyticsPage />);

    expect(
      screen.getAllByLabelText("جارٍ تحميل البيانات").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByText("لا توجد بيانات أداء لهذه السنة"),
    ).not.toBeInTheDocument();
  });

  it("renders every supported status from the API fleet", () => {
    mockApiVehicles([
      makeVehicle("AVAILABLE", { id: "00000000-0000-4000-8000-000000000001" }),
      makeVehicle("RESERVED", { id: "00000000-0000-4000-8000-000000000002" }),
      makeVehicle("RENTED", { id: "00000000-0000-4000-8000-000000000003" }),
      makeVehicle("MAINTENANCE", { id: "00000000-0000-4000-8000-000000000004" }),
      makeVehicle("OUT_OF_SERVICE", { id: "00000000-0000-4000-8000-000000000005" }),
      makeVehicle("ARCHIVED", { id: "00000000-0000-4000-8000-000000000006" }),
    ]);

    render(<AnalyticsPage />);

    const fleetStatus = screen
      .getByRole("heading", { name: "حالة السيارات" })
      .closest("section")!;

    ["متاحة", "محجوزة", "مؤجرة", "في الصيانة", "خارج الخدمة", "مؤرشفة"].forEach(
      (label) =>
        expect(within(fleetStatus).getAllByText(label).length).toBeGreaterThan(0),
    );
  });

  it("navigates fleet rows with the API vehicle UUID rather than a display id", () => {
    const vehicle = makeVehicle("RENTED");
    mockApiVehicles([vehicle]);
    vi.mocked(useVehicles).mockReturnValue([makeLegacyVehicle()]);
    const locations: string[] = [];

    render(
      <Router>
        <AnalyticsPage />
        <LocationProbe onLocation={(location) => locations.push(location)} />
      </Router>,
    );

    const fleetStatus = screen
      .getByRole("heading", { name: "حالة السيارات" })
      .closest("section")!;
    fireEvent.click(within(fleetStatus).getByRole("button", { name: /Kia Picanto/ }));

    expect(locations.at(-1)).toBe(`/vehicles/${vehicle.id}`);
  });

  it("navigates maintenance and expense rows with their resolved API vehicle UUID", async () => {
    const { useMaintenance } = await import("@/features/maintenance/hooks");
    const { useExpenses } = await import("@/features/expenses/hooks");
    const vehicle = makeVehicle("AVAILABLE");
    mockApiVehicles([vehicle]);
    vi.mocked(useMaintenance).mockReturnValue({
      data: { data: [makeMaintenance(vehicle.id)] },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useMaintenance>);
    vi.mocked(useExpenses).mockReturnValue({
      data: { data: [makeExpense(vehicle.id)] },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useExpenses>);
    const locations: string[] = [];

    render(
      <Router>
        <AnalyticsPage />
        <LocationProbe onLocation={(location) => locations.push(location)} />
      </Router>,
    );

    const maintenanceCosts = screen
      .getByRole("heading", { name: "أعلى تكاليف الصيانة" })
      .closest("section")!;
    fireEvent.click(within(maintenanceCosts).getByRole("button", { name: /Kia Picanto/ }));
    expect(locations.at(-1)).toBe(`/vehicles/${vehicle.id}`);

    const vehicleExpenses = screen
      .getByRole("heading", { name: "مصروفات مرتبطة بالسيارات" })
      .closest("section")!;
    fireEvent.click(within(vehicleExpenses).getByRole("button", { name: /Kia Picanto/ }));
    expect(locations.at(-1)).toBe(`/vehicles/${vehicle.id}`);
  });
});
