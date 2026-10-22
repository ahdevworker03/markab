import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { psqlDatabaseUrl } from "./benchmark-database-url";

const execFileAsync = promisify(execFile);
const outputPath = resolve(
  import.meta.dirname,
  "../test-results/benchmark/query-plans.json",
);

const queries = {
  customersSearch: `SELECT id FROM "Customer" WHERE organization_id = current_setting('app.organization_id')::uuid AND deleted_at IS NULL AND (first_name ILIKE '%Customer1%' OR last_name ILIKE '%Customer1%' OR national_id ILIKE '%Customer1%' OR license_number ILIKE '%Customer1%' OR phone ILIKE '%Customer1%')`,
  vehiclesSearch: `SELECT id FROM "Vehicle" WHERE organization_id = current_setting('app.organization_id')::uuid AND deleted_at IS NULL AND (make ILIKE '%Pilot%' OR model ILIKE '%Pilot%' OR plate_number ILIKE '%Pilot%')`,
  rentalsList: `SELECT id FROM "Rental" WHERE organization_id = current_setting('app.organization_id')::uuid AND deleted_at IS NULL`,
} as const;

function databaseUrl(): string {
  const value = process.env.BENCHMARK_DATABASE_URL;
  if (!value) throw new Error("BENCHMARK_DATABASE_URL is required.");
  const url = new URL(value);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
    !/^markab_benchmark(?:_[a-z0-9_]+)?$/.test(url.pathname.slice(1))
  ) {
    throw new Error(
      "Query plans require an approved local markab_benchmark database.",
    );
  }
  return value;
}

async function main(): Promise<void> {
  const url = databaseUrl();
  const organizationId = process.env.BENCHMARK_ORGANIZATION_ID;
  if (!organizationId)
    throw new Error("BENCHMARK_ORGANIZATION_ID is required.");
  const plans = await Promise.all(
    Object.entries(queries).map(async ([name, query]) => {
      const sql = `BEGIN READ ONLY; SET LOCAL app.organization_id = '${organizationId}'; EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}; ROLLBACK;`;
      const { stdout } = await execFileAsync("psql", [
        psqlDatabaseUrl(url),
        "-q",
        "-t",
        "-A",
        "-c",
        sql,
      ]);
      return { name, plan: JSON.parse(stdout.trim()) };
    }),
  );
  await writeFile(outputPath, `${JSON.stringify({ plans }, null, 2)}\n`);
}

void main();
