import { describe, it, expect } from "vitest";
import type { MaintenanceRecord } from "@/data/types";
import { getOverdueCount, getUpcomingMaintenance } from "./selectors";

function makeRecord(overrides: Partial<MaintenanceRecord>): MaintenanceRecord {
  return {
    id: `m-${Math.random()}`,
    vehicleId: "v1",
    type: "oil",
    dueDate: "2025-01-20T12:00:00.000Z",
    status: "upcoming",
    ...overrides,
  };
}

// days-from-today relative to the fixed mock anchor (2025-01-15)
const daysFromToday = (dateStr: string) =>
  Math.ceil(
    (new Date(dateStr).getTime() - new Date("2025-01-15T12:00:00Z").getTime()) /
      86_400_000
  );

describe("getOverdueCount", () => {
  it("counts only overdue records", () => {
    const records = [
      makeRecord({ status: "overdue" }),
      makeRecord({ status: "overdue" }),
      makeRecord({ status: "upcoming" }),
      makeRecord({ status: "completed" }),
    ];
    expect(getOverdueCount(records)).toBe(2);
  });
});

describe("getUpcomingMaintenance", () => {
  it("returns upcoming records due within the window, sorted by due date", () => {
    const records = [
      makeRecord({ status: "upcoming", dueDate: "2025-01-22T12:00:00.000Z" }),
      makeRecord({ status: "upcoming", dueDate: "2025-01-18T12:00:00.000Z" }),
      makeRecord({ status: "upcoming", dueDate: "2025-03-01T12:00:00.000Z" }),
      makeRecord({ status: "overdue", dueDate: "2025-01-10T12:00:00.000Z" }),
    ];
    const result = getUpcomingMaintenance(records, daysFromToday, 7);
    expect(result.map((r) => r.dueDate)).toEqual([
      "2025-01-18T12:00:00.000Z",
      "2025-01-22T12:00:00.000Z",
    ]);
  });

  it("excludes records due beyond the window", () => {
    const records = [
      makeRecord({ status: "upcoming", dueDate: "2025-01-30T12:00:00.000Z" }),
    ];
    expect(getUpcomingMaintenance(records, daysFromToday, 7)).toEqual([]);
  });
});
