import { Router, type IRouter } from "express";
import { CreatePlatformOrganizationBody } from "@workspace/api-zod";
import { z } from "zod";
import { authenticate, requireRole, validateBody } from "../../middleware";
import { created } from "../../shared";
import { normalizeEmail } from "../auth/email";
import {
  provisionOrganization,
  type ProvisionOrganizationInput,
} from "./platform-provisioning.service";

// Platform-only provisioning. Tenant middleware is never involved and there is no public equivalent.
const router: IRouter = Router();

function normalizeProvisioningInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const body = { ...(input as Record<string, unknown>) };
  if (typeof body.organizationName === "string") {
    body.organizationName = body.organizationName.trim();
  }
  if (typeof body.ownerEmail === "string") {
    body.ownerEmail = normalizeEmail(body.ownerEmail);
  }
  return body;
}

// Strict: any extra property (notably a password) is rejected rather than silently dropped.
const createPlatformOrganizationSchema = z.preprocess(
  normalizeProvisioningInput,
  CreatePlatformOrganizationBody.strict(),
);

router.post(
  "/platform/organizations",
  authenticate,
  requireRole("PLATFORM_OWNER"),
  validateBody(createPlatformOrganizationSchema),
  (req, res, next) => {
    provisionOrganization(req.body as ProvisionOrganizationInput, req.user!.sub)
      .then((result) => created(res, result))
      .catch(next);
  },
);

export default router;
