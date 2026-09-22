import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import { cleanup } from "../../test/helpers";

describe("sync pull routes", () => {
  let organizationId: string;
  let userId: string;
  let token: string;

  beforeEach(async () => {
    await cleanup();
    const organization = await prisma.organization.create({
      data: { name: "Sync pull organization" },
    });
    const user = await prisma.user.create({
      data: {
        organization_id: organization.id,
        email: "sync-pull-owner@example.com",
        password_hash: "hash",
        role: "OWNER",
      },
    });

    organizationId = organization.id;
    userId = user.id;
    token = generateAccessToken({
      sub: userId,
      org: organization.id,
      role: "OWNER",
    });
  });

  function pull(cursor?: string, limit?: number, bearerToken = token) {
    return request(app)
      .get("/api/sync/pull")
      .set("Authorization", `Bearer ${bearerToken}`)
      .query({ cursor, limit });
  }

  async function createResources(updatedAt: Date) {
    const customer = await prisma.customer.create({
      data: {
        organization_id: organizationId,
        first_name: "Amina",
        last_name: "Haddad",
        phone: "70123456",
        address: "Beirut",
        national_id: "PULL-NID",
        license_number: "PULL-LIC",
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
        updated_at: updatedAt,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        organization_id: organizationId,
        make: "Toyota",
        model: "Corolla",
        plate_number: "PULL-1",
        year: 2024,
        color: "White",
        transmission: "AUTOMATIC",
        fuel_type: "PETROL",
        seats: 5,
        current_mileage: 1000,
        status: "AVAILABLE",
        updated_at: updatedAt,
      },
    });
    const rental = await prisma.rental.create({
      data: {
        organization_id: organizationId,
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        pickup_date: new Date("2030-02-01T10:00:00.000Z"),
        expected_return_date: new Date("2030-02-03T10:00:00.000Z"),
        status: "RESERVED",
        daily_rate: 50,
        total_amount: 100,
        deposit_amount: 25,
        updated_at: updatedAt,
      },
    });
    return { customer, vehicle, rental };
  }

  it("returns an empty completed pull for an empty tenant", async () => {
    const response = await pull().expect(200);

    expect(response.body).toEqual({
      data: { changes: [], next_cursor: null, completion_cursor: null },
    });
  });

  it("globally orders mixed active and deleted resources by updated_at and id", async () => {
    const timestamp = new Date("2030-01-01T00:00:00.000Z");
    const { customer, vehicle, rental } = await createResources(timestamp);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { deleted_at: timestamp, updated_at: timestamp },
    });

    const response = await pull(undefined, 100).expect(200);
    const changes = response.body.data.changes;
    const expected = [customer, vehicle, rental]
      .map(({ id }) => id)
      .sort();

    expect(changes.map((change: { resource_id: string }) => change.resource_id)).toEqual(expected);
    expect(changes.find((change: { resource_id: string }) => change.resource_id === customer.id)).toMatchObject({
      resource_type: "CUSTOMER",
      deleted: false,
      customer: { id: customer.id },
      vehicle: null,
      rental: null,
    });
    expect(changes.find((change: { resource_id: string }) => change.resource_id === vehicle.id)).toMatchObject({
      resource_type: "VEHICLE",
      deleted: true,
      customer: null,
      vehicle: null,
      rental: null,
    });
    expect(changes.find((change: { resource_id: string }) => change.resource_id === rental.id)).toMatchObject({
      resource_type: "RENTAL",
      deleted: false,
      customer: null,
      vehicle: null,
      rental: { id: rental.id },
    });
    expect(response.body.data).toMatchObject({ next_cursor: null });
    expect(response.body.data.completion_cursor).toEqual(expect.any(String));
  });

  it("paginates and resumes unchanged data with an opaque cursor", async () => {
    await createResources(new Date("2030-01-01T00:00:00.000Z"));

    const first = await pull(undefined, 1).expect(200);
    const retry = await pull(first.body.data.next_cursor, 1).expect(200);
    const retryAgain = await pull(first.body.data.next_cursor, 1).expect(200);
    const final = await pull(retry.body.data.next_cursor, 1).expect(200);

    expect(first.body.data.changes).toHaveLength(1);
    expect(first.body.data.next_cursor).toEqual(expect.any(String));
    expect(retry.body.data).toEqual(retryAgain.body.data);
    expect(final.body.data).toMatchObject({ next_cursor: null });
    expect(final.body.data.completion_cursor).toEqual(expect.any(String));
  });

  it("defers an update and soft deletion beyond the current watermark to the next cycle", async () => {
    const originalTime = new Date("2030-01-01T00:00:00.000Z");
    const upperTime = new Date("2030-01-02T00:00:00.000Z");
    const laterTime = new Date("2030-01-03T00:00:00.000Z");
    const { customer, vehicle } = await createResources(originalTime);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { updated_at: upperTime },
    });
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { updated_at: upperTime },
    });

    const first = await pull(undefined, 1).expect(200);
    expect(first.body.data.changes[0]).toMatchObject({ resource_type: "RENTAL" });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { phone: "70999999", updated_at: laterTime },
    });
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { deleted_at: laterTime, updated_at: laterTime },
    });

    const currentTraversalIds = [first.body.data.changes[0].resource_id];
    let page = first;
    while (page.body.data.next_cursor) {
      page = await pull(page.body.data.next_cursor, 1).expect(200);
      currentTraversalIds.push(
        ...page.body.data.changes.map(
          (change: { resource_id: string }) => change.resource_id,
        ),
      );
    }

    expect(currentTraversalIds).not.toContain(customer.id);
    expect(currentTraversalIds).not.toContain(vehicle.id);

    const nextCycle = await pull(page.body.data.completion_cursor, 100).expect(200);
    expect(nextCycle.body.data.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource_id: customer.id,
          deleted: false,
          customer: expect.objectContaining({ phone: "70999999" }),
        }),
        expect.objectContaining({ resource_id: vehicle.id, deleted: true }),
      ]),
    );
  });

  it("rejects tampered and cross-tenant cursors", async () => {
    await createResources(new Date("2030-01-01T00:00:00.000Z"));
    const first = await pull(undefined, 1).expect(200);
    const tampered = `${first.body.data.next_cursor}x`;

    await pull(tampered).expect(422);

    const otherOrganization = await prisma.organization.create({
      data: { name: "Other sync pull organization" },
    });
    const otherUser = await prisma.user.create({
      data: {
        organization_id: otherOrganization.id,
        email: "other-sync-pull-owner@example.com",
        password_hash: "hash",
        role: "OWNER",
      },
    });
    const otherToken = generateAccessToken({
      sub: otherUser.id,
      org: otherOrganization.id,
      role: "OWNER",
    });

    await pull(first.body.data.next_cursor, undefined, otherToken).expect(422);
  });

  it("validates limits and enforces the tenant operational boundary", async () => {
    await pull(undefined, 0).expect(422);
    await pull(undefined, 101).expect(422);

    const platformUser = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: "platform-sync-pull-owner@example.com",
        password_hash: "hash",
        role: "PLATFORM_OWNER",
      },
    });
    const platformToken = generateAccessToken({
      sub: platformUser.id,
      org: organizationId,
      role: "PLATFORM_OWNER",
    });
    await pull(undefined, undefined, platformToken).expect(403);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED" },
    });
    await pull().expect(403);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "CANCELLED" },
    });
    await pull().expect(403);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "ACTIVE" },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { deleted_at: new Date() },
    });
    await pull().expect(401);
  });
});
