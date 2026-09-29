import assert from "node:assert/strict";
import test from "node:test";
import * as argon2 from "argon2";
import {
  buildBenchmarkTenant,
  formatBenchmarkSummary,
  seedBenchmark,
} from "./benchmark-seed";
import { validateBenchmarkTarget } from "./benchmark-target";

type RentalInterval = {
  vehicleId: string;
  pickupDate: Date;
  expectedReturnDate: Date;
};

function hasOverlappingVehicleRentals(
  rentals: readonly RentalInterval[],
): boolean {
  const byVehicle = new Map<string, RentalInterval[]>();

  for (const rental of rentals) {
    const intervals = byVehicle.get(rental.vehicleId) ?? [];
    intervals.push(rental);
    byVehicle.set(rental.vehicleId, intervals);
  }

  return [...byVehicle.values()].some((intervals) => {
    intervals.sort(
      (left, right) => left.pickupDate.getTime() - right.pickupDate.getTime(),
    );

    return intervals.some(
      (interval, index) =>
        index > 0 &&
        interval.pickupDate < intervals[index - 1]!.expectedReturnDate,
    );
  });
}

test("formats benchmark owner emails and dataset counts without secrets", () => {
  const summary = formatBenchmarkSummary({
    tenantIds: ["tenant-1", "tenant-2"],
    ownerEmails: ["owner-1@markab.local", "owner-2@markab.local"],
    counts: {
      organizations: 2,
      vehicles: 100,
      customers: 2_000,
      rentals: 1_000,
    },
    paymentCount: 1_332,
  });

  assert.equal(
    summary,
    "Benchmark seed complete: owners=owner-1@markab.local, owner-2@markab.local; organizations=2; vehicles=100; customers=2000; rentals=1000; payments=1332.",
  );
  assert.doesNotMatch(summary, /password|secret/i);
});

test("buildBenchmarkTenant creates an invariant-safe pilot tenant", () => {
  const tenant = buildBenchmarkTenant(0, new Date("2026-09-01T00:00:00.000Z"));
  const rentalsById = new Map(
    tenant.rentals.map((rental) => [rental.id, rental]),
  );
  const paymentTotals = new Map<string, number>();

  for (const payment of tenant.payments) {
    paymentTotals.set(
      payment.rentalId,
      (paymentTotals.get(payment.rentalId) ?? 0) + Number(payment.amount),
    );
  }

  assert.equal(tenant.vehicles.length, 50);
  assert.equal(tenant.customers.length, 1_000);
  assert.equal(tenant.rentals.length, 500);
  assert.equal(
    tenant.payments.some((payment) => Number(payment.amount) > 0),
    true,
  );
  assert.equal(new Set(tenant.vehicles.map((vehicle) => vehicle.id)).size, 50);
  assert.equal(
    new Set(tenant.customers.map((customer) => customer.id)).size,
    1_000,
  );
  assert.equal(new Set(tenant.rentals.map((rental) => rental.id)).size, 500);
  assert.equal(hasOverlappingVehicleRentals(tenant.rentals), false);
  assert.equal(
    tenant.rentals.every(
      (rental) => rental.expectedReturnDate > rental.pickupDate,
    ),
    true,
  );
  assert.equal(
    tenant.rentals.every(
      (rental) =>
        rental.organizationId === tenant.organization.id &&
        tenant.vehicles.some((vehicle) => vehicle.id === rental.vehicleId) &&
        tenant.customers.some((customer) => customer.id === rental.customerId),
    ),
    true,
  );
  assert.equal(
    tenant.rentals.every((rental) => {
      const vehicle = tenant.vehicles.find(
        (candidate) => candidate.id === rental.vehicleId,
      )!;

      return rental.status === "RETURNED"
        ? rental.actualPickupDate !== null && rental.actualReturnDate !== null
        : rental.status === "ACTIVE"
          ? rental.actualPickupDate !== null &&
            rental.actualReturnDate === null &&
            vehicle.status === "RENTED"
          : rental.actualPickupDate === null &&
            rental.actualReturnDate === null &&
            vehicle.status === "RESERVED";
    }),
    true,
  );
  assert.equal(
    tenant.payments.every(
      (payment) =>
        payment.organizationId === tenant.organization.id &&
        rentalsById.has(payment.rentalId) &&
        Number(payment.amount) > 0 &&
        Number(payment.amount) <=
          Number(rentalsById.get(payment.rentalId)!.totalAmount),
    ),
    true,
  );
  assert.equal(
    tenant.rentals.some((rental) => (paymentTotals.get(rental.id) ?? 0) === 0),
    true,
  );
  assert.equal(
    tenant.rentals.some((rental) => {
      const paid = paymentTotals.get(rental.id) ?? 0;
      return paid > 0 && paid < Number(rental.totalAmount);
    }),
    true,
  );
  assert.equal(
    tenant.rentals.some(
      (rental) =>
        (paymentTotals.get(rental.id) ?? 0) === Number(rental.totalAmount),
    ),
    true,
  );
});

