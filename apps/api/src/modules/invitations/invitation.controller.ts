import type { NextFunction, Request, Response } from "express";
import { created } from "../../shared";
import {
  acceptEmployeeInvitation,
  createEmployeeInvitation,
} from "./invitation.service";
import type {
  AcceptEmployeeInvitationInput,
  CreateEmployeeInvitationInput,
} from "./invitation.types";
import { setRefreshCookie } from "../auth/auth.cookie";

async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const invitation = await createEmployeeInvitation(
      req.user!.org,
      req.user!.sub,
      req.body as CreateEmployeeInvitationInput,
    );
    created(res, invitation);
  } catch (error) {
    next(error);
  }
}

async function accept(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokens = await acceptEmployeeInvitation(
      req.body as AcceptEmployeeInvitationInput,
    );
    setRefreshCookie(res, tokens.refreshToken);
    created(res, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export { create, accept };
