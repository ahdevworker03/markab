import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import { cleanup } from "../../test/helpers";

const PASSWORD_HASH = "SECRET-PASSWORD-HASH-VALUE";
const REFRESH_TOKEN = "SECRET-REFRESH-TOKEN-VALUE";
const INVITATION_TOKEN_HASH = "SECRET-INVITATION-TOKEN-HASH";
const RESET_TOKEN_HASH = "SECRET-RESET-TOKEN-HASH";
const DAY = 24 * 60 * 60 * 1000;

describe("platform organization users read model", () => {
  let organizationId: string;
  let platformOrganizationId: string;
  let ownerToken: string;
  let employeeToken: string;
  let platformOwnerToken: string;

  function readUsers(id: string, token?: string) {
    const call = request(app).get(`/api/platform/organizations/${id}/users`);
    return token ? call.set("Authorization", `Bearer ${token}`) : call;
  }

  function token(user: { id: string; role: "OWNER" | "EMPLOYEE" | "PLATFORM_OWNER" }, org: string) {
    return generateAccessToken({ sub: user.id, org, role: user.role });
  }

  beforeEach(async () => {
    await cleanup();

    const [organization, platformOrganization, otherOrganization] =
      await Promise.all([
        prisma.organization.create({ data: { name: "Tenant organization" } }),
        prisma.organization.create({
          data: { name: "Platform", internalKey: "platform", status: "ACTIVE" },
        }),
        prisma.organization.create({ data: { name: "Other tenant" } }),
      ]);
    organizationId = organization.id;
    platformOrganizationId = platformOrganization.id;

    const base = Date.now() - 10 * DAY;
    const mk = (
      email: string,
      role: "OWNER" | "EMPLOYEE" | "PLATFORM_OWNER",
      org: string,
      offset: number,
      deleted = false,
    ) =>
      prisma.user.create({
        data: {
          email,
          password_hash: PASSWORD_HASH,
          role,
          organization_id: org,
          created_at: new Date(base + offset),
          deleted_at: deleted ? new Date(base + offset + DAY) : null,
        },
      });

    // Created out of display order on purpose: ordering must not depend on insertion.
    const deactivated = await mk("deactivated@tenant.example", "EMPLOYEE", organizationId, 1000, true);
    const employeeB = await mk("b-employee@tenant.example", "EMPLOYEE", organizationId, 3000);
    const employeeA = await mk("a-employee@tenant.example", "EMPLOYEE", organizationId, 2000);
    const owner = await mk("owner@tenant.example", "OWNER", organizationId, 4000);
    const platformOwner = await mk("platform@example.com", "PLATFORM_OWNER", platformOrganizationId, 0);
    const otherOwner = await mk("other-owner@other.example", "OWNER", otherOrganization.id, 0);
    await prisma.employeeInvitation.create({
      data: {
        organization_id: otherOrganization.id,
        email: "other-invite@other.example",
        token_hash: "other-tenant-invite-hash",
        expires_at: new Date(Date.now() + DAY),
        created_by_user_id: otherOwner.id,
      },
    });
    await prisma.vehicle.create({
      data: {
        organization_id: organizationId,
        make: "Toyota",
        model: "TENANT-BUSINESS-MODEL",
        plate_number: "BIZ-1",
        year: 2020,
        color: "White",
        transmission: "AUTOMATIC",
        fuel_type: "PETROL",
        seats: 5,
        current_mileage: 1000,
        status: "AVAILABLE",
      },
    });
    await prisma.refreshToken.create({
      data: {
        token: REFRESH_TOKEN,
        user_id: owner.id,
        expires_at: new Date(Date.now() + DAY),
      },
    });
    await prisma.passwordResetToken.create({
      data: {
        token_hash: RESET_TOKEN_HASH,
        user_id: employeeA.id,
        expires_at: new Date(Date.now() + DAY),
      },
    });

    const invite = (
      email: string,
      hash: string,
      expiresAt: Date,
      createdAt: Date,
      accepted?: { id: string },
    ) =>
      prisma.employeeInvitation.create({
        data: {
          organization_id: organizationId,
          email,
          token_hash: hash,
          expires_at: expiresAt,
          created_at: createdAt,
          created_by_user_id: owner.id,
          ...(accepted
            ? { accepted_at: new Date(base + 5000), accepted_user_id: accepted.id }
            : {}),
        },
      });
    await invite("old-expired@tenant.example", INVITATION_TOKEN_HASH, new Date(Date.now() - 2 * DAY), new Date(base));
    await invite("new-expired@tenant.example", "hash-expired-2", new Date(Date.now() - DAY), new Date(base + 1000));
    await invite("old-pending@tenant.example", "hash-pending-1", new Date(Date.now() + DAY), new Date(base + 2000));
    await invite("new-pending@tenant.example", "hash-pending-2", new Date(Date.now() + 2 * DAY), new Date(base + 3000));
    await invite("a-employee@tenant.example", "hash-accepted", new Date(Date.now() + 3 * DAY), new Date(base + 500), employeeA);

    ownerToken = token(owner, organizationId);
    employeeToken = token(employeeB, organizationId);
    platformOwnerToken = token(platformOwner, platformOrganizationId);
    void deactivated;
  });

  it("returns the organization's users and invitations to a platform owner", async () => {
    const response = await readUsers(organizationId, platformOwnerToken);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data).sort()).toEqual(["invitations", "users"]);
    expect(response.body.data.users).toHaveLength(4);
    expect(response.body.data.invitations).toHaveLength(5);
  });

  it("orders users OWNER first, then active employees, then deactivated accounts", async () => {
    const { users } = (await readUsers(organizationId, platformOwnerToken)).body.data;

    expect(users.map((user: { email: string }) => user.email)).toEqual([
      "owner@tenant.example",
      "a-employee@tenant.example",
      "b-employee@tenant.example",
      "deactivated@tenant.example",
    ]);
    expect(users[0]).toMatchObject({ role: "OWNER", status: "ACTIVE", deactivatedAt: null });
  });

  it("represents deactivated (soft-deleted) users from stored state", async () => {
    const { users } = (await readUsers(organizationId, platformOwnerToken)).body.data;
    const deactivated = users.find((user: { email: string }) => user.email === "deactivated@tenant.example");
    const active = users.find((user: { email: string }) => user.email === "a-employee@tenant.example");

    expect(deactivated).toMatchObject({ role: "EMPLOYEE", status: "DEACTIVATED" });
    expect(typeof deactivated.deactivatedAt).toBe("string");
    expect(active).toMatchObject({ status: "ACTIVE", deactivatedAt: null });
    expect(Object.keys(active).sort()).toEqual([
      "createdAt",
      "deactivatedAt",
      "email",
      "id",
      "role",
      "status",
    ]);
  });

  it("derives invitation status from stored data and orders pending, expired, accepted", async () => {
    const { invitations } = (await readUsers(organizationId, platformOwnerToken)).body.data;

    expect(
      invitations.map((invitation: { email: string; status: string }) => [
        invitation.email,
        invitation.status,
      ]),
    ).toEqual([
      ["new-pending@tenant.example", "PENDING"],
      ["old-pending@tenant.example", "PENDING"],
      ["new-expired@tenant.example", "EXPIRED"],
      ["old-expired@tenant.example", "EXPIRED"],
      ["a-employee@tenant.example", "ACCEPTED"],
    ]);
    expect(Object.keys(invitations[0]).sort()).toEqual([
      "acceptedAt",
      "createdAt",
      "email",
      "expiresAt",
      "id",
      "status",
    ]);
    expect(invitations[0].acceptedAt).toBeNull();
    expect(typeof invitations[4].acceptedAt).toBe("string");
  });

  it("never returns secrets, tokens, other tenants' data or business data", async () => {
    const response = await readUsers(organizationId, platformOwnerToken);
    const body = JSON.stringify(response.body);

    for (const secret of [
      PASSWORD_HASH,
      REFRESH_TOKEN,
      INVITATION_TOKEN_HASH,
      RESET_TOKEN_HASH,
      "hash-pending",
      "password",
      "token",
      "other-owner@other.example",
      "other-invite@other.example",
      "TENANT-BUSINESS-MODEL",
      "platform@example.com",
    ]) {
      expect(body).not.toContain(secret);
    }
  });

  it.each([
    ["an owner", () => ownerToken],
    ["an employee", () => employeeToken],
  ])("denies %s", async (_label, getToken) => {
    const response = await readUsers(organizationId, getToken());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(JSON.stringify(response.body)).not.toContain("tenant.example");
  });

  it("requires authentication", async () => {
    const response = await readUsers(organizationId);

    expect(response.status).toBe(401);
  });

  it("hides the internal, deleted, and unknown organizations", async () => {
    const deleted = await prisma.organization.create({
      data: { name: "Deleted tenant", deleted_at: new Date() },
    });

    for (const id of [
      platformOrganizationId,
      deleted.id,
      "00000000-0000-4000-8000-000000000000",
    ]) {
      const response = await readUsers(id, platformOwnerToken);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
    }
  });

  it("rejects malformed organization ids", async () => {
    const response = await readUsers("not-a-uuid", platformOwnerToken);

    expect(response.status).toBe(422);
  });

  it("flags a PLATFORM_OWNER inside a client organization instead of presenting it as a tenant user", async () => {
    await prisma.user.create({
      data: {
        email: "legacy-platform-owner@tenant.example",
        password_hash: PASSWORD_HASH,
        role: "PLATFORM_OWNER",
        organization_id: organizationId,
      },
    });

    const response = await readUsers(organizationId, platformOwnerToken);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("ORGANIZATION_DATA_INTEGRITY_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("legacy-platform-owner");
    await expect(
      prisma.user.count({ where: { email: "legacy-platform-owner@tenant.example" } }),
    ).resolves.toBe(1);
  });

  it("does not open tenant routes or mutate anything for the platform owner", async () => {
    const before = await prisma.user.count();
    const tenantUsers = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${platformOwnerToken}`);
    await readUsers(organizationId, platformOwnerToken);

    expect(tenantUsers.status).toBe(403);
    expect(tenantUsers.body.error.code).toBe("TENANT_ACCESS_REQUIRED");
    await expect(prisma.user.count()).resolves.toBe(before);
  });

  it("reads users of a suspended organization (support visibility)", async () => {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED" },
    });

    const response = await readUsers(organizationId, platformOwnerToken);

    expect(response.status).toBe(200);
  });
});
