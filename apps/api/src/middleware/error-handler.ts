import type { Request, Response, NextFunction } from "express";
import { logger } from "../config";
import { AppError } from "../shared";

interface ParserError extends Error {
  type?: string;
}

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new AppError(404, "NOT_FOUND", "The requested resource was not found."));
}

export function errorHandler(
  err: ParserError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "MALFORMED_JSON", message: "Malformed JSON request body." } });
    return;
  }

  if (err.type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." } });
    return;
  }

  logger.error({ err }, "Unhandled error");

  const isProduction = process.env["NODE_ENV"] === "production";

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction ? "An unexpected error occurred." : err.message,
    },
  });
}
