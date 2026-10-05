import assert from "node:assert/strict";
import test from "node:test";
import * as argon2 from "argon2";
import {
  BenchmarkOwnerPasswordError,
  rotateBenchmarkOwnerPassword,
} from "./benchmark-owner-password";

const owner1 = {
  id: "00000000-0000-4000-8000-000001060001",
  email: "benchmark-owner-1@markab.local",
  organization_id: "00000000-0000-4000-8000-000001010001",
  password_hash: "owner-1-before",
  role: "OWNER",
  deleted_at: null,
  updated_at: new Date("2026-10-01T00:00:00.000Z"),
};
const owner2 = {
  id: "00000000-0000-4000-8000-000002060001",
  email: "benchmark-owner-2@markab.local",
  organization_id: "00000000-0000-4000-8000-000002010001",
  password_hash: "owner-2-before",
  role: "OWNER",
  deleted_at: null,
  updated_at: new Date("2026-10-01T00:00:00.000Z"),
};
const unrelatedOwner = {
  id: "00000000-0000-4000-8000-000009990001",
  email: "owner@example.com",
  organization_id: "00000000-0000-4000-8000-000009990002",
  password_hash: "other-owner-before",
  role: "OWNER",
  deleted_at: null,
  updated_at: new Date("2026-10-01T00:00:00.000Z"),
};

type User = Omit<typeof owner1, "deleted_at"> & { deleted_at: Date | null };
type RefreshToken = { id: string; user_id: string };

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const databaseUrl =
    "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public";

  return {
    NODE_ENV: "benchmark",
    DATABASE_URL: databaseUrl,
    BENCHMARK_DATABASE_URL: databaseUrl,
    BENCHMARK_OWNER_PASSWORD_ROTATION: "true",
    BENCHMARK_OWNER_EMAIL: owner1.email,
    BENCHMARK_PASSWORD: "NewPassword123!",
    ...overrides,
  };
}

function database(users: User[] = [owner1, owner2, unrelatedOwner]) {
  const state = {
    users: users.map((user) => ({ ...user })),
    refreshTokens: [
      { id: "owner-1-token", user_id: owner1.id },
      { id: "owner-2-token", user_id: owner2.id },
      { id: "other-token", user_id: "other-user" },
    ] satisfies RefreshToken[],
    organizations: ["tenant-1", "tenant-2"],
    customers: ["customer-1"],
    vehicles: ["vehicle-1"],
    rentals: ["rental-1"],
  };
  const before = structuredClone(state);

  const transaction = {
    user: {
      async findFirst({ where }: { where: { email: string } }) {
        return state.users.find((user) => user.email === where.email) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { password_hash: string };
      }) {
        const user = state.users.find((candidate) => candidate.id === where.id);
        if (!user) throw new Error("User not found.");
        user.password_hash = data.password_hash;
        user.updated_at = new Date();
        return user;
      },
    },
    refreshToken: {
      async deleteMany({ where }: { where: { user_id: string } }) {
        const before = state.refreshTokens.length;
        state.refreshTokens = state.refreshTokens.filter(
          (token) => token.user_id !== where.user_id,
        );
        return { count: before - state.refreshTokens.length };
      },
    },
  };

  const prisma = {
    async $transaction<T>(
      callback: (client: typeof transaction) => Promise<T>,
    ): Promise<T> {
      return callback(transaction);
    },
  };

  return { state, before, prisma };
}

async function rotate(
  email = owner1.email,
  users: User[] = [owner1, owner2, unrelatedOwner],
) {
  const fixture = database(users);
  await rotateBenchmarkOwnerPassword(
    fixture.prisma,
    environment({ BENCHMARK_OWNER_EMAIL: email }),
  );
  return fixture;
}

