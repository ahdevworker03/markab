import type { Request, Response, NextFunction } from "express";
import {
  login,
  getCurrentUser,
  rotateRefreshToken,
  revokeRefreshToken,
} from "./auth.service";
import {
  requestPasswordReset,
  confirmPasswordReset,
} from "./password-reset.service";
import { AppError, ok, noContent } from "../../shared";
import type {
  LoginInput,
  RequestPasswordResetInput,
  ConfirmPasswordResetInput,
} from "./auth.validation";
import {
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
} from "./auth.cookie";

async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as LoginInput;
    const tokens = await login(input.email, input.password);
    setRefreshCookie(res, tokens.refreshToken);
    ok(res, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      throw new AppError(
        401,
        "INVALID_REFRESH_TOKEN",
        "Refresh token not found or already used.",
      );
    }
    const tokens = await rotateRefreshToken(refreshToken);
    setRefreshCookie(res, tokens.refreshToken);
    ok(res, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const refreshToken = getRefreshCookie(req);
    if (refreshToken) await revokeRefreshToken(refreshToken);
    clearRefreshCookie(res);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

async function currentUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.set("Cache-Control", "no-store");
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      ok(res, null);
      return;
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      ok(res, null);
      return;
    }

    const user = await getCurrentUser(parts[1]);
    ok(res, {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      organizationStatus: user.organization.status,
      createdAt: user.created_at.toISOString(),
    });
  } catch {
    next(new AppError(401, "INVALID_ACCESS_TOKEN", "Invalid access token."));
  }
}

async function requestReset(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as RequestPasswordResetInput;
    await requestPasswordReset(input.email);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

async function confirmReset(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as ConfirmPasswordResetInput;
    await confirmPasswordReset(input.token, input.password);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export {
  loginHandler as login,
  refresh,
  logout,
  currentUser,
  requestReset,
  confirmReset,
};
