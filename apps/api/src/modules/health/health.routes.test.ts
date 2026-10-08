import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma } from "../../database";
import app from "../../app";

describe("health routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports readiness when dependencies are usable", async () => {
    const response = await request(app).get("/api/readyz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("does not expose dependency failures through readiness", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(
      new Error("postgres://secret@db.internal:5432/markab unavailable"),
    );

    const response = await request(app).get("/api/readyz");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
  });
});
