import { prisma } from "../../database";
import type { TxClient } from "../../database";
import type { CustomerRecord } from "./customer.types";

type DbClient = typeof prisma | TxClient;

async function findByOrg(orgId: string): Promise<CustomerRecord[]> {
  return prisma.customer.findMany({
    where: { organization_id: orgId, deleted_at: null },
    orderBy: { created_at: "desc" },
  });
}

async function searchByOrg(
  orgId: string,
  term: string,
): Promise<CustomerRecord[]> {
  return prisma.customer.findMany({
    where: {
      organization_id: orgId,
      deleted_at: null,
      OR: [
        { first_name: { contains: term, mode: "insensitive" } },
        { last_name: { contains: term, mode: "insensitive" } },
        { national_id: { contains: term, mode: "insensitive" } },
        { license_number: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "desc" },
  });
}

async function findById(
  customerId: string,
  orgId: string,
  tx: DbClient = prisma,
): Promise<CustomerRecord | null> {
  return tx.customer.findFirst({
    where: { id: customerId, organization_id: orgId },
  });
}

async function create(
  data: {
    first_name: string;
    last_name: string;
    phone: string;
    address: string;
    national_id: string;
    license_number: string;
    license_expiry_date: Date;
  },
  orgId: string,
  tx: DbClient = prisma,
): Promise<CustomerRecord> {
  return tx.customer.create({
    data: {
      ...data,
      organization_id: orgId,
    },
  });
}

async function update(
  customerId: string,
  data: {
    first_name: string;
    last_name: string;
    phone: string;
    address: string;
    national_id: string;
    license_number: string;
    license_expiry_date: Date;
  },
  tx: DbClient = prisma,
): Promise<CustomerRecord> {
  return tx.customer.update({
    where: { id: customerId },
    data,
  });
}

async function softDelete(customerId: string): Promise<CustomerRecord> {
  return prisma.customer.update({
    where: { id: customerId },
    data: { deleted_at: new Date() },
  });
}

export { findByOrg, searchByOrg, findById, create, update, softDelete };
