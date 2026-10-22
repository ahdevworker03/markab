import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "../../config/env";

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

let mailDir: string | undefined;

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();

  if (mailDir) {
    await rm(mailDir, { recursive: true, force: true });
    mailDir = undefined;
  }
});

describe("E2E password-reset delivery", () => {
  it("rejects the E2E mailbox outside E2E mode", () => {
    expect(() =>
      loadEnv({ ...productionEnv, E2E_MAIL_DIR: "/tmp/markab-e2e-mail" }),
    ).toThrow("E2E_MAIL_DIR is only available when NODE_ENV=e2e.");
  });

  it("writes the recipient, token, and reset URL to the E2E mailbox", async () => {
    mailDir = await mkdtemp(join(tmpdir(), "markab-e2e-mail-"));
    vi.stubEnv("NODE_ENV", "e2e");
    vi.stubEnv("PORT", "4001");
    vi.stubEnv("E2E_MAIL_DIR", mailDir);
    vi.resetModules();

    const { deliverPasswordReset } = await import("./password-reset.delivery");
    await deliverPasswordReset("owner-e2e@markab.local", "one-time-token");

    const record = JSON.parse(
      await readFile(join(mailDir, "password-reset.jsonl"), "utf8"),
    ) as { email: string; token: string; resetUrl: string };
    expect(record).toEqual({
      email: "owner-e2e@markab.local",
      token: "one-time-token",
      resetUrl: "http://127.0.0.1:4173/password-reset?token=one-time-token",
    });
  });
});
