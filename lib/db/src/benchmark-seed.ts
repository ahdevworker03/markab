import type { PrismaClient } from "@prisma/client";
import {
  type BenchmarkSeedProfile,
  validateBenchmarkTarget,
} from "./benchmark-target";

const tenantCount = 2;
const vehiclesPerTenant = 50;
const chunkSize = 100;
const profileCounts: Record<
  BenchmarkSeedProfile,
  { customersPerTenant: number; rentalsPerTenant: number }
> = {
  "full-pilot": { customersPerTenant: 1_000, rentalsPerTenant: 500 },
  "target-1000": { customersPerTenant: 700, rentalsPerTenant: 250 },
};

type BenchmarkOrganization = {
  id: string;
  name: string;
  internalKey: string;
  status: "ACTIVE";
  email: string;
};

type BenchmarkOwner = {
  id: string;
  organizationId: string;
  email: string;
};

type BenchmarkVehicle = {
  id: string;
  organizationId: string;
  make: string;
  model: string;
  plateNumber: string;
  year: number;
  color: string;
  transmission: "MANUAL" | "AUTOMATIC";
  fuelType: "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID";
  seats: number;
  currentMileage: number;
  status: "AVAILABLE" | "RESERVED" | "RENTED";
};

type BenchmarkCustomer = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  nationalId: string;
  licenseNumber: string;
  licenseExpiryDate: Date;
};

type BenchmarkRental = {
  id: string;
  organizationId: string;
  customerId: string;
  vehicleId: string;
  pickupDate: Date;
  expectedReturnDate: Date;
  actualPickupDate: Date | null;
  actualReturnDate: Date | null;
  status: "RESERVED" | "ACTIVE" | "RETURNED";
  dailyRate: string;
  totalAmount: string;
  depositAmount: string;
};

type BenchmarkPayment = {
  id: string;
  organizationId: string;
  rentalId: string;
  amount: string;
  paymentDate: Date;
  method: "CASH" | "CARD" | "TRANSFER";
};

export type BenchmarkTenant = {
  organization: BenchmarkOrganization;
  owner: BenchmarkOwner;
  vehicles: BenchmarkVehicle[];
  customers: BenchmarkCustomer[];
  rentals: BenchmarkRental[];
  payments: BenchmarkPayment[];
};

export type BenchmarkDatasetSummary = {
  tenantIds: string[];
  ownerEmails: string[];
  counts: {
    organizations: number;
    vehicles: number;
    customers: number;
    rentals: number;
  };
  paymentCount: number;
};

export function formatBenchmarkSummary(
  summary: BenchmarkDatasetSummary,
): string {
  const { counts } = summary;

  return `Benchmark seed complete: owners=${summary.ownerEmails.join(", ")}; organizations=${counts.organizations}; vehicles=${counts.vehicles}; customers=${counts.customers}; rentals=${counts.rentals}; payments=${summary.paymentCount}.`;
}

function benchmarkId(tenant: number, type: number, index: number): string {
  return `00000000-0000-4000-8000-${String(tenant * 1_000_000 + type * 10_000 + index).padStart(12, "0")}`;
}

