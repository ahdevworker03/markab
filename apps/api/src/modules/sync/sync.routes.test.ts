import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../auth";
import { cleanup } from "../../test/helpers";
import * as syncRepository from "./sync.repository";

describe("sync push routes", () => {
  let organizationId: string;
  let token: string;

  function customerCreate(operationId: string, firstName = "Amina") {
    return {
      operation_id: operationId,
      type: "CUSTOMER_CREATE",
      customer_create: {
        first_name: firstName,
        last_name: "Haddad",
        phone: "70123456",
        address: "Beirut",
        national_id: `NID-${operationId}`,
        license_number: `LIC-${operationId}`,
        license_expiry_date: "2030-01-01T00:00:00.000Z",
      },
    };
  }

  beforeEach(async () => {
    await cleanup();

    const organization = await prisma.organization.create({
      data: { name: "Sync organization" },
    });
    const user = await prisma.user.create({
      data: {
        organization_id: organization.id,
        email: "sync-owner@example.com",
        password_hash: "hash",
        role: "OWNER",
      },
    });

    organizationId = organization.id;
    token = generateAccessToken({
      sub: user.id,
      org: organization.id,
      role: "OWNER",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function push(operations: unknown[], bearerToken = token) {
    return request(app)
      .post("/api/sync/push")
      .set("Authorization", `Bearer ${bearerToken}`)
      .send({ operations });
  }

  it("allows an owner but rejects employee, platform, and non-operational sync mutations", async () => {
    const employee = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: "sync-employee@example.com",
        password_hash: "hash",
        role: "EMPLOYEE",
      },
    });
    const platform = await prisma.user.create({
      data: {
        organization_id: organizationId,
        email: "sync-platform@example.com",
        password_hash: "hash",
        role: "PLATFORM_OWNER",
      },
    });
    const employeeToken = generateAccessToken({
      sub: employee.id,
      org: organizationId,
      role: "EMPLOYEE",
    });
    const platformToken = generateAccessToken({
      sub: platform.id,
      org: organizationId,
      role: "PLATFORM_OWNER",
    });

    await push(
      [customerCreate("00000000-0000-4000-8000-000000000010")],
      employeeToken,
    ).expect(403);
    await push(
      [customerCreate("00000000-0000-4000-8000-000000000011")],
      platformToken,
    ).expect(403);
    await push([customerCreate("00000000-0000-4000-8000-000000000012")]).expect(
      200,
    );

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED" },
    });
    await push([customerCreate("00000000-0000-4000-8000-000000000013")]).expect(
      403,
    );
  });

  it("applies a customer create once and replays it as a duplicate", async () => {
    const operation = customerCreate("00000000-0000-4000-8000-000000000001");

    const first = await push([operation]).expect(200);
    const replay = await push([operation]).expect(200);
    const receipt = await prisma.syncOperationReceipt.findUniqueOrThrow({
      where: {
        organization_id_operation_id: {
          organization_id: organizationId,
          operation_id: operation.operation_id,
        },
      },
    });

    expect(first.body.results[0]).toMatchObject({
      operation_id: operation.operation_id,
      status: "APPLIED",
      code: "SYNC_APPLIED",
      resource_type: "CUSTOMER",
      customer: { firstName: "Amina" },
    });
    expect(replay.body.results[0]).toMatchObject({
      operation_id: operation.operation_id,
      status: "DUPLICATE",
      code: "SYNC_DUPLICATE",
      resource_type: "CUSTOMER",
      customer: { firstName: "Amina" },
    });
    expect(receipt.stale_customer_snapshot).toBeNull();
    await expect(
      prisma.customer.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
  });

  it("recovers concurrent identical customer creates as the same authoritative result", async () => {
    const operation = customerCreate("00000000-0000-4000-8000-000000000009");

    const [first, second] = await Promise.all([
      push([operation]),
      push([operation]),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.results[0]).toMatchObject({
      status: expect.stringMatching(/APPLIED|DUPLICATE/),
      resource_type: "CUSTOMER",
      customer: { firstName: "Amina" },
    });
    expect(second.body.results[0]).toMatchObject({
      status: expect.stringMatching(/APPLIED|DUPLICATE/),
      resource_type: "CUSTOMER",
      customer: { firstName: "Amina" },
    });
    expect(first.body.results[0].customer.id).toBe(
      second.body.results[0].customer.id,
    );
    await expect(
      prisma.customer.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.syncOperationReceipt.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
  });

  it("rejects a reused operation ID with a different payload", async () => {
    const operationId = "00000000-0000-4000-8000-000000000002";
    await push([customerCreate(operationId)]).expect(200);

    const response = await push([customerCreate(operationId, "Layla")]).expect(
      200,
    );

    expect(response.body.results[0]).toMatchObject({
      operation_id: operationId,
      status: "REJECTED",
      code: "SYNC_OPERATION_PAYLOAD_MISMATCH",
      resource_type: null,
    });
  });

  it("rolls back an operation when receipt persistence fails and allows a later retry", async () => {
    const operation = customerCreate("00000000-0000-4000-8000-000000000014");
    vi.spyOn(syncRepository, "createReceipt").mockRejectedValueOnce(
      new Error("receipt write failed"),
    );

    await push([operation]).expect(500);
    await expect(
      prisma.customer.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.syncOperationReceipt.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(0);

    await push([operation])
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: "APPLIED",
          customer: { firstName: "Amina" },
        });
      });
    await expect(
      prisma.customer.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.syncOperationReceipt.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
  });

  it("replays a rejected operation with its original machine-readable result", async () => {
    const operation = {
      operation_id: "00000000-0000-4000-8000-000000000015",
      type: "CUSTOMER_UPDATE" as const,
      customer_update: {
        customer_id: "00000000-0000-4000-8000-000000000016",
        expected_updated_at: "2030-01-01T00:00:00.000Z",
        first_name: "Amina",
        last_name: "Haddad",
        phone: "70123456",
        address: "Beirut",
        national_id: "MISSING-NID",
        license_number: "MISSING-LIC",
        license_expiry_date: "2030-01-01T00:00:00.000Z",
      },
    };

    const first = await push([operation]).expect(200);
    const replay = await push([operation]).expect(200);

    expect(first.body.results[0]).toMatchObject({
      status: "REJECTED",
      code: "CUSTOMER_NOT_FOUND",
    });
    expect(replay.body.results[0]).toMatchObject({
      status: "REJECTED",
      code: "CUSTOMER_NOT_FOUND",
    });
  });

  it("isolates the same operation ID across authenticated organizations", async () => {
    const otherOrganization = await prisma.organization.create({
      data: { name: "Other sync organization" },
    });
    const otherUser = await prisma.user.create({
      data: {
        organization_id: otherOrganization.id,
        email: "other-sync-owner@example.com",
        password_hash: "hash",
        role: "OWNER",
      },
    });
    const otherToken = generateAccessToken({
      sub: otherUser.id,
      org: otherOrganization.id,
      role: "OWNER",
    });
    const operation = customerCreate("00000000-0000-4000-8000-000000000017");

    const first = await push([operation]).expect(200);
    const second = await push([operation], otherToken).expect(200);

    expect(first.body.results[0]).toMatchObject({ status: "APPLIED" });
    expect(second.body.results[0]).toMatchObject({ status: "APPLIED" });
    expect(first.body.results[0].customer.id).not.toBe(
      second.body.results[0].customer.id,
    );
    await expect(
      prisma.syncOperationReceipt.count({
        where: { operation_id: operation.operation_id },
      }),
    ).resolves.toBe(2);
  });

  it("replays an applied create with its original identity after soft deletion", async () => {
    const operation = customerCreate("00000000-0000-4000-8000-000000000018");
    const first = await push([operation]).expect(200);
    const customerId = first.body.results[0].customer.id as string;

    await request(app)
      .delete(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const replay = await push([operation]).expect(200);
    expect(replay.body.results[0]).toMatchObject({
      status: "DUPLICATE",
      code: "SYNC_DUPLICATE",
      resource_type: "CUSTOMER",
      customer: { id: customerId },
    });
    await expect(
      prisma.customer.count({
        where: { organization_id: organizationId, deleted_at: null },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.customer.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
  });

  it("returns the current customer when an offline update is stale", async () => {
    const customer = await prisma.customer.create({
      data: {
        organization_id: organizationId,
        first_name: "Current",
        last_name: "Customer",
        phone: "70123457",
        address: "Beirut",
        national_id: "CURRENT-NID",
        license_number: "CURRENT-LIC",
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    const response = await push([
      {
        operation_id: "00000000-0000-4000-8000-000000000003",
        type: "CUSTOMER_UPDATE",
        customer_update: {
          customer_id: customer.id,
          expected_updated_at: "2000-01-01T00:00:00.000Z",
          first_name: "Offline",
          last_name: "Customer",
          phone: "70123457",
          address: "Beirut",
          national_id: "CURRENT-NID",
          license_number: "CURRENT-LIC",
          license_expiry_date: "2030-01-01T00:00:00.000Z",
        },
      },
    ]).expect(200);

    expect(response.body.results[0]).toMatchObject({
      status: "CONFLICT",
      code: "SYNC_CUSTOMER_STALE",
      resource_type: "CUSTOMER",
      current_customer: { id: customer.id, firstName: "Current" },
    });
  });

  it("replays the original stale conflict after the customer changes or is deleted", async () => {
    const timestamp = new Date("2030-01-01T00:00:00.000Z");
    const customer = await prisma.customer.create({
      data: {
        organization_id: organizationId,
        first_name: "Original",
        last_name: "Snapshot",
        phone: "70123457",
        address: "Beirut",
        national_id: "SNAPSHOT-NID",
        license_number: "SNAPSHOT-LIC",
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
        created_at: timestamp,
        updated_at: timestamp,
      },
    });
    const operation = {
      operation_id: "00000000-0000-4000-8000-000000000006",
      type: "CUSTOMER_UPDATE",
      customer_update: {
        customer_id: customer.id,
        expected_updated_at: "2000-01-01T00:00:00.000Z",
        first_name: "Offline",
        last_name: "Snapshot",
        phone: "70123457",
        address: "Beirut",
        national_id: "SNAPSHOT-NID",
        license_number: "SNAPSHOT-LIC",
        license_expiry_date: "2030-01-01T00:00:00.000Z",
      },
    };
    const expected = {
      id: customer.id,
      firstName: "Original",
      lastName: "Snapshot",
      phone: "70123457",
      address: "Beirut",
      nationalId: "SNAPSHOT-NID",
      licenseNumber: "SNAPSHOT-LIC",
      licenseExpiryDate: "2030-01-01T00:00:00.000Z",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    };

    const first = await push([operation]).expect(200);
    const replay = await push([operation]).expect(200);
    const receipt = await prisma.syncOperationReceipt.findUniqueOrThrow({
      where: {
        organization_id_operation_id: {
          organization_id: organizationId,
          operation_id: operation.operation_id,
        },
      },
    });

    expect(first.body.results[0]).toMatchObject({
      status: "CONFLICT",
      code: "SYNC_CUSTOMER_STALE",
      current_customer: expected,
    });
    expect(receipt).toMatchObject({
      outcome: "CONFLICT",
      resource_type: "CUSTOMER",
      resource_id: customer.id,
      stale_customer_snapshot: expected,
    });
    expect(replay.body.results[0]).toMatchObject({
      status: "CONFLICT",
      code: "SYNC_CUSTOMER_STALE",
      current_customer: expected,
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        first_name: "Changed",
        updated_at: new Date("2030-01-02T00:00:00.000Z"),
      },
    });
    const afterUpdate = await push([operation]).expect(200);
    expect(afterUpdate.body.results[0]).toMatchObject({
      status: "CONFLICT",
      code: "SYNC_CUSTOMER_STALE",
      current_customer: expected,
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { deleted_at: new Date("2030-01-03T00:00:00.000Z") },
    });
    const afterDeletion = await push([operation]).expect(200);
    expect(afterDeletion.body.results[0]).toMatchObject({
      status: "CONFLICT",
      code: "SYNC_CUSTOMER_STALE",
      current_customer: expected,
    });
  });

  it("keeps changed-payload and expired stale-conflict replay semantics", async () => {
    const customer = await prisma.customer.create({
      data: {
        organization_id: organizationId,
        first_name: "Current",
        last_name: "Customer",
        phone: "70123457",
        address: "Beirut",
        national_id: "EXPIRED-NID",
        license_number: "EXPIRED-LIC",
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    const operation = {
      operation_id: "00000000-0000-4000-8000-000000000007",
      type: "CUSTOMER_UPDATE",
      customer_update: {
        customer_id: customer.id,
        expected_updated_at: "2000-01-01T00:00:00.000Z",
        first_name: "Offline",
        last_name: "Customer",
        phone: "70123457",
        address: "Beirut",
        national_id: "EXPIRED-NID",
        license_number: "EXPIRED-LIC",
        license_expiry_date: "2030-01-01T00:00:00.000Z",
      },
    };

    await push([operation]).expect(200);
    await push([
      {
        ...operation,
        customer_update: { ...operation.customer_update, phone: "70999999" },
      },
    ])
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: "REJECTED",
          code: "SYNC_OPERATION_PAYLOAD_MISMATCH",
        });
      });
    await prisma.syncOperationReceipt.update({
      where: {
        organization_id_operation_id: {
          organization_id: organizationId,
          operation_id: operation.operation_id,
        },
      },
      data: { expires_at: new Date("2000-01-01T00:00:00.000Z") },
    });
    await push([operation])
      .expect(200)
      .expect(({ body }) => {
        expect(body.results[0]).toMatchObject({
          status: "EXPIRED",
          code: "SYNC_OPERATION_EXPIRED",
        });
      });
  });

  it("rejects a corrupt stale-conflict snapshot without reading the mutable customer", async () => {
    const customer = await prisma.customer.create({
      data: {
        organization_id: organizationId,
        first_name: "Current",
        last_name: "Customer",
        phone: "70123457",
        address: "Beirut",
        national_id: "CORRUPT-NID",
        license_number: "CORRUPT-LIC",
        license_expiry_date: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    const operation = {
      operation_id: "00000000-0000-4000-8000-000000000008",
      type: "CUSTOMER_UPDATE",
      customer_update: {
        customer_id: customer.id,
        expected_updated_at: "2000-01-01T00:00:00.000Z",
        first_name: "Offline",
        last_name: "Customer",
        phone: "70123457",
        address: "Beirut",
        national_id: "CORRUPT-NID",
        license_number: "CORRUPT-LIC",
        license_expiry_date: "2030-01-01T00:00:00.000Z",
      },
    };

    await push([operation]).expect(200);
    await prisma.syncOperationReceipt.update({
      where: {
        organization_id_operation_id: {
          organization_id: organizationId,
          operation_id: operation.operation_id,
        },
      },
      data: { stale_customer_snapshot: { id: "invalid" } },
    });

    await push([operation])
      .expect(500)
      .expect(({ body }) => {
        expect(body.error.code).toBe("SYNC_CONFLICT_SNAPSHOT_INVALID");
      });
  });

  it("creates a rental that references an earlier customer create", async () => {
    const vehicle = await prisma.vehicle.create({
      data: {
        organization_id: organizationId,
        make: "Toyota",
        model: "Corolla",
        plate_number: "SYNC-1",
        year: 2024,
        color: "White",
        transmission: "AUTOMATIC",
        fuel_type: "PETROL",
        seats: 5,
        current_mileage: 1000,
        status: "AVAILABLE",
      },
    });
    const customerOperationId = "00000000-0000-4000-8000-000000000004";

    const response = await push([
      customerCreate(customerOperationId),
      {
        operation_id: "00000000-0000-4000-8000-000000000005",
        type: "RENTAL_CREATE",
        rental_create: {
          customer_id: "offline-customer",
          vehicle_id: vehicle.id,
          pickup_date: "2030-02-01T10:00:00.000Z",
          expected_return_date: "2030-02-03T10:00:00.000Z",
          daily_rate: 50,
          total_amount: 100,
          deposit_amount: 25,
          customer_reference: {
            customer_create_operation_id: customerOperationId,
          },
        },
      },
    ]).expect(200);

    expect(response.body.results[1]).toMatchObject({
      status: "APPLIED",
      code: "SYNC_APPLIED",
      resource_type: "RENTAL",
      rental: { vehicleId: vehicle.id },
    });
    await expect(
      prisma.rental.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(1);
  });
});
