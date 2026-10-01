import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { cleanup } from "../../test/helpers";
import { generateAccessToken, hashPassword } from "./index";

describe("auth routes", () => {
  beforeEach(async () => {
    await cleanup();
  });

  describe("public tenant registration is removed", () => {
    const registration = () => ({
      email: `owner-${Date.now()}@example.com`,
      password: "Password123!",
      organizationName: "Self-registered organization",
    });

    async function expectNothingProvisioned() {
      await expect(prisma.organization.count()).resolves.toBe(0);
      await expect(prisma.user.count()).resolves.toBe(0);
      await expect(prisma.refreshToken.count()).resolves.toBe(0);
    }

    it("no longer provisions a tenant for unauthenticated callers", async () => {
      const response = await request(app).post("/api/auth/register").send(registration());

      // Falls through to the shared authenticated routers like any other unmatched path.
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(response.body.data).toBeUndefined();
      await expectNothingProvisioned();
    });

    it("behaves exactly like any other unmatched auth path", async () => {
      const unmatched = await request(app).post("/api/auth/does-not-exist").send(registration());
      const register = await request(app).post("/api/auth/register").send(registration());

      expect(register.status).toBe(unmatched.status);
      expect(register.body).toEqual(unmatched.body);
    });

    it("does not provision for authenticated tenant users either", async () => {
      const organization = await prisma.organization.create({ data: { name: "Existing", status: "ACTIVE" } });
      const owner = await prisma.user.create({
        data: {
          email: "existing-owner@example.com",
          password_hash: await hashPassword("Password123!"),
          role: "OWNER",
          organization_id: organization.id,
        },
      });
      const token = generateAccessToken({ sub: owner.id, org: organization.id, role: "OWNER" });

      const response = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send(registration());

      expect(response.status).toBe(404);
      await expect(prisma.organization.count()).resolves.toBe(1);
      await expect(prisma.user.count()).resolves.toBe(1);
    });

    it("does not provision for a platform owner through the old path", async () => {
      const platformOrg = await prisma.organization.create({
        data: { name: "Platform", internalKey: "platform", status: "ACTIVE" },
      });
      const platformOwner = await prisma.user.create({
        data: {
          email: "platform@example.com",
          password_hash: await hashPassword("Password123!"),
          role: "PLATFORM_OWNER",
          organization_id: platformOrg.id,
        },
      });
      const token = generateAccessToken({ sub: platformOwner.id, org: platformOrg.id, role: "PLATFORM_OWNER" });

      const response = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${token}`)
        .send(registration());

      expect(response.status).toBe(403);
      await expect(prisma.organization.count()).resolves.toBe(1);
      await expect(prisma.user.count()).resolves.toBe(1);
    });
  });

  it("accepts case-variant login for a stored normalized email", async () => {
    const organization = await prisma.organization.create({ data: { name: "Login organization", status: "ACTIVE" } });
    await prisma.user.create({
      data: {
        email: "login-owner@example.com",
        password_hash: await hashPassword("Password123!"),
        role: "OWNER",
        organization_id: organization.id,
      },
    });

    const login = await request(app).post("/api/auth/login").send({
      email: "  LOGIN-OWNER@EXAMPLE.COM ",
      password: "Password123!",
    });

    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toEqual(expect.any(String));
    expect(login.body.data.refreshToken).toBeUndefined();
    expect(login.headers["set-cookie"]?.[0]).toMatch(
      /Path=\/api\/auth;.*HttpOnly; SameSite=Lax/,
    );
  });

  it("rejects wrong credentials without revealing which part failed", async () => {
    const organization = await prisma.organization.create({ data: { name: "Login organization", status: "ACTIVE" } });
    await prisma.user.create({
      data: {
        email: "known@example.com",
        password_hash: await hashPassword("Password123!"),
        role: "OWNER",
        organization_id: organization.id,
      },
    });

    const wrongPassword = await request(app).post("/api/auth/login").send({ email: "known@example.com", password: "Wrong-Pass-1!" });
    const unknownEmail = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "Password123!" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe(unknownEmail.body.error.code);
  });
});
