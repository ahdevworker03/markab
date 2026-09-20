import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  removeLegacyAuthStorage,
  setAccessToken,
} from "./auth-token";

describe("in-memory access token", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAccessToken();
  });

  it("keeps the access token out of browser storage", () => {
    setAccessToken("access-token");

    expect(getAccessToken()).toBe("access-token");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("removes legacy auth keys from local and session storage", () => {
    for (const key of [
      "vrap.accessToken",
      "vrap.refreshToken",
      "vrap.accessTokenExpiresAt",
      "auth-token",
    ]) {
      localStorage.setItem(key, "legacy-secret");
      sessionStorage.setItem(key, "legacy-secret");
    }

    removeLegacyAuthStorage();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
