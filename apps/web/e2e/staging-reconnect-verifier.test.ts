import { describe, expect, it, vi } from "vitest";
import { createStagingReconnectVerifier } from "./staging-reconnect-verifier";

type Response = {
  ok(): boolean;
  status(): number;
  json(): Promise<unknown>;
};

const response = (status: number, body: unknown = {}): Response => ({
  ok: () => status >= 200 && status < 300,
  status: () => status,
  json: async () => body,
});

const endpoints = {
  loginUrl: "https://staging-api.markab-lb.com/api/auth/login",
  refreshUrl: "https://staging-api.markab-lb.com/api/auth/refresh",
  meUrl: "https://staging-api.markab-lb.com/api/auth/me",
  email: "benchmark@example.test",
  password: "not-a-real-password",
};

describe("staging reconnect verifier", () => {
  it("reuses one credential login for repeated verification requests", async () => {
    const post = vi.fn().mockResolvedValue(
      response(200, { data: { accessToken: "initial", expiresAt: "2100-01-01T00:00:00.000Z" } }),
    );
    const get = vi.fn().mockResolvedValue(
      response(200, { data: { role: "OWNER" } }),
    );
    const verifier = await createStagingReconnectVerifier(
      { post, get },
      endpoints,
    );

    await verifier.authorized((token) => Promise.resolve(token));
    await verifier.authorized((token) => Promise.resolve(token));

    expect(post).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledOnce();
  });

  it("refreshes the existing session when an authorized request is rejected", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { data: { accessToken: "initial", expiresAt: "2100-01-01T00:00:00.000Z" } }),
      )
      .mockResolvedValueOnce(
        response(200, { data: { accessToken: "renewed", expiresAt: "2100-01-01T00:00:00.000Z" } }),
      );
    const get = vi.fn().mockResolvedValue(
      response(200, { data: { role: "OWNER" } }),
    );
    const verifier = await createStagingReconnectVerifier(
      { post, get },
      endpoints,
    );
    const operation = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200));

    const result = await verifier.authorized(operation);

    expect(result.status()).toBe(200);
    expect(operation).toHaveBeenNthCalledWith(1, "initial");
    expect(operation).toHaveBeenNthCalledWith(2, "renewed");
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(endpoints.refreshUrl, {
      headers: { Origin: "https://staging.markab-lb.com" },
    });
  });

  it("refreshes before a verification request after access-token expiry", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { data: { accessToken: "expired", expiresAt: "2000-01-01T00:00:00.000Z" } }),
      )
      .mockResolvedValueOnce(
        response(200, { data: { accessToken: "renewed", expiresAt: "2100-01-01T00:00:00.000Z" } }),
      );
    const get = vi.fn().mockResolvedValue(
      response(200, { data: { role: "OWNER" } }),
    );
    const verifier = await createStagingReconnectVerifier(
      { post, get },
      endpoints,
    );
    const operation = vi.fn().mockResolvedValue(response(200));

    await verifier.authorized(operation);

    expect(operation).toHaveBeenCalledWith("renewed");
    expect(post).toHaveBeenCalledTimes(2);
  });
});
