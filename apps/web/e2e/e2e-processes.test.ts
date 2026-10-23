import { createServer } from "node:net";
import { expect, test } from "vitest";
import {
  assertPortAvailable,
  start,
  stop,
  waitForHttp,
} from "../scripts/e2e-processes.mjs";

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

test("rejects an occupied runner port without stopping its owner", async () => {
  const server = createServer().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port.");

  await expect(assertPortAvailable("127.0.0.1", address.port, "E2E web preview")).rejects.toThrow(
    `E2E web preview cannot start because 127.0.0.1:${address.port} is already in use.`,
  );
  expect(server.listening).toBe(true);
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("rejects when an owned process exits before its HTTP endpoint is ready", async () => {
  const child = await start(process.execPath, ["-e", "process.exit(1)"]);

  await expect(waitForHttp("http://127.0.0.1:1", child, "E2E web preview")).rejects.toThrow(
    "E2E web preview exited before starting.",
  );
});
