import type { Request, Response, NextFunction } from "express";
import { logger } from "../config";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource was not found.",
  });
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err }, "Unhandled error");

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env["NODE_ENV"] === "production"
        ? "An unexpected error occurred."
        : err.message,
  });
}
