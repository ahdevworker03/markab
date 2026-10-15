import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../database";
import { cleanup } from "../../test/helpers";

describe("sync operation receipt persistence", () => {
  let organizationId: string;
  let otherOrganizationId: string;
  const operationId = "00000000-0000-4000-8000-000000000001";
  const resourceId = "00000000-0000-4000-8000-000000000002";
  const createdAt = new Date("2030-01-01T00:00:00.000Z");
  const expiresAt = new Date("2030-01-31T00:00:00.000Z");

  beforeEach(async () => {
    await cleanup();
    const [organization, otherOrganization] = await Promise.all([
      prisma.organization.create({ data: { name: "Receipt organization" } }),
      prisma.organization.create({ data: { name: "Other receipt organization" } }),
    ]);
    organizationId = organization.id;
    otherOrganizationId = otherOrganization.id;
  });

  afterEach(cleanup);

  async function createReceipt(organization_id = organizationId) {
    return prisma.syncOperationReceipt.create({
      data: {
        organization_id,
        operation_id: operationId,
        request_fingerprint: "sha256:receipt-request",
        operation_type: "CUSTOMER_CREATE",
        result_code: "SYNC_APPLIED",
        outcome: "APPLIED",
        resource_type: "CUSTOMER",
        resource_id: resourceId,
        created_at: createdAt,
        expires_at: expiresAt,
      },
    });
  }

  it("persists a tenant-scoped receipt with its fingerprint and resource reference", async () => {
    const receipt = await createReceipt();

    expect(receipt).toMatchObject({
      organization_id: organizationId,
      operation_id: operationId,
      request_fingerprint: "sha256:receipt-request",
      operation_type: "CUSTOMER_CREATE",
      result_code: "SYNC_APPLIED",
      outcome: "APPLIED",
      resource_type: "CUSTOMER",
      resource_id: resourceId,
      stale_customer_snapshot: null,
      created_at: createdAt,
      expires_at: expiresAt,
    });
    expect(receipt.expires_at.getTime() - receipt.created_at.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
  });

  it("persists a stale customer conflict snapshot without using it for applied operations", async () => {
    const snapshot = {
      id: resourceId,
      firstName: "Original",
      lastName: "Customer",
      phone: "70123456",
      address: "Beirut",
      nationalId: "SNAPSHOT-NID",
      licenseNumber: "SNAPSHOT-LIC",
      licenseExpiryDate: "2030-01-01T00:00:00.000Z",
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    };
    const conflict = await prisma.syncOperationReceipt.create({
      data: {
        organization_id: organizationId,
        operation_id: "00000000-0000-4000-8000-000000000003",
        request_fingerprint: "sha256:conflict-request",
        operation_type: "CUSTOMER_UPDATE",
        result_code: "SYNC_CUSTOMER_STALE",
        outcome: "CONFLICT",
        resource_type: "CUSTOMER",
        resource_id: resourceId,
        stale_customer_snapshot: snapshot,
        expires_at: expiresAt,
      },
    });

    expect(conflict.stale_customer_snapshot).toEqual(snapshot);
    await expect(createReceipt()).resolves.toMatchObject({
      stale_customer_snapshot: null,
    });
  });

  it("looks up a receipt only within its organization", async () => {
    await createReceipt();

    await expect(
      prisma.syncOperationReceipt.findUnique({
        where: {
          organization_id_operation_id: {
            organization_id: organizationId,
            operation_id: operationId,
          },
        },
      }),
    ).resolves.toMatchObject({ resource_id: resourceId });

    await expect(
      prisma.syncOperationReceipt.findUnique({
        where: {
          organization_id_operation_id: {
            organization_id: otherOrganizationId,
            operation_id: operationId,
          },
        },
      }),
    ).resolves.toBeNull();
  });

  it("allows the same operation ID in another organization but rejects a duplicate in one organization", async () => {
    await createReceipt();
    await expect(createReceipt(otherOrganizationId)).resolves.toMatchObject({
      organization_id: otherOrganizationId,
    });
    await expect(createReceipt()).rejects.toMatchObject({ code: "P2002" });
  });

  it("retains expired receipts so replay remains detectable", async () => {
    const expiredAt = new Date("2029-12-31T00:00:00.000Z");
    await prisma.syncOperationReceipt.create({
      data: {
        organization_id: organizationId,
        operation_id: operationId,
        request_fingerprint: "sha256:expired-request",
        operation_type: "RENTAL_CREATE",
        result_code: "SYNC_APPLIED",
        outcome: "APPLIED",
        resource_type: "RENTAL",
        resource_id: resourceId,
        created_at: new Date("2029-12-01T00:00:00.000Z"),
        expires_at: expiredAt,
      },
    });

    await expect(
      prisma.syncOperationReceipt.findUnique({
        where: {
          organization_id_operation_id: {
            organization_id: organizationId,
            operation_id: operationId,
          },
        },
      }),
    ).resolves.toMatchObject({ expires_at: expiredAt });
  });
});
