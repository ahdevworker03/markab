import { describe, expect, it } from "vitest";
import { ApiError } from "@workspace/api-client-react";
import { isNetworkFailure } from "./network";

function apiError(status: number) {
  return new ApiError(
    new Response(null, { status, statusText: "Request failed" }),
    null,
    { method: "POST", url: "https://api.example.test/sync/push" },
  );
}

describe("isNetworkFailure", () => {
  it.each(["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."])(
    "recognizes the browser transport failure %s",
    (message) => {
      expect(isNetworkFailure(new TypeError(message))).toBe(true);
    },
  );

  it.each([400, 401, 403, 409, 422, 500])(
    "does not classify an HTTP %i response as offline",
    (status) => {
      expect(isNetworkFailure(apiError(status))).toBe(false);
    },
  );
});
