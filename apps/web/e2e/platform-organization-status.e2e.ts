import { expect, test } from "@playwright/test";
import { e2ePlatformOwner } from "./e2e-fixtures";

test("platform owner suspends and reactivates a tenant organization", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(e2ePlatformOwner.email);
  await page.getByLabel("كلمة المرور").fill(e2ePlatformOwner.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/platform$/);

  await page.getByRole("link", { name: /E2E Tenant/ }).click();
  await expect(page.getByRole("heading", { name: "E2E Tenant" })).toBeVisible();

  await page.getByRole("radio", { name: "تعليق المؤسسة" }).check();
  await page.getByLabel("سبب التغيير").fill("E2E status check");
  await page.getByRole("button", { name: "تغيير الحالة" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "تعليق المؤسسة" }).click();
  await expect(page.getByText("الحالة الحالية").locator("..")).toContainText(
    "معلّق",
  );

  await page.getByRole("radio", { name: "إعادة تفعيل المؤسسة" }).check();
  await page.getByRole("button", { name: "تغيير الحالة" }).click();
  await dialog.getByRole("button", { name: "تأكيد التفعيل" }).click();
  await expect(page.getByText("الحالة الحالية").locator("..")).toContainText(
    "نشط",
  );
});