function money(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function addDays(clock: Date, days: number): Date {
  return new Date(clock.getTime() + days * 86_400_000);
}

export function buildBenchmarkTenant(
  index: number,
  clock: Date,
  profile: BenchmarkSeedProfile = "full-pilot",
): BenchmarkTenant {
  const tenantNumber = index + 1;
  const organizationId = benchmarkId(tenantNumber, 1, 1);
  const { customersPerTenant, rentalsPerTenant } = profileCounts[profile];
  const rentalsPerVehicle = rentalsPerTenant / vehiclesPerTenant;
  const vehicles = Array.from(
    { length: vehiclesPerTenant },
    (_, vehicleIndex) => {
      const currentStatus = vehicleIndex % 5;
      const status =
        currentStatus === 0
          ? "RENTED"
          : currentStatus === 1
            ? "RESERVED"
            : "AVAILABLE";

      return {
        id: benchmarkId(tenantNumber, 2, vehicleIndex + 1),
        organizationId,
        make: ["Toyota", "Hyundai", "Kia", "Nissan"][vehicleIndex % 4]!,
        model: `Pilot ${vehicleIndex + 1}`,
        plateNumber: `BM-${tenantNumber}-${String(vehicleIndex + 1).padStart(3, "0")}`,
        year: 2022 + (vehicleIndex % 4),
        color: ["White", "Silver", "Black", "Blue"][vehicleIndex % 4]!,
        transmission: vehicleIndex % 2 === 0 ? "AUTOMATIC" : "MANUAL",
        fuelType: vehicleIndex % 4 === 0 ? "HYBRID" : "PETROL",
        seats: vehicleIndex % 3 === 0 ? 7 : 5,
        currentMileage: 20_000 + vehicleIndex * 1_000,
        status,
      } as const;
    },
  );
  const customers = Array.from(
    { length: customersPerTenant },
    (_, customerIndex) => ({
      id: benchmarkId(tenantNumber, 3, customerIndex + 1),
      organizationId,
      firstName: `Customer${tenantNumber}`,
      lastName: String(customerIndex + 1).padStart(4, "0"),
      phone: `+96170${String(tenantNumber * 1_000 + customerIndex).padStart(6, "0")}`,
      address: `Benchmark Street ${customerIndex + 1}`,
      nationalId: `BENCH-${tenantNumber}-${String(customerIndex + 1).padStart(4, "0")}`,
      licenseNumber: `LIC-${tenantNumber}-${String(customerIndex + 1).padStart(4, "0")}`,
      licenseExpiryDate: addDays(clock, 365 + customerIndex),
    }),
  );
  const rentals: BenchmarkRental[] = [];
  const payments: BenchmarkPayment[] = [];

  for (const [vehicleIndex, vehicle] of vehicles.entries()) {
    for (
      let rentalIndex = 0;
      rentalIndex < rentalsPerVehicle;
      rentalIndex += 1
    ) {
      const sequence = vehicleIndex * rentalsPerVehicle + rentalIndex;
      const current = rentalIndex === rentalsPerVehicle - 1;
      const rented = vehicle.status === "RENTED";
      const reserved = vehicle.status === "RESERVED";
      const pickupDate = current
        ? rented
          ? addDays(clock, -1)
          : reserved
            ? addDays(clock, 1)
            : addDays(clock, -10)
        : addDays(clock, -100 + rentalIndex * 8);
      const expectedReturnDate = addDays(pickupDate, 3);
      const returned = !current || vehicle.status === "AVAILABLE";
      const status = returned ? "RETURNED" : rented ? "ACTIVE" : "RESERVED";
      const dailyRateCents = 7_500 + (sequence % 7) * 500;
      const totalCents = dailyRateCents * 3;
      const rental: BenchmarkRental = {
        id: benchmarkId(tenantNumber, 4, sequence + 1),
        organizationId,
        customerId: customers[sequence * 2]!.id,
        vehicleId: vehicle.id,
        pickupDate,
        expectedReturnDate,
        actualPickupDate: status === "RESERVED" ? null : pickupDate,
        actualReturnDate: returned ? expectedReturnDate : null,
        status,
        dailyRate: money(dailyRateCents),
        totalAmount: money(totalCents),
        depositAmount: money(Math.min(10_000, totalCents)),
      };

      rentals.push(rental);

      if (sequence % 3 !== 0) {
        payments.push({
          id: benchmarkId(tenantNumber, 5, sequence + 1),
          organizationId,
          rentalId: rental.id,
          amount: money(sequence % 3 === 1 ? totalCents : totalCents / 2),
          paymentDate: returned ? expectedReturnDate : pickupDate,
          method: sequence % 2 === 0 ? "CARD" : "CASH",
        });
      }
    }
  }

  return {
    organization: {
      id: organizationId,
      name: `Benchmark Tenant ${tenantNumber}`,
      internalKey: `benchmark-tenant-${tenantNumber}`,
      status: "ACTIVE",
      email: `benchmark-tenant-${tenantNumber}@markab.local`,
    },
    owner: {
      id: benchmarkId(tenantNumber, 6, 1),
      organizationId,
      email: `benchmark-owner-${tenantNumber}@markab.local`,
    },
    vehicles,
    customers,
    rentals,
    payments,
  };
}

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }

  return result;
}

