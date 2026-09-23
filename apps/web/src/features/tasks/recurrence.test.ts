import { describe, it, expect } from "vitest";
import type { TaskResponse } from "@workspace/api-client-react";
import { formatTaskRecurrence, formatTaskRecurrenceEnd } from "./recurrence";

function makeTask(overrides: Partial<TaskResponse>): TaskResponse {
  return {
    id: `t-${Math.random()}`,
    dueDate: "2026-09-01T12:00:00Z",
    status: "PENDING",
    recurrenceInterval: null,
    recurrenceUnit: null,
    recurrenceEndDate: null,
    recurrenceEndCount: null,
    occurrenceNumber: 1,
    predecessorId: null,
    notes: null,
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-01T12:00:00Z",
    ...overrides,
    title: overrides.title ?? "مهمة تجريبية",
  };
}

describe("formatTaskRecurrence", () => {
  it("uses the dual form for an interval of 2", () => {
    expect(
      formatTaskRecurrence(
        makeTask({ recurrenceInterval: 2, recurrenceUnit: "DAY" }),
      ),
    ).toBe("كل يومين");
  });

  it("uses the plural form for intervals from 3 to 10", () => {
    expect(
      formatTaskRecurrence(
        makeTask({ recurrenceInterval: 3, recurrenceUnit: "DAY" }),
      ),
    ).toBe("كل 3 أيام");
    expect(
      formatTaskRecurrence(
        makeTask({ recurrenceInterval: 10, recurrenceUnit: "WEEK" }),
      ),
    ).toBe("كل 10 أسابيع");
  });

  it("uses the singular form for intervals of 11 and above", () => {
    expect(
      formatTaskRecurrence(
        makeTask({ recurrenceInterval: 15, recurrenceUnit: "DAY" }),
      ),
    ).toBe("كل 15 يوم");
    expect(
      formatTaskRecurrence(
        makeTask({ recurrenceInterval: 11, recurrenceUnit: "MONTH" }),
      ),
    ).toBe("كل 11 شهر");
  });
});

describe("formatTaskRecurrenceEnd occurrence-count agreement", () => {
  it.each([
    [1, "بعد مرة واحدة"],
    [2, "بعد مرتين"],
    [3, "بعد 3 مرات"],
    [5, "بعد 5 مرات"],
    [10, "بعد 10 مرات"],
    [11, "بعد 11 مرة"],
    [15, "بعد 15 مرة"],
  ])("formats an end count of %s as %s", (count, expected) => {
    const task = makeTask({
      recurrenceInterval: 1,
      recurrenceUnit: "WEEK",
      recurrenceEndCount: count,
    });
    expect(formatTaskRecurrenceEnd(task)).toBe(expected);
  });
});
