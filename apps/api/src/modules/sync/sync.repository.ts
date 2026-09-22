import { prisma, type TxClient } from "../../database";
import type { SyncPosition } from "./sync.cursor";

type DbClient = typeof prisma | TxClient;

async function findReceipt(
  organizationId: string,
  operationId: string,
  tx: DbClient = prisma,
) {
  return tx.syncOperationReceipt.findUnique({
    where: {
      organization_id_operation_id: {
        organization_id: organizationId,
        operation_id: operationId,
      },
    },
  });
}

async function createReceipt(
  data: {
    organization_id: string;
    operation_id: string;
    request_fingerprint: string;
    operation_type: "CUSTOMER_CREATE" | "CUSTOMER_UPDATE" | "RENTAL_CREATE";
    outcome: "APPLIED" | "CONFLICT" | "REJECTED";
    resource_type: "CUSTOMER" | "RENTAL" | null;
    resource_id: string | null;
    expires_at: Date;
  },
  tx: DbClient,
) {
  return tx.syncOperationReceipt.create({ data });
}

async function findCustomer(
  organizationId: string,
  customerId: string,
  tx: DbClient = prisma,
) {
  return tx.customer.findFirst({
    where: {
      id: customerId,
      organization_id: organizationId,
      deleted_at: null,
    },
  });
}

async function findRental(
  organizationId: string,
  rentalId: string,
  tx: DbClient = prisma,
) {
  return tx.rental.findFirst({
    where: { id: rentalId, organization_id: organizationId, deleted_at: null },
  });
}

function changeWhere(
  organizationId: string,
  after?: SyncPosition,
  upper?: SyncPosition,
) {
  return {
    organization_id: organizationId,
    ...(after
      ? {
          OR: [
            { updated_at: { gt: after.updatedAt } },
            { updated_at: after.updatedAt, id: { gt: after.id } },
          ],
        }
      : {}),
    ...(upper
      ? {
          AND: [
            {
              OR: [
                { updated_at: { lt: upper.updatedAt } },
                { updated_at: upper.updatedAt, id: { lte: upper.id } },
              ],
            },
          ],
        }
      : {}),
  };
}

async function findChanges(
  organizationId: string,
  after?: SyncPosition,
  upper?: SyncPosition,
) {
  const where = changeWhere(organizationId, after, upper);
  const [customers, vehicles, rentals] = await Promise.all([
    prisma.customer.findMany({ where }),
    prisma.vehicle.findMany({ where }),
    prisma.rental.findMany({ where }),
  ]);
  return { customers, vehicles, rentals };
}

export { createReceipt, findChanges, findCustomer, findRental, findReceipt };
