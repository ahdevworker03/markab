import type { ChildProcess } from "node:child_process";

export function start(
  command: string,
  args: string[],
  options?: object,
): Promise<ChildProcess>;
export function stop(child?: ChildProcess): Promise<void>;
