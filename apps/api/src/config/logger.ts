import pino from "pino";
import { env } from "./env";

const isProduction = env.NODE_ENV === "production";
export const LOG_REDACTION_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "password",
  "refreshToken",
  "token",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: LOG_REDACTION_PATHS,
  base: {
    environment: env.NODE_ENV,
    releaseId: process.env["RELEASE_ID"] ?? "unreleased",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
