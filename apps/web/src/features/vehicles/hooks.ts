import { vehicles, getVehicleById } from "@/data";
import type { Vehicle } from "@/data/types";

export function useVehicles(): Vehicle[] {
  return vehicles;
}

export function useVehicle(id: string): Vehicle | undefined {
  return getVehicleById(id);
}

export function useVehicleById(): (id: string) => Vehicle | undefined {
  return getVehicleById;
}
