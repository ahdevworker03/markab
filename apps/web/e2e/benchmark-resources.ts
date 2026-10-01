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
  const [apiListener, connections] = await Promise.all([
    execFileAsync("lsof", ["-t", "-iTCP:3001", "-sTCP:LISTEN"]),
    execFileAsync("psql", [
      databaseUrl,
      "-t",
      "-A",
      "-c",
      "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()",
    ]),
  ]);
  const backendPids = (
    await execFileAsync("psql", [
      databaseUrl,
      "-t",
      "-A",
      "-c",
      "SELECT array_to_string(array_agg(pid), ',') FROM pg_stat_activity WHERE datname = current_database()",
    ])
  ).stdout.trim();
  const pids = [apiListener.stdout.trim(), backendPids]
    .filter(Boolean)
    .join(",");
  const processes = pids
    ? await execFileAsync("ps", ["-p", pids, "-o", "pid=,comm=,pcpu=,rss="])
    : { stdout: "" };
  const rows: string[][] = processes.stdout
    .trim()
    .split("\n")
    .map((row: string) => row.trim().split(/\s+/));
  const apiPid = apiListener.stdout.trim();
  const node = rows.find(([pid]) => pid === apiPid);
  const postgres = rows.filter(([, name]) => name === "postgres");
  const parse = (row: string[] | undefined, index: number) =>
    row ? Number(row[index]) : null;
  return {
    apiCpuPercent: parse(node, 2),
    apiRssKb: parse(node, 3),
    postgresCpuPercent: postgres.length
      ? postgres.reduce((total, row) => total + Number(row[2]), 0)
      : null,
    postgresRssKb: postgres.length
      ? postgres.reduce((total, row) => total + Number(row[3]), 0)
      : null,
    activeConnections: Number(connections.stdout.trim()),
  };
}
