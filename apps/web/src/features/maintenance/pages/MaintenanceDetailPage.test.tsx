import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type MaintenanceResponse } from "@workspace/api-client-react";

vi.mock("wouter", () => ({
  useLocation: () => ["/maintenance/maintenance-1", vi.fn()],
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetVehicle: vi.fn(),
}));

vi.mock("@/features/maintenance/hooks", () => ({
  useMaintenanceRecord: vi.fn(),
  useMaintenanceMutations: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

import { useGetVehicle } from "@workspace/api-client-react";
import {
  useMaintenanceMutations,
  useMaintenanceRecord,
} from "@/features/maintenance/hooks";
import { useAuth } from "@/providers/AuthProvider";
import MaintenanceDetailPage from "./MaintenanceDetailPage";

const mockedUseGetVehicle = vi.mocked(useGetVehicle);
const mockedUseMaintenanceMutations = vi.mocked(useMaintenanceMutations);
const mockedUseMaintenanceRecord = vi.mocked(useMaintenanceRecord);
const mockedUseAuth = vi.mocked(useAuth);

function makeRecord(
  overrides: Partial<MaintenanceResponse> = {},
): MaintenanceResponse {
  return {
    id: "maintenance-1",
    vehicleId: "vehicle-1",
    type: "REPAIR",
    status: "SCHEDULED",
    maintenanceDate: "2026-08-20T09:00:00Z",
    completedAt: null,
    cost: null,
    vendor: null,
    notes: null,
    replacedParts: null,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-01T09:00:00Z",
    ...overrides,
  };
}

function makeApiError(message: string): ApiError {
  return new ApiError(
    new Response(null, { status: 409, statusText: "Conflict" }),
    { error: { code: "VEHICLE_UNAVAILABLE", message } },
    { method: "PATCH", url: "/api/maintenance/maintenance-1" },
  );
}

function mockRecord(record: MaintenanceResponse) {
  mockedUseMaintenanceRecord.mockReturnValue({
    data: { data: record },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as ReturnType<typeof useMaintenanceRecord>);
}

function mockMutations() {
  const mutations = {
    create: { isPending: false, mutateAsync: vi.fn() },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
    complete: { isPending: false, mutateAsync: vi.fn() },
    remove: { isPending: false, mutateAsync: vi.fn() },
  };
  mockedUseMaintenanceMutations.mockReturnValue(
    mutations as unknown as ReturnType<typeof useMaintenanceMutations>,
  );
  return mutations;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { role: "OWNER" } } as ReturnType<
    typeof useAuth
  >);
  mockedUseGetVehicle.mockReturnValue({
    data: { data: { id: "vehicle-1", make: "Toyota", model: "Camry", plateNumber: "A-1" } },
  } as ReturnType<typeof useGetVehicle>);
  mockRecord(makeRecord());
  mockMutations();
});

describe("MaintenanceDetailPage", () => {
  it("shows start and completion actions to an owner for scheduled maintenance", () => {
    render(<MaintenanceDetailPage params={{ id: "maintenance-1" }} />);

    expect(screen.getByRole("button", { name: "بدء الصيانة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إكمال الصيانة" })).toBeInTheDocument();
  });

  it("starts maintenance and hides the start action after refreshed data is in progress", async () => {
    const mutations = mockMutations();
    const { rerender } = render(<MaintenanceDetailPage params={{ id: "maintenance-1" }} />);

    fireEvent.click(screen.getByRole("button", { name: "بدء الصيانة" }));

    await waitFor(() => {
      expect(mutations.update.mutateAsync).toHaveBeenCalledWith({
        id: "maintenance-1",
        data: { status: "IN_PROGRESS" },
      });
    });

    mockRecord(makeRecord({ status: "IN_PROGRESS" }));
    rerender(<MaintenanceDetailPage params={{ id: "maintenance-1" }} />);

    expect(screen.queryByRole("button", { name: "بدء الصيانة" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إكمال الصيانة" })).toBeInTheDocument();
  });

  it("shows the API error when starting maintenance fails", async () => {
    const mutations = mockMutations();
    mutations.update.mutateAsync.mockRejectedValue(makeApiError("المركبة غير متاحة"));
    render(<MaintenanceDetailPage params={{ id: "maintenance-1" }} />);

    fireEvent.click(screen.getByRole("button", { name: "بدء الصيانة" }));

    expect(await screen.findByText("المركبة غير متاحة")).toBeInTheDocument();
  });

  it.each(["IN_PROGRESS", "COMPLETED"] as const)(
    "does not show the start action for %s maintenance",
    (status) => {
      mockRecord(makeRecord({ status }));
      render(<MaintenanceDetailPage params={{ id: "maintenance-1" }} />);

      expect(screen.queryByRole("button", { name: "بدء الصيانة" })).not.toBeInTheDocument();
    },
  );

  it("does not show the start action to an employee", () => {
    mockedUseAuth.mockReturnValue({ user: { role: "EMPLOYEE" } } as ReturnType<
      typeof useAuth
    >);
    render(<MaintenanceDetailPage params={{ id: "maintenance-1" }} />);

    expect(screen.queryByRole("button", { name: "بدء الصيانة" })).not.toBeInTheDocument();
  });
});
