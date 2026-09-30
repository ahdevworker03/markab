import { AppError } from "../../shared";
import type { OrganizationStatus } from "./organization.types";

const allowedTransitions: Record<OrganizationStatus, readonly OrganizationStatus[]> = {
  TRIAL: ["ACTIVE", "SUSPENDED", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CANCELLED"],
  CANCELLED: ["ACTIVE"],
};

export function isTransitionAllowed(
  from: OrganizationStatus,
  to: OrganizationStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function isReasonRequired(
  from: OrganizationStatus,
  to: OrganizationStatus,
): boolean {
  return to === "SUSPENDED" || to === "CANCELLED" || from === "CANCELLED";
}

/** Validates a real (non-idempotent) status change and returns the normalized reason. */
export function assertTransition(
  from: OrganizationStatus,
  to: OrganizationStatus,
  reason: string | undefined,
): string | undefined {
  if (!isTransitionAllowed(from, to)) {
    throw new AppError(
      409,
      "INVALID_ORGANIZATION_STATUS_TRANSITION",
      `Organization status cannot change from ${from} to ${to}.`,
    );
  }

  const normalized = reason?.trim() || undefined;

  if (isReasonRequired(from, to) && !normalized) {
    throw new AppError(
      422,
      "STATUS_CHANGE_REASON_REQUIRED",
      "A reason is required for this status change.",
    );
  }

  return normalized;
}