test("rotates owner 1 only without invoking benchmark seeding", async () => {
  const fixture = await rotate();
  const changed = fixture.state.users.find((user) => user.id === owner1.id)!;
  const unchanged = fixture.state.users.find((user) => user.id === owner2.id)!;

  assert.equal(await argon2.verify(changed.password_hash, "NewPassword123!"), true);
  assert.deepEqual(unchanged, fixture.before.users[1]);
  assert.deepEqual(
    fixture.state.users.filter((user) => user.id !== owner1.id),
    fixture.before.users.filter((user) => user.id !== owner1.id),
  );
  assert.deepEqual(fixture.state.organizations, fixture.before.organizations);
  assert.deepEqual(fixture.state.customers, fixture.before.customers);
  assert.deepEqual(fixture.state.vehicles, fixture.before.vehicles);
  assert.deepEqual(fixture.state.rentals, fixture.before.rentals);
  assert.deepEqual(fixture.state.refreshTokens, [
    { id: "owner-2-token", user_id: owner2.id },
    { id: "other-token", user_id: "other-user" },
  ]);
});

test("rotates owner 2 only", async () => {
  const fixture = await rotate(owner2.email);
  const changed = fixture.state.users.find((user) => user.id === owner2.id)!;
  const unchanged = fixture.state.users.find((user) => user.id === owner1.id)!;

  assert.equal(await argon2.verify(changed.password_hash, "NewPassword123!"), true);
  assert.deepEqual(unchanged, fixture.before.users[0]);
  assert.deepEqual(fixture.state.refreshTokens, [
    { id: "owner-1-token", user_id: owner1.id },
    { id: "other-token", user_id: "other-user" },
  ]);
});

test("rejects a benchmark email assigned a PLATFORM_OWNER", async () => {
  const platformOwner = { ...owner1, role: "PLATFORM_OWNER" };
  await assert.rejects(
    () => rotate(owner1.email, [platformOwner, owner2]),
    (error: unknown) =>
      error instanceof BenchmarkOwnerPasswordError &&
      error.code === "OWNER_ROLE_INVALID",
  );
});

test("rejects arbitrary owner emails", async () => {
  await assert.rejects(
    () => rotate("owner@example.com"),
    /BENCHMARK_OWNER_EMAIL must name an approved benchmark owner/,
  );
});

test("rejects an owner assigned to the wrong benchmark organization", async () => {
  const misplacedOwner = {
    ...owner1,
    organization_id: owner2.organization_id,
  };
  await assert.rejects(
    () => rotate(owner1.email, [misplacedOwner, owner2]),
    (error: unknown) =>
      error instanceof BenchmarkOwnerPasswordError &&
      error.code === "OWNER_ORGANIZATION_INVALID",
  );
});

test("rejects a missing benchmark owner", async () => {
  await assert.rejects(
    () => rotate(owner1.email, [owner2, unrelatedOwner]),
    (error: unknown) =>
      error instanceof BenchmarkOwnerPasswordError &&
      error.code === "OWNER_NOT_FOUND",
  );
});

test("rejects a soft-deleted benchmark owner", async () => {
  const deletedOwner = { ...owner1, deleted_at: new Date() };
  await assert.rejects(
    () => rotate(owner1.email, [deletedOwner, owner2, unrelatedOwner]),
    (error: unknown) =>
      error instanceof BenchmarkOwnerPasswordError &&
      error.code === "OWNER_NOT_FOUND",
  );
});

test("rejects a production target", async () => {
  const fixture = database();
  const productionUrl =
    "postgresql://benchmark:benchmark@production-db.internal:5432/markab_production?schema=public";

  await assert.rejects(
    () =>
      rotateBenchmarkOwnerPassword(
        fixture.prisma,
        environment({
          DATABASE_URL: productionUrl,
          BENCHMARK_DATABASE_URL: productionUrl,
          ALLOW_STAGING_BENCHMARK_SEED: "true",
          APPROVED_STAGING_BENCHMARK_DATABASE_URL:
            "postgresql://benchmark:benchmark@staging-db.internal:5432/markab_staging_benchmark?schema=public",
        }),
      ),
    /approved local PostgreSQL host/,
  );
});

test("requires explicit password-rotation opt-in", async () => {
  const fixture = database();
  const env = environment();
  delete env.BENCHMARK_OWNER_PASSWORD_ROTATION;

  await assert.rejects(
    () => rotateBenchmarkOwnerPassword(fixture.prisma, env),
    /BENCHMARK_OWNER_PASSWORD_ROTATION=true is required/,
  );
});
