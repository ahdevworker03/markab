import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("environment configuration", () => {
  it("accepts the local benchmark configuration", () => {
    expect(
      loadEnv({
        NODE_ENV: "benchmark",
        PORT: "3001",
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark",
        JWT_SECRET: "benchmark-jwt-secret-at-least-32-characters",
        REFRESH_TOKEN_SECRET: "benchmark-refresh-secret-at-least-32-chars",
        CORS_ORIGINS: "http://127.0.0.1:4174",
        STORAGE_PROVIDER: "local",
      }),
    ).toMatchObject({ NODE_ENV: "benchmark", PORT: 3001 });
  });

  it("keeps production storage validation", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "production",
        PORT: "3001",
        DATABASE_URL: "postgresql://postgres:postgres@db.internal:5432/markab",
        JWT_SECRET: "production-jwt-secret-at-least-32-characters",
        REFRESH_TOKEN_SECRET: "production-refresh-secret-at-least-32-chars",
        CORS_ORIGINS: "https://app.markab.test",
        STORAGE_PROVIDER: "local",
      }),
    ).toThrow("STORAGE_PROVIDER must be r2 in production.");
  });
});
