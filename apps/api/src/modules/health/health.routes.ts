import { Router, type IRouter } from "express";
import { healthCheck, readinessCheck } from "./health.controller";

const router: IRouter = Router();

router.get("/healthz", healthCheck);
router.get("/readyz", readinessCheck);

export default router;
