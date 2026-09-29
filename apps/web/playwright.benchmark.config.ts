import { defineConfig } from "@playwright/test";
import { validateBenchmarkTarget } from "../../lib/db/src/benchmark-target.ts";

const benchmarkEnvironment = {
  ...process.env,
  NODE_ENV: "benchmark",
  PORT: "3001",
  CORS_ORIGINS: "http://127.0.0.1:4174",
  STORAGE_PROVIDER: "local",
  STORAGE_DIR: "./.benchmark-storage",
};

validateBenchmarkTarget(benchmarkEnvironment);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "benchmark.spec.ts",
  outputDir: "./test-results/playwright-benchmark",
  workers: 1,
  timeout: 30 * 60_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  webServer: [
    {
      command:
        "rm -rf .benchmark-storage && pnpm --filter @workspace/db run db:seed:benchmark && pnpm run build && pnpm run start",
      cwd: "../api",
      env: benchmarkEnvironment,
      url: "http://127.0.0.1:3001/api/healthz",
      reuseExistingServer: false,
    },
    {
      command: "pnpm run build && pnpm run serve",
      env: {
        ...benchmarkEnvironment,
        PORT: "4174",
        VITE_API_URL: "http://127.0.0.1:3001",
      },
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
    },
  ],
});
