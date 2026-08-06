import {
  rentals,
  getActiveRentals,
  getRentalsForVehicle,
  getRentalsForCustomer,
  getTotalRemaining,
} from "@/data";
import type { Rental } from "@/data/types";

export function useRentals(): Rental[] {
  return rentals;
}

export function useRental(id: string): Rental | undefined {
  return rentals.find((r) => r.id === id);
}

export function useActiveRentals(): Rental[] {
  return getActiveRentals();
}

export function useRentalsForVehicle(vehicleId: string): Rental[] {
  return getRentalsForVehicle(vehicleId);
}

export function useRentalsForCustomer(customerId: string): Rental[] {
  return getRentalsForCustomer(customerId);
}

export function useTotalRemaining(rentalId: string): number {
  return getTotalRemaining(rentalId);
}
