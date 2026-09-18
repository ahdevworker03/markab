import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");
const generatedDirectories = [
  resolve(root, "lib/api-client-react/src/generated"),
  resolve(root, "lib/api-zod/src/generated"),
];

const platformSchema = resolve(
  import.meta.dirname,
  "../api-zod/src/generated/platform/platform.ts",
);
const source = await readFile(platformSchema, "utf8");
const normalized = source.replace(/(?:\r?\n){2,}$/, "\n");

if (normalized !== source) {
  await writeFile(platformSchema, normalized);
}

await run("pnpm", ["exec", "prettier", "--write", ...generatedDirectories], {
  cwd: root,
});
