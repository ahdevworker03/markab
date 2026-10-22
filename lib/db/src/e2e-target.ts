const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const databaseName = "markab_e2e";

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];

  if (!value) {
    throw new Error(`E2E mode requires ${name}.`);
  }

  return value;
}

function normalize(url: URL): string {
  const normalized = new URL(url);

  normalized.hostname = normalized.hostname.toLowerCase();

  return normalized.toString();
}

export function validateE2eTarget(environment: NodeJS.ProcessEnv): {
  databaseUrl: string;
} {
  if (environment.NODE_ENV !== "e2e") {
    throw new Error("E2E mode requires NODE_ENV=e2e.");
  }

  const database = new URL(required(environment, "DATABASE_URL"));
  const hostname = database.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (database.protocol !== "postgresql:" || !allowedHosts.has(hostname)) {
    throw new Error("DATABASE_URL must use an approved local PostgreSQL host.");
  }

  if (database.pathname.slice(1) !== databaseName) {
    throw new Error("DATABASE_URL must name markab_e2e.");
  }

  return { databaseUrl: normalize(database) };
}
