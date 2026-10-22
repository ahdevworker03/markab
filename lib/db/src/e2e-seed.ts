import type { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { validateE2eTarget } from "./e2e-target";

const ownerEmail = "owner-e2e@markab.local";
const ownerPassword = "e2e-owner-password";
const organizationId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const otherOrganizationId = "00000000-0000-4000-8000-000000000003";
const otherCustomerId = "00000000-0000-4000-8000-000000000004";
const platformOrganizationId = "00000000-0000-4000-8000-000000000005";
const employeeId = "00000000-0000-4000-8000-000000000006";
const platformOwnerId = "00000000-0000-4000-8000-000000000007";
const rentalCustomerId = "00000000-0000-4000-8000-000000000008";
const availableVehicleId = "00000000-0000-4000-8000-000000000009";
const lifecycleVehicleId = "00000000-0000-4000-8000-000000000010";
const conflictVehicleId = "00000000-0000-4000-8000-000000000011";
const paymentVehicleId = "00000000-0000-4000-8000-000000000012";
const lifecycleRentalId = "00000000-0000-4000-8000-000000000013";
const conflictRentalId = "00000000-0000-4000-8000-000000000014";
const paymentRentalId = "00000000-0000-4000-8000-000000000015";
const maintenanceVehicleId = "00000000-0000-4000-8000-000000000016";
const employeeEmail = "employee-e2e@markab.local";
const platformOwnerEmail = "platform-owner-e2e@markab.local";

function fixtureDate(daysFromToday: number): Date {
  const date = new Date();
  date.setUTCHours(9, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date;
}

export type E2eSeed = {
  ownerEmail: string;
  ownerPassword: string;
};

export async function seedE2e(prisma: PrismaClient): Promise<E2eSeed> {
  validateE2eTarget(process.env);

  const passwordHash = await hash(ownerPassword);

  await prisma.$transaction(async (transaction) => {
    await transaction.organization.upsert({
      where: { id: organizationId },
      create: {
        id: organizationId,
        name: "E2E Tenant",
        status: "ACTIVE",
        email: "e2e-tenant@markab.local",
      },
      update: {
        name: "E2E Tenant",
        internalKey: null,
        status: "ACTIVE",
        email: "e2e-tenant@markab.local",
      },
    });
    await transaction.user.upsert({
      where: { email: ownerEmail },
      create: {
        id: ownerId,
        organization_id: organizationId,
        email: ownerEmail,
        password_hash: passwordHash,
        role: "OWNER",
      },
      update: {
        organization_id: organizationId,
        password_hash: passwordHash,
        role: "OWNER",
      },
    });
    await transaction.organization.upsert({
      where: { id: otherOrganizationId },
      create: {
        id: otherOrganizationId,
        name: "E2E Other Tenant",
        status: "ACTIVE",
      },
      update: {
        name: "E2E Other Tenant",
        internalKey: null,
        status: "ACTIVE",
      },
    });
    await transaction.organization.upsert({
      where: { id: platformOrganizationId },
      create: {
        id: platformOrganizationId,
        name: "Platform",
        internalKey: "platform",
        status: "ACTIVE",
      },
      update: {
        name: "Platform",
        internalKey: "platform",
        status: "ACTIVE",
      },
    });
    await transaction.user.upsert({
      where: { email: employeeEmail },
      create: {
        id: employeeId,
        organization_id: organizationId,
        email: employeeEmail,
        password_hash: passwordHash,
        role: "EMPLOYEE",
      },
      update: {
        organization_id: organizationId,
        password_hash: passwordHash,
        role: "EMPLOYEE",
        deleted_at: null,
      },
    });
    await transaction.user.upsert({
      where: { email: platformOwnerEmail },
      create: {
        id: platformOwnerId,
        organization_id: platformOrganizationId,
        email: platformOwnerEmail,
        password_hash: passwordHash,
        role: "PLATFORM_OWNER",
      },
      update: {
        organization_id: platformOrganizationId,
        password_hash: passwordHash,
        role: "PLATFORM_OWNER",
        deleted_at: null,
      },
    });
    await transaction.customer.upsert({
      where: { id: otherCustomerId },
      create: {
        id: otherCustomerId,
        organization_id: otherOrganizationId,
        first_name: "Other",
        last_name: "Tenant",
        phone: "0500000001",
        address: "Riyadh",
        national_id: "E2E-OTHER-0001",
        license_number: "E2E-OTHER-LIC-0001",
        license_expiry_date: new Date("2040-01-01T00:00:00.000Z"),
      },
      update: {
        organization_id: otherOrganizationId,
        first_name: "Other",
        last_name: "Tenant",
        phone: "0500000001",
        address: "Riyadh",
        national_id: "E2E-OTHER-0001",
        license_number: "E2E-OTHER-LIC-0001",
        license_expiry_date: new Date("2040-01-01T00:00:00.000Z"),
        deleted_at: null,
      },
    });
    await transaction.customer.upsert({
      where: { id: rentalCustomerId },
      create: {
        id: rentalCustomerId,
        organization_id: organizationId,
        first_name: "عميل",
        last_name: "اختبار",
        phone: "0500000000",
        address: "الرياض",
        national_id: "1000000000",
        license_number: "E2E-0001",
        license_expiry_date: new Date("2040-01-01T00:00:00.000Z"),
      },
      update: {
        organization_id: organizationId,
        first_name: "عميل",
        last_name: "اختبار",
        phone: "0500000000",
        address: "الرياض",
        national_id: "1000000000",
        license_number: "E2E-0001",
        license_expiry_date: new Date("2040-01-01T00:00:00.000Z"),
        deleted_at: null,
      },
    });
    for (const vehicle of [
      {
        id: availableVehicleId,
        make: "Toyota",
        model: "E2E Available",
        plate_number: "E2E-1001",
        status: "AVAILABLE" as const,
      },
      {
        id: lifecycleVehicleId,
        make: "Toyota",
        model: "E2E Lifecycle",
        plate_number: "E2E-1002",
        status: "RESERVED" as const,
      },
      {
        id: conflictVehicleId,
        make: "Toyota",
        model: "E2E Conflict",
        plate_number: "E2E-1003",
        status: "RESERVED" as const,
      },
      {
        id: paymentVehicleId,
        make: "Toyota",
        model: "E2E Payment",
        plate_number: "E2E-1004",
        status: "RESERVED" as const,
      },
      {
        id: maintenanceVehicleId,
        make: "Toyota",
        model: "E2E Maintenance",
        plate_number: "E2E-1005",
        status: "AVAILABLE" as const,
      },
    ]) {
      await transaction.vehicle.upsert({
        where: { id: vehicle.id },
        create: {
          ...vehicle,
          organization_id: organizationId,
          year: 2024,
          color: "White",
          transmission: "AUTOMATIC",
          fuel_type: "PETROL",
          seats: 5,
        },
        update: {
          ...vehicle,
          organization_id: organizationId,
          year: 2024,
          color: "White",
          transmission: "AUTOMATIC",
          fuel_type: "PETROL",
          seats: 5,
          deleted_at: null,
        },
      });
    }
    for (const rental of [
      {
        id: lifecycleRentalId,
        vehicle_id: lifecycleVehicleId,
        pickup_date: fixtureDate(1),
        expected_return_date: fixtureDate(3),
        daily_rate: 100,
        total_amount: 200,
      },
      {
        id: conflictRentalId,
        vehicle_id: conflictVehicleId,
        pickup_date: fixtureDate(4),
        expected_return_date: fixtureDate(6),
        daily_rate: 100,
        total_amount: 200,
      },
      {
        id: paymentRentalId,
        vehicle_id: paymentVehicleId,
        pickup_date: fixtureDate(7),
        expected_return_date: fixtureDate(9),
        daily_rate: 50,
        total_amount: 100,
      },
    ]) {
      await transaction.rental.upsert({
        where: { id: rental.id },
        create: {
          ...rental,
          organization_id: organizationId,
          customer_id: rentalCustomerId,
          status: "RESERVED",
          deposit_amount: 0,
        },
        update: {
          ...rental,
          organization_id: organizationId,
          customer_id: rentalCustomerId,
          status: "RESERVED",
          actual_pickup_date: null,
          actual_return_date: null,
          deposit_amount: 0,
          deleted_at: null,
        },
      });
    }
  });

  return { ownerEmail, ownerPassword };
}
