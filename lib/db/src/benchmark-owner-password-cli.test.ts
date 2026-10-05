import assert from "node:assert/strict";
import test from "node:test";
import { BenchmarkOwnerPasswordError } from "./benchmark-owner-password";
import {
  diagnosticForRotationFailure,
  diagnosticForTargetValidationFailure,
} from "./benchmark-owner-password-cli";

test("reports safe target validation details", () => {
  assert.deepEqual(
    diagnosticForTargetValidationFailure(
      new Error("Benchmark mode requires BENCHMARK_PASSWORD."),
    ),
    {
      code: "TARGET_VALIDATION_FAILED",
      message: "Benchmark mode requires BENCHMARK_PASSWORD.",
    },
  );
});

test("reports benchmark owner validation failures by classification", () => {
  assert.deepEqual(
    diagnosticForRotationFailure(
      new BenchmarkOwnerPasswordError(
        "OWNER_ORGANIZATION_INVALID",
        "Benchmark owner does not belong to its expected organization.",
      ),
    ),
    {
      code: "OWNER_ORGANIZATION_INVALID",
      message: "Benchmark owner does not belong to its expected organization.",
    },
  );
});

test("does not expose unexpected database errors", () => {
  assert.deepEqual(
    diagnosticForRotationFailure(
      new Error("postgresql://user:password@db.internal:5432/markab"),
    ),
    { code: "DATABASE_OPERATION_FAILED" },
  );
});
