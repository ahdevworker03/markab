import { expect, test } from "@playwright/test";
import {
  dateAfterE2eAnchor,
  loginAsE2eOwner,
  selectE2eDate,
} from "./e2e-fixtures";

const maintenanceVehicle = {
  id: "00000000-0000-4000-8000-000000000016",
  name: "Toyota E2E Maintenance",
  plate: "E2E-1005",
} as const;

async function expectVehicleRentalEligibility(
  page: Parameters<typeof loginAsE2eOwner>[0],
  eligible: boolean,
) {
  await page.goto("/rentals/new");
  await selectE2eDate(page, "تاريخ الإرجاع المتوقع", dateAfterE2eAnchor(2));
  await page.getByLabel("البحث عن سيارة").fill(maintenanceVehicle.plate);

  if (eligible) {
    await expect(
      page.getByRole("button", { name: new RegExp(maintenanceVehicle.name) }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByText("لا توجد سيارات متاحة في هذه الفترة."),
    ).toBeVisible();
  }
}

test("maintenance lifecycle blocks and restores vehicle rental eligibility", async ({
  page,
}) => {
  await loginAsE2eOwner(page);
  await page.goto("/maintenance/add");
  await page.getByLabel("السيارة").fill(maintenanceVehicle.plate);
  await page
    .getByRole("button", { name: new RegExp(maintenanceVehicle.name) })
    .click();
  await page.locator("#maintenance-type").selectOption("REPAIR");
  await selectE2eDate(page, "تاريخ الصيانة", dateAfterE2eAnchor(1));
  await page.getByRole("button", { name: "حفظ السجل" }).click();
  await expect(
    page.getByRole("heading", { name: "تم تسجيل الصيانة" }),
  ).toBeVisible();
  await page.waitForURL(/\/maintenance$/);
  await page.getByRole("button", { name: "عرض التفاصيل" }).click();
  await page.waitForURL(/\/maintenance\//);
  const maintenanceUrl = page.url();

  await page.getByRole("button", { name: "بدء الصيانة" }).click();
  await expect(page.getByText("تم بدء الصيانة.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "إكمال الصيانة" }),
  ).toBeVisible();
  await expectVehicleRentalEligibility(page, false);

  await page.goto(maintenanceUrl);
  await page.getByRole("button", { name: "إكمال الصيانة" }).click();
  await page.getByLabel("التكلفة النهائية").fill("150");
  await page.getByRole("button", { name: "تأكيد الإكمال" }).click();
  await expect(page.getByText("تم إكمال الصيانة.")).toBeVisible();
  await expect(page.getByText("تم إكمال هذا السجل.")).toBeVisible();

  await page.goto(`/vehicles/${maintenanceVehicle.id}`);
  const vehicleStatus = page.getByText("حالة السيارة").locator("..");
  await expect(vehicleStatus.getByText("متاحة")).toBeVisible();
  await expectVehicleRentalEligibility(page, true);
});
