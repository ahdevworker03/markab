import { hashPassword, verifyPassword } from "./auth.hash";
import { generateAccessToken, verifyAccessToken } from "./auth.jwt";
import {
  storeRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  hashToken,
  isTokenExpired,
} from "./auth.refresh";
import {
  prisma,
  transaction,
  type TxClient,
} from "../../database";
import { AppError } from "../../shared";
import type { AuthTokens, AccessTokenPayload } from "./auth.types";
import type { UserRole } from "../users/user.types";

async function login(email: string, password: string): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password_hash: true,
      role: true,
      organization_id: true,
      deleted_at: true,
    },
  });

  if (!user) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  if (user.deleted_at) {
    throw new AppError(
      401,
      "ACCOUNT_DEACTIVATED",
      "This account has been deactivated.",
    );
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  return issueTokens(user.id, user.organization_id, user.role);
}

async function getCurrentUser(accessToken: string) {
  const payload = verifyAccessToken(accessToken);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      organization_id: true,
      deleted_at: true,
      created_at: true,
      organization: { select: { status: true } },
    },
  });

  if (!user || user.deleted_at) {
    throw new AppError(
      401,
      "ACCOUNT_DEACTIVATED",
      "This account has been deactivated.",
    );
  }

  return user;
}

async function issueTokens(
  userId: string,
  organizationId: string,
  role: UserRole,
  tx?: TxClient,
): Promise<AuthTokens> {
  const accessToken = generateAccessToken({
    sub: userId,
    org: organizationId,
    role,
  });

  const refreshToken = await storeRefreshToken(userId, tx);

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };
}

async function rotateRefreshToken(oldToken: string): Promise<AuthTokens> {
  const result = await transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({
      where: { token: hashToken(oldToken) },
      select: { id: true, user_id: true, expires_at: true },
    });

    if (!stored) {
      return { kind: "invalid" as const };
    }

    if (isTokenExpired(stored.expires_at)) {
      await tx.refreshToken.deleteMany({ where: { id: stored.id } });
      return { kind: "expired" as const };
    }

    const user = await tx.user.findUnique({
      where: { id: stored.user_id },
      select: { id: true, organization_id: true, role: true, deleted_at: true },
    });

    if (!user || user.deleted_at) {
      await tx.refreshToken.deleteMany({ where: { id: stored.id } });
      return { kind: "invalid" as const };
    }

    const consumed = await tx.refreshToken.deleteMany({
      where: { id: stored.id, token: hashToken(oldToken) },
    });

    if (consumed.count !== 1) {
      return { kind: "invalid" as const };
    }

    return {
      kind: "tokens" as const,
      tokens: await issueTokens(user.id, user.organization_id, user.role, tx),
    };
  });

  if (result.kind === "tokens") {
    return result.tokens;
  }

  if (result.kind === "expired") {
    throw new AppError(
      401,
      "EXPIRED_REFRESH_TOKEN",
      "Refresh token has expired.",
    );
  }

  throw new AppError(
    401,
    "INVALID_REFRESH_TOKEN",
    "Refresh token not found or already used.",
  );
}

async function revokeRefreshToken(token: string): Promise<void> {
  const stored = await findRefreshToken(token);

  if (!stored) {
    return;
  }

  await deleteRefreshToken(token);
}

async function revokeAllUserTokens(
  userId: string,
  tx?: TxClient,
): Promise<void> {
  await (tx ?? prisma).refreshToken.deleteMany({
    where: { user_id: userId },
  });
}

export {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  login,
  getCurrentUser,
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
export type { AuthTokens, AccessTokenPayload };
