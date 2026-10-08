import { describe, expect, it, vi } from "vitest";

const { disconnect } = vi.hoisted(() => ({ disconnect: vi.fn() }));

vi.mock("./database/prisma", () => ({ disconnect }));

import { createShutdownHandler } from "./server-shutdown";

describe("createShutdownHandler", () => {
  it("drains the server and disconnects Prisma once", async () => {
    let onClosed: ((error?: Error) => void) | undefined;
    const server = {
      close: vi.fn((callback: (error?: Error) => void) => {
        onClosed = callback;
      }),
      closeAllConnections: vi.fn(),
    };
    const exit = vi.fn();
    const shutdown = createShutdownHandler(server, exit, 1_000);

    shutdown("SIGTERM");
    shutdown("SIGINT");
    onClosed?.();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
  });
});
