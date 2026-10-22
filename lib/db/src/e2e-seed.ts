import type { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { validateE2eTarget } from "./e2e-target";

const ownerEmail = "owner-e2e@markab.local";
const ownerPassword = "e2e-owner-password";
const organizationId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const otherOrganizationId = "00000000-0000-4000-8000-000000000003";
const otherCustomerId = "00000000-0000-4000-8000-000000000004";
const platformOrganizationId = "00000000-0000-4000-8000-000000000005";
const employeeId = "00000000-0000-4000-8000-000000000006";
const platformOwnerId = "00000000-0000-4000-8000-000000000007";
const employeeEmail = "employee-e2e@markab.local";
const platformOwnerEmail = "platform-owner-e2e@markab.local";

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
    await transaction.organization.upsert({
      where: { id: otherOrganizationId },
      create: {
        id: otherOrganizationId,
        name: "E2E Other Tenant",
        status: "ACTIVE",
      },
      update: {
        name: "E2E Other Tenant",
        internalKey: null,
        status: "ACTIVE",
      },
    });
    await transaction.organization.upsert({
      where: { id: platformOrganizationId },
      create: {
        id: platformOrganizationId,
        name: "Platform",
        internalKey: "platform",
        status: "ACTIVE",
      },
      update: {
        name: "Platform",
        internalKey: "platform",
        status: "ACTIVE",
      },
    });
    await transaction.user.upsert({
      where: { email: employeeEmail },
      create: {
        id: employeeId,
        organization_id: organizationId,
        email: employeeEmail,
        password_hash: passwordHash,
        role: "EMPLOYEE",
      },
      update: {
        organization_id: organizationId,
        password_hash: passwordHash,
        role: "EMPLOYEE",
        deleted_at: null,
      },
    });
    await transaction.user.upsert({
      where: { email: platformOwnerEmail },
      create: {
        id: platformOwnerId,
        organization_id: platformOrganizationId,
        email: platformOwnerEmail,
        password_hash: passwordHash,
        role: "PLATFORM_OWNER",
      },
      update: {
        organization_id: platformOrganizationId,
        password_hash: passwordHash,
        role: "PLATFORM_OWNER",
        deleted_at: null,
      },
    });
    await transaction.customer.upsert({
      where: { id: otherCustomerId },
      create: {
        id: otherCustomerId,
        organization_id: otherOrganizationId,
        first_name: "Other",
        last_name: "Tenant",
        phone: "0500000001",
        address: "Riyadh",
        national_id: "E2E-OTHER-0001",
        license_number: "E2E-OTHER-LIC-0001",
        license_expiry_date: new Date("2040-01-01T00:00:00.000Z"),
      },
      update: {
        organization_id: otherOrganizationId,
        first_name: "Other",
        last_name: "Tenant",
        phone: "0500000001",
        address: "Riyadh",
        national_id: "E2E-OTHER-0001",
        license_number: "E2E-OTHER-LIC-0001",
        license_expiry_date: new Date("2040-01-01T00:00:00.000Z"),
        deleted_at: null,
      },
    });
  });

  return { ownerEmail, ownerPassword };
}
