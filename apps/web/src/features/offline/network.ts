export function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
    ].includes(error.message)
  );
}
