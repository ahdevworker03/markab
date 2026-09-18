import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const productionEnv = {
  PORT: "3000",
  NODE_ENV: "production",
  LOG_LEVEL: "info",
  CORS_ORIGINS: "https://app.example.com",
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
      RESEND_FROM: "Markab <security@example.com>",
      PASSWORD_RESET_FRONTEND_ORIGIN: "https://app.example.com",
      PASSWORD_RESET_FRONTEND_PATH: "/reset-password",
    });

    expect(env.PASSWORD_RESET_EMAIL?.resetUrl.toString()).toBe(
      "https://app.example.com/reset-password",
    );
  });

  it("rejects a reset path that URL parsing would redirect off-origin", () => {
    expect(() =>
      loadEnv({
        ...productionEnv,
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM: "Markab <security@example.com>",
        PASSWORD_RESET_FRONTEND_ORIGIN: "https://app.example.com",
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
