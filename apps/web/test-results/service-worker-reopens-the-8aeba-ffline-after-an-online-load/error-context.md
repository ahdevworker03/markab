# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: service-worker.spec.ts >> reopens the public application shell offline after an online load
- Location: e2e/service-worker.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'تسجيل الدخول' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'تسجيل الدخول' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'تسجيل الدخول' })

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("reopens the public application shell offline after an online load", async ({
  4  |   page,
  5  |   context,
  6  | }) => {
  7  |   await page.goto("/login");
  8  |   await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  9  | 
  10 |   await page.waitForFunction(async () => {
  11 |     await navigator.serviceWorker.ready;
  12 |     return navigator.serviceWorker.controller !== null;
  13 |   });
  14 | 
  15 |   await context.setOffline(true);
  16 |   await page.reload();
  17 | 
> 18 |   await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
     |                                                                     ^ Error: expect(locator).toBeVisible() failed
  19 | });
  20 | 
```