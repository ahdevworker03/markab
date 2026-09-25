import type { CurrentUserResponse } from "@workspace/api-client-react";

const storageKey = "markab.offline-session-identity";

export type OfflineSessionIdentity = Pick<
  CurrentUserResponse,
  "id" | "organizationId" | "role" | "organizationStatus"
>;

function isOfflineIdentity(value: unknown): value is OfflineSessionIdentity {
  if (!value || typeof value !== "object") return false;
  const identity = value as Record<string, unknown>;
  return (
    typeof identity.id === "string" &&
    typeof identity.organizationId === "string" &&
    (identity.role === "OWNER" || identity.role === "EMPLOYEE") &&
    (identity.organizationStatus === "TRIAL" ||
      identity.organizationStatus === "ACTIVE" ||
      identity.organizationStatus === "SUSPENDED" ||
      identity.organizationStatus === "CANCELLED")
  );
}

export function getOfflineIdentity(): OfflineSessionIdentity | null {
  const value = localStorage.getItem(storageKey);
  if (!value) return null;

  try {
    const identity: unknown = JSON.parse(value);
    return isOfflineIdentity(identity) ? identity : null;
  } catch {
    return null;
  }
}

export function saveOfflineIdentity(
  user: OfflineSessionIdentity,
): OfflineSessionIdentity {
  const identity: OfflineSessionIdentity = {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    organizationStatus: user.organizationStatus,
  };
  localStorage.setItem(storageKey, JSON.stringify(identity));
  return identity;
}

export function clearOfflineIdentity(): void {
  localStorage.removeItem(storageKey);
}
