import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  webServer: {
    command: "pnpm run build && PORT=4174 pnpm run serve",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
