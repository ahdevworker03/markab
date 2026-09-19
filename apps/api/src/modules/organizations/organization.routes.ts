import { Router, type IRouter } from "express";
import {
  get,
  getPlatform,
  listPlatform,
  update,
  updateStatus,
  remove,
} from "./organization.controller";
import {
  authenticate,
  requireRole,
  validateQuery,
  validateParams,
} from "../../middleware";
import {
  updateOrganizationSchema,
  getPlatformOrganizationParamsSchema,
  listPlatformOrganizationsQuerySchema,
  updateOrganizationStatusParamsSchema,
  updateOrganizationStatusSchema,
} from "./organization.validation";
import { validateBody } from "../../middleware";

const router: IRouter = Router();

router.get("/organizations/me", authenticate, get);
router.patch(
  "/organizations/me",
  authenticate,
  requireRole("OWNER"),
  validateBody(updateOrganizationSchema),
  update,
);
router.delete("/organizations/me", authenticate, requireRole("OWNER"), remove);
router.get(
  "/platform/organizations",
  authenticate,
  requireRole("PLATFORM_OWNER"),
  validateQuery(listPlatformOrganizationsQuerySchema),
  listPlatform,
);
router.get(
  "/platform/organizations/:organizationId",
  authenticate,
  requireRole("PLATFORM_OWNER"),
  validateParams(getPlatformOrganizationParamsSchema),
  getPlatform,
);
router.patch(
  "/platform/organizations/:organizationId/status",
  authenticate,
  requireRole("PLATFORM_OWNER"),
  validateParams(updateOrganizationStatusParamsSchema),
  validateBody(updateOrganizationStatusSchema),
  updateStatus,
);

export default router;
