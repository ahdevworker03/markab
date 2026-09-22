import { toCustomerResponse } from "../customers/customer.service";
import { toRentalResponse } from "../rentals/rental.mapper";
import { toVehicleResponse } from "../vehicles/vehicle.service";
import { decodeCursor, encodeCursor, type SyncPosition } from "./sync.cursor";
import * as repo from "./sync.repository";
import type { SyncPullQuery } from "./sync.validation";

type PullChange = {
  resource_type: "CUSTOMER" | "VEHICLE" | "RENTAL";
  resource_id: string;
  updated_at: Date;
  deleted: boolean;
  customer: ReturnType<typeof toCustomerResponse> | null;
  vehicle: ReturnType<typeof toVehicleResponse> | null;
  rental: ReturnType<typeof toRentalResponse> | null;
};

function position(change: PullChange): SyncPosition {
  return { updatedAt: change.updated_at, id: change.resource_id };
}

function compareChanges(left: PullChange, right: PullChange): number {
  const byTimestamp = left.updated_at.getTime() - right.updated_at.getTime();
  return byTimestamp || left.resource_id.localeCompare(right.resource_id);
}

function toChanges(records: Awaited<ReturnType<typeof repo.findChanges>>): PullChange[] {
  return [
    ...records.customers.map((customer) => ({
      resource_type: "CUSTOMER" as const,
      resource_id: customer.id,
      updated_at: customer.updated_at,
      deleted: Boolean(customer.deleted_at),
      customer: customer.deleted_at ? null : toCustomerResponse(customer),
      vehicle: null,
      rental: null,
    })),
    ...records.vehicles.map((vehicle) => ({
      resource_type: "VEHICLE" as const,
      resource_id: vehicle.id,
      updated_at: vehicle.updated_at,
      deleted: Boolean(vehicle.deleted_at),
      customer: null,
      vehicle: vehicle.deleted_at ? null : toVehicleResponse(vehicle),
      rental: null,
    })),
    ...records.rentals.map((rental) => ({
      resource_type: "RENTAL" as const,
      resource_id: rental.id,
      updated_at: rental.updated_at,
      deleted: Boolean(rental.deleted_at),
      customer: null,
      vehicle: null,
      rental: rental.deleted_at ? null : toRentalResponse(rental),
    })),
  ].sort(compareChanges);
}

async function pullChanges(
  organizationId: string,
  query: SyncPullQuery,
): Promise<{
  changes: PullChange[];
  next_cursor: string | null;
  completion_cursor: string | null;
}> {
  const cursor = query.cursor
    ? decodeCursor(organizationId, query.cursor)
    : undefined;
  const records = await repo.findChanges(
    organizationId,
    cursor?.after,
    cursor?.completed ? undefined : cursor?.upper,
  );
  const changes = toChanges(records);
  const upper = cursor?.completed
    ? changes.at(-1)
    : cursor?.upper
      ? { resource_id: cursor.upper.id, updated_at: cursor.upper.updatedAt }
      : changes.at(-1);

  if (!upper) {
    return { changes: [], next_cursor: null, completion_cursor: null };
  }

  const page = changes.slice(0, query.limit);
  if (page.length === 0) {
    return {
      changes: [],
      next_cursor: null,
      completion_cursor: encodeCursor(organizationId, {
        updatedAt: upper.updated_at,
        id: upper.resource_id,
      }),
    };
  }

  const last = position(page.at(-1)!);
  const upperPosition = {
    updatedAt: upper.updated_at,
    id: upper.resource_id,
  };
  if (page.length < changes.length) {
    return {
      changes: page,
      next_cursor: encodeCursor(organizationId, last, upperPosition),
      completion_cursor: null,
    };
  }

  return {
    changes: page,
    next_cursor: null,
    completion_cursor: encodeCursor(organizationId, upperPosition),
  };
}

export { pullChanges };
