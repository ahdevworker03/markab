import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import { cleanup } from "../../test/helpers";

describe("organization lifecycle routes", () => {
  let organizationId: string;
  let platformOrganizationId: string;
  let ownerToken: string;
  let platformOwnerToken: string;

  beforeEach(async () => {
    await cleanup();

    const organization = await prisma.organization.create({
      data: { name: "Tenant organization" },
    });
    const platformOrganization = await prisma.organization.create({
      data: {
        name: "Platform organization",
        internalKey: "platform",
        status: "ACTIVE",
      },
    });
    const [owner, platformOwner] = await Promise.all([
      prisma.user.create({
        data: {
          email: "owner@example.com",
          password_hash: "hash",
          role: "OWNER",
          organization_id: organization.id,
        },
      }),
      prisma.user.create({
        data: {
          email: "platform@example.com",
          password_hash: "hash",
          role: "PLATFORM_OWNER",
          organization_id: platformOrganization.id,
        },
      }),
    ]);

    organizationId = organization.id;
    platformOrganizationId = platformOrganization.id;
    ownerToken = generateAccessToken({
      sub: owner.id,
      org: organization.id,
      role: owner.role,
    });
    platformOwnerToken = generateAccessToken({
      sub: platformOwner.id,
      org: platformOrganization.id,
      role: platformOwner.role,
    });
  });

  it("creates registrations in TRIAL", async () => {
    const email = `trial-${Date.now()}@example.com`;
    const response = await request(app).post("/api/auth/register").send({
      email,
      password: "Password123!",
      organizationName: "Trial organization",
    });

    expect(response.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { organization: { select: { status: true } } },
    });
    expect(user.organization.status).toBe("TRIAL");

    const businessResponse = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${response.body.data.accessToken}`);
    expect(businessResponse.status).toBe(200);
  });

  it("leaves the internal key null when creating an organization normally", async () => {
    const organization = await prisma.organization.create({
      data: { name: "Organization without internal key" },
    });

    expect(organization.internalKey).toBeNull();
  });

  it("enforces unique organization internal keys", async () => {
    await prisma.organization.create({
      data: {
        name: "First internal-key organization",
        internalKey: "tenant-001",
      },
    });

    await expect(
      prisma.organization.create({
        data: {
          name: "Duplicate internal-key organization",
          internalKey: "tenant-001",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("lets an owner manage its organization profile", async () => {
    const response = await request(app)
      .patch("/api/organizations/me")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        legalName: "Tenant Rentals LLC",
        phone: "+961 1 234 567",
        email: "info@tenant.example",
        address: "Beirut",
        contractFooterText: "Approved rental terms apply.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: organizationId,
      name: "Tenant organization",
      status: "TRIAL",
      legalName: "Tenant Rentals LLC",
      phone: "+961 1 234 567",
      email: "info@tenant.example",
      address: "Beirut",
      contractFooterText: "Approved rental terms apply.",
    });
  });

  it("rejects organization deletion without mutating the organization", async () => {
    const response = await request(app)
      .delete("/api/organizations/me")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CANNOT_DELETE_ORGANIZATION");
    await expect(
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { deleted_at: true },
      }),
    ).resolves.toEqual({ deleted_at: null });
  });

  it("allows a platform owner to suspend a tenant and blocks tenant business routes", async () => {
    const statusResponse = await request(app)
      .patch(`/api/platform/organizations/${organizationId}/status`)
      .set("Authorization", `Bearer ${platformOwnerToken}`)
      .send({ status: "SUSPENDED" });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.status).toBe("SUSPENDED");
    expect(Object.keys(statusResponse.body.data).sort()).toEqual([
      "address",
      "createdAt",
      "email",
      "id",
      "legalName",
      "name",
      "phone",
      "status",
      "updatedAt",
    ]);

    const auditLogs = await prisma.auditLog.findMany({
      where: { organization_id: organizationId },
      select: {
        actor_user_id: true,
        action: true,
        target_type: true,
        target_id: true,
        metadata: true,
      },
    });
    expect(auditLogs).toEqual([
      {
        actor_user_id: expect.any(String),
        action: "ORGANIZATION_STATUS_UPDATED",
        target_type: "ORGANIZATION",
        target_id: organizationId,
        metadata: { previousStatus: "TRIAL", newStatus: "SUSPENDED" },
      },
    ]);

    const businessResponse = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(businessResponse.status).toBe(403);
    expect(businessResponse.body.error.code).toBe(
      "ORGANIZATION_NOT_OPERATIONAL",
    );

    const [organizationResponse, currentUserResponse] = await Promise.all([
      request(app)
        .get("/api/organizations/me")
        .set("Authorization", `Bearer ${ownerToken}`),
      request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${ownerToken}`),
    ]);

    expect(organizationResponse.status).toBe(200);
    expect(organizationResponse.body.data.status).toBe("SUSPENDED");
    expect(currentUserResponse.status).toBe(200);
    expect(currentUserResponse.body.data.organizationStatus).toBe("SUSPENDED");
  });

  it("does not let tenant owners manage lifecycle status", async () => {
    const response = await request(app)
      .patch(`/api/platform/organizations/${organizationId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("does not create an audit record when lifecycle status is unchanged", async () => {
    const response = await request(app)
      .patch(`/api/platform/organizations/${organizationId}/status`)
      .set("Authorization", `Bearer ${platformOwnerToken}`)
      .send({ status: "TRIAL" });

    expect(response.status).toBe(200);
    await expect(
      prisma.auditLog.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(0);
  });

  it("does not let employees manage lifecycle status", async () => {
    const employee = await prisma.user.create({
      data: {
        email: "employee@example.com",
        password_hash: "hash",
        role: "EMPLOYEE",
        organization_id: organizationId,
      },
    });
    const employeeToken = generateAccessToken({
      sub: employee.id,
      org: organizationId,
      role: employee.role,
    });

    const response = await request(app)
      .patch(`/api/platform/organizations/${organizationId}/status`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("restricts platform organization reads to platform owners", async () => {
    const employee = await prisma.user.create({
      data: {
        email: "employee-reads@example.com",
        password_hash: "hash",
        role: "EMPLOYEE",
        organization_id: organizationId,
      },
    });
    const employeeToken = generateAccessToken({
      sub: employee.id,
      org: organizationId,
      role: employee.role,
    });

    for (const token of [ownerToken, employeeToken]) {
      const [listResponse, detailResponse] = await Promise.all([
        request(app)
          .get("/api/platform/organizations")
          .set("Authorization", `Bearer ${token}`),
        request(app)
          .get(`/api/platform/organizations/${organizationId}`)
          .set("Authorization", `Bearer ${token}`),
      ]);

      expect(listResponse.status).toBe(403);
      expect(detailResponse.status).toBe(403);
    }
  });

  it("lists only client organizations with parsed pagination and minimum fields", async () => {
    const [matching, nonMatching, deleted, internal] = await Promise.all([
      prisma.organization.create({
        data: {
          name: "Acme Rentals",
          legal_name: "Acme Legal",
          email: "ops@acme.example",
          status: "ACTIVE",
          created_at: new Date("2026-01-02T00:00:00.000Z"),
        },
      }),
      prisma.organization.create({
        data: {
          name: "Beta Rentals",
          status: "TRIAL",
          created_at: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      prisma.organization.create({
        data: {
          name: "Deleted Acme",
          status: "ACTIVE",
          deleted_at: new Date(),
        },
      }),
      prisma.organization.create({
        data: {
          name: "Internal Acme",
          internalKey: "platform-internal",
          status: "ACTIVE",
        },
      }),
    ]);

    const response = await request(app)
      .get("/api/platform/organizations")
      .query({ page: "1", pageSize: "1", search: "ACME", status: "ACTIVE" })
      .set("Authorization", `Bearer ${platformOwnerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: matching.id,
      name: "Acme Rentals",
      legalName: "Acme Legal",
      email: "ops@acme.example",
      status: "ACTIVE",
    });
    expect(Object.keys(response.body.data[0]).sort()).toEqual([
      "address",
      "createdAt",
      "email",
      "id",
      "legalName",
      "name",
      "phone",
      "status",
      "updatedAt",
    ]);

    const defaultResponse = await request(app)
      .get("/api/platform/organizations")
      .set("Authorization", `Bearer ${platformOwnerToken}`);
    expect(defaultResponse.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 3 });
    expect(defaultResponse.body.data.map((organization: { id: string }) => organization.id)).toEqual([
      organizationId,
      matching.id,
      nonMatching.id,
    ]);
    expect(defaultResponse.body.data.map((organization: { id: string }) => organization.id)).not.toContain(platformOrganizationId);
    expect(defaultResponse.body.data.map((organization: { id: string }) => organization.id)).not.toContain(deleted.id);
    expect(defaultResponse.body.data.map((organization: { id: string }) => organization.id)).not.toContain(internal.id);
  });

  it("returns client details and hides missing, deleted, and internal organizations", async () => {
    const deleted = await prisma.organization.create({
      data: { name: "Deleted organization", deleted_at: new Date() },
    });
    const internal = await prisma.organization.create({
      data: { name: "Internal organization", internalKey: "platform-detail" },
    });

    const detailResponse = await request(app)
      .get(`/api/platform/organizations/${organizationId}`)
      .set("Authorization", `Bearer ${platformOwnerToken}`);
    expect(detailResponse.status).toBe(200);
    expect(Object.keys(detailResponse.body.data).sort()).toEqual([
      "address",
      "createdAt",
      "email",
      "id",
      "legalName",
      "name",
      "phone",
      "status",
      "updatedAt",
    ]);

    for (const id of [deleted.id, internal.id, "00000000-0000-4000-8000-000000000000"]) {
      const response = await request(app)
        .get(`/api/platform/organizations/${id}`)
        .set("Authorization", `Bearer ${platformOwnerToken}`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
    }

    const malformedResponse = await request(app)
      .get("/api/platform/organizations/not-a-uuid")
      .set("Authorization", `Bearer ${platformOwnerToken}`);
    expect(malformedResponse.status).toBe(422);
    expect(malformedResponse.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("hides internal, deleted, and missing organizations from lifecycle updates", async () => {
    const internal = await prisma.organization.create({
      data: { name: "Internal status organization", internalKey: "platform-status" },
    });
    const deleted = await prisma.organization.create({
      data: { name: "Deleted status organization", deleted_at: new Date() },
    });

    for (const id of [internal.id, deleted.id, "00000000-0000-4000-8000-000000000000"]) {
      const response = await request(app)
        .patch(`/api/platform/organizations/${id}/status`)
        .set("Authorization", `Bearer ${platformOwnerToken}`)
        .send({ status: "ACTIVE" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
    }
    await expect(
      prisma.auditLog.count({ where: { organization_id: internal.id } }),
    ).resolves.toBe(0);
  });

  it("blocks cancelled organizations from tenant business operations", async () => {
    await request(app)
      .patch(`/api/platform/organizations/${organizationId}/status`)
      .set("Authorization", `Bearer ${platformOwnerToken}`)
      .send({ status: "CANCELLED" })
      .expect(200);

    const response = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORGANIZATION_NOT_OPERATIONAL");
  });

  it("does not grant platform owners ordinary tenant business access", async () => {
    const response = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${platformOwnerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TENANT_ACCESS_REQUIRED");
  });

  it("rejects malformed organization IDs on lifecycle updates", async () => {
    const response = await request(app)
      .patch("/api/platform/organizations/not-a-uuid/status")
      .set("Authorization", `Bearer ${platformOwnerToken}`)
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
