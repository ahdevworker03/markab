import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import app from "../../app";
import { prisma, transaction } from "../../database";
import { createOrganizationWithOwner, generateAccessToken, hashPassword } from "../auth";
import {
  clearPasswordResetDeliveriesForTest,
  getLatestPasswordResetDeliveryForTest,
  setPasswordResetDeliveryForTest,
} from "../auth/password-reset.delivery";
import { cleanup } from "../../test/helpers";

describe("platform organization provisioning", () => {
  let platformOrgId: string;
  let platformOwnerId: string;
  let platformToken: string;
  let ownerToken: string;
  let employeeToken: string;

  const createOrg = (body: unknown, token: string | null = platformToken) => {
    const call = request(app).post("/api/platform/organizations").send(body as object);
    return token ? call.set("Authorization", `Bearer ${token}`) : call;
  };
  const valid = (overrides: Record<string, unknown> = {}) => ({
    organizationName: "Cedar Rentals",
    ownerEmail: "founder@cedar.example",
    initialStatus: "ACTIVE",
    ...overrides,
  });
  const clientOrgCount = () => prisma.organization.count({ where: { internalKey: null } });

  beforeEach(async () => {
    await cleanup();
    clearPasswordResetDeliveriesForTest();
    const hash = await hashPassword("irrelevant-password");
    const [platformOrg, tenantOrg] = await Promise.all([
      prisma.organization.create({
        data: { name: "Platform", internalKey: "platform", status: "ACTIVE" },
      }),
      prisma.organization.create({ data: { name: "Existing tenant", status: "ACTIVE" } }),
    ]);
    platformOrgId = platformOrg.id;
    const [platformOwner, owner, employee] = await Promise.all([
      prisma.user.create({
        data: { email: "platform@example.com", password_hash: hash, role: "PLATFORM_OWNER", organization_id: platformOrg.id },
      }),
      prisma.user.create({
        data: { email: "owner@existing.example", password_hash: hash, role: "OWNER", organization_id: tenantOrg.id },
      }),
      prisma.user.create({
        data: { email: "employee@existing.example", password_hash: hash, role: "EMPLOYEE", organization_id: tenantOrg.id },
      }),
    ]);
    platformOwnerId = platformOwner.id;
    platformToken = generateAccessToken({ sub: platformOwner.id, org: platformOrg.id, role: "PLATFORM_OWNER" });
    ownerToken = generateAccessToken({ sub: owner.id, org: tenantOrg.id, role: "OWNER" });
    employeeToken = generateAccessToken({ sub: employee.id, org: tenantOrg.id, role: "EMPLOYEE" });
  });

  afterEach(() => setPasswordResetDeliveryForTest(undefined));

  describe("authorization", () => {
    it.each([
      ["owner", () => ownerToken],
      ["employee", () => employeeToken],
    ])("denies %s without creating anything", async (_label, get) => {
      const before = await prisma.organization.count();

      const response = await createOrg(valid(), get());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
      await expect(prisma.organization.count()).resolves.toBe(before);
      await expect(prisma.auditLog.count()).resolves.toBe(0);
    });

    it("requires authentication", async () => {
      const response = await createOrg(valid(), null);

      expect(response.status).toBe(401);
    });
  });

  describe("creation", () => {
    it.each(["ACTIVE", "TRIAL"] as const)("creates a %s organization and its OWNER", async (initialStatus) => {
      const response = await createOrg(valid({ initialStatus }));

      expect(response.status).toBe(201);
      const { organization, owner } = response.body.data;
      expect(organization).toMatchObject({ name: "Cedar Rentals", status: initialStatus });
      expect(owner).toEqual({ id: expect.any(String), email: "founder@cedar.example", role: "OWNER" });
      const row = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
      expect(row).toMatchObject({ status: initialStatus, internalKey: null, deleted_at: null });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
      expect(user).toMatchObject({ role: "OWNER", organization_id: organization.id, deleted_at: null });
      await expect(prisma.user.count({ where: { organization_id: organization.id } })).resolves.toBe(1);
    });

    it("defaults to ACTIVE when no status is given", async () => {
      const { initialStatus: _omit, ...withoutStatus } = valid();

      const response = await createOrg(withoutStatus);

      expect(response.status).toBe(201);
      expect(response.body.data.organization.status).toBe("ACTIVE");
    });

    it("normalizes the owner email and trims the organization name", async () => {
      const response = await createOrg(valid({ organizationName: "  Padded Name  ", ownerEmail: "  Mixed.Case@Cedar.EXAMPLE " }));

      expect(response.status).toBe(201);
      expect(response.body.data.organization.name).toBe("Padded Name");
      expect(response.body.data.owner.email).toBe("mixed.case@cedar.example");
    });

    it("leaves the internal platform organization and platform owner untouched", async () => {
      await createOrg(valid());

      await expect(prisma.organization.count({ where: { internalKey: "platform" } })).resolves.toBe(1);
      await expect(
        prisma.organization.findUniqueOrThrow({ where: { id: platformOrgId } }),
      ).resolves.toMatchObject({ name: "Platform", status: "ACTIVE" });
      await expect(prisma.user.count({ where: { organization_id: platformOrgId } })).resolves.toBe(1);
      await expect(prisma.user.count({ where: { role: "PLATFORM_OWNER" } })).resolves.toBe(1);
    });

    it("returns what the frontend needs to navigate to the new organization", async () => {
      const response = await createOrg(valid());

      expect(Object.keys(response.body.data).sort()).toEqual(["organization", "owner"]);
      expect(Object.keys(response.body.data.organization).sort()).toEqual([
        "address", "createdAt", "email", "id", "legalName", "name", "phone", "status", "updatedAt",
      ]);
      const detail = await request(app)
        .get(`/api/platform/organizations/${response.body.data.organization.id}`)
        .set("Authorization", `Bearer ${platformToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.name).toBe("Cedar Rentals");
    });
  });

  describe("validation", () => {
    it("rejects an email that already belongs to any account, in any case", async () => {
      for (const ownerEmail of ["owner@existing.example", "OWNER@Existing.Example", "platform@example.com"]) {
        const before = await clientOrgCount();
        const response = await createOrg(valid({ ownerEmail }));

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
        await expect(clientOrgCount()).resolves.toBe(before);
      }
      await expect(prisma.auditLog.count()).resolves.toBe(0);
    });

    it.each([
      ["malformed email", { ownerEmail: "not-an-email" }],
      ["missing email", { ownerEmail: undefined }],
      ["missing organization name", { organizationName: undefined }],
      ["blank organization name", { organizationName: "   " }],
      ["over-long organization name", { organizationName: "x".repeat(201) }],
      ["SUSPENDED status", { initialStatus: "SUSPENDED" }],
      ["CANCELLED status", { initialStatus: "CANCELLED" }],
      ["invalid status", { initialStatus: "FREE" }],
      ["lowercase status", { initialStatus: "active" }],
    ])("rejects %s with no side effects", async (_label, overrides) => {
      const before = await prisma.organization.count();

      const response = await createOrg(valid(overrides));

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      await expect(prisma.organization.count()).resolves.toBe(before);
      await expect(prisma.auditLog.count()).resolves.toBe(0);
    });

    it.each([
      ["a password", { password: "ChosenByPlatform123" }],
      ["a role", { role: "PLATFORM_OWNER" }],
      ["an organization id", { organizationId: "00000000-0000-4000-8000-000000000000" }],
      ["an internal key", { internalKey: "platform2" }],
    ])("rejects unknown properties such as %s", async (_label, extra) => {
      const before = await prisma.user.count();

      const response = await createOrg(valid(extra));

      expect(response.status).toBe(422);
      await expect(prisma.user.count()).resolves.toBe(before);
    });
  });

  describe("integrity", () => {
    it("rolls the organization back when owner creation fails", async () => {
      const before = await prisma.organization.count();

      await expect(
        transaction(async (tx) => {
          const faulty = new Proxy(tx, {
            get(target, prop, receiver) {
              if (prop === "user") {
                return {
                  findUnique: target.user.findUnique.bind(target.user),
                  create: async () => {
                    throw new Error("owner creation failed");
                  },
                };
              }
              return Reflect.get(target, prop, receiver);
            },
          });
          return createOrganizationWithOwner(faulty, {
            organizationName: "Doomed Org",
            ownerEmail: "doomed@example.com",
            passwordHash: "hash",
          });
        }),
      ).rejects.toThrow("owner creation failed");

      await expect(prisma.organization.count()).resolves.toBe(before);
      await expect(prisma.organization.count({ where: { name: "Doomed Org" } })).resolves.toBe(0);
    });

    it("creates exactly one account when the same email is provisioned concurrently", async () => {
      const [a, b] = await Promise.all([
        createOrg(valid({ organizationName: "Race One", ownerEmail: "race@cedar.example" })),
        createOrg(valid({ organizationName: "Race Two", ownerEmail: "race@cedar.example" })),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      await expect(prisma.user.count({ where: { email: "race@cedar.example" } })).resolves.toBe(1);
      await expect(prisma.organization.count({ where: { name: { in: ["Race One", "Race Two"] } } })).resolves.toBe(1);
      await expect(prisma.auditLog.count({ where: { action: "PLATFORM_ORGANIZATION_CREATED" } })).resolves.toBe(1);
    });

    it("writes exactly one non-secret audit entry on success", async () => {
      const response = await createOrg(valid({ initialStatus: "TRIAL" }));

      const logs = await prisma.auditLog.findMany({ where: { action: "PLATFORM_ORGANIZATION_CREATED" } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        organization_id: response.body.data.organization.id,
        actor_user_id: platformOwnerId,
        target_type: "ORGANIZATION",
        target_id: response.body.data.organization.id,
        metadata: { initialStatus: "TRIAL", ownerRole: "OWNER" },
      });
      const delivered = getLatestPasswordResetDeliveryForTest("founder@cedar.example")!;
      expect(JSON.stringify(logs)).not.toContain(delivered.token);
      expect(JSON.stringify(logs)).not.toMatch(/password|token/i);
    });

    it("writes no audit entry for failed requests", async () => {
      await createOrg(valid({ ownerEmail: "owner@existing.example" }));
      await createOrg(valid({ initialStatus: "SUSPENDED" }));

      await expect(prisma.auditLog.count({ where: { action: "PLATFORM_ORGANIZATION_CREATED" } })).resolves.toBe(0);
    });
  });

  describe("owner password setup", () => {
    it("never accepts, stores or returns a password or token", async () => {
      const response = await createOrg(valid());

      const body = JSON.stringify(response.body);
      const delivered = getLatestPasswordResetDeliveryForTest("founder@cedar.example")!;
      expect(body).not.toContain(delivered.token);
      expect(body).not.toMatch(/password|token|hash|secret/i);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "founder@cedar.example" } });
      expect(body).not.toContain(user.password_hash);
    });

    it("delivers one setup link to the owner, stores only its hash, and the owner can then sign in", async () => {
      const response = await createOrg(valid());
      const ownerId = response.body.data.owner.id as string;

      const delivered = getLatestPasswordResetDeliveryForTest("founder@cedar.example");
      expect(delivered).toBeDefined();
      const stored = await prisma.passwordResetToken.findMany({ where: { user_id: ownerId } });
      expect(stored).toHaveLength(1);
      expect(stored[0]?.token_hash).toBe(createHash("sha256").update(delivered!.token).digest("hex"));
      expect(JSON.stringify(stored)).not.toContain(delivered!.token);

      const before = await request(app)
        .post("/api/auth/login")
        .send({ email: "founder@cedar.example", password: "AnyGuess-12345" });
      expect(before.status).toBe(401);

      await request(app)
        .post("/api/auth/password-reset/confirm")
        .send({ token: delivered!.token, password: "Owner-Chosen-Pass-123" })
        .expect(204);
      const after = await request(app)
        .post("/api/auth/login")
        .send({ email: "founder@cedar.example", password: "Owner-Chosen-Pass-123" });
      expect(after.status).toBe(200);
    });

    it("keeps the account when email delivery fails", async () => {
      setPasswordResetDeliveryForTest(async () => {
        throw new Error("provider unavailable");
      });

      const response = await createOrg(valid());

      expect(response.status).toBe(201);
      await expect(prisma.user.count({ where: { email: "founder@cedar.example" } })).resolves.toBe(1);
      await expect(
        prisma.passwordResetToken.count({ where: { user_id: response.body.data.owner.id, consumed_at: null } }),
      ).resolves.toBe(1);
      await expect(prisma.auditLog.count({ where: { action: "PLATFORM_ORGANIZATION_CREATED" } })).resolves.toBe(1);
    });

    it("lets the platform owner request a fresh setup link without duplicating the tenant", async () => {
      const created = await createOrg(valid());
      const organizationId = created.body.data.organization.id as string;
      const first = getLatestPasswordResetDeliveryForTest("founder@cedar.example")!.token;

      await request(app)
        .post(`/api/platform/organizations/${organizationId}/owner/password-reset`)
        .set("Authorization", `Bearer ${platformToken}`)
        .expect(204);

      const second = getLatestPasswordResetDeliveryForTest("founder@cedar.example")!.token;
      expect(second).not.toBe(first);
      await expect(prisma.organization.count({ where: { name: "Cedar Rentals" } })).resolves.toBe(1);
    });
  });

  describe("platform provisioning is the only tenant-creation path", () => {
    it("does not let an unauthenticated caller create a tenant through the removed public route", async () => {
      const before = await prisma.organization.count();

      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "self@signup.example", password: "Self-Signup-123", organizationName: "Self Signup" });

      expect(response.status).toBe(401);
      await expect(prisma.organization.count()).resolves.toBe(before);
      await expect(prisma.user.count({ where: { email: "self@signup.example" } })).resolves.toBe(0);
    });
  });
});
