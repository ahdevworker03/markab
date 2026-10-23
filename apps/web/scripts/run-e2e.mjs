import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertPortAvailable,
  start,
  stop,
  waitForHttp,
} from "./e2e-processes.mjs";

const rootDirectory = resolve(import.meta.dirname, "../../..");
const webDirectory = resolve(rootDirectory, "apps/web");
const storageDirectory = resolve(webDirectory, ".e2e/storage");
const mailDirectory = resolve(webDirectory, ".e2e/mail");
const apiOrigin = "http://127.0.0.1:3002";
const webOrigin = "http://127.0.0.1:4173";
const databaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55432/markab_e2e?schema=public";
const databaseContainer = "markab-e2e-postgres";
const playwrightArgs = process.argv.slice(2);
if (playwrightArgs[0] === "--") playwrightArgs.shift();
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NODE_ENV: "e2e",
  PORT: "3002",
  JWT_SECRET: "e2e-jwt-secret-not-for-production",
  REFRESH_TOKEN_SECRET: "e2e-refresh-secret-not-for-production",
  CORS_ORIGINS: webOrigin,
  STORAGE_PROVIDER: "local",
  STORAGE_DIR: storageDirectory,
  E2E_MAIL_DIR: mailDirectory,
};

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDirectory,
      env: environment,
      stdio: "inherit",
      ...options,
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else
        rejectRun(
          new Error(`${command} exited with ${signal ?? `code ${code}`}.`),
        );
    });
  });
}

async function waitForDatabase(process) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (process.exitCode !== null)
      throw new Error("E2E PostgreSQL exited before starting.");
    try {
      await run("docker", [
        "exec",
        databaseContainer,
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "markab_e2e",
      ]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("E2E PostgreSQL did not become ready.");
}

await run("pnpm", [
  "--filter",
  "@workspace/db",
  "exec",
  "tsx",
  "-e",
  'import { validateE2eTarget } from "./src/e2e-target.ts"; validateE2eTarget(process.env);',
]);

await Promise.all([
  rm(storageDirectory, { recursive: true, force: true }),
  rm(mailDirectory, { recursive: true, force: true }),
]);
await Promise.all([
  mkdir(storageDirectory, { recursive: true }),
  mkdir(mailDirectory, { recursive: true }),
]);

await run("pnpm", ["--filter", "@workspace/api-server", "run", "build"]);
await run("pnpm", ["--filter", "@workspace/web", "run", "build"], {
  env: { ...environment, VITE_API_URL: apiOrigin },
});

let api;
let web;
let database;

try {
  database = await start(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      databaseContainer,
      "--publish",
      "127.0.0.1:55432:5432",
      "--env",
      "POSTGRES_USER=postgres",
      "--env",
      "POSTGRES_PASSWORD=postgres",
      "--env",
      "POSTGRES_DB=markab_e2e",
      "postgres:16-alpine",
    ],
    { cwd: rootDirectory, stdio: "inherit" },
  );
  await waitForDatabase(database);
  await run("pnpm", ["--filter", "@workspace/db", "run", "db:migrate:deploy"]);
  await run("pnpm", ["--filter", "@workspace/db", "run", "db:seed:e2e"]);
  await assertPortAvailable("127.0.0.1", 3002, "E2E API");
  api = await start(
    "pnpm",
    ["--filter", "@workspace/api-server", "run", "start"],
    { cwd: rootDirectory, env: environment, stdio: "inherit" },
  );
  await assertPortAvailable("127.0.0.1", 4173, "E2E web preview");
  web = await start(
    "pnpm",
    [
      "--filter",
      "@workspace/web",
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    { cwd: rootDirectory, env: environment, stdio: "inherit" },
  );
  await Promise.all([
    waitForHttp(`${apiOrigin}/api/healthz`, api, "E2E API"),
    waitForHttp(webOrigin, web, "E2E web preview"),
  ]);
  await run("pnpm", [
    "--filter",
    "@workspace/web",
    "exec",
    "playwright",
    "test",
    "--config",
    "playwright.e2e.config.ts",
    ...playwrightArgs,
  ]);
} finally {
  await Promise.all([stop(web), stop(api), stop(database)]);
}
