import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import { cleanup } from "../../test/helpers";
import * as syncRepository from "./sync.repository";

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

  async function createResources(updatedAt: Date, suffix = "") {
    const customer = await prisma.customer.create({
      data: {
        organization_id: organizationId,
        first_name: "Amina",
        last_name: "Haddad",
        phone: `70123456${suffix}`,
        address: "Beirut",
        national_id: `PULL-NID${suffix}`,
        license_number: `PULL-LIC${suffix}`,
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
        updated_at: updatedAt,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        organization_id: organizationId,
        make: "Toyota",
        model: "Corolla",
        plate_number: `PULL-1${suffix}`,
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

  async function createCustomers(count: number, updatedAt: Date) {
    return Promise.all(
      Array.from({ length: count }, (_, index) => {
        const suffix = `${index + 1}`.padStart(3, "0");
        return prisma.customer.create({
          data: {
            organization_id: organizationId,
            first_name: "Amina",
            last_name: `Haddad ${suffix}`,
            phone: `70${suffix}456`,
            address: "Beirut",
            national_id: `PULL-NID-${suffix}`,
            license_number: `PULL-LIC-${suffix}`,
            license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
            updated_at: updatedAt,
          },
        });
      }),
    );
  }

  it("returns an empty completed pull for an empty tenant", async () => {
    const response = await pull().expect(200);

    expect(response.body).toEqual({
      changes: [],
      next_cursor: null,
      completion_cursor: null,
    });
  });

  it("globally orders mixed active and deleted resources by updated_at, resource type, and id", async () => {
    const timestamp = new Date("2030-01-01T00:00:00.000Z");
    const { customer, vehicle, rental } = await createResources(timestamp);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { deleted_at: timestamp, updated_at: timestamp },
    });

    const response = await pull(undefined, 100).expect(200);
    const changes = response.body.changes;
    const expected = [customer.id, vehicle.id, rental.id];

    expect(
      changes.map((change: { resource_id: string }) => change.resource_id),
    ).toEqual(expected);
    expect(
      changes.find(
        (change: { resource_id: string }) => change.resource_id === customer.id,
      ),
    ).toMatchObject({
      resource_type: "CUSTOMER",
      deleted: false,
      customer: { id: customer.id },
      vehicle: null,
      rental: null,
    });
    expect(
      changes.find(
        (change: { resource_id: string }) => change.resource_id === vehicle.id,
      ),
    ).toMatchObject({
      resource_type: "VEHICLE",
      deleted: true,
      customer: null,
      vehicle: null,
      rental: null,
    });
    expect(
      changes.find(
        (change: { resource_id: string }) => change.resource_id === rental.id,
      ),
    ).toMatchObject({
      resource_type: "RENTAL",
      deleted: false,
      customer: null,
      vehicle: null,
      rental: { id: rental.id },
    });
    expect(response.body).toMatchObject({ next_cursor: null });
    expect(response.body.completion_cursor).toEqual(expect.any(String));
  });

  it("paginates and resumes unchanged data with an opaque cursor", async () => {
    await createResources(new Date("2030-01-01T00:00:00.000Z"));

    const first = await pull(undefined, 1).expect(200);
    const retry = await pull(first.body.next_cursor, 1).expect(200);
    const retryAgain = await pull(first.body.next_cursor, 1).expect(200);
    const final = await pull(retry.body.next_cursor, 1).expect(200);

    expect(first.body.changes).toHaveLength(1);
    expect(first.body.next_cursor).toEqual(expect.any(String));
    expect(retry.body).toEqual(retryAgain.body);
    expect(final.body).toMatchObject({ next_cursor: null });
    expect(final.body.completion_cursor).toEqual(expect.any(String));
  });

  it("caps each repository resource stream at limit plus one", async () => {
    const updatedAt = new Date("2030-01-01T00:00:00.000Z");
    await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        createResources(updatedAt, `-${index + 1}`),
      ),
    );

    const records = await syncRepository.findChanges(
      organizationId,
      undefined,
      undefined,
      2,
    );

    expect(records.customers).toHaveLength(3);
    expect(records.vehicles).toHaveLength(3);
    expect(records.rentals).toHaveLength(3);
  });

  it("delivers a customer-dominated traversal once without skipping equal-timestamp rows", async () => {
    const updatedAt = new Date("2030-01-01T00:00:00.000Z");
    await createCustomers(5, updatedAt);
    const expected = await prisma.customer.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ updated_at: "asc" }, { id: "asc" }],
    });
    const receivedIds: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await pull(cursor, 2).expect(200);
      receivedIds.push(
        ...response.body.changes.map(
          (change: { resource_id: string }) => change.resource_id,
        ),
      );
      cursor = response.body.next_cursor ?? undefined;
    } while (cursor);

    expect(receivedIds).toEqual(expected.map((customer) => customer.id));
    expect([...new Set(receivedIds)]).toHaveLength(expected.length);
  });

  it("keeps equal timestamps and IDs from different resources across pages", async () => {
    const id = "00000000-0000-4000-8000-000000000020";
    const updatedAt = new Date("2030-01-01T00:00:00.000Z");
    await prisma.customer.create({
      data: {
        id,
        organization_id: organizationId,
        first_name: "Amina",
        last_name: "Haddad",
        phone: "70123456",
        address: "Beirut",
        national_id: "SHARED-ID-NID",
        license_number: "SHARED-ID-LIC",
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
        updated_at: updatedAt,
      },
    });
    await prisma.vehicle.create({
      data: {
        id,
        organization_id: organizationId,
        make: "Toyota",
        model: "Corolla",
        plate_number: "SHARED-ID-PLATE",
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

    const first = await pull(undefined, 1).expect(200);
    const second = await pull(first.body.next_cursor, 1).expect(200);

    expect(first.body.changes[0]).toMatchObject({
      resource_type: "CUSTOMER",
      resource_id: id,
    });
    expect(second.body.changes[0]).toMatchObject({
      resource_type: "VEHICLE",
      resource_id: id,
    });
    expect(second.body.next_cursor).toBeNull();
  });

  it("delivers a change made after the upper watermark in the next cycle", async () => {
    const before = new Date("2030-01-01T00:00:00.000Z");
    const upperTime = new Date("2030-01-02T00:00:00.000Z");
    const after = new Date("2030-01-03T00:00:00.000Z");
    const { customer, vehicle } = await createResources(before);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { updated_at: upperTime },
    });

    const upper = await syncRepository.findUpperWatermark(organizationId);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { phone: "70999999", updated_at: after },
    });

    const currentCycle = await syncRepository.findChanges(
      organizationId,
      undefined,
      upper!,
      100,
    );
    const nextCycle = await syncRepository.findChanges(
      organizationId,
      upper!,
      undefined,
      100,
    );

    expect(currentCycle.customers).toEqual([]);
    expect(nextCycle.customers).toMatchObject([
      { id: customer.id, phone: "70999999" },
    ]);
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
    expect(first.body.changes[0]).toMatchObject({ resource_type: "RENTAL" });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { phone: "70999999", updated_at: laterTime },
    });
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { deleted_at: laterTime, updated_at: laterTime },
    });

    const currentTraversalIds = [first.body.changes[0].resource_id];
    let page = first;
    while (page.body.next_cursor) {
      page = await pull(page.body.next_cursor, 1).expect(200);
      currentTraversalIds.push(
        ...page.body.changes.map(
          (change: { resource_id: string }) => change.resource_id,
        ),
      );
    }

    expect(currentTraversalIds).not.toContain(customer.id);
    expect(currentTraversalIds).not.toContain(vehicle.id);

    const nextCycle = await pull(page.body.completion_cursor, 100).expect(200);
    expect(nextCycle.body.changes).toEqual(
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
    const tampered = `${first.body.next_cursor}x`;

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

    await pull(first.body.next_cursor, undefined, otherToken).expect(422);
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
