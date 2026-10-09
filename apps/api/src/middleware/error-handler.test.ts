import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { logger } from "../config";
import { errorHandler } from "./error-handler";

describe("error handler", () => {
  it("logs unexpected errors with request correlation and a query-free path", () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const request = {
      id: "5ad4e121-5e94-4dd4-a02b-8aa9b6f5ddd1",
      method: "GET",
      path: "/api/sync/pull",
      log: logger,
    } as unknown as Request;

    try {
      errorHandler(
        new Error("database query failed"),
        request,
        response,
        vi.fn(),
      );

      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "api.unexpected_error",
          requestId: "5ad4e121-5e94-4dd4-a02b-8aa9b6f5ddd1",
          method: "GET",
          path: "/api/sync/pull",
        }),
        "Unhandled error",
      );
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("uses a route-specific operational event for unexpected failures", () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const response = {
      locals: { unexpectedErrorEvent: "sync.push_failed" },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const request = {
      id: "5ad4e121-5e94-4dd4-a02b-8aa9b6f5ddd1",
      method: "POST",
      path: "/api/sync/push",
      log: logger,
    } as unknown as Request;

    try {
      errorHandler(
        new Error("database query failed"),
        request,
        response,
        vi.fn(),
      );

      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ event: "sync.push_failed" }),
        "Unhandled error",
      );
    } finally {
      vi.restoreAllMocks();
    }
  });
});
