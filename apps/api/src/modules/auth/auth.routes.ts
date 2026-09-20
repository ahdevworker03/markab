import { Router, type IRouter } from "express";
import {
  register,
  login,
  refresh,
  logout,
  currentUser,
  requestReset,
  confirmReset,
} from "./auth.controller";
import { createRateLimiter, validateBody } from "../../middleware";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "./auth.validation";

const router: IRouter = Router();
const publicRateLimit = () =>
  createRateLimiter({ limit: 30, windowMs: 15 * 60 * 1000 });

router.post(
  "/register",
  publicRateLimit(),
  validateBody(registerSchema),
  register,
);
router.post("/login", publicRateLimit(), validateBody(loginSchema), login);
router.post(
  "/refresh",
  publicRateLimit(),
  validateBody(refreshSchema),
  refresh,
);
router.post("/logout", validateBody(logoutSchema), logout);
router.post(
  "/password-reset/request",
  publicRateLimit(),
  validateBody(requestPasswordResetSchema),
  requestReset,
);
router.post(
  "/password-reset/confirm",
  publicRateLimit(),
  validateBody(confirmPasswordResetSchema),
  confirmReset,
);
router.get("/me", currentUser);

export default router;
