const VALID_NODE_ENVS = ["development", "production", "test"] as const;

const VALID_LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

const VALID_STORAGE_PROVIDERS = ["local", "r2"] as const;

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "https://x1gtk7w1-5173.uks1.devtunnels.ms",
] as const;

type NodeEnv = (typeof VALID_NODE_ENVS)[number];
type LogLevel = (typeof VALID_LOG_LEVELS)[number];
type StorageProviderName = (typeof VALID_STORAGE_PROVIDERS)[number];

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface PasswordResetEmailConfig {
  apiKey: string;
  from: string;
  resetUrl: URL;
}

export interface EnvConfig {
  PORT: number;
  NODE_ENV: NodeEnv;
  LOG_LEVEL: LogLevel;
  CORS_ORIGINS: string[];
  STORAGE_PROVIDER: StorageProviderName;
  STORAGE_DIR?: string;
  R2?: R2Config;
  PASSWORD_RESET_EMAIL?: PasswordResetEmailConfig;
}

function parseCorsOrigins(rawOrigins: string | undefined): string[] {
  const origins = rawOrigins
    ? rawOrigins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [...DEFAULT_CORS_ORIGINS];

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS must include at least one origin.");
  }

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (
        url.origin !== origin ||
        !["http:", "https:"].includes(url.protocol)
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(`Invalid CORS origin: "${origin}"`);
    }
  }

  return origins;
}

function requiredR2Value(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required when STORAGE_PROVIDER=r2.`);
  }

  return value;
}

function passwordResetEmailConfig(
  environment: NodeJS.ProcessEnv,
  nodeEnv: NodeEnv,
): PasswordResetEmailConfig | undefined {
  if (nodeEnv === "test") return undefined;

  const apiKey = environment["RESEND_API_KEY"]?.trim();
  const from = environment["RESEND_FROM"]?.trim();
  const origin = environment["PASSWORD_RESET_FRONTEND_ORIGIN"]?.trim();
  const path = environment["PASSWORD_RESET_FRONTEND_PATH"]?.trim();
  const values = [apiKey, from, origin, path];

  if (!values.some(Boolean)) {
    if (nodeEnv === "production") {
      throw new Error(
        "Resend password-reset email configuration is required in production.",
      );
    }
    return undefined;
  }

  if (values.some((value) => !value)) {
    throw new Error(
      "Resend password-reset email configuration must be complete.",
    );
  }

  if (!/^re_[A-Za-z0-9_]+$/.test(apiKey!)) {
    throw new Error("RESEND_API_KEY must be a valid Resend API key.");
  }

  if (
    !/^[^\r\n]+@[^\s<>]+(?:\.[^\s<>]+)+$|^[^\r\n]+<[^\s<>]+@[^\s<>]+(?:\.[^\s<>]+)+>$/.test(
      from!,
    )
  ) {
    throw new Error("RESEND_FROM must be a valid sender identity.");
  }

  let resetOrigin: URL;
  try {
    resetOrigin = new URL(origin!);
    if (
      resetOrigin.origin !== origin ||
      (nodeEnv === "production" && resetOrigin.protocol !== "https:")
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("PASSWORD_RESET_FRONTEND_ORIGIN must be a valid origin.");
  }

  if (
    !path!.startsWith("/") ||
    path!.startsWith("//") ||
    path!.includes("?") ||
    path!.includes("#")
  ) {
    throw new Error(
      "PASSWORD_RESET_FRONTEND_PATH must be an absolute path without query or fragment.",
    );
  }

  const resetUrl = new URL(path!, resetOrigin);
  if (resetUrl.origin !== resetOrigin.origin) {
    throw new Error(
      "PASSWORD_RESET_FRONTEND_PATH must remain on the configured origin.",
    );
  }

  return {
    apiKey: apiKey!,
    from: from!,
    resetUrl,
  };
}

export function loadEnv(
  environment: NodeJS.ProcessEnv = process.env,
): EnvConfig {
  const rawPort = environment["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const nodeEnv = environment["NODE_ENV"] ?? "development";

  if (!VALID_NODE_ENVS.includes(nodeEnv as NodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV value: "${nodeEnv}". Must be one of: ${VALID_NODE_ENVS.join(", ")}`,
    );
  }

  const logLevel = (environment["LOG_LEVEL"] ?? "info") as LogLevel;

  if (!VALID_LOG_LEVELS.includes(logLevel)) {
    throw new Error(
      `Invalid LOG_LEVEL value: "${logLevel}". Must be one of: ${VALID_LOG_LEVELS.join(", ")}`,
    );
  }

  const storageProvider = (environment["STORAGE_PROVIDER"] ??
    "local") as StorageProviderName;

  if (!VALID_STORAGE_PROVIDERS.includes(storageProvider)) {
    throw new Error(
      `Invalid STORAGE_PROVIDER value: "${storageProvider}". Must be one of: ${VALID_STORAGE_PROVIDERS.join(", ")}`,
    );
  }

  const r2 =
    storageProvider === "r2"
      ? {
          accountId: requiredR2Value(environment, "R2_ACCOUNT_ID"),
          accessKeyId: requiredR2Value(environment, "R2_ACCESS_KEY_ID"),
          secretAccessKey: requiredR2Value(environment, "R2_SECRET_ACCESS_KEY"),
          bucket: requiredR2Value(environment, "R2_BUCKET"),
        }
      : undefined;
  const passwordResetEmail = passwordResetEmailConfig(
    environment,
    nodeEnv as NodeEnv,
  );

  return {
    PORT: port,
    NODE_ENV: nodeEnv as NodeEnv,
    LOG_LEVEL: logLevel,
    CORS_ORIGINS: parseCorsOrigins(environment["CORS_ORIGINS"]),
    STORAGE_PROVIDER: storageProvider,
    STORAGE_DIR: environment["STORAGE_DIR"],
    R2: r2,
    PASSWORD_RESET_EMAIL: passwordResetEmail,
  };
}

export const env = loadEnv();
