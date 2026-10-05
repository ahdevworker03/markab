import { execFileSync } from "node:child_process";
import { NET_WRAPPER } from "./staging-reconnect-guard";

export default function globalTeardown(): void {
  try {
    execFileSync("sudo", ["-n", NET_WRAPPER, "unblock"], { stdio: "inherit" });
  } catch {
    console.error(
      `STAGING_RECONNECT_UNBLOCK_FAILED: run 'sudo ${NET_WRAPPER} unblock' manually.`,
    );
  }
}
