import { Router, type IRouter } from "express";
import {
  list,
  get,
  create,
  update,
  complete,
  remove,
} from "./task.controller";
import {
  authenticate,
  requireRole,
  requireOperationalOrganization,
  validateBody,
  validateUuidParam,
} from "../../middleware";
import {
  createTaskSchema,
  updateTaskSchema,
} from "./task.validation";

const router: IRouter = Router();
router.use(authenticate, requireOperationalOrganization);
router.param("id", validateUuidParam);

router.get("/tasks", list);
router.get("/tasks/:id", get);
router.post(
  "/tasks",
  requireRole("OWNER"),
  validateBody(createTaskSchema),
  create,
);
router.patch(
  "/tasks/:id",
  requireRole("OWNER"),
  validateBody(updateTaskSchema),
  update,
);
router.post(
  "/tasks/:id/complete",
  requireRole("OWNER"),
  complete,
);
router.delete("/tasks/:id", requireRole("OWNER"), remove);

export default router;
