import pino from "pino";
import { describe, expect, it } from "vitest";
import { LOG_REDACTION_PATHS } from "./logger";

describe("logger redaction", () => {
  it("does not serialize authentication secrets", () => {
    let output = "";
    const logger = pino(
      { redact: LOG_REDACTION_PATHS },
      {
        write: (line) => {
          output += line;
        },
      },
    );

    logger.info(
      {
        req: {
          headers: {
            authorization: "Bearer access-secret",
            cookie: "refreshToken=refresh-secret",
          },
        },
        res: { headers: { "set-cookie": "refreshToken=refresh-secret" } },
        password: "password-secret",
        refreshToken: "refresh-secret",
        token: "reset-secret",
      },
      "authentication event",
    );

    for (const secret of [
      "access-secret",
      "refresh-secret",
      "password-secret",
      "reset-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
  });
});
