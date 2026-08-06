import type { Vehicle, VehicleStatus } from "@/data/types";

export interface VehicleStatusCounts {
  available: number;
  rented: number;
  maintenance: number;
}

export function getVehicleStatusCounts(vehicles: Vehicle[]): VehicleStatusCounts {
  return {
    available: vehicles.filter((v) => v.status === "available").length,
    rented: vehicles.filter((v) => v.status === "rented").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  };
}

export function getVehiclesByStatus(vehicles: Vehicle[], status: VehicleStatus): Vehicle[] {
  return vehicles.filter((v) => v.status === status);
}
