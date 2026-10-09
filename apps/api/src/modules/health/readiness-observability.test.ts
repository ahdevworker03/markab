import { describe, expect, it, vi } from "vitest";
import { createReadinessObservability } from "./readiness-observability";

describe("readiness observability", () => {
  it("logs only failure transitions and recovery", () => {
    const log = {
      warn: vi.fn(),
      info: vi.fn(),
    };
    const readiness = createReadinessObservability(log);

    readiness.unavailable();
    readiness.unavailable();
    readiness.available();
    readiness.available();

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      { event: "api.readiness_unavailable" },
      "API readiness unavailable",
    );
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      { event: "api.readiness_recovered" },
      "API readiness recovered",
    );
  });
});
