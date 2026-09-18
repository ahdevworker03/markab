import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "./app";
import { prisma } from "./database";
import { errorHandler } from "./middleware";
import { cleanup } from "./test/helpers";
import { generateAccessToken } from "./modules/auth";

const unknownUuid = "00000000-0000-4000-8000-000000000000";

describe("request boundary", () => {
  let token: string;
  let platformOwnerToken: string;

  beforeEach(async () => {
    await cleanup();

    const [organization, platformOrganization] = await Promise.all([
      prisma.organization.create({ data: { name: "Boundary organization" } }),
      prisma.organization.create({
        data: { name: "Boundary platform organization", status: "ACTIVE" },
      }),
    ]);
    const [owner, platformOwner] = await Promise.all([
      prisma.user.create({
        data: {
          organization_id: organization.id,
          email: "boundary-owner@example.com",
          password_hash: "hash",
          role: "OWNER",
        },
      }),
      prisma.user.create({
        data: {
          organization_id: platformOrganization.id,
          email: "boundary-platform@example.com",
          password_hash: "hash",
          role: "PLATFORM_OWNER",
        },
      }),
    ]);

    token = generateAccessToken({
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const resources = [
    {
      name: "customer",
      expectedCode: "CUSTOMER_NOT_FOUND",
      send: (id: string) =>
        request(app)
          .get(`/api/customers/${id}`)
          .set("Authorization", `Bearer ${token}`),
      lookup: () => vi.spyOn(prisma.customer, "findFirst"),
    },
    {
      name: "vehicle",
      expectedCode: "VEHICLE_NOT_FOUND",
      send: (id: string) =>
        request(app)
          .get(`/api/vehicles/${id}`)
          .set("Authorization", `Bearer ${token}`),
      lookup: () => vi.spyOn(prisma.vehicle, "findFirst"),
    },
    {
      name: "rental",
      expectedCode: "RENTAL_NOT_FOUND",
      send: (id: string) =>
        request(app)
          .get(`/api/rentals/${id}`)
          .set("Authorization", `Bearer ${token}`),
      lookup: () => vi.spyOn(prisma.rental, "findFirst"),
    },
    {
      name: "platform organization",
      expectedCode: "ORGANIZATION_NOT_FOUND",
      send: (id: string) =>
        request(app)
          .patch(`/api/platform/organizations/${id}/status`)
          .set("Authorization", `Bearer ${platformOwnerToken}`)
          .send({ status: "ACTIVE" }),
      lookup: () => vi.spyOn(prisma, "$transaction"),
    },
  ];

  it.each(resources)(
    "rejects malformed $name UUIDs before their domain lookup",
    async ({ send, lookup }) => {
      const resourceLookup = lookup();

      const response = await send("not-a-uuid");

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(resourceLookup).not.toHaveBeenCalled();
    },
  );

  it.each(resources)(
    "passes well-formed unknown $name UUIDs to the normal resource lookup",
    async ({ send, lookup, expectedCode }) => {
      const resourceLookup = lookup();

      const response = await send(unknownUuid);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(expectedCode);
      expect(resourceLookup).toHaveBeenCalled();
    },
  );

  it("accepts a valid JSON request body", async () => {
    const response = await request(app)
      .patch("/api/organizations/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ legalName: "Boundary Rentals LLC" });

    expect(response.status).toBe(200);
    expect(response.body.data.legalName).toBe("Boundary Rentals LLC");
  });

  it("returns MALFORMED_JSON for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MALFORMED_JSON");
  });

  it("returns PAYLOAD_TOO_LARGE for oversized JSON", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ value: "x".repeat(110 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns UNSUPPORTED_MEDIA_TYPE for a non-JSON request body", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "text/plain")
      .send("email=boundary@example.com");

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns a redacted 500 response for unexpected internal errors in production", async () => {
    const errorApp = express();
    errorApp.get("/boom", () => {
      throw new Error("PrismaClientKnownRequestError: relation does not exist");
    });
    errorApp.use(errorHandler);
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await request(errorApp).get("/boom");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      });
      expect(JSON.stringify(response.body)).not.toContain("Prisma");
      expect(JSON.stringify(response.body)).not.toContain(
        "relation does not exist",
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
