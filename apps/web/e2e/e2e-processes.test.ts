import { expect, test } from "vitest";
import { start, stop } from "../scripts/e2e-processes.mjs";

test("waits for an owned process to exit after SIGTERM", async () => {
  const child = await start(process.execPath, [
    "-e",
    'process.on("SIGTERM", () => setTimeout(() => process.exit(0), 75)); console.log("ready"); setInterval(() => {}, 1_000);',
  ]);
  const stdout = child.stdout;
  if (!stdout) throw new Error("Test process has no stdout.");
  await new Promise((resolveReady) => stdout.once("data", resolveReady));

  const startedAt = Date.now();
  await stop(child);

  expect(child.exitCode).toBe(0);
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(50);
});

test("rejects a failed process launch", async () => {
  await expect(start("markab-e2e-missing-command", [])).rejects.toMatchObject({
    code: "ENOENT",
  });
});
