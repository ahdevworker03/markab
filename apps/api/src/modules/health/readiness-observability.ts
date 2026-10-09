import { logger } from "../../config";

interface ReadinessLogger {
  info: (bindings: object, message: string) => void;
  warn: (bindings: object, message: string) => void;
}

export function createReadinessObservability(log: ReadinessLogger = logger): {
  available: () => void;
  unavailable: () => void;
} {
  let unavailable = false;

  return {
    available() {
      if (!unavailable) return;
      unavailable = false;
      log.info({ event: "api.readiness_recovered" }, "API readiness recovered");
    },
    unavailable() {
      if (unavailable) return;
      unavailable = true;
      log.warn(
        { event: "api.readiness_unavailable" },
        "API readiness unavailable",
      );
    },
  };
}
