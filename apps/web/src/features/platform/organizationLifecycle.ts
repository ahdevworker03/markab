import type { OrganizationStatus } from "@workspace/api-client-react";

export const REASON_MAX_LENGTH = 500;

export const statusLabels: Record<OrganizationStatus, string> = {
  TRIAL: "تجريبي",
  ACTIVE: "نشط",
  SUSPENDED: "معلّق",
  CANCELLED: "ملغي",
};

// Presentation mirror of the server policy; the API remains the enforcer.
const nextStatuses: Record<OrganizationStatus, readonly OrganizationStatus[]> = {
  TRIAL: ["ACTIVE", "SUSPENDED", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CANCELLED"],
  CANCELLED: ["ACTIVE"],
};

export function getNextStatuses(
  current: OrganizationStatus,
): readonly OrganizationStatus[] {
  return nextStatuses[current];
}

export function isReasonRequired(
  from: OrganizationStatus,
  to: OrganizationStatus,
): boolean {
  return to === "SUSPENDED" || to === "CANCELLED" || from === "CANCELLED";
}

export function isRestrictiveStatus(status: OrganizationStatus): boolean {
  return status === "SUSPENDED" || status === "CANCELLED";
}
