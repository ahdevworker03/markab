import { env, logger } from "../../config";

interface PasswordResetDelivery {
  email: string;
  token: string;
}

const testDeliveries: PasswordResetDelivery[] = [];
const RESEND_TIMEOUT_MS = 10_000;

type PasswordResetDeliveryHandler = (
  email: string,
  token: string,
) => Promise<void>;

interface ResendPasswordResetConfig {
  apiKey: string;
  from: string;
  resetUrl: URL;
}

class PasswordResetDeliveryError extends Error {
  constructor(readonly status?: number) {
    super("Password reset delivery failed.");
  }
}

function createResendPasswordResetDelivery(
  config: ResendPasswordResetConfig,
  fetcher: typeof fetch = globalThis.fetch,
  timeoutMs = RESEND_TIMEOUT_MS,
): PasswordResetDeliveryHandler {
  return async (email, token) => {
    const resetUrl = new URL(config.resetUrl);
    resetUrl.searchParams.set("token", token);

    let response: Response;
    try {
      response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [email],
          subject: "Reset your Markab password",
          html: `<p>Use this one-time link to reset your Markab password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour.</p><p>Ignore this email if you did not request a password reset.</p>`,
          text: `Use this one-time link to reset your Markab password:\n${resetUrl}\n\nThis link expires in one hour.\n\nIgnore this email if you did not request a password reset.`,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new PasswordResetDeliveryError();
    }

    if (!response.ok) {
      throw new PasswordResetDeliveryError(response.status);
    }
  };
}

let testDeliveryOverride: PasswordResetDeliveryHandler | undefined;

async function deliverPasswordReset(
  email: string,
  token: string,
): Promise<void> {
  let send: PasswordResetDeliveryHandler | undefined;

  if (process.env["NODE_ENV"] === "test") {
    send = testDeliveryOverride;
    if (!send) {
      testDeliveries.push({ email, token });
      return;
    }
  } else if (env.PASSWORD_RESET_EMAIL) {
    send = createResendPasswordResetDelivery(env.PASSWORD_RESET_EMAIL);
  }

  if (!send) return;

  try {
    await send(email, token);
  } catch (error) {
    logger.error(
      {
        provider: "resend",
        status:
          error instanceof PasswordResetDeliveryError
            ? error.status
            : undefined,
      },
      "Password reset delivery failed",
    );
  }
}

function getLatestPasswordResetDeliveryForTest(
  email: string,
): PasswordResetDelivery | undefined {
  return [...testDeliveries]
    .reverse()
    .find((delivery) => delivery.email === email);
}

function clearPasswordResetDeliveriesForTest(): void {
  testDeliveries.length = 0;
}

function setPasswordResetDeliveryForTest(
  delivery?: PasswordResetDeliveryHandler,
): void {
  testDeliveryOverride = delivery;
}

export {
  deliverPasswordReset,
  createResendPasswordResetDelivery,
  getLatestPasswordResetDeliveryForTest,
  clearPasswordResetDeliveriesForTest,
  setPasswordResetDeliveryForTest,
};
