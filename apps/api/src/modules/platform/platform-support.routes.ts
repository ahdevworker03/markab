import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import {
  DeactivatePlatformEmployeeBody,
  DeactivatePlatformEmployeeParams,
  RequestPlatformOwnerPasswordResetParams,
  ResendPlatformEmployeeInvitationParams,
} from "@workspace/api-zod";
import { authenticate, requireRole, validateBody, validateParams } from "../../middleware";
import { noContent, ok } from "../../shared";
import {
  deactivateEmployee,
  requestOwnerPasswordReset,
  resendEmployeeInvitation,
} from "./platform-support.service";

// Platform-specific support actions. These never pass through tenant middleware or tenant routes.
const router: IRouter = Router();
const platformOnly = [authenticate, requireRole("PLATFORM_OWNER")];

function handle(
  action: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    action(req, res).catch(next);
  };
}

router.post(
  "/platform/organizations/:organizationId/invitations/:invitationId/resend",
  ...platformOnly,
  validateParams(ResendPlatformEmployeeInvitationParams),
  handle(async (req, res) => {
    const { organizationId, invitationId } = req.params as Record<string, string>;
    ok(res, await resendEmployeeInvitation(organizationId, invitationId, req.user!.sub));
  }),
);

router.post(
  "/platform/organizations/:organizationId/owner/password-reset",
  ...platformOnly,
  validateParams(RequestPlatformOwnerPasswordResetParams),
  handle(async (req, res) => {
    const { organizationId } = req.params as Record<string, string>;
    await requestOwnerPasswordReset(organizationId, req.user!.sub);
    noContent(res);
  }),
);

router.post(
  "/platform/organizations/:organizationId/users/:userId/deactivate",
  ...platformOnly,
  validateParams(DeactivatePlatformEmployeeParams),
  validateBody(DeactivatePlatformEmployeeBody),
  handle(async (req, res) => {
    const { organizationId, userId } = req.params as Record<string, string>;
    const { reason } = req.body as { reason: string };
    ok(res, await deactivateEmployee(organizationId, userId, req.user!.sub, reason));
  }),
);

export default router;
