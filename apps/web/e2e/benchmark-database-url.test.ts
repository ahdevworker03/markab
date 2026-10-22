import { describe, expect, it } from "vitest";
import { psqlDatabaseUrl } from "./benchmark-database-url";

describe("psqlDatabaseUrl", () => {
  it.each([
    [
      "removes a Prisma schema parameter",
      "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public",
      "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark",
    ],
    [
      "preserves other query parameters",
      "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?schema=public&application_name=benchmark",
      "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?application_name=benchmark",
    ],
    [
      "leaves a URL without a schema parameter unchanged",
      "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?application_name=benchmark",
      "postgresql://postgres:postgres@127.0.0.1:5432/markab_benchmark?application_name=benchmark",
    ],
    [
      "preserves encoded credentials",
      "postgresql://user%40name:pa%3Ass@127.0.0.1:5432/markab_benchmark?schema=public",
      "postgresql://user%40name:pa%3Ass@127.0.0.1:5432/markab_benchmark",
    ],
  ])("%s", (_name, input, expected) => {
    expect(psqlDatabaseUrl(input)).toBe(expected);
  });
});
