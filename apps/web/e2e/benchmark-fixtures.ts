import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { BenchmarkHttpError } from "./benchmark-results";
import type { BenchmarkSeedProfile } from "../../../lib/db/src/benchmark-target";
import type {
  Browser,
  BrowserContext,
  APIRequestContext,
  Page,
  CDPSession,
} from "@playwright/test";

const execFileAsync = promisify(execFile);
const rootDirectory = resolve(import.meta.dirname, "../../..");
const apiOrigin = "http://127.0.0.1:3001";
export const benchmarkDatasetCounts = {
  organizations: 2,
  vehicles: 100,
  customers: 2_000,
  rentals: 1_000,
  payments: 666,
};

export const mobileProfile = {
  name: "mid-range-mobile-4g",
  viewportWidth: 393,
  viewportHeight: 852,
  deviceScaleFactor: 2,
  cpuThrottlingRate: 4,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
  latency: 150,
  connectionType: "cellular4g" as const,
};

export async function setMobileNetworkOffline(
  session: CDPSession,
  offline: boolean,
): Promise<void> {
  await session.send("Network.emulateNetworkConditions", {
    offline,
    latency: mobileProfile.latency,
    downloadThroughput: mobileProfile.downloadThroughput,
    uploadThroughput: mobileProfile.uploadThroughput,
    connectionType: mobileProfile.connectionType,
  });
}

function benchmarkPassword(): string {
  const password = process.env.BENCHMARK_PASSWORD;
  if (!password)
    throw new Error("BENCHMARK_PASSWORD is required for benchmark login.");
  return password;
}

export async function login(
  request: APIRequestContext,
  owner = 1,
): Promise<string> {
  const response = await request.post(`${apiOrigin}/api/auth/login`, {
    data: {
      email: `benchmark-owner-${owner}@markab.local`,
      password: benchmarkPassword(),
    },
  });
  if (!response.ok()) {
    throw new Error(`Benchmark login failed with ${response.status()}.`);
  }
  const body = (await response.json()) as { data?: { accessToken?: string } };
  if (!body.data?.accessToken)
    throw new Error("Benchmark login did not return an access token.");
  return body.data.accessToken;
}

export async function requestJson(
  request: APIRequestContext,
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  data?: unknown,
): Promise<unknown> {
  const response = await request.fetch(`${apiOrigin}/api${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok())
    throw new Error(`${method} ${path} failed with ${response.status()}.`);
  return response.json();
}

export async function requestJsonEvidence(
  request: APIRequestContext,
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  data?: unknown,
): Promise<{ body: unknown; status: number; responseBytes: number }> {
  const response = await request.fetch(`${apiOrigin}/api${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  const responseBody = await response.body();
  if (!response.ok())
    throw new BenchmarkHttpError(
      `${method} ${path} failed with ${response.status()}.`,
      {
        status: response.status(),
        error: `${method} ${path} failed with ${response.status()}.`,
        responseBytes: responseBody.byteLength,
      },
    );
  return {
    body: JSON.parse(responseBody.toString()) as unknown,
    status: response.status(),
    responseBytes: responseBody.byteLength,
  };
}

export async function resetBenchmark(
  profile: BenchmarkSeedProfile = "full-pilot",
): Promise<void> {
  try {
    await execFileAsync(
      "pnpm",
      ["--filter", "@workspace/db", "run", "db:seed:benchmark"],
      {
        cwd: rootDirectory,
        env: { ...process.env, BENCHMARK_PROFILE: profile },
      },
    );
  } catch (error) {
    throw new Error("Guarded benchmark reset failed.", { cause: error });
  }
}

export async function syncChangeCount(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  let cursor: string | null = null;
  let count = 0;

  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const body = (await requestJson(request, token, `/sync/pull?${query}`)) as {
      changes: unknown[];
      next_cursor: string | null;
    };
    count += body.changes.length;
    cursor = body.next_cursor;
  } while (cursor);

  return count;
}

export async function createMobileProfile(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  session: CDPSession;
  profile: Record<string, string | number | boolean>;
}> {
  const context = await browser.newContext({
    viewport: {
      width: mobileProfile.viewportWidth,
      height: mobileProfile.viewportHeight,
    },
    deviceScaleFactor: mobileProfile.deviceScaleFactor,
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await setMobileNetworkOffline(session, false);
  await session.send("Emulation.setCPUThrottlingRate", {
    rate: mobileProfile.cpuThrottlingRate,
  });

  return {
    context,
    page,
    session,
    profile: { ...mobileProfile, browserVersion: browser.version() },
  };
}
