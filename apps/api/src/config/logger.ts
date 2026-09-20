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
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
