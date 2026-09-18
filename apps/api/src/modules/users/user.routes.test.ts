import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import * as auditRepository from "../audit/audit.repository";
import { cleanup } from "../../test/helpers";

describe("user routes", () => {
  let organizationId: string;
  let ownerId: string;
  let ownerToken: string;

  beforeEach(async () => {
    await cleanup();

    const organization = await prisma.organization.create({
      data: { name: "Role test organization" },
    });
    organizationId = organization.id;

    const owner = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: `owner-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "OWNER",
      },
    });
    ownerId = owner.id;

    ownerToken = generateAccessToken({
      sub: owner.id,
      org: organizationId,
      role: "OWNER",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows an owner to create an employee in the same organization", async () => {
    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: `employee-${Date.now()}@example.com`,
        password: "Password123!",
        role: "EMPLOYEE",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe("EMPLOYEE");
  });

  it("records employee creation with the owner actor and non-sensitive metadata", async () => {
    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: `employee-audit-${Date.now()}@example.com`,
        password: "Password123!",
        role: "EMPLOYEE",
      });

    expect(response.status).toBe(201);
    await expect(
      prisma.auditLog.findFirst({
        where: { action: "USER_CREATED", target_id: response.body.data.id },
        select: {
          organization_id: true,
          actor_user_id: true,
          target_type: true,
          metadata: true,
        },
      }),
    ).resolves.toEqual({
      organization_id: organizationId,
      actor_user_id: ownerId,
      target_type: "USER",
      metadata: { role: "EMPLOYEE" },
    });
  });

  it("rolls back employee creation when its audit write fails", async () => {
    const email = `employee-audit-rollback-${Date.now()}@example.com`;
    vi.spyOn(auditRepository, "create").mockRejectedValueOnce(
      new Error("audit unavailable"),
    );

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, password: "Password123!", role: "EMPLOYEE" });

    expect(response.status).toBe(500);
    await expect(
      prisma.user.findUnique({ where: { email } }),
    ).resolves.toBeNull();
  });

  it("records employee deletion with the owner actor and role-only metadata", async () => {
    const employee = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: `employee-delete-audit-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "EMPLOYEE",
      },
    });

    const response = await request(app)
      .delete(`/api/users/${employee.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(204);
    await expect(
      prisma.auditLog.findFirst({
        where: { action: "USER_DELETED", target_id: employee.id },
        select: {
          organization_id: true,
          actor_user_id: true,
          target_type: true,
          metadata: true,
        },
      }),
    ).resolves.toEqual({
      organization_id: organizationId,
      actor_user_id: ownerId,
      target_type: "USER",
      metadata: { role: "EMPLOYEE" },
    });
  });

  it("rolls back employee deletion when its audit write fails", async () => {
    const employee = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: `employee-delete-audit-rollback-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "EMPLOYEE",
      },
    });
    vi.spyOn(auditRepository, "create").mockRejectedValueOnce(
      new Error("audit unavailable"),
    );

    const response = await request(app)
      .delete(`/api/users/${employee.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(500);
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: employee.id },
        select: { deleted_at: true },
      }),
    ).resolves.toEqual({ deleted_at: null });
  });

  it("normalizes employee email identity before enforcing global uniqueness", async () => {
    const email = `normalized-employee-${Date.now()}@example.com`;
    const first = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        email: `  ${email.toUpperCase()}  `,
        password: "Password123!",
        role: "EMPLOYEE",
      });
    const duplicate = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, password: "Password123!", role: "EMPLOYEE" });

    expect(first.status).toBe(201);
    expect(first.body.data.email).toBe(email);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("rejects OWNER role changes while preserving EMPLOYEE updates", async () => {
    const employee = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: `role-employee-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "EMPLOYEE",
      },
    });

    const [ownerUpdate, employeeUpdate] = await Promise.all([
      request(app)
        .patch(`/api/users/${ownerId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "EMPLOYEE" }),
      request(app)
        .patch(`/api/users/${employee.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "EMPLOYEE" }),
    ]);

    expect(ownerUpdate.status).toBe(409);
    expect(ownerUpdate.body.error.code).toBe("OWNER_ROLE_CHANGE_NOT_SUPPORTED");
    expect(employeeUpdate.status).toBe(200);
    expect(employeeUpdate.body.data.role).toBe("EMPLOYEE");
  });

  it("rejects legacy and platform roles from tenant user creation", async () => {
    for (const role of ["MANAGER", "PLATFORM_OWNER"]) {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          email: `${role.toLowerCase()}-${Date.now()}@example.com`,
          password: "Password123!",
          role,
        });

      expect(response.status).toBe(422);
    }
  });

  it("does not grant a platform owner tenant user-management access", async () => {
    const platformOwner = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: `platform-owner-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "PLATFORM_OWNER",
      },
    });
    const platformOwnerToken = generateAccessToken({
      sub: platformOwner.id,
      org: organizationId,
      role: "PLATFORM_OWNER",
    });

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${platformOwnerToken}`)
      .send({
        email: `employee-${Date.now()}@example.com`,
        password: "Password123!",
        role: "EMPLOYEE",
      });

    expect(response.status).toBe(403);
  });

  it("does not grant a platform owner tenant role-update access", async () => {
    const [employee, platformOwner] = await Promise.all([
      prisma.user.create({
        data: {
          organization_id: organizationId,
          email: `employee-update-${Date.now()}@example.com`,
          password_hash: "hash",
          role: "EMPLOYEE",
        },
      }),
      prisma.user.create({
        data: {
          organization_id: organizationId,
          email: `platform-update-${Date.now()}@example.com`,
          password_hash: "hash",
          role: "PLATFORM_OWNER",
        },
      }),
    ]);
    const platformToken = generateAccessToken({
      sub: platformOwner.id,
      org: organizationId,
      role: platformOwner.role,
    });

    const response = await request(app)
      .patch(`/api/users/${employee.id}`)
      .set("Authorization", `Bearer ${platformToken}`)
      .send({ role: "EMPLOYEE" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TENANT_ACCESS_REQUIRED");
  });
});
