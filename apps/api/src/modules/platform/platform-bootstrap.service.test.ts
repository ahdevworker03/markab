import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../database";
import { clearPasswordResetDeliveriesForTest, getLatestPasswordResetDeliveryForTest } from "../auth/password-reset.delivery";
import { cleanup } from "../../test/helpers";
import { bootstrapPlatformOwner } from "./platform-bootstrap.service";

describe("platform owner bootstrap", () => {
  beforeEach(async () => {
    await cleanup();
    clearPasswordResetDeliveriesForTest();
  });

  it("creates one internal platform owner and sends a reset activation", async () => {
    const result = await bootstrapPlatformOwner("  PLATFORM@example.com ");

    expect(result).toEqual({ created: true });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { internalKey: "platform" },
      include: { users: true },
    });
    expect(organization.users).toMatchObject([
      { email: "platform@example.com", role: "PLATFORM_OWNER", deleted_at: null },
    ]);
    expect(organization.users[0]?.password_hash).toMatch(/^\$argon2/);
    expect(getLatestPasswordResetDeliveryForTest("platform@example.com")).toMatchObject({
      email: "platform@example.com",
      token: expect.any(String),
    });
    await expect(
      prisma.auditLog.count({ where: { action: "PLATFORM_OWNER_BOOTSTRAPPED" } }),
    ).resolves.toBe(1);
  });

  it("is idempotent and issues a replacement activation reset", async () => {
    await bootstrapPlatformOwner("platform@example.com");
    const result = await bootstrapPlatformOwner(" PLATFORM@EXAMPLE.COM ");

    expect(result).toEqual({ created: false });
    await expect(prisma.organization.count({ where: { internalKey: "platform" } })).resolves.toBe(1);
    await expect(prisma.user.count({ where: { role: "PLATFORM_OWNER", deleted_at: null } })).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({ where: { action: "PLATFORM_OWNER_BOOTSTRAPPED" } }),
    ).resolves.toBe(1);
    await expect(prisma.passwordResetToken.count({ where: { consumed_at: null } })).resolves.toBe(1);
  });

  it("does not replace an existing platform owner", async () => {
    await bootstrapPlatformOwner("platform@example.com");

    await expect(bootstrapPlatformOwner("other@example.com")).rejects.toThrow(
      "An active platform owner already exists.",
    );
  });
});
