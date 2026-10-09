import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "./app";

const TUNNEL_ORIGIN = "https://x1gtk7w1-5173.uks1.devtunnels.ms";
const LOCAL_ORIGIN = "http://localhost:5173";

describe("CORS", () => {
  it.each([TUNNEL_ORIGIN, LOCAL_ORIGIN])(
    "allows %s to preflight auth requests",
    async (origin) => {
      const response = await request(app)
        .options("/api/auth/login")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type, Authorization");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Content-Type",
      );
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Authorization",
      );
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      expect(response.headers["access-control-max-age"]).toBe("600");
    },
  );

  it("allows a tunneled login request to reach the auth route", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", TUNNEL_ORIGIN)
      .set("Authorization", "Bearer test-token")
      .send({});

    expect(response.status).toBe(422);
    expect(response.headers["access-control-allow-origin"]).toBe(TUNNEL_ORIGIN);
  });

  it("does not allow unconfigured origins", async () => {
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://untrusted.devtunnels.ms")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sets restrictive security headers without wildcard credentialed CORS", async () => {
    const response = await request(app).get("/api/healthz");

    expect(response.headers["content-security-policy"]).not.toContain(
      "unsafe-eval",
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns a validated request ID and replaces an invalid client value", async () => {
    const acceptedRequestId = "5ad4e121-5e94-4dd4-a02b-8aa9b6f5ddd1";
    const accepted = await request(app)
      .get("/api/healthz")
      .set("X-Request-Id", acceptedRequestId);
    const replaced = await request(app)
      .get("/api/healthz")
      .set("X-Request-Id", "forged-log-entry");

    expect(accepted.headers["x-request-id"]).toBe(acceptedRequestId);
    expect(replaced.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(replaced.headers["x-request-id"]).not.toBe("forged-log-entry");
  });
});
