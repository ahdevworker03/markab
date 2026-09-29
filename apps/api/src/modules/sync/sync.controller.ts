import type { NextFunction, Request, Response } from "express";
import { pushOperations } from "./sync.service";
import { pullChanges } from "./sync.pull.service";
import type { SyncPullQuery, SyncPushInput } from "./sync.validation";

async function push(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await pushOperations(req.user!.org, req.body as SyncPushInput));
  } catch (error) {
    next(error);
  }
}

async function pull(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(
      await pullChanges(
        req.user!.org,
        res.locals.validatedQuery as SyncPullQuery,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export { pull, push };
