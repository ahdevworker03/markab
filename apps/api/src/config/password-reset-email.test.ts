import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const productionEnv = {
  PORT: "3000",
  NODE_ENV: "production",
  LOG_LEVEL: "info",
  CORS_ORIGINS: "https://app.markab.test",
  DATABASE_URL: "postgresql://user:password@db.internal:5432/markab",
  JWT_SECRET: "jwt-secret-that-is-long-enough-for-production-use",
  REFRESH_TOKEN_SECRET: "refresh-secret-that-is-long-enough-for-production-use",
  STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key-id",
  R2_SECRET_ACCESS_KEY: "secret-access-key",
  R2_BUCKET: "markab-private",
};

describe("password-reset email configuration", () => {
  it("requires complete Resend configuration in production without exposing secrets", () => {
    const apiKey = "re_secret_must_not_appear";

    expect(() => loadEnv({ ...productionEnv, RESEND_API_KEY: apiKey })).toThrow(
      "Resend password-reset email configuration must be complete.",
    );

    try {
      loadEnv({ ...productionEnv, RESEND_API_KEY: apiKey });
    } catch (error) {
      expect((error as Error).message).not.toContain(apiKey);
    }
  });

  it("builds the configured HTTPS reset URL", () => {
    const env = loadEnv({
      ...productionEnv,
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM: "Markab <security@markab.test>",
      PASSWORD_RESET_FRONTEND_ORIGIN: "https://app.markab.test",
      PASSWORD_RESET_FRONTEND_PATH: "/password-reset",
    });

    expect(env.PASSWORD_RESET_EMAIL?.resetUrl.toString()).toBe(
      "https://app.markab.test/password-reset",
    );
  });

  it("rejects a reset path that URL parsing would redirect off-origin", () => {
    expect(() =>
      loadEnv({
        ...productionEnv,
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM: "Markab <security@markab.test>",
        PASSWORD_RESET_FRONTEND_ORIGIN: "https://app.markab.test",
        PASSWORD_RESET_FRONTEND_PATH: "/\\evil.example",
      }),
    ).toThrow(
      "PASSWORD_RESET_FRONTEND_PATH must remain on the configured origin.",
    );
  });

  it("keeps the test delivery sink free of Resend configuration", () => {
    expect(() => loadEnv({ ...productionEnv, NODE_ENV: "test" })).not.toThrow();
  });
});
