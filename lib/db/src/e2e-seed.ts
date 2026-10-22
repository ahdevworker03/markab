import type { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { validateE2eTarget } from "./e2e-target";

const ownerEmail = "owner-e2e@markab.local";
const ownerPassword = "e2e-owner-password";
const organizationId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";

export type E2eSeed = {
  ownerEmail: string;
  ownerPassword: string;
};

export async function seedE2e(prisma: PrismaClient): Promise<E2eSeed> {
  validateE2eTarget(process.env);

  const passwordHash = await hash(ownerPassword);

  await prisma.$transaction(async (transaction) => {
    await transaction.organization.upsert({
      where: { id: organizationId },
      create: {
        id: organizationId,
        name: "E2E Tenant",
        status: "ACTIVE",
        email: "e2e-tenant@markab.local",
      },
      update: {
        name: "E2E Tenant",
        internalKey: null,
        status: "ACTIVE",
        email: "e2e-tenant@markab.local",
      },
    });
    await transaction.user.upsert({
      where: { email: ownerEmail },
      create: {
        id: ownerId,
        organization_id: organizationId,
        email: ownerEmail,
        password_hash: passwordHash,
        role: "OWNER",
      },
      update: {
        organization_id: organizationId,
        password_hash: passwordHash,
        role: "OWNER",
      },
    });
  });

  return { ownerEmail, ownerPassword };
}
