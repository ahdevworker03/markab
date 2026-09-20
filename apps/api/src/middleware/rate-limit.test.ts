import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("rejects the request after the configured trusted-IP limit", async () => {
    const app = express();
    app.set("trust proxy", false);
    app.use(createRateLimiter({ limit: 2, windowMs: 60_000 }));
    app.post("/", (_req, res) => res.sendStatus(204));

    await request(app).post("/").expect(204);
    await request(app).post("/").expect(204);
    const response = await request(app).post("/");

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    });
  });
});
