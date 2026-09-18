import { describe, expect, it, vi } from "vitest";
import { createResendPasswordResetDelivery } from "./password-reset.delivery";

const config = {
  apiKey: "re_test_key",
  from: "Markab <security@example.com>",
  resetUrl: new URL("https://app.example.com/reset-password"),
};

describe("Resend password-reset delivery", () => {
  it("sends the configured sender, recipient, one-hour copy, and server-built reset link", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const send = createResendPasswordResetDelivery(config, fetcher);

    await send("owner@example.com", "one-time-token");

    expect(fetcher).toHaveBeenCalledOnce();
    const [endpoint, options] = fetcher.mock.calls[0]!;
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(options).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer re_test_key",
        "Content-Type": "application/json",
      },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(fetcher.mock.calls[0]![1]!.body as string) as {
      html: string;
      text: string;
    };
    expect(body.html).toContain(
      "https://app.example.com/reset-password?token=one-time-token",
    );
    expect(body.text).toContain(
      "https://app.example.com/reset-password?token=one-time-token",
    );
    expect(body.html).toContain("one hour");
    expect(body.text).toContain("Ignore this email if you did not request");
  });

  it("rejects provider failures without including request secrets in the error", async () => {
    const send = createResendPasswordResetDelivery(
      config,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("denied", { status: 401 })),
    );

    await expect(send("owner@example.com", "one-time-token")).rejects.toThrow(
      "Password reset delivery failed.",
    );
  });

  it("rejects an aborted provider request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const send = createResendPasswordResetDelivery(config, fetcher, 1);

    await expect(send("owner@example.com", "one-time-token")).rejects.toThrow(
      "Password reset delivery failed.",
    );
  });
});
