import { expect, test } from "@playwright/test";
import {
  dateAfterE2eAnchor,
  e2eRentalFixtures,
  loginAsE2eOwner,
  selectE2eDate,
} from "./e2e-fixtures";

test("customer and available vehicle create a reserved rental", async ({
  page,
}) => {
  await loginAsE2eOwner(page);
  await page.goto("/customers/add");
  await page.getByLabel("الاسم الأول").fill("Reservation");
  await page.getByLabel("اسم العائلة").fill("E2E");
  await page.getByLabel("رقم الهاتف").fill("0500000011");
  await page.getByLabel("العنوان").fill("الرياض");
  await page.getByLabel("رقم الهوية").fill("1000000011");
  await page.getByLabel("رقم الرخصة").fill("E2E-0011");
  await selectE2eDate(page, "تاريخ انتهاء الرخصة", dateAfterE2eAnchor(0));
  await page.getByRole("button", { name: "حفظ العميل" }).click();
  await expect(page).toHaveURL(/\/customers\//);

  await page.goto("/rentals/new");
  await page.getByLabel("البحث عن عميل").fill("Reservation E2E");
  await page.getByRole("button", { name: /Reservation E2E/ }).click();
  await page.getByLabel("البحث عن سيارة").fill("E2E-1001");
  await page.getByRole("button", { name: /Toyota E2E Available/ }).click();
  await selectE2eDate(page, "تاريخ الاستلام", dateAfterE2eAnchor(10));
  await selectE2eDate(page, "تاريخ الإرجاع المتوقع", dateAfterE2eAnchor(12));
  await page.getByLabel("الأجرة اليومية").fill("75");
  await page.getByRole("button", { name: "حفظ الإيجار" }).click();

  await expect(
    page.getByRole("heading", { name: "تم إنشاء عقد الإيجار" }),
  ).toBeVisible();
  await expect(page.getByText("Reservation E2E")).toBeVisible();
  await expect(
    page.getByText(e2eRentalFixtures.availableVehicle),
  ).toBeVisible();
  await page.waitForURL(/\/rentals$/);
  const rentals = page.getByRole("table");
  const reservation = rentals.getByRole("row", { name: /Reservation E2E/ });
  await expect(reservation).toBeVisible();
  await expect(reservation.getByText("محجوز")).toBeVisible();
});
