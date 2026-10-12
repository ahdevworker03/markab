import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import { prisma } from "../../database";
import { generateAccessToken } from "../../modules/auth";
import { cleanup, seed } from "../../test/helpers";
import * as paymentRepository from "./payment.repository";

describe("payment timeout replay probe", () => {
  it("replays a committed payment after the client socket disconnects", async () => {
    await cleanup();
    const { orgId, vehicleId } = await seed();
    const user = await prisma.user.create({
      data: {
        organization_id: orgId,
        email: `timeout-owner-${Date.now()}@example.com`,
        password_hash: "hash",
        role: "OWNER",
      },
    });
    const customer = await prisma.customer.create({
      data: {
        organization_id: orgId,
        first_name: "Timeout",
        last_name: "Customer",
        phone: "123456",
        address: "Beirut",
        national_id: `NID-${Date.now()}`,
        license_number: `LIC-${Date.now()}`,
        license_expiry_date: new Date("2030-01-01T00:00:00Z"),
      },
    });
    const rental = await prisma.rental.create({
      data: {
        organization_id: orgId,
        customer_id: customer.id,
        vehicle_id: vehicleId,
        pickup_date: new Date("2026-08-01T09:00:00Z"),
        expected_return_date: new Date("2026-08-10T09:00:00Z"),
        status: "ACTIVE",
        daily_rate: 50,
        total_amount: 500,
        deposit_amount: 100,
      },
    });
    const token = generateAccessToken({ sub: user.id, org: orgId, role: "OWNER" });
    const operationId = "00000000-0000-4000-8000-000000000099";
    const payload = {
      amount: 125,
      payment_date: "2026-08-02T09:00:00Z",
      method: "CASH",
      operation_id: operationId,
    };
    const findReceipt = paymentRepository.findOperationReceipt;
    vi.spyOn(paymentRepository, "findOperationReceipt").mockImplementationOnce(
      async (data, tx) => {
        await new Promise((resolve) => setTimeout(resolve, 30_500));
        return findReceipt(data, tx);
      },
    );

    try {
      const first = await request(app)
        .post(`/api/rentals/${rental.id}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .send(payload)
        .catch((error: Error) => error);

      expect(first).toBeInstanceOf(Error);

      let receipt = null;
      for (let attempt = 0; attempt < 20 && !receipt; attempt += 1) {
        receipt = await prisma.paymentOperationReceipt.findUnique({
          where: {
            organization_id_operation_id: {
              organization_id: orgId,
              operation_id: operationId,
            },
          },
          include: { payment: true },
        });
        if (!receipt) await new Promise((resolve) => setTimeout(resolve, 200));
      }

      expect(receipt).not.toBeNull();
      const retry = await request(app)
        .post(`/api/rentals/${rental.id}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .send(payload);
      const changedPayload = await request(app)
        .post(`/api/rentals/${rental.id}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...payload, amount: 100 });
      const balance = await request(app)
        .get(`/api/rentals/${rental.id}/payments`)
        .set("Authorization", `Bearer ${token}`);

      expect(retry.status).toBe(201);
      expect(retry.body.data.id).toBe(receipt!.payment.id);
      await expect(
        prisma.payment.count({ where: { rental_id: rental.id } }),
      ).resolves.toBe(1);
      await expect(
        prisma.paymentOperationReceipt.count({ where: { organization_id: orgId } }),
      ).resolves.toBe(1);
      expect(balance.body.data.outstandingBalance).toBe(375);
      expect(changedPayload.status).toBe(409);
      expect(changedPayload.body.error.code).toBe(
        "PAYMENT_OPERATION_PAYLOAD_MISMATCH",
      );
    } finally {
      vi.restoreAllMocks();
      await cleanup();
    }
  }, 45_000);
});
