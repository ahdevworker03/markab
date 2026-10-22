import { expect, test, type Page } from "@playwright/test";

import { e2eOwner, readLatestResetUrl } from "./e2e-fixtures";

const newPassword = "e2e-owner-password-reset";

async function login(page: Page, password: string) {
  await page.getByLabel("البريد الإلكتروني").fill(e2eOwner.email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "دخول" }).click();
}

async function requestReset(page: Page, email: string) {
  await page.goto("/password-reset");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(
    page.getByText("إذا كان البريد مسجلاً، ستصلك تعليمات إعادة التعيين."),
  ).toBeVisible();
}

async function confirmReset(page: Page, password: string) {
  await page.getByLabel("كلمة المرور الجديدة").fill(password);
  await page.getByRole("button", { name: "تحديث كلمة المرور" }).click();
  await expect(
    page.getByText("تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن."),
  ).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await requestReset(page, e2eOwner.email);
  await page.goto(await readLatestResetUrl(e2eOwner.email));
  await confirmReset(page, e2eOwner.password);
});

test("password reset rejects the old password and accepts the new password", async ({
  page,
}) => {
  await requestReset(page, e2eOwner.email);
  const resetUrl = await readLatestResetUrl(e2eOwner.email);

  await page.goto(resetUrl);
  await confirmReset(page, newPassword);

  await page.getByRole("button", { name: "العودة لتسجيل الدخول" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, e2eOwner.password);
  await expect(
    page.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة."),
  ).toBeVisible();

  await login(page, newPassword);
  await expect(page).toHaveURL(/\/$/);
});

test("seeded owner password remains available after the reset scenario", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, e2eOwner.password);
  await expect(page).toHaveURL(/\/$/);
});
