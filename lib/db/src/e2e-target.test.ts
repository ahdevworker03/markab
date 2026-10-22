import assert from "node:assert/strict";
import test from "node:test";
import { validateE2eTarget } from "./e2e-target";

const target =
  "postgresql://postgres:postgres@127.0.0.1:5432/markab_e2e?schema=public";

test("accepts the local markab_e2e database in e2e mode", () => {
  assert.deepEqual(
    validateE2eTarget({ NODE_ENV: "e2e", DATABASE_URL: target }),
    { databaseUrl: target },
  );
});

test("rejects a development database", () => {
  assert.throws(() =>
    validateE2eTarget({
      NODE_ENV: "e2e",
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/markab_development?schema=public",
    }),
  );
});

test("rejects a remote markab_e2e database", () => {
  assert.throws(() =>
    validateE2eTarget({
      NODE_ENV: "e2e",
      DATABASE_URL: "postgresql://postgres:postgres@db.example/markab_e2e",
    }),
  );
});

test("rejects non-e2e mode", () => {
  assert.throws(() =>
    validateE2eTarget({ NODE_ENV: "development", DATABASE_URL: target }),
  );
});
