import { AppError } from "../../shared";
import { transaction } from "../../database";
import { recordAuditLog } from "../audit";
import * as repo from "./organization.repository";
import { assertTransition } from "./organization.lifecycle";
import type {
  OrganizationResponse,
  PlatformOrganizationInvitationResponse,
  PlatformOrganizationResponse,
  PlatformOrganizationUserResponse,
  PlatformOrganizationUsersResponse,
  UpdateOrganizationInput,
} from "./organization.types";

function toResponse(record: {
  id: string;
  name: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contract_footer_text: string | null;
  created_at: Date;
  updated_at: Date;
}): OrganizationResponse {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    legalName: record.legal_name,
    phone: record.phone,
    email: record.email,
    address: record.address,
    contractFooterText: record.contract_footer_text,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

function toPlatformResponse(record: {
  id: string;
  name: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}): PlatformOrganizationResponse {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    legalName: record.legal_name,
    phone: record.phone,
    email: record.email,
    address: record.address,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

async function updateOrganizationStatus(
  orgId: string,
  actorUserId: string,
  status: OrganizationResponse["status"],
  reason?: string,
): Promise<PlatformOrganizationResponse> {
  const organization = await transaction(async (tx) => {
    const org = await repo.findPlatformByIdWithinTx(orgId, tx);

    if (!org) {
      throw new AppError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found.",
      );
    }

    if (org.status === status) {
      return org;
    }

    const normalizedReason = assertTransition(org.status, status, reason);
    const updated = await repo.updatePlatformStatusWithinTx(
      orgId,
      org.status,
      status,
      tx,
    );

    if (!updated) {
      throw new AppError(
        409,
        "INVALID_ORGANIZATION_STATUS_TRANSITION",
        "Organization status changed concurrently. Reload and try again.",
      );
    }

    await recordAuditLog(tx, {
      organizationId: updated.id,
      actorUserId,
      action: "ORGANIZATION_STATUS_UPDATED",
      targetType: "ORGANIZATION",
      targetId: updated.id,
      metadata: {
        previousStatus: org.status,
        newStatus: updated.status,
        ...(normalizedReason ? { reason: normalizedReason } : {}),
      },
    });

    return updated;
  });

  return toPlatformResponse(organization);
}

async function listPlatformOrganizations(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrganizationResponse["status"];
}): Promise<{
  data: PlatformOrganizationResponse[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const { organizations, total } = await repo.listPlatformOrganizations(input);
  return {
    data: organizations.map(toPlatformResponse),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
  };
}

async function getPlatformOrganization(
  orgId: string,
): Promise<PlatformOrganizationResponse> {
  const org = await repo.findPlatformById(orgId);

  if (!org) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
  }

  return toPlatformResponse(org);
}

function byCreatedThenId<T extends { createdAt: string; id: string }>(a: T, b: T) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function userRank(user: PlatformOrganizationUserResponse): number {
  if (user.status === "DEACTIVATED") return 2;
  return user.role === "OWNER" ? 0 : 1;
}

const invitationRank = { PENDING: 0, EXPIRED: 1, ACCEPTED: 2 } as const;

async function listPlatformOrganizationUsers(
  orgId: string,
  now: Date = new Date(),
): Promise<PlatformOrganizationUsersResponse> {
  const organization = await repo.findPlatformById(orgId);

  if (!organization) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
  }

  const { users, invitations } = await repo.listPlatformOrganizationAccess(orgId);

  if (users.some((user) => user.role === "PLATFORM_OWNER")) {
    // Never present a platform account as a tenant user; surface the broken invariant instead.
    throw new AppError(
      500,
      "ORGANIZATION_DATA_INTEGRITY_ERROR",
      "Organization contains an account that violates platform role invariants.",
    );
  }

  const mappedUsers = users
    .map(
      (user): PlatformOrganizationUserResponse => ({
        id: user.id,
        email: user.email,
        role: user.role as "OWNER" | "EMPLOYEE",
        status: user.deleted_at ? "DEACTIVATED" : "ACTIVE",
        createdAt: user.created_at.toISOString(),
        deactivatedAt: user.deleted_at ? user.deleted_at.toISOString() : null,
      }),
    )
    .sort((a, b) => userRank(a) - userRank(b) || byCreatedThenId(a, b));

  const mappedInvitations = invitations
    .map(
      (invitation): PlatformOrganizationInvitationResponse => ({
        id: invitation.id,
        email: invitation.email,
        status: invitation.accepted_at
          ? "ACCEPTED"
          : invitation.expires_at <= now
            ? "EXPIRED"
            : "PENDING",
        createdAt: invitation.created_at.toISOString(),
        expiresAt: invitation.expires_at.toISOString(),
        acceptedAt: invitation.accepted_at
          ? invitation.accepted_at.toISOString()
          : null,
      }),
    )
    .sort(
      (a, b) =>
        invitationRank[a.status] - invitationRank[b.status] ||
        byCreatedThenId(b, a),
    );

  return { users: mappedUsers, invitations: mappedInvitations };
}

async function getOrganization(orgId: string): Promise<OrganizationResponse> {
  const org = await repo.findById(orgId);

  if (!org || org.deleted_at) {
    throw new AppError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found.",
    );
  }

  return toResponse(org);
}

async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationResponse> {
  const org = await repo.findById(orgId);

  if (!org || org.deleted_at) {
    throw new AppError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found.",
    );
  }

  const updated = await repo.update(orgId, input);

  return toResponse(updated);
}

async function deleteOrganization(orgId: string): Promise<void> {
  const org = await repo.findById(orgId);

  if (!org || org.deleted_at) {
    throw new AppError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found.",
    );
  }

  throw new AppError(
    409,
    "CANNOT_DELETE_ORGANIZATION",
    "You cannot delete your own organization.",
  );
}

export {
  getOrganization,
  getPlatformOrganization,
  listPlatformOrganizations,
  listPlatformOrganizationUsers,
  updateOrganization,
  updateOrganizationStatus,
  deleteOrganization,
};
