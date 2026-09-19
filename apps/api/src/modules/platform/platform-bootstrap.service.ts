import { randomBytes } from "node:crypto";
import { retrySerializable, transaction } from "../../database";
import { recordAuditLog } from "../audit";
import { hashPassword } from "../auth";
import { normalizeEmail } from "../auth/email";
import { requestPasswordReset } from "../auth/password-reset.service";

const PLATFORM_INTERNAL_KEY = "platform";

async function bootstrapPlatformOwner(email: string): Promise<{ created: boolean }> {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));

  const result = await retrySerializable(() =>
    transaction(
      async (tx) => {
        let organization = await tx.organization.findUnique({
          where: { internalKey: PLATFORM_INTERNAL_KEY },
          select: { id: true },
        });

        if (!organization) {
          organization = await tx.organization.create({
            data: { name: "Platform", internalKey: PLATFORM_INTERNAL_KEY, status: "ACTIVE" },
            select: { id: true },
          });
        }

        const owners = await tx.user.findMany({
          where: {
            organization_id: organization.id,
            role: "PLATFORM_OWNER",
            deleted_at: null,
          },
          select: { id: true, email: true },
        });

        if (owners.length > 0) {
          if (owners.length !== 1 || owners[0]?.email !== normalizedEmail) {
            throw new Error("An active platform owner already exists.");
          }
          return { created: false };
        }

        const existingUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, organization_id: true, role: true, deleted_at: true },
        });
        if (existingUser) {
          if (
            existingUser.organization_id === organization.id &&
            existingUser.role === "PLATFORM_OWNER" &&
            existingUser.deleted_at
          ) {
            await tx.user.update({
              where: { id: existingUser.id },
              data: { deleted_at: null, password_hash: passwordHash },
            });
            return { created: false };
          }
          throw new Error("The requested email is already assigned to another account.");
        }

        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password_hash: passwordHash,
            role: "PLATFORM_OWNER",
            organization_id: organization.id,
          },
          select: { id: true },
        });
        await recordAuditLog(tx, {
          organizationId: organization.id,
          actorUserId: user.id,
          action: "PLATFORM_OWNER_BOOTSTRAPPED",
          targetType: "USER",
          targetId: user.id,
        });
        return { created: true };
      },
      { isolationLevel: "Serializable" },
    ),
  );

  await requestPasswordReset(normalizedEmail);
  return result;
}

export { bootstrapPlatformOwner };
