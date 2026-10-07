import { Prisma } from "@prisma/client";
import { prisma, type TxClient } from "../../database";
import type { CustomerResponse } from "../customers/customer.types";
import {
  comparePositions,
  resourceTypeRank,
  type SyncPosition,
  type SyncResourceType,
} from "./sync.cursor";

type DbClient = typeof prisma | TxClient;

function staleCustomerSnapshotJson(
  snapshot: CustomerResponse,
): Prisma.InputJsonObject {
  return {
    id: snapshot.id,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    phone: snapshot.phone,
    address: snapshot.address,
    nationalId: snapshot.nationalId,
    licenseNumber: snapshot.licenseNumber,
    licenseExpiryDate: snapshot.licenseExpiryDate,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

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
    stale_customer_snapshot: CustomerResponse | null;
    expires_at: Date;
  },
  tx: DbClient,
) {
  return tx.syncOperationReceipt.create({
    data: {
      ...data,
      stale_customer_snapshot: data.stale_customer_snapshot
        ? staleCustomerSnapshotJson(data.stale_customer_snapshot)
        : Prisma.JsonNull,
    },
  });
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
  resourceType: SyncResourceType,
  after?: SyncPosition,
  upper?: SyncPosition,
) {
  return {
    organization_id: organizationId,
    AND: [
      ...(after
        ? [
            {
              OR: [
                { updated_at: { gt: after.updatedAt } },
                ...(resourceTypeRank(resourceType) >
                resourceTypeRank(after.resourceType)
                  ? [{ updated_at: after.updatedAt }]
                  : resourceType === after.resourceType
                    ? [{ updated_at: after.updatedAt, id: { gt: after.id } }]
                    : []),
              ],
            },
          ]
        : []),
      ...(upper
        ? [
            {
              OR: [
                { updated_at: { lt: upper.updatedAt } },
                ...(resourceTypeRank(resourceType) <
                resourceTypeRank(upper.resourceType)
                  ? [{ updated_at: upper.updatedAt }]
                  : resourceType === upper.resourceType
                    ? [{ updated_at: upper.updatedAt, id: { lte: upper.id } }]
                    : []),
              ],
            },
          ]
        : []),
    ],
  };
}

async function findUpperWatermark(
  organizationId: string,
): Promise<SyncPosition | undefined> {
  const [customer, vehicle, rental] = await Promise.all([
    prisma.customer.findFirst({
      where: { organization_id: organizationId },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    }),
    prisma.vehicle.findFirst({
      where: { organization_id: organizationId },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    }),
    prisma.rental.findFirst({
      where: { organization_id: organizationId },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    }),
  ]);
  const positions = [
    customer && {
      updatedAt: customer.updated_at,
      resourceType: "CUSTOMER" as const,
      id: customer.id,
    },
    vehicle && {
      updatedAt: vehicle.updated_at,
      resourceType: "VEHICLE" as const,
      id: vehicle.id,
    },
    rental && {
      updatedAt: rental.updated_at,
      resourceType: "RENTAL" as const,
      id: rental.id,
    },
  ].filter((position): position is SyncPosition => Boolean(position));
  return positions.sort(comparePositions).at(-1);
}

async function findChanges(
  organizationId: string,
  after?: SyncPosition,
  upper?: SyncPosition,
  limit = 100,
) {
  const [customers, vehicles, rentals] = await Promise.all([
    prisma.customer.findMany({
      where: changeWhere(organizationId, "CUSTOMER", after, upper),
      orderBy: [{ updated_at: "asc" }, { id: "asc" }],
      take: limit + 1,
    }),
    prisma.vehicle.findMany({
      where: changeWhere(organizationId, "VEHICLE", after, upper),
      orderBy: [{ updated_at: "asc" }, { id: "asc" }],
      take: limit + 1,
    }),
    prisma.rental.findMany({
      where: changeWhere(organizationId, "RENTAL", after, upper),
      orderBy: [{ updated_at: "asc" }, { id: "asc" }],
      take: limit + 1,
    }),
  ]);
  return { customers, vehicles, rentals };
}

export {
  createReceipt,
  findChanges,
  findCustomer,
  findRental,
  findReceipt,
  findUpperWatermark,
};
