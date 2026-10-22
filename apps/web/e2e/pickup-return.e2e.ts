import { expect, test } from "@playwright/test";
import { e2eRentalFixtures, loginAsE2eOwner } from "./e2e-fixtures";

test("reserved rental is picked up and returned through its lifecycle", async ({
  page,
}) => {
  await loginAsE2eOwner(page);
  await page.goto(`/rentals/${e2eRentalFixtures.lifecycleRentalId}`);
  const rentalStatus = page.getByText("حالة الإيجار").locator("..");
  const vehicleStatus = page.getByText("حالة السيارة").locator("..");
  await expect(rentalStatus.getByText("محجوز")).toBeVisible();
  await expect(vehicleStatus.getByText("محجوز")).toBeVisible();

  await page.getByRole("button", { name: "تسجيل الاستلام" }).click();
  await page.getByRole("button", { name: "تأكيد" }).click();
  await expect(page.getByText("تم تسجيل الاستلام.")).toBeVisible();
  await expect(rentalStatus.getByText("نشط")).toBeVisible();
  await expect(vehicleStatus.getByText("مؤجرة")).toBeVisible();

  await page.getByRole("button", { name: "إرجاع السيارة" }).click();
  await page.getByRole("button", { name: "تأكيد" }).click();
  await expect(page.getByText("تم تسجيل إرجاع السيارة.")).toBeVisible();
  await expect(rentalStatus.getByText("مُعاد")).toBeVisible();
  await expect(vehicleStatus.getByText("متاحة")).toBeVisible();
});
