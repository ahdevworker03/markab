import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { cleanup } from "../../test/helpers";
import { generateAccessToken, hashPassword } from ".";

describe("auth session integrity", () => {
  let employeeId: string;
  let otherEmployeeId: string;
  let ownerToken: string;
  let employeeAccessToken: string;
  let employeeRefreshToken: string;

  beforeEach(async () => {
    await cleanup();

    const [organization, otherOrganization] = await Promise.all([
      prisma.organization.create({ data: { name: "Session organization" } }),
      prisma.organization.create({
        data: { name: "Other session organization" },
      }),
    ]);
    const passwordHash = await hashPassword("Password123!");
    const [owner, employee] = await Promise.all([
      prisma.user.create({
        data: {
          organization_id: organization.id,
          email: "session-owner@example.com",
          password_hash: passwordHash,
          role: "OWNER",
        },
      }),
      prisma.user.create({
        data: {
          organization_id: organization.id,
          email: "session-employee@example.com",
          password_hash: passwordHash,
          role: "EMPLOYEE",
        },
      }),
    ]);
    const otherEmployee = await prisma.user.create({
      data: {
        organization_id: otherOrganization.id,
        email: "other-session-employee@example.com",
        password_hash: passwordHash,
        role: "EMPLOYEE",
      },
    });

    employeeId = employee.id;
    otherEmployeeId = otherEmployee.id;
    ownerToken = generateAccessToken({
      sub: owner.id,
      org: organization.id,
      role: owner.role,
    });

    const login = await request(app).post("/api/auth/login").send({
      email: employee.email,
      password: "Password123!",
    });
    employeeAccessToken = login.body.data.accessToken;
    employeeRefreshToken = login.body.data.refreshToken;
  });

  async function deleteEmployee(): Promise<void> {
    await request(app)
      .delete(`/api/users/${employeeId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);
  }

  it("allows an active employee access token to use tenant routes", async () => {
    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${employeeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((user: { id: string }) => user.id)).toEqual(
      expect.arrayContaining([employeeId]),
    );
  });

  it("rejects a deleted user's access token", async () => {
    await deleteEmployee();

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${employeeAccessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("rejects a deleted user from /auth/me", async () => {
    await deleteEmployee();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${employeeAccessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("revokes a deleted user's refresh credentials", async () => {
    await deleteEmployee();

    await expect(
      prisma.refreshToken.count({ where: { user_id: employeeId } }),
    ).resolves.toBe(0);
  });

  it("rejects a deleted user's refresh token", async () => {
    await prisma.user.update({
      where: { id: employeeId },
      data: { deleted_at: new Date() },
    });

    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken: employeeRefreshToken,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rotates refresh tokens without storing the raw token", async () => {
    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken: employeeRefreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).not.toBe(employeeRefreshToken);
    await expect(
      prisma.refreshToken.findUnique({
        where: { token: response.body.data.refreshToken },
      }),
    ).resolves.toBeNull();
  });

  it("rejects reuse of an already rotated refresh token", async () => {
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: employeeRefreshToken })
      .expect(200);

    const replay = await request(app).post("/api/auth/refresh").send({
      refreshToken: employeeRefreshToken,
    });

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("allows at most one concurrent refresh rotation", async () => {
    const responses = await Promise.all([
      request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: employeeRefreshToken }),
      request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: employeeRefreshToken }),
    ]);

    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.status === 401),
    ).toHaveLength(1);
    expect(
      responses.find((response) => response.status === 401)?.body.error.code,
    ).toBe("INVALID_REFRESH_TOKEN");
    await expect(
      prisma.refreshToken.count({ where: { user_id: employeeId } }),
    ).resolves.toBe(1);
  });

  it("keeps active employee sessions tenant-scoped and role-restricted", async () => {
    const [users, createUser] = await Promise.all([
      request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${employeeAccessToken}`),
      request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${employeeAccessToken}`)
        .send({
          email: "forbidden-session-user@example.com",
          password: "Password123!",
          role: "EMPLOYEE",
        }),
    ]);

    expect(users.status).toBe(200);
    expect(users.body.data.map((user: { id: string }) => user.id)).toEqual(
      expect.arrayContaining([employeeId]),
    );
    expect(
      users.body.data.map((user: { id: string }) => user.id),
    ).not.toContain(otherEmployeeId);
    expect(createUser.status).toBe(403);
    expect(createUser.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
  });
});
