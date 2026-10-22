import { expect, test } from "@playwright/test";
import {
  dateAfterE2eAnchor,
  loginAsE2eOwner,
  selectE2eDate,
} from "./e2e-fixtures";

test("overlapping reservation reports an unavailable vehicle without creating another rental", async ({ page }) => {
  await loginAsE2eOwner(page);
  await page.goto("/rentals/new");
  await page.getByLabel("البحث عن عميل").fill("عميل اختبار");
  await page.getByRole("button", { name: /عميل اختبار/ }).click();
  await page.getByLabel("البحث عن سيارة").fill("E2E-1003");
  await page.getByRole("button", { name: /Toyota E2E Conflict/ }).click();
  await selectE2eDate(page, "تاريخ الاستلام", dateAfterE2eAnchor(4));
  await selectE2eDate(page, "تاريخ الإرجاع المتوقع", dateAfterE2eAnchor(6));
  await page.getByLabel("الأجرة اليومية").fill("100");
  await expect(page.getByText("هذه السيارة غير متاحة في الفترة المحددة.")).toBeVisible();
  await page.getByRole("button", { name: "حفظ الإيجار" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "هذه السيارة غير متاحة في الفترة المحددة.",
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/rentals\/new$/);
  await expect(page.getByText("تم إنشاء عقد الإيجار")).not.toBeVisible();
});
