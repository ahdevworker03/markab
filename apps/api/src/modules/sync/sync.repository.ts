import { prisma, type TxClient } from "../../database";

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

export { createReceipt, findCustomer, findRental, findReceipt };