export async function seedBenchmark(
  prisma: PrismaClient,
  password: string,
  profile?: BenchmarkSeedProfile,
): Promise<BenchmarkDatasetSummary> {
  const target = validateBenchmarkTarget(process.env);

  if (target.password !== password) {
    throw new Error("Benchmark password must match BENCHMARK_PASSWORD.");
  }

  const { hash } = await import("argon2");
  const clock = new Date("2026-09-01T00:00:00.000Z");
  const selectedProfile = profile ?? target.profile;
  const tenants = Array.from({ length: tenantCount }, (_, index) =>
    buildBenchmarkTenant(index, clock, selectedProfile),
  );
  const passwordHash = await hash(password);

  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany();
    await tx.photo.deleteMany();
    await tx.contract.deleteMany();
    await tx.payment.deleteMany();
    await tx.rental.deleteMany();
    await tx.maintenanceSchedule.deleteMany();
    await tx.maintenance.deleteMany();
    await tx.expense.deleteMany();
    await tx.task.deleteMany();
    await tx.syncOperationReceipt.deleteMany();
    await tx.employeeInvitation.deleteMany();
    await tx.passwordResetToken.deleteMany();
    await tx.refreshToken.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.customer.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.user.deleteMany();
    await tx.organization.deleteMany();

    await tx.organization.createMany({
      data: tenants.map(({ organization }) => ({
        id: organization.id,
        name: organization.name,
        internalKey: organization.internalKey,
        status: organization.status,
        email: organization.email,
      })),
    });
    await tx.user.createMany({
      data: tenants.map(({ owner }) => ({
        id: owner.id,
        organization_id: owner.organizationId,
        email: owner.email,
        password_hash: passwordHash,
        role: "OWNER",
      })),
    });

    for (const tenant of tenants) {
      await tx.vehicle.createMany({
        data: tenant.vehicles.map((vehicle) => ({
          id: vehicle.id,
          organization_id: vehicle.organizationId,
          make: vehicle.make,
          model: vehicle.model,
          plate_number: vehicle.plateNumber,
          year: vehicle.year,
          color: vehicle.color,
          transmission: vehicle.transmission,
          fuel_type: vehicle.fuelType,
          seats: vehicle.seats,
          current_mileage: vehicle.currentMileage,
          status: vehicle.status,
        })),
      });
      await tx.customer.createMany({
        data: tenant.customers.map((customer) => ({
          id: customer.id,
          organization_id: customer.organizationId,
          first_name: customer.firstName,
          last_name: customer.lastName,
          phone: customer.phone,
          address: customer.address,
          national_id: customer.nationalId,
          license_number: customer.licenseNumber,
          license_expiry_date: customer.licenseExpiryDate,
        })),
      });
      for (const rentalChunk of chunks(tenant.rentals)) {
        await tx.rental.createMany({
          data: rentalChunk.map((rental) => ({
            id: rental.id,
            organization_id: rental.organizationId,
            customer_id: rental.customerId,
            vehicle_id: rental.vehicleId,
            pickup_date: rental.pickupDate,
            expected_return_date: rental.expectedReturnDate,
            actual_pickup_date: rental.actualPickupDate,
            actual_return_date: rental.actualReturnDate,
            status: rental.status,
            daily_rate: rental.dailyRate,
            total_amount: rental.totalAmount,
            deposit_amount: rental.depositAmount,
          })),
        });
      }
      for (const paymentChunk of chunks(tenant.payments)) {
        await tx.payment.createMany({
          data: paymentChunk.map((payment) => ({
            id: payment.id,
            organization_id: payment.organizationId,
            rental_id: payment.rentalId,
            amount: payment.amount,
            payment_date: payment.paymentDate,
            method: payment.method,
          })),
        });
      }
    }
  });

  return {
    tenantIds: tenants.map(({ organization }) => organization.id),
    ownerEmails: tenants.map(({ owner }) => owner.email),
    counts: {
      organizations: tenantCount,
      vehicles: tenants.reduce(
        (count, tenant) => count + tenant.vehicles.length,
        0,
      ),
      customers: tenants.reduce(
        (count, tenant) => count + tenant.customers.length,
        0,
      ),
      rentals: tenants.reduce(
        (count, tenant) => count + tenant.rentals.length,
        0,
      ),
    },
    paymentCount: tenants.reduce(
      (count, tenant) => count + tenant.payments.length,
      0,
    ),
  };
}
