import { Router, type IRouter } from "express";
import {
  authenticate,
  requireOperationalOrganization,
  validateBody,
} from "../../middleware";
import { push } from "./sync.controller";
import { syncPushSchema } from "./sync.validation";

const router: IRouter = Router();
router.use(authenticate, requireOperationalOrganization);
router.post("/sync/push", validateBody(syncPushSchema), push);

export default router;
