import { beforeEach, describe, expect, it } from "vitest";
import { prisma, transaction } from "../database";
import { cleanup } from "../test/helpers";
import {
  createCustomer,
  createCustomerWithinTx,
  updateCustomer,
  updateCustomerWithinTx,
} from "./customers/customer.service";
import {
  createRental,
  createRentalWithinTx,
} from "./rentals/rental.service";

describe("externally owned domain transactions", () => {
  let organizationId: string;
  let customerId: string;
  let vehicleId: string;

  const customerInput = {
    first_name: "Transaction",
    last_name: "Customer",
    phone: "03000000",
    address: "Beirut",
    national_id: "TX-NID-1",
    license_number: "TX-LICENSE-1",
    license_expiry_date: new Date("2030-09-30T00:00:00.000Z"),
  };

  beforeEach(async () => {
    await cleanup();
    const organization = await prisma.organization.create({
      data: { name: "Transaction organization" },
    });
    organizationId = organization.id;
    const [customer, vehicle] = await Promise.all([
      prisma.customer.create({
        data: { ...customerInput, organization_id: organizationId },
      }),
      prisma.vehicle.create({
        data: {
          organization_id: organizationId,
          make: "Toyota",
          model: "Corolla",
          plate_number: "TX-VEHICLE-1",
          year: 2020,
          color: "White",
          transmission: "AUTOMATIC",
          fuel_type: "PETROL",
          seats: 5,
          current_mileage: 1000,
          status: "AVAILABLE",
        },
      }),
    ]);
    customerId = customer.id;
    vehicleId = vehicle.id;
  });

  const rentalInput = () => ({
    customer_id: customerId,
    vehicle_id: vehicleId,
    pickup_date: new Date("2030-01-01T09:00:00.000Z"),
    expected_return_date: new Date("2030-01-03T09:00:00.000Z"),
    daily_rate: 100,
    total_amount: 200,
    deposit_amount: 50,
    status: "RESERVED" as const,
  });

  it("keeps normal customer and rental creation behavior", async () => {
    const customer = await createCustomer(organizationId, {
      ...customerInput,
      national_id: "TX-NID-2",
      license_number: "TX-LICENSE-2",
    });
    const rental = await createRental(organizationId, rentalInput());
    const updatedCustomer = await updateCustomer(customerId, organizationId, {
      ...customerInput,
      first_name: "Updated",
    });

    expect(customer.id).toBeDefined();
    expect(updatedCustomer.firstName).toBe("Updated");
    expect(rental.status).toBe("RESERVED");
    await expect(
      prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    ).resolves.toMatchObject({ status: "RESERVED" });
  });

  it("rolls back customer create and update from an external transaction", async () => {
    await expect(
      transaction(
        async (tx) => {
          await createCustomerWithinTx(organizationId, {
            ...customerInput,
            national_id: "TX-NID-3",
            license_number: "TX-LICENSE-3",
          }, tx);
          await updateCustomerWithinTx(customerId, organizationId, {
            ...customerInput,
            first_name: "Changed",
          }, tx);
          throw new Error("rollback");
        },
        { isolationLevel: "Serializable" },
      ),
    ).rejects.toThrow("rollback");

    await expect(
      prisma.customer.findFirst({
        where: { organization_id: organizationId, national_id: "TX-NID-3" },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.customer.findUnique({ where: { id: customerId } }),
    ).resolves.toMatchObject({ first_name: "Transaction" });
  });

  it("rolls back rental creation and its vehicle status from an external transaction", async () => {
    await expect(
      transaction(
        async (tx) => {
          await createRentalWithinTx(organizationId, rentalInput(), tx);
          throw new Error("rollback");
        },
        { isolationLevel: "Serializable" },
      ),
    ).rejects.toThrow("rollback");

    await expect(
      prisma.rental.count({ where: { organization_id: organizationId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    ).resolves.toMatchObject({ status: "AVAILABLE" });
  });

  it("preserves rental availability rejection inside an external transaction", async () => {
    await createRental(organizationId, rentalInput());

    await expect(
      transaction(
        (tx) => createRentalWithinTx(organizationId, rentalInput(), tx),
        { isolationLevel: "Serializable" },
      ),
    ).rejects.toMatchObject({ code: "VEHICLE_UNAVAILABLE" });
  });
});
