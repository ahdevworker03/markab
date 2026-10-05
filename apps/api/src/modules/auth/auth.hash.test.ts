import { describe, expect, it } from "vitest";
import { rotateBenchmarkOwnerPassword } from "../../../../../lib/db/src/benchmark-owner-password";
import { verifyPassword } from "./auth.hash";

const email = "benchmark-owner-1@markab.local";
const organizationId = "00000000-0000-4000-8000-000001010001";
const password = "BenchmarkPassword123!";
const databaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public";

describe("benchmark owner password hashing", () => {
  it("creates a hash normal authentication accepts and rejects wrong passwords", async () => {
    let passwordHash = "";

    await rotateBenchmarkOwnerPassword(
      {
        async $transaction(callback) {
          return callback({
            user: {
              async findFirst() {
                return {
                  id: "00000000-0000-4000-8000-000001060001",
                  organization_id: organizationId,
                  role: "OWNER",
                  deleted_at: null,
                };
              },
              async update({ data }) {
                passwordHash = data.password_hash;
              },
            },
            refreshToken: {
              async deleteMany() {},
            },
          });
        },
      },
      {
        NODE_ENV: "benchmark",
        DATABASE_URL: databaseUrl,
        BENCHMARK_DATABASE_URL: databaseUrl,
        BENCHMARK_OWNER_PASSWORD_ROTATION: "true",
        BENCHMARK_OWNER_EMAIL: email,
        BENCHMARK_PASSWORD: password,
      },
    );

    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword123!", passwordHash)).resolves.toBe(false);
  });
});
