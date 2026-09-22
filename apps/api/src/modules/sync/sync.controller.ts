import type { NextFunction, Request, Response } from "express";
import { ok } from "../../shared";
import { pushOperations } from "./sync.service";
import type { SyncPushInput } from "./sync.validation";

async function push(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    ok(res, await pushOperations(req.user!.org, req.body as SyncPushInput));
  } catch (error) {
    next(error);
  }
}

export { push };
