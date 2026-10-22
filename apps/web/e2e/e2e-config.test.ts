import { expect, test } from "vitest";
import config from "../playwright.e2e.config";

test("matches only dedicated E2E specs", () => {
  expect(config.testMatch).toBe("**/*.e2e.ts");
});
