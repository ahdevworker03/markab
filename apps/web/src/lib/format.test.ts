import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDateAr,
  formatDateShort,
  formatInitials,
} from "./format";

describe("formatCurrency", () => {
  it("formats with a dollar sign and thousands grouping", () => {
    expect(formatCurrency(1500000)).toBe("$1,500,000");
  });

  it("formats small amounts without grouping", () => {
    expect(formatCurrency(50)).toBe("$50");
  });
});

describe("formatDateAr", () => {
  it("renders day, Lebanese month name, and year", () => {
    // 2025-01-15 → كانون الثاني (January)
    expect(formatDateAr("2025-01-15T12:00:00.000Z")).toBe("15 كانون الثاني 2025");
  });

  it("uses the correct month for a different month", () => {
    // 2025-02-... → شباط (February)
    expect(formatDateAr("2025-02-03T12:00:00.000Z")).toBe("3 شباط 2025");
  });
});

describe("formatDateShort", () => {
  it("omits the year", () => {
    expect(formatDateShort("2025-01-15T12:00:00.000Z")).toBe("15 كانون الثاني");
  });
});

describe("formatInitials", () => {
  it("returns the first letter of the first two words", () => {
    expect(formatInitials("أحمد محمد")).toBe("أم");
  });

  it("returns a single letter for a one-word name", () => {
    expect(formatInitials("أحمد")).toBe("أ");
  });

  it("ignores extra whitespace between words", () => {
    expect(formatInitials("  أحمد   محمد  ")).toBe("أم");
  });
});
