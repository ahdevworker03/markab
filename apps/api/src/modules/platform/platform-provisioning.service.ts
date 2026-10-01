import { randomBytes } from "node:crypto";
import { logger } from "../../config";
import { isUniqueConstraintError, transaction } from "../../database";
import { recordAuditLog } from "../audit";
import {
  createOrganizationWithOwner,
  deliverPasswordReset,
  hashPassword,
  issuePasswordResetToken,
} from "../auth";
import { emailAlreadyExistsError } from "../auth/account-provisioning";
import type { PlatformOrganizationResponse } from "../organizations/organization.types";

export interface ProvisionOrganizationInput {
  organizationName: string;
  ownerEmail: string;
  initialStatus: "ACTIVE" | "TRIAL";
}

export interface ProvisionedOrganization {
  organization: PlatformOrganizationResponse;
  owner: { id: string; email: string; role: "OWNER" };
}

/**
 * Creates a client organization, its first OWNER, the one-time password-setup credential and the audit
 * entry in one transaction. The owner's chosen password never exists here: the stored hash is of a
 * discarded random secret, so the account is unusable until the owner completes the normal reset flow.
 * Email delivery happens after commit and can never roll the account back.
 */
export async function provisionOrganization(
  input: ProvisionOrganizationInput,
  actorUserId: string,
): Promise<ProvisionedOrganization> {
  const unusablePasswordHash = await hashPassword(
    randomBytes(32).toString("base64url"),
  );

  let created;
  try {
    created = await transaction(async (tx) => {
      const { organization, owner } = await createOrganizationWithOwner(tx, {
        organizationName: input.organizationName,
        ownerEmail: input.ownerEmail,
        passwordHash: unusablePasswordHash,
        status: input.initialStatus,
      });
      const setupToken = await issuePasswordResetToken(tx, owner.id);

      await recordAuditLog(tx, {
        organizationId: organization.id,
        actorUserId,
        action: "PLATFORM_ORGANIZATION_CREATED",
        targetType: "ORGANIZATION",
        targetId: organization.id,
        metadata: { initialStatus: input.initialStatus, ownerRole: "OWNER" },
      });

      return { organization, owner, setupToken };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw emailAlreadyExistsError();
    throw error;
  }

  try {
    await deliverPasswordReset(created.owner.email, created.setupToken);
  } catch {
    // The account is already committed; the platform owner can request a new link.
    logger.error("Owner setup link delivery failed after provisioning");
  }

  const { organization, owner } = created;
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      status: organization.status,
      legalName: organization.legal_name,
      phone: organization.phone,
      email: organization.email,
      address: organization.address,
      createdAt: organization.created_at.toISOString(),
      updatedAt: organization.updated_at.toISOString(),
    },
    owner: { id: owner.id, email: owner.email, role: "OWNER" },
  };
}
