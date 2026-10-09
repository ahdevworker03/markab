import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VehicleResponse } from "@workspace/api-client-react";
import VehiclesPage from "./VehiclesPage";

const { setLocation, setSearchParams, useVehiclesList } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  setSearchParams: vi.fn(),
  useVehiclesList: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/vehicles", setLocation],
  useSearchParams: () => [new URLSearchParams(), setSearchParams],
}));
vi.mock("@/features/vehicles/api-hooks", () => ({ useVehiclesList }));
vi.mock("@/features/vehicles/components/VehicleAvailabilitySection", () => ({
  VehicleAvailabilitySection: () => null,
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "OWNER" } }),
}));
vi.mock("@/features/offline/OfflineProvider", () => ({
  useOffline: () => ({ isOffline: false }),
}));

const vehicles = Array.from({ length: 50 }, (_, index) => ({
  id: `vehicle-${index + 1}`,
  make: "Toyota",
  model: "Yaris",
  plateNumber: `A ${String(index + 1).padStart(6, "0")}`,
  year: 2024,
  transmission: "AUTOMATIC",
  fuelType: "PETROL",
  seats: 5,
  currentMileage: 50000,
  status: "AVAILABLE",
})) as unknown as VehicleResponse[];

describe("VehiclesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVehiclesList.mockReturnValue({
      vehicles,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("uses the singular vehicle noun after the displayed count", () => {
    render(<VehiclesPage />);

    expect(screen.getByText("50 سيارة")).toBeInTheDocument();
    expect(screen.queryByText("50 سيارات")).not.toBeInTheDocument();
  });
});
