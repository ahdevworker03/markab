import { describe, it, expect } from "vitest";
import { toISO, daysFromToday } from "./mock-date";

describe("toISO", () => {
  it("converts a date-only string to a noon-UTC ISO timestamp", () => {
    expect(toISO("2025-01-15")).toBe("2025-01-15T12:00:00.000Z");
  });
});

describe("daysFromToday", () => {
  // The mock "today" anchor is 2025-01-15 (see mock-date.ts).
  it("returns 0 for the anchor date", () => {
    expect(daysFromToday("2025-01-15T12:00:00.000Z")).toBe(0);
  });

  it("returns a positive number for a future date", () => {
    expect(daysFromToday("2025-01-17T12:00:00.000Z")).toBe(2);
  });

  it("returns a negative number for a past date", () => {
    expect(daysFromToday("2025-01-13T12:00:00.000Z")).toBe(-2);
  });
});
