import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

export async function assertPortAvailable(host, port, name) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolve);
    });
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      throw new Error(
        `${name} cannot start because ${host}:${port} is already in use.`,
      );
    }
    throw error;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}

async function fetchWhileRunning(url, child, name) {
  if (child.exitCode !== null) throw new Error(`${name} exited before starting.`);
  return new Promise((resolve, reject) => {
    const onExit = () => reject(new Error(`${name} exited before starting.`));
    child.once("exit", onExit);
    fetch(url)
      .then((response) => resolve(response.ok))
      .catch(() => resolve(false))
      .finally(() => child.removeListener("exit", onExit));
  });
}

export async function waitForHttp(url, child, name) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await fetchWhileRunning(url, child, name)) return;
    await sleep(250);
  }
  throw new Error(`${name} did not start at ${url}.`);
}

export function start(command, args, options = {}) {
  return new Promise((resolveStart, rejectStart) => {
    let child;
    try {
      child = spawn(command, args, { detached: true, ...options });
    } catch (error) {
      rejectStart(error);
      return;
    }

    child.once("error", rejectStart);
    child.once("spawn", () => {
      resolveStart(child);
    });
  });
}

export function stop(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();

  return new Promise((resolveStop, rejectStop) => {
    const cleanup = () => {
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
    };
    const onError = (error) => {
      cleanup();
      rejectStop(error);
    };
    const onExit = () => {
      cleanup();
      resolveStop();
    };

    child.once("error", onError);
    child.once("exit", onExit);

    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      cleanup();
      if (error.code === "ESRCH") resolveStop();
      else rejectStop(error);
    }
  });
}
