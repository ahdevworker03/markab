import { render as testingLibraryRender } from "@testing-library/react";
import { vi } from "vitest";

export function renderAtFixedDate(
  ...args: Parameters<typeof testingLibraryRender>
) {
  return withFixedDate(() => testingLibraryRender(...args));
}

export function withFixedDate<T>(callback: () => T): T {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
  try {
    return callback();
  } finally {
    vi.useRealTimers();
  }
}
