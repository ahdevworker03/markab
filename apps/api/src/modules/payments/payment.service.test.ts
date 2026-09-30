import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../database";
import {
  listPayments,
  listRentalPayments,
  listOutstandingBalances,
  createPayment,
} from "./payment.service";
import { cleanup, seed, type SeedOrg } from "../../test/helpers";
import * as repository from "./payment.repository";

describe("payment service", () => {
  let ctx: SeedOrg;
  let rentalId: string;

  async function createRental(
    orgId: string,
    totalAmount: number,
  ): Promise<string> {
    const customer = await prisma.customer.create({
      data: {
        organization_id: orgId,
        first_name: "Test",
        last_name: "Customer",
        phone: "123456",
        address: "Beirut",
        national_id: `NID-${Date.now()}-${Math.random()}`,
        license_number: `LIC-${Date.now()}-${Math.random()}`,
        license_expiry_date: new Date("2030-01-01T00:00:00Z"),
      },
    });
    const vehicle = await prisma.vehicle.findFirst({
      where: { organization_id: orgId },
      select: { id: true },
    });
    if (!vehicle) throw new Error("no vehicle seeded");
    const rental = await prisma.rental.create({
      data: {
        organization_id: orgId,
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        pickup_date: new Date("2026-08-01T09:00:00Z"),
        expected_return_date: new Date("2026-08-10T09:00:00Z"),
        status: "ACTIVE",
        daily_rate: 50,
        total_amount: totalAmount,
        deposit_amount: 100,
      },
    });
    return rental.id;
  }

  beforeEach(async () => {
    await cleanup();
    ctx = await seed();
    rentalId = await createRental(ctx.orgId, 500);
  });

  describe("create", () => {
    it("records a valid payment for a rental in the organization", async () => {
      const payment = await createPayment(rentalId, ctx.orgId, {
        amount: 100,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });

      expect(payment.rentalId).toBe(rentalId);
      expect(payment.amount).toBe(100);
      expect(payment.method).toBe("CASH");
    });

    it("supports multiple payments for the same rental (partial payments)", async () => {
      await createPayment(rentalId, ctx.orgId, {
        amount: 100,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });
      await createPayment(rentalId, ctx.orgId, {
        amount: 50,
        payment_date: new Date("2026-08-03T09:00:00Z"),
        method: "TRANSFER",
      });

      const result = await listRentalPayments(rentalId, ctx.orgId);
      expect(result.payments).toHaveLength(2);
    });

    it("rejects a payment for a rental in another organization", async () => {
      const otherRental = await createRental(ctx.otherOrgId, 100);

      await expect(
        createPayment(otherRental, ctx.orgId, {
          amount: 10,
          payment_date: new Date("2026-08-02T09:00:00Z"),
          method: "CASH",
        }),
      ).rejects.toThrow("Rental not found");
    });

    it("rejects a missing rental", async () => {
      await expect(
        createPayment("00000000-0000-0000-0000-000000000000", ctx.orgId, {
          amount: 10,
          payment_date: new Date("2026-08-02T09:00:00Z"),
          method: "CASH",
        }),
      ).rejects.toThrow("Rental not found");
    });

    it("rejects a non-positive amount", async () => {
      await expect(
        createPayment(rentalId, ctx.orgId, {
          amount: 0,
          payment_date: new Date("2026-08-02T09:00:00Z"),
          method: "CASH",
        }),
      ).rejects.toThrow("strictly greater than zero");
    });

    it("rejects a negative amount", async () => {
      await expect(
        createPayment(rentalId, ctx.orgId, {
          amount: -5,
          payment_date: new Date("2026-08-02T09:00:00Z"),
          method: "CASH",
        }),
      ).rejects.toThrow("strictly greater than zero");
    });

    it("rejects an invalid payment method", async () => {
      await expect(
        createPayment(rentalId, ctx.orgId, {
          amount: 10,
          payment_date: new Date("2026-08-02T09:00:00Z"),
          method: "STRIPE" as never,
        }),
      ).rejects.toThrow("Invalid payment method");
    });
  });

  describe("list for a rental", () => {
    it("returns only that rental's payments", async () => {
      const otherRental = await createRental(ctx.orgId, 300);

      await createPayment(rentalId, ctx.orgId, {
        amount: 100,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });
      await createPayment(otherRental, ctx.orgId, {
        amount: 50,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CARD",
      });

      const result = await listRentalPayments(rentalId, ctx.orgId);
      expect(result.payments).toHaveLength(1);
      expect(result.payments[0].amount).toBe(100);
    });

    it("returns 404 for a rental in another organization", async () => {
      const otherRental = await createRental(ctx.otherOrgId, 100);

      await expect(listRentalPayments(otherRental, ctx.orgId)).rejects.toThrow(
        "Rental not found",
      );
    });

    it("derives outstanding balance as total minus active payments", async () => {
      await createPayment(rentalId, ctx.orgId, {
        amount: 100,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });
      await createPayment(rentalId, ctx.orgId, {
        amount: 50,
        payment_date: new Date("2026-08-03T09:00:00Z"),
        method: "TRANSFER",
      });

      const result = await listRentalPayments(rentalId, ctx.orgId);
      expect(result.outstandingBalance).toBe(500 - 150);
    });

    it("derives the balance exactly using Decimal arithmetic (1.00 - 0.10 - 0.20 = 0.70)", async () => {
      const smallRental = await createRental(ctx.orgId, 1);
      await createPayment(smallRental, ctx.orgId, {
        amount: 0.1,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });
      await createPayment(smallRental, ctx.orgId, {
        amount: 0.2,
        payment_date: new Date("2026-08-03T09:00:00Z"),
        method: "TRANSFER",
      });

      const result = await listRentalPayments(smallRental, ctx.orgId);
      expect(result.outstandingBalance).toBe(0.7);
      expect(result.outstandingBalance).toBeGreaterThan(0.69);
      expect(result.outstandingBalance).toBeLessThan(0.71);
    });

    it("excludes soft-deleted payments from the balance", async () => {
      const payment = await createPayment(rentalId, ctx.orgId, {
        amount: 100,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { deleted_at: new Date() },
      });

      const result = await listRentalPayments(rentalId, ctx.orgId);
      expect(result.payments).toHaveLength(0);
      expect(result.outstandingBalance).toBe(500);
    });
  });

  describe("list organization-wide", () => {
    it("returns only the organization's payments", async () => {
      const otherRental = await createRental(ctx.orgId, 300);

      await createPayment(rentalId, ctx.orgId, {
        amount: 100,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });
      await createPayment(otherRental, ctx.orgId, {
        amount: 50,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CARD",
      });

      const payments = await listPayments(ctx.orgId);
      expect(payments).toHaveLength(2);
    });

    it("does not include another organization's payments", async () => {
      const otherRental = await createRental(ctx.otherOrgId, 100);
      await createPayment(otherRental, ctx.otherOrgId, {
        amount: 99,
        payment_date: new Date("2026-08-02T09:00:00Z"),
        method: "CASH",
      });

      const payments = await listPayments(ctx.orgId);
      expect(payments).toHaveLength(0);
    });
  });

  describe("outstanding-balance summary", () => {
    const record = (rentalId: string, organizationId: string, amount: number) =>
      prisma.payment.create({
        data: {
          organization_id: organizationId,
          rental_id: rentalId,
          amount,
          method: "CASH",
          payment_date: new Date("2026-08-02T09:00:00Z"),
        },
      });

    it("matches a single partial payment and uses two bulk reads as rentals grow", async () => {
      await record(rentalId, ctx.orgId, 125);
      const rentalRead = vi.spyOn(repository, "findOutstandingRentals");
      const paymentRead = vi.spyOn(repository, "sumOutstandingPayments");
      try {
        const first = await listOutstandingBalances(ctx.orgId);
        expect(first.balances[0]).toMatchObject({
          paidAmount: 125,
          outstandingBalance: 375,
        });
        await createRental(ctx.orgId, 50);
        const second = await listOutstandingBalances(ctx.orgId);
        expect(second.balances).toHaveLength(2);
        expect(rentalRead).toHaveBeenCalledTimes(2);
        expect(paymentRead).toHaveBeenCalledTimes(2);
      } finally {
        rentalRead.mockRestore();
        paymentRead.mockRestore();
      }
    });

    it("includes zero, partial, full, returned and cancelled rentals with Decimal totals per customer", async () => {
      const partialId = await createRental(ctx.orgId, 200);
      const fullId = await createRental(ctx.orgId, 20);
      const decimalId = await createRental(ctx.orgId, 1);
      const returnedId = await createRental(ctx.orgId, 30);
      const cancelledId = await createRental(ctx.orgId, 40);
      const first = await prisma.rental.findUniqueOrThrow({
        where: { id: rentalId },
      });
      await prisma.rental.update({
        where: { id: partialId },
        data: { customer_id: first.customer_id },
      });
      await prisma.rental.update({
        where: { id: returnedId },
        data: { status: "RETURNED" },
      });
      await prisma.rental.update({
        where: { id: cancelledId },
        data: { status: "CANCELLED" },
      });
      await record(partialId, ctx.orgId, 50);
      await record(partialId, ctx.orgId, 75);
      await record(fullId, ctx.orgId, 20);
      await record(decimalId, ctx.orgId, 0.1);
      await record(decimalId, ctx.orgId, 0.2);

      const result = await listOutstandingBalances(ctx.orgId);
      const balances = new Map(
        result.balances.map((balance) => [balance.rentalId, balance]),
      );
      expect(balances.get(rentalId)).toMatchObject({
        totalAmount: 500,
        paidAmount: 0,
        outstandingBalance: 500,
      });
      expect(balances.get(partialId)).toMatchObject({
        customerId: first.customer_id,
        totalAmount: 200,
        paidAmount: 125,
        outstandingBalance: 75,
      });
      expect(balances.get(fullId)).toMatchObject({
        paidAmount: 20,
        outstandingBalance: 0,
      });
      expect(balances.get(decimalId)).toMatchObject({
        totalAmount: 1,
        paidAmount: 0.3,
        outstandingBalance: 0.7,
      });
      expect(balances.get(returnedId)?.outstandingBalance).toBe(30);
      expect(balances.get(cancelledId)?.outstandingBalance).toBe(40);
      expect(result.totalOutstanding).toBe(645.7);
      expect(result.customerOutstanding).toContainEqual({
        customerId: first.customer_id,
        outstandingBalance: 575,
      });
    });

    it("keeps legacy negative balances but excludes deleted payments, rentals and other tenants", async () => {
      const overpaidId = await createRental(ctx.orgId, 100);
      const deletedId = await createRental(ctx.orgId, 60);
      const foreignId = await createRental(ctx.otherOrgId, 90);
      await record(overpaidId, ctx.orgId, 110);
      const first = await prisma.rental.findUniqueOrThrow({
        where: { id: rentalId },
      });
      await prisma.rental.update({
        where: { id: overpaidId },
        data: { customer_id: first.customer_id },
      });
      const deletedPayment = await record(rentalId, ctx.orgId, 50);
      await prisma.payment.update({
        where: { id: deletedPayment.id },
        data: { deleted_at: new Date() },
      });
      await prisma.rental.update({
        where: { id: deletedId },
        data: { deleted_at: new Date() },
      });
      await record(foreignId, ctx.otherOrgId, 10);

      const result = await listOutstandingBalances(ctx.orgId);
      expect(result.balances).toHaveLength(2);
      expect(result.balances).toContainEqual(
        expect.objectContaining({
          rentalId: overpaidId,
          paidAmount: 110,
          outstandingBalance: -10,
        }),
      );
      expect(result.balances).toContainEqual(
        expect.objectContaining({
          rentalId,
          paidAmount: 0,
          outstandingBalance: 500,
        }),
      );
      expect(result.totalOutstanding).toBe(490);
      expect(result.customerOutstanding).toHaveLength(1);
      expect(result.customerOutstanding[0]?.outstandingBalance).toBe(500);
    });
  });
});
