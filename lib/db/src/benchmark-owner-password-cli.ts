import { fileURLToPath } from "node:url";
import { validateBenchmarkTarget } from "./benchmark-target";
import {
  BenchmarkOwnerPasswordError,
  rotateBenchmarkOwnerPassword,
} from "./benchmark-owner-password";

type Diagnostic = {
  code:
    | "TARGET_VALIDATION_FAILED"
    | "OWNER_NOT_FOUND"
    | "OWNER_ROLE_INVALID"
    | "OWNER_ORGANIZATION_INVALID"
    | "DATABASE_OPERATION_FAILED"
    | "UNEXPECTED_ERROR";
  message?: string;
};

const safeValidationMessage = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) return undefined;

  const message = error.message;
  return /^(Benchmark mode requires [A-Z_]+\.|BENCHMARK_(OWNER_EMAIL|PASSWORD) is required\.|BENCHMARK_OWNER_PASSWORD_ROTATION=true is required\.|BENCHMARK_OWNER_EMAIL must name an approved benchmark owner\.|BENCHMARK_DATABASE_URL must use an approved local PostgreSQL host\.|DATABASE_URL must use an approved local PostgreSQL host\.|BENCHMARK_DATABASE_URL must name markab_benchmark or markab_benchmark_<suffix>\.|DATABASE_URL must name markab_benchmark or markab_benchmark_<suffix>\.|DATABASE_URL must equal BENCHMARK_DATABASE_URL in benchmark mode\.|APPROVED_STAGING_BENCHMARK_DATABASE_URL must use PostgreSQL\.|BENCHMARK_PROFILE must be full-pilot or target-1000\.)$/.test(
    message,
  )
    ? message
    : undefined;
};

function diagnosticForTargetValidationFailure(error: unknown): Diagnostic {
  return {
    code: "TARGET_VALIDATION_FAILED",
    message: safeValidationMessage(error),
  };
}

function diagnosticForRotationFailure(error: unknown): Diagnostic {
  if (error instanceof BenchmarkOwnerPasswordError) {
    return { code: error.code, message: error.message };
  }

  const message = safeValidationMessage(error);
  if (message) return { code: "TARGET_VALIDATION_FAILED", message };

  return { code: "DATABASE_OPERATION_FAILED" };
}

function report(diagnostic: Diagnostic): void {
  console.error(diagnostic.code);
  if (diagnostic.message) console.error(diagnostic.message);
  process.exitCode = 1;
}

async function run(): Promise<void> {
  try {
    validateBenchmarkTarget(process.env);
  } catch (error) {
    report(diagnosticForTargetValidationFailure(error));
    return;
  }

  let prisma: typeof import("./index").default;
  try {
    ({ default: prisma } = await import("./index"));
  } catch {
    report({ code: "DATABASE_OPERATION_FAILED" });
    return;
  }

  let failure: Diagnostic | undefined;
  try {
    await rotateBenchmarkOwnerPassword(prisma, process.env);
  } catch (error) {
    failure = diagnosticForRotationFailure(error);
  }
  try {
    await prisma.$disconnect();
  } catch {
    failure ??= { code: "DATABASE_OPERATION_FAILED" };
  }

  if (failure) {
    report(failure);
    return;
  }

  console.log("Benchmark owner password rotated.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(() => report({ code: "UNEXPECTED_ERROR" }));
}

export { diagnosticForRotationFailure, diagnosticForTargetValidationFailure };