test("buildBenchmarkTenant creates an invariant-safe target tenant with 1,000 syncable resources", () => {
  const tenant = buildBenchmarkTenant(
    0,
    new Date("2026-09-01T00:00:00.000Z"),
    "target-1000",
  );

  assert.equal(tenant.vehicles.length, 50);
  assert.equal(tenant.customers.length, 700);
  assert.equal(tenant.rentals.length, 250);
  assert.equal(
    tenant.vehicles.length + tenant.customers.length + tenant.rentals.length,
    1_000,
  );
  assert.equal(hasOverlappingVehicleRentals(tenant.rentals), false);
  assert.equal(
    tenant.rentals.every((rental) => {
      const vehicle = tenant.vehicles.find(
        (candidate) => candidate.id === rental.vehicleId,
      )!;

      return rental.status === "RETURNED"
        ? rental.actualPickupDate !== null && rental.actualReturnDate !== null
        : rental.status === "ACTIVE"
          ? rental.actualPickupDate !== null &&
            rental.actualReturnDate === null &&
            vehicle.status === "RENTED"
          : rental.actualPickupDate === null &&
            rental.actualReturnDate === null &&
            vehicle.status === "RESERVED";
    }),
    true,
  );
});

const benchmarkEnvironmentPresent =
  [
    "NODE_ENV",
    "DATABASE_URL",
    "BENCHMARK_DATABASE_URL",
    "BENCHMARK_PASSWORD",
  ].every((name) => Boolean(process.env[name])) &&
  process.env["NODE_ENV"] === "benchmark";

test(
  "restores full-pilot row counts after seeding target-1000",
  { skip: !benchmarkEnvironmentPresent },
  async () => {
    const target = validateBenchmarkTarget(process.env);
    const { default: prisma } = await import("./index");

    try {
      const first = await seedBenchmark(prisma, target.password, "full-pilot");
      assert.deepEqual(first.counts, {
        organizations: 2,
        vehicles: 100,
        customers: 2_000,
        rentals: 1_000,
      });
      assert.ok(first.paymentCount > 0);
      assert.deepEqual(
        {
          organizations: await prisma.organization.count(),
          vehicles: await prisma.vehicle.count(),
          customers: await prisma.customer.count(),
          rentals: await prisma.rental.count(),
        },
        first.counts,
      );
      const owners = await prisma.user.findMany({
        where: { email: { in: first.ownerEmails } },
        select: { password_hash: true },
      });
      assert.equal(owners.length, 2);
      assert.equal(
        (
          await Promise.all(
            owners.map((owner) =>
              argon2.verify(owner.password_hash, target.password),
            ),
          )
        ).every(Boolean),
        true,
      );

      const second = await seedBenchmark(prisma, target.password, "full-pilot");
      assert.deepEqual(second.counts, first.counts);
      assert.equal(second.paymentCount, first.paymentCount);
      assert.deepEqual(
        {
          organizations: await prisma.organization.count(),
          vehicles: await prisma.vehicle.count(),
          customers: await prisma.customer.count(),
          rentals: await prisma.rental.count(),
        },
        second.counts,
      );

      const targetProfile = await seedBenchmark(
        prisma,
        target.password,
        "target-1000",
      );
      assert.deepEqual(targetProfile.counts, {
        organizations: 2,
        vehicles: 100,
        customers: 1_400,
        rentals: 500,
      });

      const fullPilot = await seedBenchmark(
        prisma,
        target.password,
        "full-pilot",
      );
      assert.deepEqual(fullPilot.counts, first.counts);
      assert.deepEqual(
        {
          organizations: await prisma.organization.count(),
          vehicles: await prisma.vehicle.count(),
          customers: await prisma.customer.count(),
          rentals: await prisma.rental.count(),
        },
        fullPilot.counts,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
