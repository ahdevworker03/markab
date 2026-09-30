import { transaction, type TxClient } from "../../database";
import { AppError } from "../../shared";
import { recordAuditLog } from "../audit";
import { revokeAllUserTokens, issuePasswordResetToken, deliverPasswordReset } from "../auth";
import { issueEmployeeInvitation } from "../invitations";
import { findPlatformByIdWithinTx } from "../organizations/organization.repository";
import type { PlatformOrganizationUserResponse } from "../organizations/organization.types";
import { softDelete } from "../users/user.repository";
import type { EmployeeInvitationResponse } from "../invitations/invitation.types";

const REASON_MAX_LENGTH = 500;

/** Client organizations only; internal, deleted and unknown organizations are masked as 404. */
async function requireClientOrganization(tx: TxClient, organizationId: string) {
  const organization = await findPlatformByIdWithinTx(organizationId, tx);

  if (!organization) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
  }

  return organization;
}

function integrityError(): AppError {
  return new AppError(
    500,
    "ORGANIZATION_DATA_INTEGRITY_ERROR",
    "Organization owner data violates platform invariants.",
  );
}

async function resendEmployeeInvitation(
  organizationId: string,
  invitationId: string,
  actorUserId: string,
): Promise<EmployeeInvitationResponse> {
  return transaction(async (tx) => {
    const organization = await requireClientOrganization(tx, organizationId);

    const invitation = await tx.employeeInvitation.findFirst({
      where: { id: invitationId, organization_id: organizationId },
      select: { email: true, accepted_at: true },
    });
    if (!invitation) {
      throw new AppError(404, "INVITATION_NOT_FOUND", "Invitation not found.");
    }
    if (invitation.accepted_at) {
      throw new AppError(
        409,
        "INVITATION_ALREADY_ACCEPTED",
        "This invitation has already been accepted.",
      );
    }
    if (organization.status === "SUSPENDED" || organization.status === "CANCELLED") {
      throw new AppError(
        403,
        "ORGANIZATION_NOT_OPERATIONAL",
        "This organization is not available for business operations.",
      );
    }

    return issueEmployeeInvitation(tx, organizationId, actorUserId, invitation.email, {
      resentAction: "PLATFORM_EMPLOYEE_INVITATION_RESENT",
    });
  });
}

async function requestOwnerPasswordReset(
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  const issued = await transaction(async (tx) => {
    await requireClientOrganization(tx, organizationId);

    const owners = await tx.user.findMany({
      where: { organization_id: organizationId, role: "OWNER" },
      select: { id: true, email: true, deleted_at: true },
    });
    const active = owners.filter((owner) => !owner.deleted_at);

    if (active.length > 1) throw integrityError();
    const owner = active[0];
    if (!owner) {
      if (owners.length > 0) {
        throw new AppError(
          409,
          "OWNER_DEACTIVATED",
          "The organization owner account is deactivated.",
        );
      }
      throw integrityError();
    }

    const token = await issuePasswordResetToken(tx, owner.id);
    await recordAuditLog(tx, {
      organizationId,
      actorUserId,
      action: "PLATFORM_OWNER_PASSWORD_RESET_REQUESTED",
      targetType: "USER",
      targetId: owner.id,
      metadata: { role: "OWNER" },
    });

    return { email: owner.email, token };
  });

  // Delivery happens after commit; the raw token never leaves the delivery boundary.
  await deliverPasswordReset(issued.email, issued.token);
}

async function deactivateEmployee(
  organizationId: string,
  userId: string,
  actorUserId: string,
  rawReason: string,
): Promise<PlatformOrganizationUserResponse> {
  const reason = rawReason.trim();
  if (!reason) {
    throw new AppError(
      422,
      "DEACTIVATION_REASON_REQUIRED",
      "A reason is required to deactivate an employee.",
    );
  }
  if (reason.length > REASON_MAX_LENGTH) {
    throw new AppError(422, "VALIDATION_ERROR", "Reason is too long.");
  }

  return transaction(async (tx) => {
    await requireClientOrganization(tx, organizationId);

    const user = await tx.user.findFirst({
      where: { id: userId, organization_id: organizationId },
      select: { id: true, email: true, role: true, created_at: true, deleted_at: true },
    });
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found.");
    }
    if (user.role !== "EMPLOYEE") {
      throw new AppError(
        409,
        "USER_NOT_DEACTIVATABLE",
        "Only employee accounts can be deactivated from Platform Admin.",
      );
    }
    if (user.deleted_at) {
      throw new AppError(
        409,
        "USER_ALREADY_DEACTIVATED",
        "This account is already deactivated.",
      );
    }

    const deactivated = await softDelete(user.id, tx);
    await revokeAllUserTokens(user.id, tx);
    await recordAuditLog(tx, {
      organizationId,
      actorUserId,
      action: "PLATFORM_EMPLOYEE_DEACTIVATED",
      targetType: "USER",
      targetId: user.id,
      metadata: { role: "EMPLOYEE", reason },
    });

    return {
      id: user.id,
      email: user.email,
      role: "EMPLOYEE",
      status: "DEACTIVATED",
      createdAt: user.created_at.toISOString(),
      deactivatedAt: (deactivated.deleted_at ?? new Date()).toISOString(),
    };
  });
}

export { resendEmployeeInvitation, requestOwnerPasswordReset, deactivateEmployee };
