import { expect, test } from "@playwright/test";
import {
  dateAfterE2eAnchor,
  e2eRentalFixtures,
  loginAsE2eOwner,
  selectE2eDate,
} from "./e2e-fixtures";

test("partial payment updates the server-derived outstanding balance", async ({
  page,
}) => {
  await loginAsE2eOwner(page);
  await page.goto(`/rentals/${e2eRentalFixtures.paymentRentalId}`);
  const total = page.getByText("إجمالي العقد", { exact: true }).locator("..");
  const paid = page.getByText("المدفوع", { exact: true }).locator("..");
  const outstanding = page.getByText("المتبقي", { exact: true }).locator("..");
  const paymentStatus = page
    .getByText("حالة الدفع", { exact: true })
    .locator("..");
  await expect(total.locator(":scope > div")).toHaveText("USD 100");
  await expect(paid.locator(":scope > div")).toHaveText("USD 0");

  await page.getByRole("button", { name: "تسجيل دفعة" }).click();
  await page.getByLabel("المبلغ").fill("40");
  await selectE2eDate(page, "تاريخ الدفع", dateAfterE2eAnchor(7));
  await page.getByLabel("طريقة الدفع").selectOption("CASH");
  await page.getByRole("button", { name: "تسجيل الدفعة" }).click();

  await expect(page.getByText("تم تسجيل الدفعة.")).toBeVisible();
  await expect(paid.locator(":scope > div")).toHaveText("USD 40");
  await expect(outstanding.locator(":scope > div")).toHaveText("USD 60");
  await expect(paymentStatus.getByText("دفعة جزئية")).toBeVisible();
});
