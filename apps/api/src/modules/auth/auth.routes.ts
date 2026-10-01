import { Router, type IRouter, type RequestHandler } from "express";
import {
  login,
  refresh,
  logout,
  currentUser,
  requestReset,
  confirmReset,
} from "./auth.controller";
import { createRateLimiter, validateBody } from "../../middleware";
import {
  loginSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "./auth.validation";
import { AppError } from "../../shared";
import { hasAllowedOrigin } from "./auth.cookie";

const router: IRouter = Router();
const publicRateLimit = () =>
  createRateLimiter({ limit: 30, windowMs: 15 * 60 * 1000 });
const requireAllowedOrigin: RequestHandler = (req, _res, next) => {
  if (!hasAllowedOrigin(req)) {
    next(new AppError(403, "INVALID_ORIGIN", "Request origin is not allowed."));
    return;
  }
  next();
};

router.post("/login", publicRateLimit(), validateBody(loginSchema), login);
router.post("/refresh", publicRateLimit(), requireAllowedOrigin, refresh);
router.post("/logout", requireAllowedOrigin, logout);
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
