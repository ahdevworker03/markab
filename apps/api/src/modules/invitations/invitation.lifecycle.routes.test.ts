import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import { cleanup } from "../../test/helpers";

// Separate file: the public accept route has a per-module in-memory rate limit.
describe("employee invitation acceptance and organization lifecycle", () => {
  let organizationId: string;
  let ownerToken: string;

  beforeEach(async () => {
    await cleanup();

    const organization = await prisma.organization.create({
      data: { name: "Lifecycle invitation organization" },
    });
    organizationId = organization.id;

    const owner = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: `lifecycle-owner-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "OWNER",
      },
    });
    ownerToken = generateAccessToken({
      sub: owner.id,
      org: organizationId,
      role: "OWNER",
    });
  });

  async function invite(email: string): Promise<string> {
    const response = await request(app)
      .post("/api/users/invitations")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email });
    expect(response.status).toBe(201);
    return response.body.data.acceptanceToken as string;
  }

  function accept(token: string) {
    return request(app)
      .post("/api/auth/invitations/accept")
      .send({ token, password: "Invitation-Pass-123" });
  }

  it.each(["SUSPENDED", "CANCELLED"] as const)(
    "rejects acceptance while %s without consuming the invitation",
    async (status) => {
      const email = `blocked-${status.toLowerCase()}@example.com`;
      const token = await invite(email);
      await prisma.organization.update({
        where: { id: organizationId },
        data: { status },
      });

      const blocked = await accept(token);

      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe("ORGANIZATION_NOT_OPERATIONAL");
      await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
      await expect(
        prisma.employeeInvitation.findUniqueOrThrow({
          where: {
            organization_id_email: { organization_id: organizationId, email },
          },
        }),
      ).resolves.toMatchObject({ accepted_at: null, accepted_user_id: null });

      await prisma.organization.update({
        where: { id: organizationId },
        data: { status: "ACTIVE" },
      });
      const restored = await accept(token);

      expect(restored.status).toBe(201);
      await expect(
        prisma.user.count({ where: { email, organization_id: organizationId } }),
      ).resolves.toBe(1);
    },
  );

  it.each(["TRIAL", "ACTIVE"] as const)(
    "accepts invitations while %s",
    async (status) => {
      const email = `allowed-${status.toLowerCase()}@example.com`;
      const token = await invite(email);
      await prisma.organization.update({
        where: { id: organizationId },
        data: { status },
      });

      const response = await accept(token);

      expect(response.status).toBe(201);
      await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
    },
  );

  it("still reports unknown tokens as invalid while the organization is suspended", async () => {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED" },
    });

    const response = await accept("A".repeat(43));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INVALID_OR_EXPIRED_INVITATION");
  });
});
