import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

const e2eMailDirectory = resolve(import.meta.dirname, "../.e2e/mail");
const mailboxPath = resolve(e2eMailDirectory, "password-reset.jsonl");

export const e2eOwner = {
  email: "owner-e2e@markab.local",
  password: "e2e-owner-password",
} as const;

export const e2eRentalFixtures = {
  availableVehicle: "Toyota E2E Available",
  lifecycleRentalId: "00000000-0000-4000-8000-000000000008",
  conflictVehicle: "Toyota E2E Conflict",
  paymentRentalId: "00000000-0000-4000-8000-000000000010",
} as const;

export function dateAfterE2eAnchor(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function selectE2eDate(
  page: Page,
  label: string,
  date: string,
): Promise<void> {
  const trigger = page.getByLabel(label);
  await trigger.click();
  const calendar = page.getByRole("dialog");
  const month = calendar.getByRole("status");
  const previousMonth = await month.textContent();
  const day = calendar.locator(`button[data-day="${date}"]`);

  if (!(await day.isVisible())) {
    await calendar
      .getByRole("button", { name: "Go to the Next Month" })
      .click();
    await expect(month).not.toHaveText(previousMonth ?? "");
  }

  await expect(day).toHaveCount(1);
  await day.click();
  await expect(calendar).toBeHidden();
}

export async function loginAsE2eOwner(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(e2eOwner.email);
  await page.getByLabel("كلمة المرور").fill(e2eOwner.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await page.waitForURL(/\/$/);
}

type ResetDelivery = {
  email: string;
  resetUrl: string;
};

function isResetDelivery(value: unknown): value is ResetDelivery {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    "resetUrl" in value &&
    typeof value.resetUrl === "string"
  );
}

export async function readLatestResetUrl(email: string): Promise<string> {
  let content: string;
  try {
    content = await readFile(mailboxPath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No E2E reset delivery exists for ${email}.`);
    }
    throw error;
  }

  const delivery = content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown)
    .filter(isResetDelivery)
    .reverse()
    .find((entry) => entry.email === email);

  if (!delivery) throw new Error(`No E2E reset delivery exists for ${email}.`);
  return delivery.resetUrl;
}
