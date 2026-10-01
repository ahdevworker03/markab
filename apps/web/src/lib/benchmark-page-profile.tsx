import { Profiler, useEffect, useRef, type ReactNode } from "react";

type Phase = "mount" | "update" | "nested-update";

type ProfileEvent = {
  route: string;
  type:
    | "mount"
    | "commit"
    | "summaries-ready"
    | "loaders-cleared"
    | "fallback"
    | "lazy-resolved";
  at: number;
  actualDuration?: number;
  baseDuration?: number;
};

declare global {
  interface Window {
    __benchmarkPageProfile?: ProfileEvent[];
  }
}

function record(event: ProfileEvent) {
  if (import.meta.env.MODE === "benchmark") {
    (window.__benchmarkPageProfile ??= []).push(event);
  }
}

export function BenchmarkPageProfile({
  route,
  summariesReady,
  loadersCleared,
  children,
}: {
  route: string;
  summariesReady: boolean;
  loadersCleared: boolean;
  children: ReactNode;
}) {
  const mounted = useRef(false);
  const summaryMarked = useRef(false);
  const loadersMarked = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      record({ route, type: "mount", at: performance.now() });
    }
    if (summariesReady && !summaryMarked.current) {
      summaryMarked.current = true;
      record({ route, type: "summaries-ready", at: performance.now() });
    }
    if (loadersCleared && !loadersMarked.current) {
      loadersMarked.current = true;
      record({ route, type: "loaders-cleared", at: performance.now() });
    }
  }, [loadersCleared, route, summariesReady]);

  if (import.meta.env.MODE !== "benchmark") return children;
  return (
    <Profiler
      id={route}
      onRender={(
        _id,
        _phase: Phase,
        actualDuration,
        baseDuration,
        _startTime,
        commitTime,
      ) =>
        record({
          route,
          type: "commit",
          at: commitTime,
          actualDuration,
          baseDuration,
        })
      }
    >
      {children}
    </Profiler>
  );
}
