import { expect, test, type Page } from "@playwright/test";

import { e2eOwner } from "./e2e-fixtures";

async function login(page: Page, password = e2eOwner.password) {
  await page.getByLabel("البريد الإلكتروني").fill(e2eOwner.email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "دخول" }).click();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
}

test("authenticated access/session redirects, persists, and logs out", async ({ page }) => {
  await page.goto("/customers");
  await expect(page).toHaveURL(/\/login$/);

  await login(page);
  await expect(page).toHaveURL(/\/$/);

  await page.reload();
  await expect(page).toHaveURL(/\/$/);

  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
});
