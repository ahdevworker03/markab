const VALID_NODE_ENVS = ["development", "production", "test"] as const;

const VALID_LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

type NodeEnv = (typeof VALID_NODE_ENVS)[number];
type LogLevel = (typeof VALID_LOG_LEVELS)[number];

export interface EnvConfig {
  PORT: number;
  NODE_ENV: NodeEnv;
  LOG_LEVEL: LogLevel;
}

function loadEnv(): EnvConfig {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const nodeEnv = process.env["NODE_ENV"] ?? "development";

  if (!VALID_NODE_ENVS.includes(nodeEnv as NodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV value: "${nodeEnv}". Must be one of: ${VALID_NODE_ENVS.join(", ")}`,
    );
  }

  const logLevel = (process.env["LOG_LEVEL"] ?? "info") as LogLevel;

  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    throw new Error(
      `Invalid LOG_LEVEL value: "${logLevel}". Must be one of: ${VALID_LOG_LEVELS.join(", ")}`,
    );
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv as NodeEnv,
    LOG_LEVEL: logLevel,
  };
}

export const env = loadEnv();
