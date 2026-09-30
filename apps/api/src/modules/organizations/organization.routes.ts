import { Router, type IRouter } from "express";
import {
  get,
  getPlatform,
  listPlatform,
  listPlatformUsers,
  update,
  updateStatus,
  remove,
} from "./organization.controller";
import {
  authenticate,
  requireOperationalOrganization,
  requireRole,
  validateQuery,
  validateParams,
} from "../../middleware";
import {
  updateOrganizationSchema,
  getPlatformOrganizationParamsSchema,
  listPlatformOrganizationsQuerySchema,
  listPlatformOrganizationUsersParamsSchema,
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
  requireOperationalOrganization,
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
router.get(
  "/platform/organizations/:organizationId/users",
  authenticate,
  requireRole("PLATFORM_OWNER"),
  validateParams(listPlatformOrganizationUsersParamsSchema),
  listPlatformUsers,
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
