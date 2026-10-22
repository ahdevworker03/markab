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
        customer: { upsert: (input: { create: Record<string, unknown> }) => Promise<void> };
        vehicle: { upsert: (input: { create: Record<string, unknown> }) => Promise<void> };
        rental: { upsert: (input: { create: Record<string, unknown> }) => Promise<void> };
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
        customer: {
          upsert: async ({ create }) => {
            calls.push({ model: "customer", data: create });
          },
        },
        vehicle: {
          upsert: async ({ create }) => {
            calls.push({ model: "vehicle", data: create });
          },
        },
        rental: {
          upsert: async ({ create }) => {
            calls.push({ model: "rental", data: create });
          },
        },
      }),
  };

  try {
    process.env.NODE_ENV = "e2e";
    process.env.DATABASE_URL = databaseUrl;

    const result = await seedE2e(prisma as never);

    assert.equal(result.ownerEmail, "owner-e2e@markab.local");
    assert.equal(calls.length, 10);
    assert.equal(calls[1]!.data.email, "owner-e2e@markab.local");
    assert.deepEqual(
      calls.filter((call) => call.model === "rental").map((call) => call.data.status),
      ["RESERVED", "RESERVED", "RESERVED"],
    );
    assert.deepEqual(
      calls.filter((call) => call.model === "vehicle").map((call) => call.data.status),
      ["AVAILABLE", "RESERVED", "RESERVED", "RESERVED"],
    );
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, previousEnvironment);
  }
});
