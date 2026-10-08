import type { Server } from "node:http";
import { logger } from "./config";
import { disconnect } from "./database/prisma";

const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;

type ShutdownServer = Pick<Server, "close" | "closeAllConnections">;

export function createShutdownHandler(
  server: ShutdownServer,
  exit: (code: number) => void = process.exit,
  drainTimeoutMs = DEFAULT_DRAIN_TIMEOUT_MS,
): (signal: NodeJS.Signals) => void {
  let shuttingDown = false;

  return (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down server");

    const forceExit = setTimeout(() => {
      logger.error({ signal }, "Server did not drain before shutdown timeout");
      server.closeAllConnections();
      exit(1);
    }, drainTimeoutMs);
    forceExit.unref();

    server.close(async (error) => {
      clearTimeout(forceExit);

      if (error) {
        logger.error({ err: error }, "Error closing server");
        exit(1);
        return;
      }

      try {
        await disconnect();
        exit(0);
      } catch (disconnectError) {
        logger.error({ err: disconnectError }, "Error disconnecting database");
        exit(1);
      }
    });
  };
}
