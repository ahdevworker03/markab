import { useEffect, useRef, useState } from "react";

export function SearchCompletionMarker({
  result,
  ready,
}: {
  result: unknown;
  ready: boolean;
}) {
  const resultRef = useRef(result);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!ready || result === resultRef.current) return;
    resultRef.current = result;
    setGeneration((value) => value + 1);
  }, [ready, result]);

  if (!generation) return null;

  return (
    <output
      data-benchmark-search-completion
      data-search-generation={generation}
      hidden
    />
  );
}
