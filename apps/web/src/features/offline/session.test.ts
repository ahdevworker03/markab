import { afterEach, describe, expect, it } from "vitest";
import {
  clearOfflineIdentity,
  getOfflineIdentity,
  saveOfflineIdentity,
} from "./session";

const tenant = {
  id: "user-a",
  organizationId: "organization-a",
  role: "OWNER" as const,
  organizationStatus: "ACTIVE" as const,
};

describe("offline session identity", () => {
  afterEach(() => clearOfflineIdentity());

  it("persists only the validated tenant identity fields", () => {
    saveOfflineIdentity({
      ...tenant,
      email: "owner@example.com",
      createdAt: "2026-09-23T12:00:00.000Z",
    });

    expect(getOfflineIdentity()).toEqual(tenant);
  });

  it("removes the active identity without touching durable workspace data", () => {
    saveOfflineIdentity(tenant);

    clearOfflineIdentity();

    expect(getOfflineIdentity()).toBeNull();
  });
});
