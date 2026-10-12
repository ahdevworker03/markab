import { prisma } from "../../database";
import type { TxClient } from "../../database";
import type { Decimal } from "@prisma/client/runtime/client";
import type { PaymentRecord, PaymentMethod } from "./payment.types";

async function findById(
  paymentId: string,
  orgId: string,
): Promise<PaymentRecord | null> {
  return prisma.payment.findFirst({
    where: { id: paymentId, organization_id: orgId },
  });
}

async function findRental(
  rentalId: string,
  orgId: string,
  client: TxClient = prisma,
): Promise<{ id: string; total_amount: Decimal } | null> {
  return client.rental.findFirst({
    where: { id: rentalId, organization_id: orgId, deleted_at: null },
    select: { id: true, total_amount: true },
  });
}

async function findByRental(
  rentalId: string,
  orgId: string,
  client: TxClient = prisma,
): Promise<PaymentRecord[]> {
  return client.payment.findMany({
    where: { rental_id: rentalId, organization_id: orgId, deleted_at: null },
    orderBy: { payment_date: "desc" },
  });
}

async function findByOrg(orgId: string): Promise<PaymentRecord[]> {
  return prisma.payment.findMany({
    where: { organization_id: orgId, deleted_at: null },
    orderBy: { payment_date: "desc" },
  });
}

async function findOutstandingRentals(
  orgId: string,
  client: TxClient = prisma,
) {
  return client.rental.findMany({
    where: { organization_id: orgId, deleted_at: null },
    select: { id: true, customer_id: true, total_amount: true },
  });
}

async function sumOutstandingPayments(
  orgId: string,
  client: TxClient = prisma,
) {
  return client.payment.groupBy({
    by: ["rental_id"],
    where: {
      organization_id: orgId,
      deleted_at: null,
      rental: { organization_id: orgId, deleted_at: null },
    },
    _sum: { amount: true },
  });
}

async function create(
  data: {
    organization_id: string;
    rental_id: string;
    amount: number;
    payment_date: Date;
    method: PaymentMethod;
  },
  client: TxClient = prisma,
): Promise<PaymentRecord> {
  return client.payment.create({ data });
}

async function findOperationReceipt(
  organizationId: string,
  operationId: string,
  client: TxClient = prisma,
) {
  return client.paymentOperationReceipt.findUnique({
    where: {
      organization_id_operation_id: {
        organization_id: organizationId,
        operation_id: operationId,
      },
    },
    include: { payment: true },
  });
}

async function createOperationReceipt(
  data: {
    organization_id: string;
    operation_id: string;
    request_fingerprint: string;
    payment_id: string;
  },
  client: TxClient,
) {
  return client.paymentOperationReceipt.create({ data });
}

export {
  findById,
  findRental,
  findByRental,
  findByOrg,
  findOutstandingRentals,
  sumOutstandingPayments,
  create,
  findOperationReceipt,
  createOperationReceipt,
};
