import { maintenance, getMaintenanceForVehicle } from "@/data";
import type { MaintenanceRecord } from "@/data/types";

export function useMaintenance(): MaintenanceRecord[] {
  return maintenance;
}

export function useMaintenanceRecord(id: string): MaintenanceRecord | undefined {
  return maintenance.find((m) => m.id === id);
}

export function useMaintenanceForVehicle(vehicleId: string): MaintenanceRecord[] {
  return getMaintenanceForVehicle(vehicleId);
}
