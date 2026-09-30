import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken, hashPassword } from "../auth";
import {
  clearPasswordResetDeliveriesForTest,
  getLatestPasswordResetDeliveryForTest,
} from "../auth/password-reset.delivery";
import { cleanup } from "../../test/helpers";

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = "Support-Pass-123";

type Role = "OWNER" | "EMPLOYEE" | "PLATFORM_OWNER";

describe("platform support actions", () => {
  let orgId: string;
  let otherOrgId: string;
  let platformOrgId: string;
  let owner: { id: string; email: string };
  let employee: { id: string; email: string };
  let otherEmployee: { id: string };
  let platformOwner: { id: string };
  let platformToken: string;
  let ownerToken: string;
  let employeeToken: string;
  let pendingInvitationId: string;
  let expiredInvitationId: string;
  let acceptedInvitationId: string;
  let otherInvitationId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const tokenFor = (user: { id: string }, org: string, role: Role) =>
    generateAccessToken({ sub: user.id, org, role });

  beforeEach(async () => {
    await cleanup();
    clearPasswordResetDeliveriesForTest();
    const hash = await hashPassword(PASSWORD);

    const [org, otherOrg, platformOrg] = await Promise.all([
      prisma.organization.create({ data: { name: "Tenant", status: "ACTIVE" } }),
      prisma.organization.create({ data: { name: "Other tenant" } }),
      prisma.organization.create({
        data: { name: "Platform", internalKey: "platform", status: "ACTIVE" },
      }),
    ]);
    orgId = org.id;
    otherOrgId = otherOrg.id;
    platformOrgId = platformOrg.id;

    const mk = (email: string, role: Role, organization_id: string) =>
      prisma.user.create({
        data: { email, password_hash: hash, role, organization_id },
      });
    owner = await mk("owner@tenant.example", "OWNER", orgId);
    employee = await mk("employee@tenant.example", "EMPLOYEE", orgId);
    const otherOwner = await mk("other-owner@other.example", "OWNER", otherOrgId);
    otherEmployee = await mk("other-employee@other.example", "EMPLOYEE", otherOrgId);
    platformOwner = await mk("platform@example.com", "PLATFORM_OWNER", platformOrgId);

    const invite = (
      email: string,
      organization_id: string,
      expires: number,
      by: string,
      accepted?: string,
    ) =>
      prisma.employeeInvitation.create({
        data: {
          organization_id,
          email,
          token_hash: createHash("sha256").update(`seed-${email}`).digest("hex"),
          expires_at: new Date(Date.now() + expires),
          created_by_user_id: by,
          ...(accepted ? { accepted_at: new Date(), accepted_user_id: accepted } : {}),
        },
      });
    pendingInvitationId = (await invite("pending@tenant.example", orgId, DAY, owner.id)).id;
    expiredInvitationId = (await invite("expired@tenant.example", orgId, -DAY, owner.id)).id;
    acceptedInvitationId = (await invite("employee@tenant.example", orgId, DAY, owner.id, employee.id)).id;
    otherInvitationId = (await invite("other-invite@other.example", otherOrgId, DAY, otherOwner.id)).id;

    platformToken = tokenFor(platformOwner, platformOrgId, "PLATFORM_OWNER");
    ownerToken = tokenFor(owner, orgId, "OWNER");
    employeeToken = tokenFor(employee, orgId, "EMPLOYEE");
  });

  const resendPath = (o: string, i: string) =>
    `/api/platform/organizations/${o}/invitations/${i}/resend`;
  const recoveryPath = (o: string) => `/api/platform/organizations/${o}/owner/password-reset`;
  const deactivatePath = (o: string, u: string) =>
    `/api/platform/organizations/${o}/users/${u}/deactivate`;

  const audits = (action: string) =>
    prisma.auditLog.findMany({ where: { action } });

  describe("authorization", () => {
    it.each([
      ["owner", () => ownerToken],
      ["employee", () => employeeToken],
    ])("denies %s on every support action", async (_l, get) => {
      const calls = [
        request(app).post(resendPath(orgId, pendingInvitationId)),
        request(app).post(recoveryPath(orgId)),
        request(app).post(deactivatePath(orgId, employee.id)).send({ reason: "x" }),
      ];
      for (const call of calls) {
        const response = await call.set(auth(get()));
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
      }
      await expect(prisma.auditLog.count()).resolves.toBe(0);
    });

    it("requires authentication", async () => {
      for (const call of [
        request(app).post(resendPath(orgId, pendingInvitationId)),
        request(app).post(recoveryPath(orgId)),
        request(app).post(deactivatePath(orgId, employee.id)).send({ reason: "x" }),
      ]) {
        expect((await call).status).toBe(401);
      }
    });

    it("hides the internal and unknown organizations from every action", async () => {
      const unknown = "00000000-0000-4000-8000-000000000000";
      for (const id of [platformOrgId, unknown]) {
        for (const call of [
          request(app).post(resendPath(id, pendingInvitationId)),
          request(app).post(recoveryPath(id)),
          request(app).post(deactivatePath(id, employee.id)).send({ reason: "x" }),
        ]) {
          const response = await call.set(auth(platformToken));
          expect(response.status).toBe(404);
          expect(response.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
        }
      }
    });

    it("keeps tenant routes closed to the platform owner", async () => {
      for (const call of [
        request(app).post("/api/users/invitations").send({ email: "x@y.example" }),
        request(app).delete(`/api/users/${employee.id}`),
      ]) {
        const response = await call.set(auth(platformToken));
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("TENANT_ACCESS_REQUIRED");
      }
    });
  });

  describe("resend employee invitation", () => {
    it.each([
      ["pending", () => pendingInvitationId, "pending@tenant.example"],
      ["expired", () => expiredInvitationId, "expired@tenant.example"],
    ])("reissues a %s invitation and invalidates the old link", async (_l, id, email) => {
      const before = await prisma.employeeInvitation.findUniqueOrThrow({ where: { id: id() } });

      const response = await request(app).post(resendPath(orgId, id())).set(auth(platformToken));

      expect(response.status).toBe(200);
      const { acceptanceToken, expiresAt } = response.body.data;
      expect(acceptanceToken).toEqual(expect.any(String));
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * DAY);
      const after = await prisma.employeeInvitation.findUniqueOrThrow({ where: { id: id() } });
      expect(after.token_hash).not.toBe(before.token_hash);
      expect(after.token_hash).toBe(createHash("sha256").update(acceptanceToken).digest("hex"));
      expect(JSON.stringify(after)).not.toContain(acceptanceToken);
      await expect(
        prisma.employeeInvitation.count({ where: { organization_id: orgId, email } }),
      ).resolves.toBe(1);

      const logs = await audits("PLATFORM_EMPLOYEE_INVITATION_RESENT");
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        organization_id: orgId,
        actor_user_id: platformOwner.id,
        target_type: "EMPLOYEE_INVITATION",
        target_id: id(),
        metadata: { email },
      });
      expect(JSON.stringify(logs)).not.toContain(acceptanceToken);
    });

    it("makes the new link work and the previous one stop working", async () => {
      const first = await request(app).post(resendPath(orgId, pendingInvitationId)).set(auth(platformToken));
      const second = await request(app).post(resendPath(orgId, pendingInvitationId)).set(auth(platformToken));

      const old = await request(app)
        .post("/api/auth/invitations/accept")
        .send({ token: first.body.data.acceptanceToken, password: PASSWORD });
      const fresh = await request(app)
        .post("/api/auth/invitations/accept")
        .send({ token: second.body.data.acceptanceToken, password: PASSWORD });

      expect(old.status).toBe(409);
      expect(old.body.error.code).toBe("INVALID_OR_EXPIRED_INVITATION");
      expect(fresh.status).toBe(201);
    });

    it("rejects accepted invitations without writing", async () => {
      const response = await request(app).post(resendPath(orgId, acceptedInvitationId)).set(auth(platformToken));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("INVITATION_ALREADY_ACCEPTED");
      await expect(audits("PLATFORM_EMPLOYEE_INVITATION_RESENT")).resolves.toHaveLength(0);
    });

    it("rejects invitations of another organization", async () => {
      const response = await request(app).post(resendPath(orgId, otherInvitationId)).set(auth(platformToken));

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("INVITATION_NOT_FOUND");
      const untouched = await prisma.employeeInvitation.findUniqueOrThrow({ where: { id: otherInvitationId } });
      expect(untouched.token_hash).toBe(
        createHash("sha256").update("seed-other-invite@other.example").digest("hex"),
      );
    });

    it.each(["SUSPENDED", "CANCELLED"] as const)(
      "rejects resend while the organization is %s",
      async (status) => {
        await prisma.organization.update({ where: { id: orgId }, data: { status } });

        const response = await request(app).post(resendPath(orgId, pendingInvitationId)).set(auth(platformToken));

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("ORGANIZATION_NOT_OPERATIONAL");
        await expect(audits("PLATFORM_EMPLOYEE_INVITATION_RESENT")).resolves.toHaveLength(0);
      },
    );

    it("allows resend while the organization is in TRIAL", async () => {
      await prisma.organization.update({ where: { id: orgId }, data: { status: "TRIAL" } });

      const response = await request(app).post(resendPath(orgId, pendingInvitationId)).set(auth(platformToken));

      expect(response.status).toBe(200);
    });

    it("rejects malformed ids", async () => {
      const response = await request(app).post(resendPath(orgId, "nope")).set(auth(platformToken));

      expect(response.status).toBe(422);
    });
  });

  describe("owner password recovery", () => {
    it("resolves the owner server-side, delivers through the existing boundary and returns nothing", async () => {
      const response = await request(app).post(recoveryPath(orgId)).set(auth(platformToken));

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      const delivery = getLatestPasswordResetDeliveryForTest(owner.email);
      expect(delivery).toBeDefined();
      const stored = await prisma.passwordResetToken.findMany({ where: { user_id: owner.id } });
      expect(stored).toHaveLength(1);
      expect(stored[0]?.token_hash).toBe(createHash("sha256").update(delivery!.token).digest("hex"));
      expect(JSON.stringify(stored)).not.toContain(delivery!.token);
      expect(getLatestPasswordResetDeliveryForTest(employee.email)).toBeUndefined();

      const logs = await audits("PLATFORM_OWNER_PASSWORD_RESET_REQUESTED");
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        organization_id: orgId,
        actor_user_id: platformOwner.id,
        target_id: owner.id,
        metadata: { role: "OWNER" },
      });
      expect(JSON.stringify(logs)).not.toContain(delivery!.token);
    });

    it("does not let the client choose the target email", async () => {
      const response = await request(app)
        .post(recoveryPath(orgId))
        .set(auth(platformToken))
        .send({ email: "employee@tenant.example", userId: employee.id });

      expect(response.status).toBe(204);
      expect(getLatestPasswordResetDeliveryForTest("employee@tenant.example")).toBeUndefined();
      expect(getLatestPasswordResetDeliveryForTest("owner@tenant.example")).toBeDefined();
    });

    it("completes the normal reset flow, revokes sessions, and leaves lifecycle untouched", async () => {
      await prisma.organization.update({ where: { id: orgId }, data: { status: "SUSPENDED" } });
      await prisma.refreshToken.create({
        data: { token: "owner-session", user_id: owner.id, expires_at: new Date(Date.now() + DAY) },
      });

      await request(app).post(recoveryPath(orgId)).set(auth(platformToken)).expect(204);
      const { token } = getLatestPasswordResetDeliveryForTest(owner.email)!;
      const confirm = await request(app)
        .post("/api/auth/password-reset/confirm")
        .send({ token, password: "Brand-New-Pass-123" });

      expect(confirm.status).toBe(204);
      await expect(prisma.refreshToken.count({ where: { user_id: owner.id } })).resolves.toBe(0);
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: owner.email, password: "Brand-New-Pass-123" });
      expect(login.status).toBe(200);
      await expect(
        prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      ).resolves.toMatchObject({ status: "SUSPENDED" });
    });

    it.each(["SUSPENDED", "CANCELLED"] as const)("is allowed while %s", async (status) => {
      await prisma.organization.update({ where: { id: orgId }, data: { status } });

      const response = await request(app).post(recoveryPath(orgId)).set(auth(platformToken));

      expect(response.status).toBe(204);
    });

    it("invalidates earlier unconsumed reset tokens", async () => {
      await request(app).post(recoveryPath(orgId)).set(auth(platformToken)).expect(204);
      const first = getLatestPasswordResetDeliveryForTest(owner.email)!.token;
      await request(app).post(recoveryPath(orgId)).set(auth(platformToken)).expect(204);

      const confirm = await request(app)
        .post("/api/auth/password-reset/confirm")
        .send({ token: first, password: "Another-Pass-123" });

      expect(confirm.status).toBe(409);
    });

    it("rejects a deactivated owner", async () => {
      await prisma.user.update({ where: { id: owner.id }, data: { deleted_at: new Date() } });

      const response = await request(app).post(recoveryPath(orgId)).set(auth(platformToken));

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("OWNER_DEACTIVATED");
      expect(getLatestPasswordResetDeliveryForTest(owner.email)).toBeUndefined();
      await expect(audits("PLATFORM_OWNER_PASSWORD_RESET_REQUESTED")).resolves.toHaveLength(0);
    });

    it("flags missing and multiple owners as integrity errors", async () => {
      await prisma.user.create({
        data: { email: "second-owner@tenant.example", password_hash: "h", role: "OWNER", organization_id: orgId },
      });
      const multiple = await request(app).post(recoveryPath(orgId)).set(auth(platformToken));
      expect(multiple.status).toBe(500);
      expect(multiple.body.error.code).toBe("ORGANIZATION_DATA_INTEGRITY_ERROR");

      await prisma.user.updateMany({
        where: { organization_id: orgId, role: "OWNER" },
        data: { role: "EMPLOYEE" },
      });
      const none = await request(app).post(recoveryPath(orgId)).set(auth(platformToken));
      expect(none.status).toBe(500);
      expect(none.body.error.code).toBe("ORGANIZATION_DATA_INTEGRITY_ERROR");
      await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
    });
  });

  describe("deactivate employee", () => {
    async function deactivate(userId: string, body: unknown = { reason: "  Left the company  " }, org = orgId) {
      return request(app).post(deactivatePath(org, userId)).set(auth(platformToken)).send(body as object);
    }

    it("soft-deletes the employee, revokes sessions, audits once, and blocks sign-in", async () => {
      await prisma.refreshToken.create({
        data: { token: "employee-session", user_id: employee.id, expires_at: new Date(Date.now() + DAY) },
      });
      const vehicle = await prisma.vehicle.create({
        data: {
          organization_id: orgId, make: "Toyota", model: "Corolla", plate_number: "SUP-1", year: 2020,
          color: "White", transmission: "AUTOMATIC", fuel_type: "PETROL", seats: 5,
          current_mileage: 1, status: "AVAILABLE",
        },
      });

      const response = await deactivate(employee.id);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: employee.id, role: "EMPLOYEE", status: "DEACTIVATED",
      });
      expect(typeof response.body.data.deactivatedAt).toBe("string");
      const row = await prisma.user.findUniqueOrThrow({ where: { id: employee.id } });
      expect(row.deleted_at).not.toBeNull();
      await expect(prisma.refreshToken.count({ where: { user_id: employee.id } })).resolves.toBe(0);
      await expect(prisma.vehicle.findUnique({ where: { id: vehicle.id } })).resolves.not.toBeNull();
      await expect(prisma.user.findUnique({ where: { id: owner.id } })).resolves.toMatchObject({ deleted_at: null });

      const logs = await audits("PLATFORM_EMPLOYEE_DEACTIVATED");
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        organization_id: orgId,
        actor_user_id: platformOwner.id,
        target_id: employee.id,
        metadata: { role: "EMPLOYEE", reason: "Left the company" },
      });

      const login = await request(app).post("/api/auth/login").send({ email: employee.email, password: PASSWORD });
      expect(login.status).toBe(401);
      const stale = await request(app).get("/api/customers").set(auth(employeeToken));
      expect(stale.status).toBe(401);
      const list = await request(app).get(`/api/platform/organizations/${orgId}/users`).set(auth(platformToken));
      expect(list.body.data.users.find((u: { id: string }) => u.id === employee.id).status).toBe("DEACTIVATED");
    });

    it("never deactivates an owner or a platform owner", async () => {
      const legacy = await prisma.user.create({
        data: { email: "legacy@tenant.example", password_hash: "h", role: "PLATFORM_OWNER", organization_id: orgId },
      });

      for (const id of [owner.id, legacy.id]) {
        const response = await deactivate(id);
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("USER_NOT_DEACTIVATABLE");
      }
      const targeted = await deactivate(platformOwner.id);
      expect(targeted.status).toBe(404);
      await expect(
        prisma.user.count({ where: { id: { in: [owner.id, legacy.id, platformOwner.id] }, deleted_at: null } }),
      ).resolves.toBe(3);
      await expect(audits("PLATFORM_EMPLOYEE_DEACTIVATED")).resolves.toHaveLength(0);
    });

    it("rejects users of another organization and the internal organization", async () => {
      const cross = await deactivate(otherEmployee.id);
      expect(cross.status).toBe(404);
      expect(cross.body.error.code).toBe("USER_NOT_FOUND");
      const internal = await deactivate(platformOwner.id, { reason: "x" }, platformOrgId);
      expect(internal.status).toBe(404);
      await expect(prisma.user.findUnique({ where: { id: otherEmployee.id } })).resolves.toMatchObject({ deleted_at: null });
    });

    it.each([
      ["missing", {}],
      ["empty", { reason: "" }],
      ["whitespace", { reason: "   " }],
      ["too long", { reason: "x".repeat(501) }],
    ])("requires a valid reason (%s)", async (_l, body) => {
      const response = await deactivate(employee.id, body);

      expect(response.status).toBe(422);
      await expect(prisma.user.findUnique({ where: { id: employee.id } })).resolves.toMatchObject({ deleted_at: null });
      await expect(audits("PLATFORM_EMPLOYEE_DEACTIVATED")).resolves.toHaveLength(0);
    });

    it("rejects an already deactivated employee without a second audit entry", async () => {
      await deactivate(employee.id);
      const again = await deactivate(employee.id);

      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("USER_ALREADY_DEACTIVATED");
      await expect(audits("PLATFORM_EMPLOYEE_DEACTIVATED")).resolves.toHaveLength(1);
    });

    it("is allowed while the organization is suspended", async () => {
      await prisma.organization.update({ where: { id: orgId }, data: { status: "SUSPENDED" } });

      const response = await deactivate(employee.id);

      expect(response.status).toBe(200);
    });
  });
});
