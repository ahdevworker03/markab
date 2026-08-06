import { useEffect, useRef } from "react";

/**
 * setTimeout that cleans itself up on unmount (and when `delay` changes).
 * Pass `delay = null` to disable. Prevents setState/navigation on an unmounted page.
 */
export function useTimeout(callback: () => void, delay: number | null) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => callbackRef.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
