import type { TxClient } from "../../database";
import { AppError } from "../../shared";

export type ProvisionedOrganizationStatus = "ACTIVE" | "TRIAL";

export function emailAlreadyExistsError(): AppError {
  return new AppError(
    409,
    "EMAIL_ALREADY_EXISTS",
    "A user with this email already exists.",
  );
}

/**
 * Creates a client organization and its first OWNER inside the caller's transaction.
 * Single source of the "organization + first owner" invariant, used only by platform
 * provisioning (there is no public registration); it never creates EMPLOYEE or PLATFORM_OWNER accounts and never sets
 * an internal key, so the result is always an ordinary client tenant.
 */
export async function createOrganizationWithOwner(
  tx: TxClient,
  input: {
    organizationName: string;
    ownerEmail: string;
    passwordHash: string;
    status?: ProvisionedOrganizationStatus;
  },
) {
  const existingUser = await tx.user.findUnique({
    where: { email: input.ownerEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw emailAlreadyExistsError();
  }

  const organization = await tx.organization.create({
    data: {
      name: input.organizationName,
      ...(input.status ? { status: input.status } : {}),
    },
  });

  const owner = await tx.user.create({
    data: {
      email: input.ownerEmail,
      password_hash: input.passwordHash,
      role: "OWNER",
      organization_id: organization.id,
    },
    select: { id: true, email: true, role: true, organization_id: true },
  });

  return { organization, owner };
}
