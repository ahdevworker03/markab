import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const e2eMailDirectory = resolve(import.meta.dirname, "../.e2e/mail");
const mailboxPath = resolve(e2eMailDirectory, "password-reset.jsonl");

export const e2eOwner = {
  email: "owner-e2e@markab.local",
  password: "e2e-owner-password",
} as const;

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
