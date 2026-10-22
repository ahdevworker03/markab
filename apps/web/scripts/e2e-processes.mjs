import { spawn } from "node:child_process";

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
