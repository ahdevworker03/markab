import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/data/types";
import { getVehicleStatusCounts } from "./selectors";

function makeVehicle(status: Vehicle["status"]): Vehicle {
  return {
    id: `v-${status}-${Math.random()}`,
    make: "Toyota",
    model: "Corolla",
    year: 2022,
    plate: "123",
    status,
    dailyPrice: 50,
    mileage: 10000,
    photos: [],
  };
}

describe("getVehicleStatusCounts", () => {
  it("counts vehicles by status", () => {
    const vehicles = [
      makeVehicle("available"),
      makeVehicle("available"),
      makeVehicle("rented"),
      makeVehicle("maintenance"),
    ];
    expect(getVehicleStatusCounts(vehicles)).toEqual({
      available: 2,
      rented: 1,
      maintenance: 1,
    });
  });

  it("returns zeros for an empty fleet", () => {
    expect(getVehicleStatusCounts([])).toEqual({
      available: 0,
      rented: 0,
      maintenance: 0,
    });
  });
});
