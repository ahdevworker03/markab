import { expect, test } from "@playwright/test";
import { e2eEmployee, e2eTenantBoundary } from "./e2e-fixtures";

test("employee access is read-only and cannot cross tenant customer boundaries", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(e2eEmployee.email);
  await page.getByLabel("كلمة المرور").fill(e2eEmployee.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/customers");
  await expect(page.getByRole("button", { name: "إضافة عميل" })).toHaveCount(0);

  await page.goto(`/customers/${e2eTenantBoundary.otherCustomerId}`);
  await expect(page.getByText("تعذر تحميل العميل")).toBeVisible();
});
