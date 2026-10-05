import * as argon2 from "argon2";
import { validateBenchmarkTarget } from "./benchmark-target";

const benchmarkOwners = {
  "benchmark-owner-1@markab.local": "00000000-0000-4000-8000-000001010001",
  "benchmark-owner-2@markab.local": "00000000-0000-4000-8000-000002010001",
} as const;

type BenchmarkOwnerEmail = keyof typeof benchmarkOwners;
type BenchmarkOwnerPasswordErrorCode =
  | "OWNER_NOT_FOUND"
  | "OWNER_ROLE_INVALID"
  | "OWNER_ORGANIZATION_INVALID";

export class BenchmarkOwnerPasswordError extends Error {
  constructor(
    readonly code: BenchmarkOwnerPasswordErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type PasswordRotationTransaction = {
  user: {
    findFirst: (input: {
      where: { email: string };
      select: {
        id: true;
        organization_id: true;
        role: true;
        deleted_at: true;
      };
    }) => Promise<
      | {
          id: string;
          organization_id: string;
          role: string;
          deleted_at: Date | null;
        }
      | null
    >;
    update: (input: {
      where: { id: string };
      data: { password_hash: string };
    }) => Promise<unknown>;
  };
  refreshToken: {
    deleteMany: (input: { where: { user_id: string } }) => Promise<unknown>;
  };
};

type PasswordRotationDatabase = {
  $transaction: <T>(
    callback: (transaction: PasswordRotationTransaction) => Promise<T>,
  ) => Promise<T>;
};

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];

  if (!value) throw new Error(`${name} is required.`);

  return value;
}

function ownerEmail(environment: NodeJS.ProcessEnv): BenchmarkOwnerEmail {
  const email = required(environment, "BENCHMARK_OWNER_EMAIL");

  if (!(email in benchmarkOwners)) {
    throw new Error("BENCHMARK_OWNER_EMAIL must name an approved benchmark owner.");
  }

  return email as BenchmarkOwnerEmail;
}

export async function rotateBenchmarkOwnerPassword(
  database: PasswordRotationDatabase,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (environment.BENCHMARK_OWNER_PASSWORD_ROTATION !== "true") {
    throw new Error("BENCHMARK_OWNER_PASSWORD_ROTATION=true is required.");
  }

  validateBenchmarkTarget(environment);
  const email = ownerEmail(environment);
  const passwordHash = await argon2.hash(
    required(environment, "BENCHMARK_PASSWORD"),
  );

  await database.$transaction(async (transaction) => {
    const owner = await transaction.user.findFirst({
      where: { email },
      select: {
        id: true,
        organization_id: true,
        role: true,
        deleted_at: true,
      },
    });

    if (!owner || owner.deleted_at) {
      throw new BenchmarkOwnerPasswordError(
        "OWNER_NOT_FOUND",
        "Approved benchmark owner was not found or is inactive.",
      );
    }
    if (owner.role !== "OWNER") {
      throw new BenchmarkOwnerPasswordError(
        "OWNER_ROLE_INVALID",
        "Approved benchmark owner does not have the OWNER role.",
      );
    }
    if (owner.organization_id !== benchmarkOwners[email]) {
      throw new BenchmarkOwnerPasswordError(
        "OWNER_ORGANIZATION_INVALID",
        "Benchmark owner does not belong to its expected organization.",
      );
    }

    await transaction.user.update({
      where: { id: owner.id },
      data: { password_hash: passwordHash },
    });
    await transaction.refreshToken.deleteMany({ where: { user_id: owner.id } });
  });
}
