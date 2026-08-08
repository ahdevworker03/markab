import { Router, type IRouter } from "express";
import healthRouter from "../modules/health/health.routes";

const router: IRouter = Router();

router.use(healthRouter);

export default router;
