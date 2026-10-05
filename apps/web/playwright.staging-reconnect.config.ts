import { defineConfig } from "@playwright/test";
import {
  STAGING_WEB_ORIGIN,
  readStagingReconnectConfig,
} from "./e2e/staging-reconnect-guard.ts";

// Fails closed before any test starts when opt-in or inputs are missing.
readStagingReconnectConfig(process.env);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "staging-reconnect.bench.ts",
  outputDir: "./test-results/playwright-staging-reconnect",
  globalTeardown: "./e2e/staging-reconnect-teardown.ts",
  workers: 1,
  retries: 0,
  timeout: 90 * 60_000,
  // List output only: traces, screenshots, videos, and HTML reports could
  // capture typed credentials.
  reporter: "list",
  use: {
    baseURL: STAGING_WEB_ORIGIN,
    browserName: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
});
