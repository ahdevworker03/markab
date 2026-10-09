import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useVehicleRecord: vi.fn(),
  useVehicleMutations: vi.fn(),
  useVehicleDocuments: vi.fn(),
  useVehiclePhotos: vi.fn(),
  useRentalsForVehicle: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/vehicles/vehicle-1", vi.fn()],
}));
vi.mock("@/features/vehicles/api-hooks", () => ({
  useVehicleRecord: mocks.useVehicleRecord,
  useVehicleMutations: mocks.useVehicleMutations,
}));
vi.mock("@/features/media/hooks", () => ({
  useVehicleDocuments: mocks.useVehicleDocuments,
  useVehiclePhotos: mocks.useVehiclePhotos,
}));
vi.mock("@/features/rentals/api-hooks", () => ({
  useRentalsForVehicle: mocks.useRentalsForVehicle,
}));
vi.mock("@/features/media", () => ({
  DocumentList: () => null,
  MediaGallery: () => null,
}));
vi.mock("@/features/rentals", () => ({ RentalHistorySection: () => null }));
vi.mock("@/features/maintenance", () => ({
  MaintenanceHistorySection: () => null,
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { role: "STAFF" } }),
}));
vi.mock("@/features/offline/OfflineProvider", () => ({
  useOffline: () => ({ isOffline: false }),
}));

import VehicleDetailPage from "./VehicleDetailPage";

const vehicle = {
  id: "vehicle-1",
  make: "Toyota",
  model: "Yaris",
  plateNumber: "A 123456",
  year: 2024,
  color: "أبيض",
  transmission: "AUTOMATIC",
  fuelType: "PETROL",
  seats: 5,
  currentMileage: 123456,
  status: "AVAILABLE",
  notes: "ملاحظة طويلة عن السيارة تحتاج إلى مساحة كاملة للقراءة.",
};

const emptyQuery = { data: { data: [] }, isLoading: false, isError: false };
const idleMutation = { isPending: false, mutateAsync: vi.fn() };

describe("VehicleDetailPage metadata layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useVehicleRecord.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: vehicle },
      refetch: vi.fn(),
    });
    mocks.useVehicleMutations.mockReturnValue({ remove: idleMutation });
    mocks.useVehiclePhotos.mockReturnValue({
      query: emptyQuery,
      upload: idleMutation,
      remove: idleMutation,
    });
    mocks.useVehicleDocuments.mockReturnValue({
      query: emptyQuery,
      upload: idleMutation,
      update: idleMutation,
      remove: idleMutation,
    });
    mocks.useRentalsForVehicle.mockReturnValue({ rentals: [] });
  });

  it("uses two mobile columns and keeps notes full-width", () => {
    render(<VehicleDetailPage params={{ id: vehicle.id }} />);

    const metadataSection = screen
      .getByRole("heading", {
        name: "بيانات السيارة",
      })
      .closest("section");
    expect(metadataSection).not.toBeNull();
    const metadata = within(metadataSection as HTMLElement);
    const grid = metadataSection?.querySelector(".grid-cols-2");
    expect(grid).toHaveClass("md:grid-cols-3", "lg:grid-cols-4");

    const plateLabel = metadata.getByText("رقم اللوحة");
    expect(plateLabel.nextElementSibling).toHaveAttribute("dir", "ltr");

    const notesLabel = metadata.getByText("ملاحظات");
    expect(notesLabel.parentElement?.parentElement).toHaveClass(
      "col-span-2",
      "md:col-span-3",
      "lg:col-span-4",
    );
  });
});
