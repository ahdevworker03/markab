import { AppError } from "../../shared";
import { transaction } from "../../database";
import { recordAuditLog } from "../audit";
import * as repo from "./organization.repository";
import type {
  OrganizationResponse,
  PlatformOrganizationResponse,
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

    const updated = await repo.updatePlatformStatusWithinTx(orgId, status, tx);
    await recordAuditLog(tx, {
      organizationId: updated.id,
      actorUserId,
      action: "ORGANIZATION_STATUS_UPDATED",
      targetType: "ORGANIZATION",
      targetId: updated.id,
      metadata: {
        previousStatus: org.status,
        newStatus: updated.status,
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
  updateOrganization,
  updateOrganizationStatus,
  deleteOrganization,
};
