import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidateQueries } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListMaintenance: vi.fn(),
  useGetMaintenance: vi.fn(),
  useListVehicleMaintenance: vi.fn(),
  useListMaintenanceSchedules: vi.fn(),
  useCreateMaintenanceSchedule: vi.fn(),
  useUpdateMaintenanceSchedule: vi.fn(),
  useDeleteMaintenanceSchedule: vi.fn(),
  useCreateMaintenance: vi.fn(),
  useUpdateMaintenance: vi.fn(),
  useCompleteMaintenance: vi.fn(),
  useDeleteMaintenance: vi.fn(),
  getListMaintenanceQueryKey: vi.fn(() => ["maintenance"]),
  getGetMaintenanceQueryKey: vi.fn((id: string) => ["maintenance", id]),
  getListVehicleMaintenanceQueryKey: vi.fn((id: string) => ["vehicle-maintenance", id]),
  getGetVehicleQueryKey: vi.fn((id: string) => ["vehicle", id]),
  getListVehiclesQueryKey: vi.fn(() => ["vehicles"]),
  getListMaintenanceSchedulesQueryKey: vi.fn(() => ["maintenance-schedules"]),
}));

import {
  getGetMaintenanceQueryKey,
  getGetVehicleQueryKey,
  getListMaintenanceQueryKey,
  getListVehicleMaintenanceQueryKey,
  getListVehiclesQueryKey,
  useCompleteMaintenance,
  useCreateMaintenance,
  useDeleteMaintenance,
  useUpdateMaintenance,
} from "@workspace/api-client-react";
import { useMaintenanceMutations } from "./hooks";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCreateMaintenance).mockReturnValue({} as ReturnType<
    typeof useCreateMaintenance
  >);
  vi.mocked(useUpdateMaintenance).mockReturnValue({} as ReturnType<
    typeof useUpdateMaintenance
  >);
  vi.mocked(useCompleteMaintenance).mockReturnValue({} as ReturnType<
    typeof useCompleteMaintenance
  >);
  vi.mocked(useDeleteMaintenance).mockReturnValue({} as ReturnType<
    typeof useDeleteMaintenance
  >);
});

describe("useMaintenanceMutations", () => {
  it("exposes update and refreshes maintenance and vehicle data after it succeeds", () => {
    const { result } = renderHook(() => useMaintenanceMutations());
    const mutation = vi.mocked(useUpdateMaintenance).mock.calls[0]?.[0]?.mutation;

    if (!mutation?.onSuccess) throw new Error("Missing update success handler");

    mutation.onSuccess(
      { data: { vehicleId: "vehicle-1" } } as never,
      { id: "maintenance-1", data: { status: "IN_PROGRESS" } } as never,
      undefined,
      undefined,
    );

    expect(result.current.update).toBeDefined();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getListMaintenanceQueryKey(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getGetMaintenanceQueryKey("maintenance-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getListVehicleMaintenanceQueryKey("vehicle-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getGetVehicleQueryKey("vehicle-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getListVehiclesQueryKey(),
    });
  });
});
