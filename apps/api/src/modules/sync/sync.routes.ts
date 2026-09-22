import { Router, type IRouter } from "express";
import {
  authenticate,
  requireOperationalOrganization,
  validateBody,
  validateQuery,
} from "../../middleware";
import { pull, push } from "./sync.controller";
import { syncPullQuerySchema, syncPushSchema } from "./sync.validation";

const router: IRouter = Router();
router.use(authenticate, requireOperationalOrganization);
router.post("/sync/push", validateBody(syncPushSchema), push);
router.get("/sync/pull", validateQuery(syncPullQuerySchema), pull);

export default router;
