import assert from "node:assert/strict";
import test from "node:test";
import { seedE2e } from "./e2e-seed";

const databaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:5432/markab_e2e?schema=public";

test("seeds the deterministic E2E owner", async () => {
  const previousEnvironment = { ...process.env };
  const calls: Array<{ model: string; data: Record<string, unknown> }> = [];
  const prisma = {
    $transaction: async (
      callback: (transaction: {
        organization: { upsert: (input: { create: Record<string, unknown> }) => Promise<void> };
        user: { upsert: (input: { create: Record<string, unknown> }) => Promise<void> };
      }) => Promise<void>,
    ) =>
      callback({
        organization: {
          upsert: async ({ create }) => {
            calls.push({ model: "organization", data: create });
          },
        },
        user: {
          upsert: async ({ create }) => {
            calls.push({ model: "user", data: create });
          },
        },
      }),
  };

  try {
    process.env.NODE_ENV = "e2e";
    process.env.DATABASE_URL = databaseUrl;

    const result = await seedE2e(prisma as never);

    assert.equal(result.ownerEmail, "owner-e2e@markab.local");
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.data.email, "owner-e2e@markab.local");
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, previousEnvironment);
  }
});
