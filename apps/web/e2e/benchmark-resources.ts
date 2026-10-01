import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ResourceSnapshot = {
  apiCpuPercent: number | null;
  apiRssKb: number | null;
  postgresCpuPercent: number | null;
  postgresRssKb: number | null;
  activeConnections: number;
};

export async function captureLocalResources(): Promise<ResourceSnapshot> {
  const databaseUrl = process.env.BENCHMARK_DATABASE_URL;
  if (!databaseUrl) throw new Error("BENCHMARK_DATABASE_URL is required.");
  const [processes, connections] = await Promise.all([
    execFileAsync("ps", [
      "-C",
      "node",
      "-C",
      "postgres",
      "-o",
      "comm=,pcpu=,rss=",
    ]),
    execFileAsync("psql", [
      databaseUrl,
      "-t",
      "-A",
      "-c",
      "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()",
    ]),
  ]);
  const rows: string[][] = processes.stdout
    .trim()
    .split("\n")
    .map((row: string) => row.trim().split(/\s+/));
  const node = rows.find(([name]) => name === "node");
  const postgres = rows.find(([name]) => name === "postgres");
  const parse = (row: string[] | undefined, index: number) =>
    row ? Number(row[index]) : null;
  return {
    apiCpuPercent: parse(node, 1),
    apiRssKb: parse(node, 2),
    postgresCpuPercent: parse(postgres, 1),
    postgresRssKb: parse(postgres, 2),
    activeConnections: Number(connections.stdout.trim()),
  };
}
