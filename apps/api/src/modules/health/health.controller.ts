import type { Request, Response } from "express";
import { HealthCheckResponse, ReadinessCheckResponse } from "@workspace/api-zod";
import { prisma } from "../../database";
import { storageProvider } from "../../config/storage";

export function healthCheck(_req: Request, res: Response): void {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

export async function readinessCheck(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    void storageProvider;
    await prisma.$queryRaw`SELECT 1`;
    res.json(ReadinessCheckResponse.parse({ status: "ok" }));
  } catch {
    res.status(503).json(ReadinessCheckResponse.parse({ status: "unavailable" }));
  }
}
