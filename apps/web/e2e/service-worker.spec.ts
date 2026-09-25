import { expect, test } from "@playwright/test";

test("reopens the public application shell offline after an online load", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();

  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  });

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
});
