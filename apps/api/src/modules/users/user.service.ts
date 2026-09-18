import { hashPassword, revokeAllUserTokens } from "../auth";
import { transaction } from "../../database";
import { AppError } from "../../shared";
import { recordAuditLog } from "../audit";
import * as repo from "./user.repository";
import type {
  UserResponse,
  CreateUserInput,
  UpdateUserInput,
  UserRole,
} from "./user.types";

function toResponse(record: {
  id: string;
  email: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}): UserResponse {
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

async function listUsers(orgId: string): Promise<UserResponse[]> {
  const users = await repo.findByOrg(orgId);
  return users.map(toResponse);
}

async function getUser(userId: string, orgId: string): Promise<UserResponse> {
  const user = await repo.findById(userId, orgId);

  if (!user || user.deleted_at) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }

  return toResponse(user);
}

async function createUser(
  orgId: string,
  actorUserId: string,
  input: CreateUserInput,
): Promise<UserResponse> {
  const passwordHash = await hashPassword(input.password);

  const user = await transaction(async (tx) => {
    const existing = await repo.findByEmail(input.email, tx);

    if (existing) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "A user with this email already exists.",
      );
    }

    const created = await repo.create(input, passwordHash, orgId, tx);
    await recordAuditLog(tx, {
      organizationId: orgId,
      actorUserId,
      action: "USER_CREATED",
      targetType: "USER",
      targetId: created.id,
      metadata: { role: created.role },
    });

    return created;
  });

  return toResponse(user);
}

async function updateUser(
  userId: string,
  orgId: string,
  input: UpdateUserInput,
): Promise<UserResponse> {
  const user = await repo.findById(userId, orgId);

  if (!user || user.deleted_at) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }

  if (user.role === "OWNER") {
    throw new AppError(
      409,
      "OWNER_ROLE_CHANGE_NOT_SUPPORTED",
      "Owner role changes are not supported.",
    );
  }

  const updated = await repo.update(userId, input);

  return toResponse(updated);
}

async function deleteUser(
  userId: string,
  orgId: string,
  actorUserId: string,
): Promise<void> {
  if (userId === actorUserId) {
    throw new AppError(
      409,
      "CANNOT_DELETE_SELF",
      "You cannot delete your own account.",
    );
  }

  await transaction(async (tx) => {
    const user = await repo.findById(userId, orgId, tx);

    if (!user || user.deleted_at) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    }

    await repo.softDelete(userId, tx);
    await revokeAllUserTokens(userId, tx);
    await recordAuditLog(tx, {
      organizationId: orgId,
      actorUserId,
      action: "USER_DELETED",
      targetType: "USER",
      targetId: user.id,
      metadata: { role: user.role },
    });
  });
}

export { listUsers, getUser, createUser, updateUser, deleteUser };
