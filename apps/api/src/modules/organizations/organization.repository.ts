import { prisma } from "../../database";
import type { TxClient } from "../../database";
import type {
  OrganizationRecord,
  OrganizationStatus,
  UpdateOrganizationInput,
} from "./organization.types";

type DbClient = typeof prisma | TxClient;
const platformOrganizationSelect = {
  id: true,
  name: true,
  status: true,
  legal_name: true,
  phone: true,
  email: true,
  address: true,
  created_at: true,
  updated_at: true,
};
const clientOrganizationWhere = { deleted_at: null, internalKey: null };

type PlatformOrganizationRecord = {
  id: string;
  name: string;
  status: OrganizationStatus;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
};

async function findById(orgId: string): Promise<OrganizationRecord | null> {
  return prisma.organization.findUnique({
    where: { id: orgId },
  });
}

async function update(
  orgId: string,
  data: UpdateOrganizationInput,
): Promise<OrganizationRecord> {
  return prisma.organization.update({
    where: { id: orgId },
    data: {
      name: data.name,
      legal_name: data.legalName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      contract_footer_text: data.contractFooterText,
    },
  });
}

async function findByIdWithinTx(
  orgId: string,
  tx: DbClient,
): Promise<OrganizationRecord | null> {
  return tx.organization.findUnique({
    where: { id: orgId },
  });
}

async function listPlatformOrganizations(
  input: { page: number; pageSize: number; search?: string; status?: OrganizationStatus },
): Promise<{ organizations: PlatformOrganizationRecord[]; total: number }> {
  const where = {
    ...clientOrganizationWhere,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { legal_name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [organizations, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      select: platformOrganizationSelect,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return { organizations, total };
}

async function findPlatformById(
  orgId: string,
): Promise<PlatformOrganizationRecord | null> {
  return prisma.organization.findFirst({
    where: { id: orgId, ...clientOrganizationWhere },
    select: platformOrganizationSelect,
  });
}

async function findPlatformByIdWithinTx(
  orgId: string,
  tx: DbClient,
): Promise<PlatformOrganizationRecord | null> {
  return tx.organization.findFirst({
    where: { id: orgId, ...clientOrganizationWhere },
    select: platformOrganizationSelect,
  });
}

async function updateStatusWithinTx(
  orgId: string,
  status: OrganizationStatus,
  tx: DbClient,
): Promise<OrganizationRecord> {
  return tx.organization.update({
    where: { id: orgId },
    data: { status },
  });
}

/** Compare-and-set on the previous status; returns null if it changed concurrently. */
async function updatePlatformStatusWithinTx(
  orgId: string,
  previousStatus: OrganizationStatus,
  status: OrganizationStatus,
  tx: DbClient,
): Promise<PlatformOrganizationRecord | null> {
  const { count } = await tx.organization.updateMany({
    where: { id: orgId, status: previousStatus, ...clientOrganizationWhere },
    data: { status },
  });
  return count === 0 ? null : findPlatformByIdWithinTx(orgId, tx);
}

async function softDelete(orgId: string): Promise<OrganizationRecord> {
  return prisma.organization.update({
    where: { id: orgId },
    data: { deleted_at: new Date() },
  });
}

export {
  findById,
  findByIdWithinTx,
  findPlatformById,
  findPlatformByIdWithinTx,
  listPlatformOrganizations,
  update,
  updatePlatformStatusWithinTx,
  updateStatusWithinTx,
  softDelete,
};
